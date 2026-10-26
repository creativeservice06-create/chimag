import { getSettings, getOrder, getOrderItems, updateOrder, addOrderEvent } from './db.js';
import { setStatus } from './orders.js';
import { trackingUrlFor } from '../shipping/common.js';
import { notifyParcelShipped } from './notify.js';

/*
  Legătura cu Helpship (https://helpship-api.azurewebsites.net/docs, API v2).
  Secrete în Cloudflare (Worker → Settings → Variables and Secrets):
    HELPSHIP_CLIENT_ID, HELPSHIP_CLIENT_SECRET  – date OAuth2 (client credentials)
    HELPSHIP_ACCOUNT_ID                          – contul nostru de client în Helpship (accountId)
  Opțional: HELPSHIP_API_URL, HELPSHIP_TOKEN_URL (ex. pentru mediul de test).
  Fără aceste secrete legătura este oprită și nu se trimite nimic.
*/
const API = (env) => (env.HELPSHIP_API_URL || 'https://helpship-api.azurewebsites.net').replace(/\/$/, '');
const TOKEN_URL = (env) => env.HELPSHIP_TOKEN_URL || 'https://helpship-auth.azurewebsites.net/connect/token';

export const helpshipEnabled = (env) => !!(env.HELPSHIP_CLIENT_ID && env.HELPSHIP_CLIENT_SECRET && env.HELPSHIP_ACCOUNT_ID);

let tokenCache = { value: '', exp: 0 };
async function token(env) {
  if (tokenCache.value && tokenCache.exp > Date.now() + 60e3) return tokenCache.value;
  const r = await fetch(TOKEN_URL(env), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.HELPSHIP_CLIENT_ID, client_secret: env.HELPSHIP_CLIENT_SECRET, scope: 'helpship.api' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`autentificare Helpship eșuată (${r.status}${j.error ? ` ${j.error}` : ''})`);
  tokenCache = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return tokenCache.value;
}

