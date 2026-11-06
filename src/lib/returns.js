// Cereri de retur (dreptul de retragere în 14 zile): clientul le trimite din site, noi le gestionăm din admin.
import { getOrder, getOrderItems, addOrderEvent } from './db.js';

// adresa la care clientul trimite coletul (depozitul Helpship)
export const RETURN_ADDRESS = {
  name: 'Helpship-Hard Service SRL retur',
  street: 'Str. Anghel I. Saligny nr. 40',
  city: 'Oradea',
  county: 'Bihor',
  zip: '410085',
  country: 'România',
};
export const returnAddressLines = () => [RETURN_ADDRESS.name, RETURN_ADDRESS.street, `${RETURN_ADDRESS.city}, jud. ${RETURN_ADDRESS.county}, ${RETURN_ADDRESS.zip}`, RETURN_ADDRESS.country];

export const RETURN_STATUSES = { noua: 'Cerere nouă', primita: 'Colet primit', rambursata: 'Bani returnați', respinsa: 'Respinsă' };
export const RETURN_REASONS = ['M-am răzgândit', 'Nu corespunde descrierii', 'Produs defect sau deteriorat', 'Am primit alt produs', 'Altul'];
export const WINDOW_DAYS = 14;
export const returnWindow = (settings) => Math.max(14, Number(settings?.return_days) || 14);

const parse = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
export const cleanIban = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const validIban = (s) => /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s) && (!s.startsWith('RO') || s.length === 24);
export const fmtIban = (s) => String(s || '').replace(/(.{4})/g, '$1 ').trim();

export async function getReturnsForOrder(env, orderId) {
  const { results } = await env.DB.prepare('SELECT * FROM returns WHERE order_id = ? ORDER BY id DESC').bind(orderId).all();
  return (results || []).map((r) => ({ ...r, items: parse(r.items) }));
}

export async function getReturn(env, id) {
  const r = await env.DB.prepare('SELECT * FROM returns WHERE id = ?').bind(id).first();
  return r ? { ...r, items: parse(r.items) } : null;
}

export async function listReturns(env, status = '') {
  const where = status ? 'WHERE r.status = ?' : '';
  const stmt = env.DB.prepare(`SELECT r.*, o.number, o.customer_name, o.phone, o.email, o.city, o.county, o.total AS order_total, o.status AS order_status
    FROM returns r JOIN orders o ON o.id = r.order_id ${where} ORDER BY CASE r.status WHEN 'noua' THEN 0 WHEN 'primita' THEN 1 ELSE 2 END, r.id DESC LIMIT 200`);
  const { results } = await (status ? stmt.bind(status) : stmt).all();
  return (results || []).map((r) => ({ ...r, items: parse(r.items) }));
}

export async function countOpenReturns(env) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM returns WHERE status IN ('noua', 'primita')").first().catch(() => null);
  return r?.n || 0;
}

// data livrării: prima trecere a comenzii pe „Livrată” din istoric
export async function deliveredAt(env, order) {
  const e = await env.DB.prepare("SELECT created_at FROM order_events WHERE order_id = ? AND message LIKE '%→ Livrată%' ORDER BY id LIMIT 1").bind(order.id).first().catch(() => null);
  return e?.created_at || (order.status === 'livrata' ? order.updated_at : '');
}

// poate clientul trimite acum o cerere de retur pentru comanda asta?
export async function eligibility(env, order, days = WINDOW_DAYS) {
  if (['anulata', 'refuzata'].includes(order.status)) return { ok: false, why: 'anulata' };
  if (order.status === 'noua' || order.status === 'confirmata') return { ok: true, before: true };
  const d = await deliveredAt(env, order);
  if (!d) return { ok: true };
  const age = (Date.now() - new Date(d.replace(' ', 'T') + 'Z').getTime()) / 864e5;
  const until = new Date(new Date(d.replace(' ', 'T') + 'Z').getTime() + days * 864e5);
  return age <= days ? { ok: true, delivered: d, until, days } : { ok: false, why: 'expirat', delivered: d, until, days };
}

// suma de returnat: produsele alese (cu reducerile proporționale); la retur complet, toată comanda inclusiv transportul
export function refundAmount(order, items, chosen) {
  const sub = items.reduce((s, i) => s + i.total, 0) || 1;
  const pick = chosen.reduce((s, c) => { const it = items.find((i) => i.id === c.id); return it ? s + Math.round((it.total * c.qty) / it.qty) : s; }, 0);
  const full = items.every((i) => (chosen.find((c) => c.id === i.id)?.qty || 0) >= i.qty);
  if (full) return { amount: order.total, full: true };
  const net = Math.max(0, order.subtotal - (order.discount || 0) - (order.coupon_discount || 0));
  return { amount: Math.round((pick * net) / sub), full: false };
}

export async function createReturn(env, order, data) {
  const items = await getOrderItems(env, order.id);
  const chosen = data.items.filter((c) => items.some((i) => i.id === c.id) && c.qty > 0).map((c) => {
    const it = items.find((i) => i.id === c.id);
    return { id: it.id, title: it.title, sku: it.sku || '', qty: Math.min(c.qty, it.qty), of: it.qty };
  });
  if (!chosen.length) throw new Error('Alege cel puțin un produs pe care vrei să-l returnezi.');
  const { amount, full } = refundAmount(order, items, chosen);
  const r = await env.DB.prepare(`INSERT INTO returns (order_id, items, amount, full_return, reason, message, iban, holder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(order.id, JSON.stringify(chosen), amount, full ? 1 : 0, data.reason.slice(0, 80), data.message.slice(0, 1000), data.iban, data.holder.slice(0, 120)).run();
  const id = r.meta?.last_row_id;
  await addOrderEvent(env, order.id, `Cerere de retur R-${id} trimisă de client din site: ${chosen.map((c) => `${c.qty} x ${c.title}`).join(', ')}${full ? ' (toată comanda)' : ''}.`);
  return getReturn(env, id);
}

export async function setReturnStatus(env, id, status, note = '') {
  const r = await getReturn(env, id);
  if (!r || !RETURN_STATUSES[status]) return null;
  const extra = status === 'primita' ? ", received_at = datetime('now')" : status === 'rambursata' ? ", refunded_at = datetime('now')" : '';
  await env.DB.prepare(`UPDATE returns SET status = ?, admin_note = CASE WHEN ? != '' THEN ? ELSE admin_note END, updated_at = datetime('now')${extra} WHERE id = ?`).bind(status, note, note, id).run();
  await addOrderEvent(env, r.order_id, `Retur R-${id}: ${RETURN_STATUSES[status]}${note ? ` (${note})` : ''}.`);
  return getReturn(env, id);
}

export { getOrder };
