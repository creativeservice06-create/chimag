import { getSettings, updateOrder, addOrderEvent } from './lib/db.js';
import { setStatus } from './lib/orders.js';
import { getProvider } from './shipping/providers.js';
import { mapShippingStatus } from './shipping/common.js';

// Rulează la 30 de minute (vezi [triggers] în wrangler.toml):
// întreabă curierul de statusul coletelor expediate și marchează automat livrat / refuzat.
export async function syncTracking(env) {
  const settings = await getSettings(env);
  const { results } = await env.DB.prepare(
    `SELECT * FROM orders WHERE status = 'expediata' AND awb != '' AND created_at > datetime('now', '-30 days')
     ORDER BY updated_at ASC LIMIT 40`).all();
  for (const order of results || []) {
    const provider = getProvider(order.shipping_provider || settings.shipping_provider);
    try {
      const r = await provider.status(env, settings, order);
      if (!r?.text) continue;
      if (r.text !== order.shipping_status) {
        await updateOrder(env, order.id, { shipping_status: r.text.slice(0, 120) });
        await addOrderEvent(env, order.id, `Curier: ${r.text}`);
      }
      const next = mapShippingStatus(r.text);
      if (next) await setStatus(env, settings, order.id, next, { by: 'curier' });
    } catch (e) {
      console.log('tracking', order.number, e.message);
    }
  }
}
