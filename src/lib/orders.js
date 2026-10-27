import { addOrderEvent, getOrder, getOrderItems, nextOrderNumber, updateOrder, ORDER_STATUSES } from './db.js';
import { randomToken } from './util.js';
import { splitParcels } from './pricing.js';
import { getProvider } from '../shipping/providers.js';
import { trackingUrlFor } from '../shipping/common.js';
import { notifyStatus } from './notify.js';

export async function createOrder(env, { customer, priced, paymentMethod, meta }) {
  const number = await nextOrderNumber(env);
  const split = splitParcels(priced);
  const token = randomToken(16);
  const row = await env.DB.prepare(`INSERT INTO orders
    (number, token, status, payment_method, payment_status, customer_name, phone, email, county, city, address, postal_code, notes,
     subtotal, discount, shipping, cod_fee, total, utm_source, utm_medium, utm_campaign, fbclid, ttclid, fbp, ip, user_agent,
     coupon_code, coupon_discount, customer_id, fulfillment_mode, own_total, hs_total)
    VALUES (?, ?, 'noua', ?, 'neplatita', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id`)
    .bind(number, token, paymentMethod, customer.name, customer.phone, customer.email, customer.county, customer.city,
      customer.address, customer.postalCode, customer.notes, priced.subtotal, priced.discount, priced.shipping, priced.codFee,
      priced.total, meta.utm_source, meta.utm_medium, meta.utm_campaign, meta.fbclid, meta.ttclid, meta.fbp, meta.ip, meta.ua,
      priced.coupon?.ok ? priced.coupon.code : '', priced.coupon?.ok ? priced.couponDiscount : 0, meta.customerId || 0,
      split.mode, split.own, split.hs)
    .first();
  const orderId = row.id;

  const stmts = [];
  for (const l of priced.lines) {
    stmts.push(env.DB.prepare(`INSERT INTO order_items (order_id, product_id, title, sku, qty, unit_price, line_discount, total, fulfillment, unit_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(orderId, l.product.id, l.product.title + (l.isBump ? ' (ofertă la comandă)' : ''), l.product.sku || '', l.qty, l.unitPrice, l.lineDiscount, l.total, l.product.fulfillment || '', l.product.cost_price || 0));
    if (l.product.track_stock) {
      stmts.push(env.DB.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').bind(l.qty, l.product.id));
    }
  }
  stmts.push(env.DB.prepare('INSERT INTO order_events(order_id, message) VALUES (?, ?)')
    .bind(orderId, `Comandă plasată (${paymentMethod === 'card' ? 'plată cu cardul' : 'plată ramburs'})`));
  if (split.mode === 'mixt') {
    stmts.push(env.DB.prepare('INSERT INTO order_events(order_id, message) VALUES (?, ?)')
      .bind(orderId, `Comandă în 2 colete: Helpship ${(split.hs / 100).toFixed(2)} lei, colet propriu ${(split.own / 100).toFixed(2)} lei`));
  } else if (split.mode === 'helpship') {
    stmts.push(env.DB.prepare('INSERT INTO order_events(order_id, message) VALUES (?, ?)').bind(orderId, 'Comanda se livrează integral prin Helpship.'));
  }
  if (priced.coupon?.ok) {
    stmts.push(env.DB.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').bind(priced.coupon.code));
    stmts.push(env.DB.prepare('INSERT INTO order_events(order_id, message) VALUES (?, ?)')
      .bind(orderId, `Cod de reducere folosit: ${priced.coupon.code} (${priced.coupon.label})`));
  }
  await env.DB.batch(stmts);

  return { id: orderId, number, token };
}

async function restoreStock(env, orderId) {
  const items = await getOrderItems(env, orderId);
  const stmts = items.filter((i) => i.product_id).map((i) =>
    env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND track_stock = 1').bind(i.qty, i.product_id));
  if (stmts.length) await env.DB.batch(stmts);
}

const RESTOCK = new Set(['anulata', 'retur']);

// factura / storno automat (erorile nu blochează schimbarea de status)
async function invoiceSync(env, settings, orderId) {
  try { const { syncInvoice } = await import('./invoices.js'); await syncInvoice(env, settings, orderId); }
  catch (e) { console.log('factura', e?.message || e); }
}

export async function setStatus(env, settings, orderId, status, { by = 'admin', ctx = null } = {}) {
  const order = await getOrder(env, orderId);
  if (!order || !ORDER_STATUSES[status] || order.status === status) return { order };
  await updateOrder(env, orderId, { status });
  await addOrderEvent(env, orderId, `Status: ${ORDER_STATUSES[order.status]} → ${ORDER_STATUSES[status]}${by === 'admin' ? '' : ` (${by})`}`);
  if (RESTOCK.has(status) && !RESTOCK.has(order.status)) {
    await restoreStock(env, orderId);
    await addOrderEvent(env, orderId, 'Stocul produselor a fost readăugat.');
  }
  if (order.fulfillment_mode && order.fulfillment_mode !== 'own') {
    const hs = await import('./helpship.js');
    if (status === 'confirmata' && !order.hs_order_id) await hs.sendToHelpship(env, settings, orderId).catch(() => {});
    if (status === 'anulata') await hs.cancelAtHelpship(env, orderId).catch(() => {});
  }
  await invoiceSync(env, settings, orderId);
  let awbResult = null;
  if (status === 'confirmata' && settings.auto_awb_on_confirm === '1' && !order.awb && order.fulfillment_mode !== 'helpship') {
    awbResult = await generateAwb(env, settings, orderId, { ctx });
  }
  const updated = await getOrder(env, orderId);
  // email către client (confirmată / expediată / livrată / anulată / retur)
  if (!(awbResult && awbResult.ok && awbResult.awb)) { // dacă s-a generat AWB, emailul „expediată" pleacă din generateAwb
    const p = notifyStatus(env, settings, updated);
    if (ctx) ctx.waitUntil(p); else await p;
  }
  return { order: updated, awbResult };
}

export async function generateAwb(env, settings, orderId, { ctx = null } = {}) {
  const order = await getOrder(env, orderId);
  if (!order) return { ok: false, error: 'Comanda nu există.' };
  if (order.awb) return { ok: false, error: `Comanda are deja AWB-ul ${order.awb}.` };
  if (order.payment_method === 'card' && order.payment_status !== 'platita') {
    return { ok: false, error: 'Comanda cu cardul nu este încă plătită.' };
  }
  if (order.fulfillment_mode === 'helpship') return { ok: false, error: 'Comanda se livrează prin Helpship; AWB-ul îl generează depozitul.' };
  const provider = getProvider(settings.shipping_provider);
  let items = await getOrderItems(env, orderId);
  const parcel = order.fulfillment_mode === 'mixt' ? { ...order, total: order.own_total } : order;
  if (order.fulfillment_mode === 'mixt') items = items.filter((i) => i.fulfillment !== 'helpship');
  // greutatea produselor, pentru calculul coletului
  const ids = items.map((i) => i.product_id).filter(Boolean);
  if (ids.length) {
    const { results } = await env.DB.prepare(`SELECT id, weight_g, length_cm, width_cm, height_cm FROM products WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    const w = new Map((results || []).map((r) => [r.id, r]));
    for (const i of items) {
      const p = w.get(i.product_id) || {};
      i.weight_g = p.weight_g || 500; i.length_cm = p.length_cm || 0; i.width_cm = p.width_cm || 0; i.height_cm = p.height_cm || 0;
    }
  }
  try {
    const r = await provider.create(env, settings, parcel, items);
    if (r.pending) {
      await updateOrder(env, orderId, { shipping_provider: provider.id, shipping_error: '' });
      await addOrderEvent(env, orderId, r.message || 'Trimisă către furnizorul de livrare.');
      return { ok: true, pending: true, message: r.message };
    }
    await updateOrder(env, orderId, {
      shipping_provider: provider.id, awb: r.awb, courier: r.courier || '',
      tracking_url: r.trackingUrl || trackingUrlFor(r.courier, r.awb), label_url: r.labelUrl || '', shipping_error: '',
    });
    await addOrderEvent(env, orderId, `AWB generat: ${r.awb}${r.courier ? ` (${r.courier})` : ''}`);
    if (order.status === 'noua' || order.status === 'confirmata') {
      await updateOrder(env, orderId, { status: 'expediata' });
      await addOrderEvent(env, orderId, `Status: ${ORDER_STATUSES[order.status]} → Expediată`);
      await invoiceSync(env, settings, orderId);
      const p = notifyStatus(env, settings, await getOrder(env, orderId));
      if (ctx) ctx.waitUntil(p); else await p;
    }
    return { ok: true, awb: r.awb };
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 500);
    await updateOrder(env, orderId, { shipping_error: msg });
    await addOrderEvent(env, orderId, `Eroare la generarea AWB: ${msg}`);
    return { ok: false, error: msg };
  }
}

export async function cancelAwb(env, settings, orderId) {
  const order = await getOrder(env, orderId);
  if (!order?.awb) return { ok: false, error: 'Comanda nu are AWB.' };
  try {
    await getProvider(order.shipping_provider || settings.shipping_provider).cancel(env, settings, order);
  } catch (e) {
    await addOrderEvent(env, orderId, `Anularea la curier a eșuat: ${e.message}. AWB-ul a fost șters doar din magazin.`);
  }
  await updateOrder(env, orderId, { awb: '', courier: '', tracking_url: '', label_url: '', shipping_status: '' });
  await addOrderEvent(env, orderId, `AWB ${order.awb} anulat.`);
  return { ok: true };
}

export async function setManualAwb(env, orderId, awb, courier, { ctx = null } = {}) {
  awb = String(awb || '').trim();
  courier = String(courier || '').trim();
  const before = await getOrder(env, orderId);
  await updateOrder(env, orderId, { awb, courier, tracking_url: trackingUrlFor(courier, awb), shipping_error: '' });
  await addOrderEvent(env, orderId, awb ? `AWB setat manual: ${awb}${courier ? ` (${courier})` : ''}` : 'AWB șters manual.');
  if (!awb || before?.awb) return;
  // primul AWB: comanda devine „Expediată” și clientul primește emailul „confirmată și pe drum”, cu AWB-ul
  const { getSettings } = await import('./db.js');
  const settings = await getSettings(env);
  if (['noua', 'confirmata'].includes(before.status)) await setStatus(env, settings, orderId, 'expediata', { ctx });
  else if (before.status === 'expediata') {
    const p = notifyStatus(env, settings, await getOrder(env, orderId));
    if (ctx) ctx.waitUntil(p); else await p;
  }
}

export async function markPaid(env, orderId, sessionId) {
  const order = await getOrder(env, orderId);
  if (!order || order.payment_status === 'platita') return order;
  await updateOrder(env, orderId, { payment_status: 'platita', stripe_session_id: sessionId || order.stripe_session_id });
  await addOrderEvent(env, orderId, 'Plata cu cardul a fost confirmată de Stripe.');
  if (order.fulfillment_mode && order.fulfillment_mode !== 'own') {
    const { getSettings } = await import('./db.js');
    const settings = await getSettings(env);
    if (settings.helpship_send !== 'confirmed') await (await import('./helpship.js')).sendToHelpship(env, settings, orderId).catch(() => {});
  }
  return getOrder(env, orderId);
}

// Ștergere definitivă (pentru comenzi de test): stocul revine, comanda se anulează la Helpship, facturile ei se șterg.
export async function deleteOrder(env, settings, orderId) {
  const order = await getOrder(env, orderId);
  if (!order) return { ok: false, error: 'Comanda nu există.' };
  if (!RESTOCK.has(order.status)) await restoreStock(env, orderId);
  if (order.hs_order_id && order.status !== 'anulata') {
    const hs = await import('./helpship.js');
    await hs.cancelAtHelpship(env, orderId).catch(() => {});
  }
  const inv = await import('./invoices.js');
  await inv.deleteOrderInvoices(env, settings, orderId);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM order_events WHERE order_id = ?').bind(orderId),
    env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(orderId),
    env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(orderId),
  ]);
  return { ok: true, number: order.number };
}
