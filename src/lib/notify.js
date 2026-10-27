import { sendMail, sendEmail } from './email.js';
import { getOrderItems } from './db.js';
import { adminNewOrderEmail, customerOrderEmail, customerStatusEmail, STATUS_EMAILS, itemImages, contactAdminEmail, contactAutoReply, parcelShippedEmail, invoiceEmail } from '../emails.js';

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
  // „confirmată + pe drum” pleacă doar împreună cu AWB-ul (dacă AWB-ul se adaugă mai târziu, emailul pleacă atunci)
  if (order.status === 'expediata' && !order.awb) {
    await env.DB.prepare('INSERT INTO order_events(order_id, message) VALUES (?, ?)').bind(order.id, 'Emailul de expediere către client pleacă după ce comanda are AWB.').run();
    return;
  }
  const base = baseUrl(env);
  const items = await getOrderItems(env, order.id);
  const inv = await env.DB.prepare("SELECT * FROM invoices WHERE order_id = ? AND kind = 'factura'").bind(order.id).first().catch(() => null);
  const withInv = ['expediata', 'livrata'].includes(order.status) ? inv : null;
  const mail = customerStatusEmail(settings, base, order, items, await itemImages(env, items), withInv);
  if (!mail) return;
  const r = await safe(sendMail(env, settings, { to: order.email, ...mail, attachments: withInv ? await pdfAttachment(env, settings, withInv) : [] }));
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

// factura emisă manual din admin (la cele automate, linkul e în emailul de expediere/livrare)
export async function notifyInvoice(env, settings, order, inv) {
  if (settings.customer_emails === '0' || !order.email) return false;
  const r = await safe(sendMail(env, settings, { to: order.email, ...invoiceEmail(settings, baseUrl(env), order, inv), attachments: await pdfAttachment(env, settings, inv) }));
  if (r.ok) await env.DB.prepare('INSERT INTO order_events(order_id, message) VALUES (?, ?)').bind(order.id, `Email trimis clientului: factura ${inv.full_number}`).run();
  return !!r.ok;
}

// factura PDF atașată la email (dacă generarea dă greș, emailul pleacă oricum, cu linkul facturii)
async function pdfAttachment(env, settings, inv) {
  try {
    const { invoicePdf, invoicePdfName } = await import('./invoice-pdf.js');
    const content = await invoicePdf(env, inv, { storeName: settings.store_name, site: baseUrl(env).replace(/^https?:\/\//, '') || 'www.chimag.ro' });
    return [{ name: invoicePdfName(inv), type: 'application/pdf', content }];
  } catch (e) { console.log('pdf', e?.message || e); return []; }
}
