import { sendMail, sendEmail } from './email.js';
import { getOrderItems } from './db.js';
import { adminNewOrderEmail, customerOrderEmail, customerStatusEmail, STATUS_EMAILS, itemImages, contactAdminEmail, contactAutoReply, parcelShippedEmail } from '../emails.js';

// Toate notificările pe email ale magazinului. Erorile de email nu blochează niciodată comanda.
const baseUrl = (env) => String(env.SITE_URL || '').replace(/\/$/, '');
const safe = async (p) => { try { return await p; } catch (e) { console.log('email', e?.message || e); return { ok: false }; } };

export async function notifyOrderPlaced(env, settings, order) {
  const base = baseUrl(env);
  const items = await getOrderItems(env, order.id);
  const images = await itemImages(env, items);
  const tasks = [];
  if (settings.notify_orders === '1') tasks.push(safe(sendEmail(env, settings, adminNewOrderEmail(settings, base, order, items, images))));
  if (settings.customer_emails !== '0' && order.email) {
    tasks.push(safe(sendMail(env, settings, { to: order.email, ...customerOrderEmail(settings, base, order, items, images) })));
  }
  await Promise.all(tasks);
}

export async function notifyStatus(env, settings, order) {
  if (settings.customer_emails === '0' || !order.email || !STATUS_EMAILS.includes(order.status)) return;
  const base = baseUrl(env);
  const items = await getOrderItems(env, order.id);
  const mail = customerStatusEmail(settings, base, order, items, await itemImages(env, items));
  if (!mail) return;
  const r = await safe(sendMail(env, settings, { to: order.email, ...mail }));
  if (r.ok) await env.DB.prepare('INSERT INTO order_events(order_id, message) VALUES (?, ?)').bind(order.id, `Email trimis clientului: ${mail.subject}`).run();
}

export async function notifyContact(env, settings, msg) {
  const base = baseUrl(env);
  const r = await safe(sendEmail(env, settings, { ...contactAdminEmail(settings, base, msg), replyTo: msg.email || undefined }));
  if (msg.email && settings.customer_emails !== '0') await safe(sendMail(env, settings, { to: msg.email, ...contactAutoReply(settings, base, msg) }));
  return r;
}

// coletul din depozitul Helpship al unei comenzi în 2 colete a plecat
export async function notifyParcelShipped(env, settings, order) {
  if (settings.customer_emails === '0' || !order.email) return;
  const base = baseUrl(env);
  const items = (await getOrderItems(env, order.id)).filter((i) => i.fulfillment === 'helpship');
  const r = await safe(sendMail(env, settings, { to: order.email, ...parcelShippedEmail(settings, base, order, items, await itemImages(env, items)) }));
  if (r.ok) await env.DB.prepare('INSERT INTO order_events(order_id, message) VALUES (?, ?)').bind(order.id, 'Email trimis clientului: coletul Helpship a fost expediat').run();
}
