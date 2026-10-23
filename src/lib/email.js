// Trimitere email fără parole de Yahoo/Gmail:
// 1) Cloudflare Email Routing (binding "EMAIL" în wrangler.toml) – gratuit, trimite spre adresa ta verificată
// 2) sau Resend (RESEND_API_KEY) – alternativă, dacă nu folosești Email Routing
// Dacă nu e configurat nimic, mesajele rămân salvate în admin (secțiunea Mesaje).

function b64utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const encodeHeader = (s) => `=?UTF-8?B?${b64utf8(s)}?=`;
const wrap76 = (s) => s.replace(/(.{76})/g, '$1\r\n');

export function emailStatus(env) {
  if (env.EMAIL) return { ok: true, via: 'Cloudflare Email Routing' };
  if (env.RESEND_API_KEY) return { ok: true, via: 'Resend' };
  return { ok: false, via: '' };
}

export async function sendEmail(env, settings, { subject, text, replyTo }) {
  const to = settings.contact_email;
  if (!to) return { ok: false, error: 'Nu este setată adresa de email pentru notificări.' };
  const fromAddr = env.MAIL_FROM || 'formular@chimag.ro';
  const fromName = settings.store_name || 'Chimag';

  if (env.EMAIL) {
    try {
      const { EmailMessage } = await import('cloudflare:email');
      const host = fromAddr.split('@')[1] || 'chimag.ro';
      const headers = [
        `From: ${encodeHeader(fromName)} <${fromAddr}>`,
        `To: <${to}>`,
        ...(replyTo ? [`Reply-To: <${replyTo}>`] : []),
        `Subject: ${encodeHeader(subject)}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <${crypto.randomUUID()}@${host}>`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
      ];
      const raw = headers.join('\r\n') + '\r\n\r\n' + wrap76(b64utf8(text));
      await env.EMAIL.send(new EmailMessage(fromAddr, to, raw));
      return { ok: true, via: 'email-routing' };
    } catch (e) {
      console.log('email routing error', e?.message || e);
      if (!env.RESEND_API_KEY) return { ok: false, error: String(e?.message || e) };
    }
  }

  if (env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM || `${fromName} <onboarding@resend.dev>`,
        to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (res.ok) return { ok: true, via: 'resend' };
    return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
  }

  return { ok: false, error: 'Trimiterea de email nu este configurată.' };
}
