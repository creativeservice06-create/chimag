import { parseJSON } from './util.js';

// ---------- Setări ----------
const DEFAULTS = {
  store_name: 'Chimag', tagline: '', phone: '', email: '', hours: '',
  company_name: '', company_cui: '', company_reg: '', company_address: '',
  shipping_cost: '1999', free_shipping_threshold: '14900', cod_fee: '0',
  delivery_text: 'Livrare în 24–48h prin curier', return_days: '14', announcement: '',
  bump_product_id: '', bump_discount_pct: '20', fb_pixel_id: '', tiktok_pixel_id: '',
  shipping_provider: 'test', auto_awb_on_confirm: '0', card_enabled: '0',
  sender_name: '', sender_phone: '', sender_county: '', sender_city: '', sender_address: '',
  parcel_contents: 'Produse diverse',
  contact_email: '', notify_orders: '1', accounts_enabled: '1', customer_emails: '1', whatsapp: '', facebook_url: '', instagram_url: '', tiktok_url: '',
};

export async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULTS };
  for (const r of results || []) s[r.key] = r.value ?? '';
  return s;
}

export async function saveSettings(env, values) {
  const stmts = Object.entries(values).map(([k, v]) =>
    env.DB.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .bind(k, String(v ?? '')));
  if (stmts.length) await env.DB.batch(stmts);
}

// ---------- Produse ----------
export function hydrateProduct(p) {
  if (!p) return null;
  return {
    ...p,
    images: parseJSON(p.images, []),
    benefits: parseJSON(p.benefits, []),
    faq: parseJSON(p.faq, []),
    bundles: parseJSON(p.bundles, []),
    sections: parseJSON(p.sections, []),
    specs: parseJSON(p.specs, []),
  };
}

export async function listProducts(env, { activeOnly = true } = {}) {
  const sql = `SELECT * FROM products ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY sort ASC, id DESC`;
  const { results } = await env.DB.prepare(sql).all();
  return (results || []).map(hydrateProduct);
}

export async function getProductBySlug(env, slug) {
  return hydrateProduct(await env.DB.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').bind(slug).first());
}

export async function getProductById(env, id) {
  return hydrateProduct(await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first());
}

export async function getProductsByIds(env, ids) {
  if (!ids.length) return [];
  const q = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT * FROM products WHERE id IN (${q})`).bind(...ids).all();
  return (results || []).map(hydrateProduct);
}

export async function getReviews(env, productId) {
  const { results } = await env.DB
    .prepare('SELECT * FROM reviews WHERE product_id = ? AND approved = 1 ORDER BY id DESC LIMIT 50')
    .bind(productId).all();
  return results || [];
}

// ---------- Comenzi ----------
export async function nextOrderNumber(env) {
  const row = await env.DB
    .prepare("UPDATE counters SET value = value + 1 WHERE name = 'order_number' RETURNING value")
    .first();
  return `CHI-${row.value}`;
}

export async function addOrderEvent(env, orderId, message) {
  await env.DB.prepare('INSERT INTO order_events(order_id, message) VALUES (?, ?)').bind(orderId, message).run();
}

export async function getOrder(env, id) {
  return env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
}

export async function getOrderItems(env, orderId) {
  const { results } = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').bind(orderId).all();
  return results || [];
}

export async function updateOrder(env, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(', ');
  await env.DB.prepare(`UPDATE orders SET ${set}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...keys.map((k) => fields[k]), id).run();
}

export const ORDER_STATUSES = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  expediata: 'Expediată',
  livrata: 'Livrată',
  refuzata: 'Refuzată',
  retur: 'Retur',
  anulata: 'Anulată',
};

export const PAYMENT_STATUSES = {
  neplatita: 'Neplătită',
  platita: 'Plătită',
  esuata: 'Plată eșuată',
  rambursata: 'Rambursată',
};
