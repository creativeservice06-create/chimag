import { addOrderEvent, getOrder, getOrderItems, nextOrderNumber, updateOrder, ORDER_STATUSES } from './db.js';
import { randomToken } from './util.js';
import { getProvider } from '../shipping/providers.js';
import { trackingUrlFor } from '../shipping/common.js';

export async function createOrder(env, { customer, priced, paymentMethod, meta }) {
  const number = await nextOrderNumber(env);
  const token = randomToken(16);
  const row = await env.DB.prepare(`INSERT INTO orders
    (number, token, status, payment_method, payment_status, customer_name, phone, email, county, city, address, postal_code, notes,
     subtotal, discount, shipping, cod_fee, total, utm_source, utm_medium, utm_campaign, fbclid, ttclid, fbp, ip, user_agent)
    VALUES (?, ?, 'noua', ?, 'neplatita', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id`)
    .bind(number, token, paymentMethod, customer.name, customer.phone, customer.email, customer.county, customer.city,
      customer.address, customer.postalCode, customer.notes, priced.subtotal, priced.discount, priced.shipping, priced.codFee,
      priced.total, meta.utm_source, meta.utm_medium, meta.utm_campaign, meta.fbclid, meta.ttclid, meta.fbp, meta.ip, meta.ua)
    .first();
  const orderId = row.id;

  const stmts = [];
  for (const l of priced.lines) {
    stmts.push(env.DB.prepare(`INSERT INTO order_items (order_id, product_id, title, sku, qty, unit_price, line_discount, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(orderId, l.product.id, l.product.title + (l.isBump ? ' (ofertă la comandă)' : ''), l.product.sku || '', l.qty, l.unitPrice, l.lineDiscount, l.total));
    if (l.product.track_stock) {
      stmts.push(env.DB.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').bind(l.qty, l.product.id));
    }
  }
  stmts.push(env.DB.prepare('INSERT INTO order_events(order_id, message) VALUES (?, ?)')
    .bind(orderId, `Comandă plasată (${paymentMethod === 'card' ? 'plată cu cardul' : 'plată ramburs'})`));
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

export async function setStatus(env, settings, orderId, status, { by = 'admin' } = {}) {
  const order = await getOrder(env, orderId);
  if (!order || !ORDER_STATUSES[status] || order.status === status) return { order };
  await updateOrder(env, orderId, { status });
  await addOrderEvent(env, orderId, `Status: ${ORDER_STATUSES[order.status]} → ${ORDER_STATUSES[status]}${by === 'admin' ? '' : ` (${by})`}`);
  if (RESTOCK.has(status) && !RESTOCK.has(order.status)) {
    await restoreStock(env, orderId);
    await addOrderEvent(env, orderId, 'Stocul produselor a fost readăugat.');
  }
  let awbResult = null;
  if (status === 'confirmata' && settings.auto_awb_on_confirm === '1' && !order.awb) {
    awbResult = await generateAwb(env, settings, orderId);
  }
  return { order: await getOrder(env, orderId), awbResult };
}

export async function generateAwb(env, settings, orderId) {
  const order = await getOrder(env, orderId);
  if (!order) return { ok: false, error: 'Comanda nu există.' };
  if (order.awb) return { ok: false, error: `Comanda are deja AWB-ul ${order.awb}.` };
  if (order.payment_method === 'card' && order.payment_status !== 'platita') {
    return { ok: false, error: 'Comanda cu cardul nu este încă plătită.' };
  }
  const provider = getProvider(settings.shipping_provider);
  const items = await getOrderItems(env, orderId);
  // greutatea produselor, pentru calculul coletului
  const ids = items.map((i) => i.product_id).filter(Boolean);
  if (ids.length) {
    const { results } = await env.DB.prepare(`SELECT id, weight_g FROM products WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    const w = new Map((results || []).map((r) => [r.id, r.weight_g]));
    for (const i of items) i.weight_g = w.get(i.product_id) || 500;
  }
  try {
    const r = await provider.create(env, settings, order, items);
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

export async function setManualAwb(env, orderId, awb, courier) {
  awb = String(awb || '').trim();
  courier = String(courier || '').trim();
  await updateOrder(env, orderId, { awb, courier, tracking_url: trackingUrlFor(courier, awb), shipping_error: '' });
  await addOrderEvent(env, orderId, awb ? `AWB setat manual: ${awb}${courier ? ` (${courier})` : ''}` : 'AWB șters manual.');
}

export async function markPaid(env, orderId, sessionId) {
  const order = await getOrder(env, orderId);
  if (!order || order.payment_status === 'platita') return order;
  await updateOrder(env, orderId, { payment_status: 'platita', stripe_session_id: sessionId || order.stripe_session_id });
  await addOrderEvent(env, orderId, 'Plata cu cardul a fost confirmată de Stripe.');
  return getOrder(env, orderId);
}
