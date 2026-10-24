import { getSettings } from './db.js';
import { wheelState } from './coupons.js';
import { sendMail } from './email.js';
import { wheelUnlockedEmail } from '../emails.js';

// Când clientul îndeplinește condiția pentru o nouă învârtire, îi trimitem un email (o singură dată pe etapă).
export async function checkWheelUnlock(env, settings, customerId) {
  const c = await env.DB.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').bind(customerId).first();
  if (!c) return;
  const st = await wheelState(env, settings, c);
  if (st.state !== 'ready' || st.stage < 2 || (c.wheel_notified || 0) >= st.stage) return;
  await env.DB.prepare('UPDATE customers SET wheel_notified = ? WHERE id = ?').bind(st.stage, c.id).run();
  if (settings.customer_emails === '0' || !c.email) return;
  const base = String(env.SITE_URL || '').replace(/\/$/, '');
  const r = await sendMail(env, settings, { to: c.email, ...wheelUnlockedEmail(settings, base, c, st) }).catch(() => ({ ok: false }));
  await env.DB.prepare('INSERT INTO customer_events (customer_id, message) VALUES (?, ?)')
    .bind(c.id, `Învârtirea ${st.stage} la roată deblocată${r.ok ? ' (email trimis)' : ''}.`).run();
}

// Rulează din cron: clienții al căror premiu de la roată tocmai a expirat pot avea o învârtire nouă disponibilă.
export async function checkWheelUnlocks(env) {
  const settings = await getSettings(env);
  if (settings.wheel_enabled !== '1') return;
  const { results } = await env.DB.prepare(`SELECT DISTINCT customer_id FROM coupons
    WHERE source = 'roata' AND customer_id > 0 AND expires_at != '' AND expires_at <= datetime('now') AND expires_at > datetime('now', '-2 hours')
    LIMIT 50`).all();
  for (const r of results || []) await checkWheelUnlock(env, settings, r.customer_id).catch((e) => console.log('wheel', e.message));
}