async function api(env, method, path, body) {
  const r = await fetch(API(env) + path, {
    method,
    headers: { authorization: `Bearer ${await token(env)}`, accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* răspuns text */ }
  if (!r.ok) throw new Error(`Helpship ${method} ${path}: ${r.status} ${typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// listele pot veni ca [..] sau ca { items | data | results: [..] }
const asList = (d) => (Array.isArray(d) ? d : d?.items || d?.data || d?.results || d?.value || []);

async function romaniaId(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'helpship_country_ro'").first();
  if (row?.value) return row.value;
  const list = asList(await api(env, 'GET', '/api/Country?Alpha2Code=RO&Limit=5'));
  const ro = list.find((c) => String(c.alpha2Code || c.Alpha2Code || '').toUpperCase() === 'RO') || list[0];
  const id = ro?.id || ro?.Id || '';
  if (!id) throw new Error('nu am găsit România în lista de țări Helpship');
  await env.DB.prepare("INSERT INTO settings(key, value) VALUES ('helpship_country_ro', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(id).run();
  return id;
}

export function buildOrderPayload(env, order, items, countryId) {
  const mine = order.fulfillment_mode === 'mixt' ? items.filter((i) => i.fulfillment === 'helpship') : items;
  const parts = String(order.customer_name || '').trim().split(/\s+/);
  const paid = order.payment_status === 'platita';
  const amount = (order.fulfillment_mode === 'mixt' ? order.hs_total : order.total) / 100;
  const lines = mine.reduce((sum, i) => sum + i.total, 0) / 100;
  const diff = Math.round((amount - lines) * 100) / 100; // transport (+) sau reducere din cod (−) pentru acest colet
  return {
    accountId: env.HELPSHIP_ACCOUNT_ID,
    externalId: order.number,
    name: order.number,
    placedOn: new Date(order.created_at.replace(' ', 'T') + 'Z').toISOString(),
    totalPrice: amount, // suma comenzii pentru acest colet (la ramburs = de încasat de curier)
    currency: 'RON',
    shippingPrice: diff > 0 ? diff : 0,
    discountPrice: diff < 0 ? -diff : 0,
    paymentStatus: paid ? 'Paid' : 'Pending',
    customerNote: order.notes || null,
    shopOwnerNote: order.fulfillment_mode === 'mixt' ? 'Comanda are 2 colete; acesta conține doar produsele Helpship.' : null,
    mailingAddress: {
      firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || parts[0] || '',
      addressLine1: order.address, city: order.city, province: order.county, zip: order.postal_code || null,
      countryId, phone: order.phone, email: order.email || null,
    },
    orderLines: mine.map((i) => ({
      orderId: '00000000-0000-0000-0000-000000000000',
      name: i.title, externalSku: i.sku || null, quantity: i.qty,
      price: Math.round(i.total / i.qty) / 100, externalId: String(i.id),
    })),
  };
}

// Trimite comanda (sau coletul Helpship al ei) în sistemul Helpship. Se poate apela de mai multe ori: nu dublează.
export async function sendToHelpship(env, settings, orderId, { force = false } = {}) {
  if (!helpshipEnabled(env)) return { ok: false, error: 'Legătura cu Helpship nu este configurată (lipsesc datele de acces în Cloudflare).' };
  const order = await getOrder(env, orderId);
  if (!order || order.fulfillment_mode === 'own') return { ok: false, error: 'Comanda nu are produse livrate prin Helpship.' };
  if (order.hs_order_id && !force) return { ok: true, already: true };
  if (order.status === 'anulata') return { ok: false, error: 'Comanda este anulată.' };
  if (order.payment_method === 'card' && order.payment_status !== 'platita') return { ok: false, error: 'Comanda cu cardul nu este încă plătită.' };
  try {
    const payload = buildOrderPayload(env, order, await getOrderItems(env, orderId), await romaniaId(env));
    const res = await api(env, 'POST', '/api/Order', payload);
    const id = (typeof res === 'string' ? res.replace(/"/g, '') : res?.id || res?.Id || res?.orderId || '') || '';
    await updateOrder(env, orderId, { hs_order_id: String(id).slice(0, 80) || 'trimisa', hs_sent_at: new Date().toISOString().slice(0, 19).replace('T', ' '), hs_status: 'Trimisă la depozit', hs_error: '' });
    await addOrderEvent(env, orderId, `Trimisă la Helpship${id ? ` (id ${id})` : ''}.`);
    return { ok: true, id };
  } catch (e) {
    await updateOrder(env, orderId, { hs_error: String(e.message).slice(0, 300) });
    await addOrderEvent(env, orderId, `Helpship: eroare la trimitere – ${String(e.message).slice(0, 200)}`);
    return { ok: false, error: e.message };
  }
}

// caută în răspuns numărul AWB și curierul (câmpurile pot avea nume diferite)
function findTracking(o) {
  if (!o || typeof o !== 'object') return {};
  let awb = '', courier = '', status = '';
  const walk = (x, depth) => {
    if (!x || typeof x !== 'object' || depth > 3) return;
    for (const [k, v] of Object.entries(x)) {
      if (typeof v === 'string' || typeof v === 'number') {
        if (!awb && /^(trackingNumber|trackingCode|awb|awbNumber)$/i.test(k) && String(v).trim()) awb = String(v).trim();
        if (!courier && /^(carrierName|courierName|deliveryServiceName|carrier|courier)$/i.test(k) && String(v).trim()) courier = String(v).trim();
        if (!status && /^(trackingStatus|status)$/i.test(k)) status = String(v);
      } else walk(v, depth + 1);
    }
  };
  walk(o, 0);
  return { awb, courier, status };
}

const DONE = { Delivered: 'livrata', Returned: 'retur' };

// Rulează din cron: trimite comenzile rămase netrimise și aduce AWB-ul / statusul pentru cele trimise.
export async function syncHelpship(env) {
  if (!helpshipEnabled(env)) return;
  const settings = await getSettings(env);
  const sendWhen = settings.helpship_send === 'confirmed' ? "status = 'confirmata'" : "status IN ('noua', 'confirmata')";
  const { results: pending } = await env.DB.prepare(`SELECT id FROM orders WHERE fulfillment_mode != 'own' AND hs_order_id = '' AND ${sendWhen}
    AND NOT (payment_method = 'card' AND payment_status != 'platita') AND created_at > datetime('now', '-7 days') ORDER BY id LIMIT 20`).all();
  for (const r of pending || []) await sendToHelpship(env, settings, r.id).catch(() => {});

  const { results: sent } = await env.DB.prepare(`SELECT * FROM orders WHERE fulfillment_mode != 'own' AND hs_order_id NOT IN ('', 'trimisa')
    AND status NOT IN ('anulata', 'livrata', 'retur') AND created_at > datetime('now', '-30 days') ORDER BY updated_at ASC LIMIT 25`).all();
  for (const order of sent || []) {
    try {
      const t = findTracking(await api(env, 'GET', `/api/Order/${order.hs_order_id}`));
      const fields = {};
      if (t.status && t.status !== order.hs_status) fields.hs_status = t.status.slice(0, 40);
      if (t.awb && t.awb !== (order.fulfillment_mode === 'mixt' ? order.hs_awb : order.awb)) {
        const url = trackingUrlFor(t.courier, t.awb);
        if (order.fulfillment_mode === 'mixt') Object.assign(fields, { hs_awb: t.awb, hs_courier: t.courier, hs_tracking_url: url });
        else Object.assign(fields, { awb: t.awb, courier: t.courier, tracking_url: url, shipping_provider: 'helpship' });
      }
      if (!Object.keys(fields).length) continue;
      await updateOrder(env, order.id, fields);
      if (fields.hs_awb || fields.awb) await addOrderEvent(env, order.id, `Helpship: AWB ${t.awb}${t.courier ? ` (${t.courier})` : ''}`);
      if (fields.hs_awb && !order.hs_awb) await notifyParcelShipped(env, settings, { ...order, ...fields }).catch(() => {});
      if (fields.awb && order.fulfillment_mode === 'helpship' && ['noua', 'confirmata'].includes(order.status)) await setStatus(env, settings, order.id, 'expediata', { by: 'Helpship' });
      if (order.fulfillment_mode === 'helpship' && DONE[t.status]) await setStatus(env, settings, order.id, DONE[t.status], { by: 'Helpship' });
    } catch (e) {
      console.log('helpship sync', order.number, e.message);
    }
  }
}

// anularea comenzii la noi o anulează și la depozit (dacă fusese trimisă)
export async function cancelAtHelpship(env, orderId) {
  if (!helpshipEnabled(env)) return;
  const order = await getOrder(env, orderId);
  if (!order || !order.hs_order_id || order.hs_order_id === 'trimisa') return;
  try {
    await api(env, 'POST', '/api/Order/cancel', [order.hs_order_id]);
    await updateOrder(env, orderId, { hs_status: 'Anulată la depozit' });
    await addOrderEvent(env, orderId, 'Comanda a fost anulată și la Helpship.');
  } catch (e) {
    await addOrderEvent(env, orderId, `Helpship: anularea nu a reușit – ${String(e.message).slice(0, 200)}. Anuleaz-o manual în Helpship.`);
  }
}
