import { smtpSend, buildMime } from './smtp.js';

// Trimitere email:
// 1) SMTP prin contul tău de email (Yahoo/Gmail) – merge fără domeniu, spre orice adresă.
//    Secrete în Cloudflare: SMTP_USER (adresa), SMTP_PASS (parola de aplicație),
//    opțional SMTP_HOST (implicit smtp.mail.yahoo.com) și SMTP_PORT (implicit 465).
// 2) Cloudflare Email Routing (binding EMAIL) – după ce ai domeniu; trimite doar spre adresa ta.
// Dacă nu e configurat nimic, emailurile nu pleacă, dar comenzile și mesajele rămân în admin.

function smtpConfig(env) {
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  const user = String(env.SMTP_USER).trim();
  const host = env.SMTP_HOST || (/@gmail\.com$/i.test(user) ? 'smtp.gmail.com' : /@(outlook|hotmail|live)\./i.test(user) ? 'smtp-mail.outlook.com' : 'smtp.mail.yahoo.com');
  const port = Number(env.SMTP_PORT) || (host === 'smtp-mail.outlook.com' ? 587 : 465);
  return { host, port, user, pass: String(env.SMTP_PASS).replace(/\s/g, ''), heloName: 'chimag.ro' };
}

export function emailStatus(env) {
  const s = smtpConfig(env);
  if (s) return { ok: true, customers: true, via: `${s.user} (${s.host})` };
  if (env.EMAIL) return { ok: true, customers: false, via: 'Cloudflare Email Routing (doar spre tine)' };
  return { ok: false, customers: false, via: '' };
}

/** Trimite un email oricui (client sau administrator). */
export async function sendMail(env, settings, { to, subject, html, text, replyTo, attachments }) {
  const list = (Array.isArray(to) ? to : [to]).map((t) => String(t || '').trim()).filter(Boolean);
  if (!list.length) return { ok: false, error: 'Lipsește destinatarul.' };
  const fromName = settings.store_name || 'Chimag';
  const smtp = smtpConfig(env);

  if (smtp) {
    try {
      const raw = buildMime({ fromName, fromAddr: smtp.user, to: list, subject, text, html, replyTo, attachments });
      await smtpSend(smtp, [{ from: smtp.user, to: list, raw }]);
      return { ok: true, via: 'smtp' };
    } catch (e) {
      console.log('smtp error', e?.message || e);
      return { ok: false, error: String(e?.message || e) };
    }
  }

  if (env.EMAIL && list.every((t) => t === settings.contact_email)) {
    try {
      const { EmailMessage } = await import('cloudflare:email');
      const fromAddr = env.MAIL_FROM || 'formular@chimag.ro';
      const raw = buildMime({ fromName, fromAddr, to: list, subject, text, html, replyTo });
      await env.EMAIL.send(new EmailMessage(fromAddr, list[0], raw));
      return { ok: true, via: 'email-routing' };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }
  return { ok: false, error: 'Trimiterea de email nu este configurată (vezi README → „Emailuri").' };
}

/** Email către administrator (adresa din Setări → Notificări). */
export async function sendEmail(env, settings, msg) {
  if (!settings.contact_email) return { ok: false, error: 'Nu este setată adresa de email pentru notificări.' };
  return sendMail(env, settings, { ...msg, to: settings.contact_email });
}
