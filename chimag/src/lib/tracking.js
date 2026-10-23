import { sha256Hex } from './util.js';

// Evenimente "Purchase" trimise de pe server (Facebook Conversions API + TikTok Events API).
// Folosesc același event_id ca pixelul din browser, deci Facebook/TikTok le deduplică.
// Se activează doar dacă există FB_CAPI_TOKEN / TIKTOK_EVENTS_TOKEN și ID-ul pixelului în setări.

export const TIKTOK_PURCHASE_EVENT = 'CompletePayment';

const e164 = (phone) => (phone?.startsWith('0') ? '+40' + phone.slice(1) : phone || '');
const norm = (s) => String(s || '').trim().toLowerCase();

export async function sendServerPurchase(env, settings, order, items, siteUrl) {
  const tasks = [];
  const value = order.total / 100;
  const eventTime = Math.floor(Date.now() / 1000);
  const url = `${siteUrl}/multumim/${order.token}`;
  const [ph, em, fn, ct] = await Promise.all([
    sha256Hex(e164(order.phone).replace('+', '')),
    order.email ? sha256Hex(norm(order.email)) : null,
    sha256Hex(norm(order.customer_name.split(' ')[0])),
    sha256Hex(norm(order.city).replace(/\s/g, '')),
  ]);

  if (env.FB_CAPI_TOKEN && settings.fb_pixel_id) {
    const user_data = {
      ph: [ph], fn: [fn], ct: [ct], country: [await sha256Hex('ro')],
      client_ip_address: order.ip || undefined,
      client_user_agent: order.user_agent || undefined,
      fbp: order.fbp || undefined,
      fbc: order.fbclid ? `fb.1.${Date.parse(order.created_at.replace(' ', 'T') + 'Z')}.${order.fbclid}` : undefined,
    };
    if (em) user_data.em = [em];
    const body = {
      data: [{
        event_name: 'Purchase', event_time: eventTime, event_id: order.number, action_source: 'website',
        event_source_url: url, user_data,
        custom_data: {
          currency: 'RON', value, content_type: 'product',
          content_ids: items.map((i) => String(i.product_id)),
          contents: items.map((i) => ({ id: String(i.product_id), quantity: i.qty, item_price: i.unit_price / 100 })),
          num_items: items.reduce((s, i) => s + i.qty, 0),
          order_id: order.number,
        },
      }],
    };
    tasks.push(fetch(`https://graph.facebook.com/v21.0/${settings.fb_pixel_id}/events?access_token=${env.FB_CAPI_TOKEN}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }));
  }

  if (env.TIKTOK_EVENTS_TOKEN && settings.tiktok_pixel_id) {
    const user = { phone: ph, ip: order.ip || undefined, user_agent: order.user_agent || undefined, ttclid: order.ttclid || undefined };
    if (em) user.email = em;
    const body = {
      event_source: 'web', event_source_id: settings.tiktok_pixel_id,
      data: [{
        event: TIKTOK_PURCHASE_EVENT, event_time: eventTime, event_id: order.number, user, page: { url },
        properties: {
          currency: 'RON', value, content_type: 'product', order_id: order.number,
          contents: items.map((i) => ({ content_id: String(i.product_id), content_name: i.title, quantity: i.qty, price: i.unit_price / 100 })),
        },
      }],
    };
    tasks.push(fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST', headers: { 'content-type': 'application/json', 'Access-Token': env.TIKTOK_EVENTS_TOKEN }, body: JSON.stringify(body),
    }));
  }

  const results = await Promise.allSettled(tasks);
  for (const r of results) if (r.status === 'rejected') console.log('tracking error', r.reason);
}
