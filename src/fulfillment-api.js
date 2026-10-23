import { json } from './lib/util.js';
import { timingSafeEqual } from './lib/auth.js';
import { getOrderItems, updateOrder, addOrderEvent, ORDER_STATUSES } from './lib/db.js';
import { setStatus } from './lib/orders.js';
import { getSettings } from './lib/db.js';
import { trackingUrlFor } from './shipping/common.js';

/*
  API pentru depozitul partener (ex. Helpship, sau orice firmă de fulfillment / ERP).
  Autentificare: header  Authorization: Bearer <WAREHOUSE_API_KEY>

  GET  /api/fulfillment/orders?status=confirmata&since=2026-10-01   -> comenzile de pregătit
  GET  /api/fulfillment/orders/CHI-1001                              -> o comandă
  POST /api/fulfillment/orders/CHI-1001  {"awb":"...","courier":"FAN Courier","status":"expediata"}
  GET  /api/fulfillment/products                                     -> SKU + stoc
  POST /api/fulfillment/stock  [{"sku":"CHI-LMP-01","stock":120}]    -> actualizează stocul din depozit
*/

function serializeOrder(o, items) {
  return {
    number: o.number,
    status: o.status,
    created_at: o.created_at,
    payment_method: o.payment_method,
    payment_status: o.payment_status,
    cod_amount: o.payment_method === 'ramburs' && o.payment_status !== 'platita' ? o.total / 100 : 0,
    total: o.total / 100,
    currency: 'RON',
    customer: {
      name: o.customer_name, phone: o.phone, email: o.email,
      county: o.county, city: o.city, address: o.address, postal_code: o.postal_code, country: 'RO',
    },
    notes: o.notes,
    items: items.map((i) => ({ sku: i.sku, name: i.title, qty: i.qty, unit_price: i.unit_price / 100, total: i.total / 100 })),
    shipping: { awb: o.awb, courier: o.courier, tracking_url: o.tracking_url },
  };
}

export async function handleFulfillmentApi(request, env, path) {
  const auth = request.headers.get('authorization') || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.WAREHOUSE_API_KEY || !key || !timingSafeEqual(key, env.WAREHOUSE_API_KEY)) {
    return json({ error: 'unauthorized' }, 401);
  }
  const url = new URL(request.url);
  const method = request.method;
  let m;

  if (method === 'GET' && path === '/api/fulfillment/orders') {
    const status = url.searchParams.get('status') || 'confirmata';
    const since = url.searchParams.get('since') || '2000-01-01';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
    if (!ORDER_STATUSES[status]) return json({ error: 'status invalid', allowed: Object.keys(ORDER_STATUSES) }, 400);
    const { results } = await env.DB.prepare(
      `SELECT * FROM orders WHERE status = ? AND created_at >= ?
       AND NOT (payment_method = 'card' AND payment_status != 'platita')
       ORDER BY id ASC LIMIT ?`).bind(status, since, limit).all();
    const out = [];
    for (const o of results || []) out.push(serializeOrder(o, await getOrderItems(env, o.id)));
    return json({ orders: out });
  }

  if ((m = path.match(/^\/api\/fulfillment\/orders\/(CHI-\d+)$/))) {
    const order = await env.DB.prepare('SELECT * FROM orders WHERE number = ?').bind(m[1]).first();
    if (!order) return json({ error: 'not found' }, 404);

    if (method === 'GET') return json(serializeOrder(order, await getOrderItems(env, order.id)));

    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const fields = {};
      if (body.awb !== undefined) {
        fields.awb = String(body.awb).slice(0, 60);
        fields.courier = String(body.courier || order.courier || '').slice(0, 60);
        fields.tracking_url = String(body.tracking_url || trackingUrlFor(fields.courier, fields.awb)).slice(0, 300);
        fields.shipping_error = '';
      }
      if (body.shipping_status) fields.shipping_status = String(body.shipping_status).slice(0, 120);
      if (Object.keys(fields).length) {
        await updateOrder(env, order.id, fields);
        if (fields.awb) await addOrderEvent(env, order.id, `Depozit: AWB ${fields.awb}${fields.courier ? ` (${fields.courier})` : ''}`);
      }
      let status = body.status;
      if (!status && fields.awb && (order.status === 'noua' || order.status === 'confirmata')) status = 'expediata';
      if (status) {
        if (!ORDER_STATUSES[status]) return json({ error: 'status invalid', allowed: Object.keys(ORDER_STATUSES) }, 400);
        await setStatus(env, await getSettings(env), order.id, status, { by: 'depozit' });
      }
      const updated = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(order.id).first();
      return json(serializeOrder(updated, await getOrderItems(env, order.id)));
    }
  }

  if (method === 'GET' && path === '/api/fulfillment/products') {
    const { results } = await env.DB.prepare('SELECT id, sku, title, stock, weight_g, active FROM products ORDER BY id').all();
    return json({ products: results || [] });
  }

  if (method === 'POST' && path === '/api/fulfillment/stock') {
    const body = await request.json().catch(() => []);
    const list = Array.isArray(body) ? body : body.items || [];
    const stmts = list.filter((r) => r.sku && Number.isFinite(Number(r.stock)))
      .map((r) => env.DB.prepare('UPDATE products SET stock = ?, updated_at = datetime(\'now\') WHERE sku = ?').bind(Math.max(0, Math.floor(r.stock)), String(r.sku)));
    if (stmts.length) await env.DB.batch(stmts);
    return json({ received: stmts.length });
  }

  return json({ error: 'not found' }, 404);
}
