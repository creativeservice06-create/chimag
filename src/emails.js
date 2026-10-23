import { esc } from './lib/html.js';
import { money, formatDate } from './lib/util.js';
import { ORDER_STATUSES } from './lib/db.js';

// Șabloane de email (HTML cu tabele + stiluri inline = arată corect în Yahoo, Gmail, Outlook și pe telefon).

const C = { navy: '#0e192a', blue: '#155ecc', ink: '#101d30', muted: '#56657a', line: '#dfe5ed', bg: '#f3f6fb', tint: '#eaf2fd', amber: '#f6b73c' };
const FONT = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

const abs = (base, url) => (!url ? '' : /^https?:\/\//.test(url) ? url : base + url);

function layout(s, base, { preheader = '', title, intro = '', body = '', cta = null }) {
  const company = [s.company_name, s.company_cui ? `CUI ${s.company_cui}` : '', s.company_reg, s.company_address].filter(Boolean).join(' · ');
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};${FONT}color:${C.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${C.line};">
  <tr><td style="background:${C.navy};padding:20px 28px;">
    <a href="${esc(base)}" style="text-decoration:none;color:#ffffff;font-size:24px;font-weight:800;${FONT}"><img src="${esc(base)}/img/logo-email.png" width="121" height="32" alt="${esc((s.store_name || 'chimag').toLowerCase())}" style="display:block;border:0;width:121px;height:32px;color:#ffffff;font-size:22px;font-weight:800;"></a>
  </td></tr>
  <tr><td style="padding:28px 28px 8px;">
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:${C.ink};${FONT}">${esc(title)}</h1>
    ${intro ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${C.muted};">${intro}</p>` : ''}
  </td></tr>
  <tr><td style="padding:0 28px 8px;">${body}</td></tr>
  ${cta ? `<tr><td style="padding:12px 28px 28px;"><a href="${esc(cta.href)}" style="display:inline-block;background:${C.blue};color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 24px;border-radius:10px;${FONT}">${esc(cta.label)}</a></td></tr>` : '<tr><td style="padding:8px"></td></tr>'}
  <tr><td style="background:${C.bg};padding:20px 28px;font-size:13px;line-height:1.6;color:${C.muted};border-top:1px solid ${C.line};">
    ${s.phone ? `Ai întrebări? Sună-ne la <a href="tel:${esc(s.phone.replace(/\s/g, ''))}" style="color:${C.blue};">${esc(s.phone)}</a>${s.hours ? ` (${esc(s.hours)})` : ''} sau scrie-ne din <a href="${esc(base)}/pagina/contact" style="color:${C.blue};">pagina de contact</a>.<br>` : ''}
    ${esc(company)}<br><a href="${esc(base)}" style="color:${C.muted};">${esc(base.replace(/^https?:\/\//, ''))}</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function itemsTable(base, items, images) {
  const rows = items.map((i) => {
    const img = abs(base, images.get(i.product_id));
    return `<tr>
      <td width="72" style="padding:10px 0;border-bottom:1px solid ${C.line};vertical-align:top;">${img ? `<img src="${esc(img)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:10px;background:${C.bg};border:1px solid ${C.line};">` : ''}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${C.line};font-size:15px;line-height:1.4;vertical-align:top;">${esc(i.title)}<br><span style="color:${C.muted};font-size:13px;">${i.qty} × ${money(i.unit_price)}${i.line_discount ? ` · reducere −${money(i.line_discount)}` : ''}</span></td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:15px;font-weight:700;white-space:nowrap;vertical-align:top;">${money(i.total)}</td>
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${FONT}">${rows}</table>`;
}

function totalsTable(o) {
  const row = (label, value, strong) => `<tr><td style="padding:4px 0;font-size:${strong ? 17 : 14}px;color:${strong ? C.ink : C.muted};${strong ? 'font-weight:800;' : ''}">${label}</td><td align="right" style="padding:4px 0;font-size:${strong ? 18 : 14}px;${strong ? 'font-weight:800;' : ''}white-space:nowrap;">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;${FONT}">
    ${row('Subtotal', money(o.subtotal))}
    ${o.discount ? row('Reducere pachet', '−' + money(o.discount)) : ''}
    ${o.coupon_discount ? row(`Cod ${esc(o.coupon_code)}`, '−' + money(o.coupon_discount)) : ''}
    ${row('Transport', o.shipping ? money(o.shipping) : 'Gratuit')}
    ${o.cod_fee ? row('Taxă ramburs', money(o.cod_fee)) : ''}
    <tr><td colspan="2" style="border-top:1px solid ${C.line};padding-top:6px"></td></tr>
    ${row(o.payment_method === 'card' && o.payment_status === 'platita' ? 'Total plătit' : 'Total de plată la livrare', money(o.total), true)}
  </table>`;
}

function addressBox(o) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;background:${C.bg};border-radius:12px;${FONT}"><tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;">
    <strong>Livrare la</strong><br>${esc(o.customer_name)}<br>${esc(o.address)}<br>${esc(o.city)}, jud. ${esc(o.county)}${o.postal_code ? ` ${esc(o.postal_code)}` : ''}<br>${esc(o.phone)}${o.email ? ` · ${esc(o.email)}` : ''}
    <br><span style="color:${C.muted}">Plata: ${o.payment_method === 'card' ? 'card online' : 'ramburs, la livrare'}</span>
    ${o.notes ? `<br><span style="color:${C.muted}">Observații: ${esc(o.notes)}</span>` : ''}
  </td></tr></table>`;
}

const textItems = (items) => items.map((i) => `${i.qty} x ${i.title} – ${money(i.total)}`).join('\n');

// ---------- Comenzi ----------
export function adminNewOrderEmail(s, base, o, items, images) {
  return {
    subject: `🛒 Comandă nouă ${o.number} – ${money(o.total)}`,
    html: layout(s, base, {
      preheader: `${o.customer_name}, ${o.city} – ${money(o.total)}`,
      title: `Comandă nouă ${o.number}`,
      intro: `${esc(o.customer_name)} din ${esc(o.city)} a comandat acum, ${formatDate(o.created_at)}.${o.coupon_code ? ` Cod folosit: <strong>${esc(o.coupon_code)}</strong>.` : ''}${o.utm_source ? ` Sursa: ${esc(o.utm_source)}${o.utm_campaign ? ` / ${esc(o.utm_campaign)}` : ''}.` : ''}`,
      body: itemsTable(base, items, images) + totalsTable(o) + addressBox(o),
      cta: { label: 'Deschide comanda în admin', href: `${base}/admin/comenzi/${o.id}` },
    }),
    text: `Comandă nouă ${o.number}\n\n${textItems(items)}\n\nTotal: ${money(o.total)}\nClient: ${o.customer_name}, ${o.phone}\n${o.address}, ${o.city}, ${o.county}\n\n${base}/admin/comenzi/${o.id}`,
  };
}

export function customerOrderEmail(s, base, o, items, images) {
  return {
    subject: `Comanda ta ${o.number} a fost primită`,
    html: layout(s, base, {
      preheader: `Mulțumim! Total ${money(o.total)}. Te sunăm pentru confirmare.`,
      title: `Mulțumim, ${o.customer_name.split(' ')[0]}! Am primit comanda ta.`,
      intro: `Numărul comenzii este <strong style="color:${C.ink}">${esc(o.number)}</strong>. Îți scriem din nou când o expediem, împreună cu numărul AWB pentru urmărire.`,
      body: itemsTable(base, items, images) + totalsTable(o) + addressBox(o),
      cta: { label: 'Vezi statusul comenzii', href: `${base}/multumim/${o.token}` },
    }),
    text: `Mulțumim! Am primit comanda ${o.number}.\n\n${textItems(items)}\n\nTotal: ${money(o.total)}\n\nStatusul comenzii: ${base}/multumim/${o.token}`,
  };
}

const STATUS_COPY = {
  confirmata: { subject: 'Comanda {n} a fost confirmată', title: 'Comanda ta e confirmată ✅', intro: 'O pregătim pentru expediere. Îți trimitem numărul AWB imediat ce pleacă spre tine.' },
  expediata: { subject: 'Comanda {n} a fost expediată 🚚', title: 'Comanda ta e pe drum 🚚', intro: 'Coletul a plecat spre tine. Curierul te sună înainte de livrare.' },
  livrata: { subject: 'Comanda {n} a fost livrată', title: 'Comanda ta a fost livrată 🎉', intro: 'Sperăm să te bucuri de produse! Dacă ai orice problemă, scrie-ne și o rezolvăm.' },
  anulata: { subject: 'Comanda {n} a fost anulată', title: 'Comanda ta a fost anulată', intro: 'Dacă nu tu ai cerut anularea sau vrei să plasezi din nou comanda, sună-ne și te ajutăm.' },
  retur: { subject: 'Am primit returul pentru comanda {n}', title: 'Am primit produsele returnate', intro: 'Verificăm produsele și îți returnăm banii în cel mult 14 zile, conform politicii de retur.' },
};
export const STATUS_EMAILS = Object.keys(STATUS_COPY);

export function customerStatusEmail(s, base, o, items, images) {
  const c = STATUS_COPY[o.status];
  if (!c) return null;
  const awb = o.status === 'expediata' && o.awb
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:${C.tint};border-radius:12px;${FONT}"><tr><td style="padding:14px 16px;font-size:15px;">AWB: <strong>${esc(o.awb)}</strong>${o.courier ? ` · ${esc(o.courier)}` : ''}${o.tracking_url ? `<br><a href="${esc(o.tracking_url)}" style="color:${C.blue};font-weight:700;">Urmărește coletul</a>` : ''}</td></tr></table>`
    : '';
  return {
    subject: c.subject.replace('{n}', o.number),
    html: layout(s, base, {
      preheader: c.intro, title: c.title, intro: c.intro,
      body: awb + itemsTable(base, items, images) + totalsTable(o),
      cta: { label: 'Vezi comanda', href: `${base}/multumim/${o.token}` },
    }),
    text: `${c.title}\n${c.intro}\n${o.awb ? `AWB: ${o.awb} ${o.tracking_url || ''}\n` : ''}\nComanda: ${base}/multumim/${o.token}`,
  };
}

// ---------- Cont ----------
export function verifyEmail(s, base, customer, link) {
  return {
    subject: `Confirmă-ți contul ${s.store_name || 'Chimag'}`,
    html: layout(s, base, {
      preheader: 'Un singur click și contul tău e activ.',
      title: `Bun venit, ${customer.name.split(' ')[0]}!`,
      intro: 'Contul tău a fost creat. Confirmă adresa de email ca să-l poți folosi: vezi comenzile, statusul lor și comanzi mai repede, cu adresa salvată.',
      cta: { label: 'Confirmă adresa de email', href: link },
      body: `<p style="font-size:13px;color:${C.muted};${FONT}">Linkul e valabil 48 de ore. Dacă nu tu ai creat contul, ignoră acest email.</p>`,
    }),
    text: `Bun venit! Confirmă contul aici: ${link}`,
  };
}

export function resetEmail(s, base, customer, link, invited = false) {
  return {
    subject: invited ? `Contul tău ${s.store_name || 'Chimag'} e gata – alege o parolă` : 'Resetează parola contului',
    html: layout(s, base, {
      preheader: invited ? 'Alege o parolă și intră în cont.' : 'Ai cerut o parolă nouă.',
      title: invited ? `Bun venit, ${customer.name.split(' ')[0]}!` : 'Alege o parolă nouă',
      intro: invited ? 'Ți-am creat un cont în magazin. Alege o parolă ca să-l poți folosi.' : 'Am primit o cerere de resetare a parolei. Apasă butonul de mai jos ca să alegi una nouă.',
      cta: { label: invited ? 'Alege parola' : 'Resetează parola', href: link },
      body: `<p style="font-size:13px;color:${C.muted};${FONT}">Linkul e valabil ${invited ? '7 zile' : 'o oră'}. Dacă nu tu ai cerut asta, ignoră emailul; parola rămâne neschimbată.</p>`,
    }),
    text: `${invited ? 'Alege parola' : 'Resetează parola'}: ${link}`,
  };
}

// ---------- Contact ----------
export function contactAdminEmail(s, base, m) {
  return {
    subject: `✉️ Mesaj nou: ${m.subject || 'contact'} – ${m.name}`,
    html: layout(s, base, {
      preheader: m.message.slice(0, 90),
      title: `Mesaj nou de la ${m.name}`,
      intro: [m.phone && `Telefon: <a href="tel:${esc(m.phone)}" style="color:${C.blue}">${esc(m.phone)}</a>`, m.email && `Email: <a href="mailto:${esc(m.email)}" style="color:${C.blue}">${esc(m.email)}</a>`, m.order_number && `Comanda: ${esc(m.order_number)}`, m.subject && `Subiect: ${esc(m.subject)}`].filter(Boolean).join('<br>'),
      body: `<div style="background:${C.bg};border-radius:12px;padding:16px;font-size:15px;line-height:1.6;white-space:pre-wrap;${FONT}">${esc(m.message)}</div>`,
      cta: { label: 'Vezi în admin', href: `${base}/admin/mesaje` },
    }),
    text: `Mesaj de la ${m.name} (${m.phone || ''} ${m.email || ''})\n\n${m.message}`,
  };
}

export function contactAutoReply(s, base, m) {
  return {
    subject: `Am primit mesajul tău – ${s.store_name || 'Chimag'}`,
    html: layout(s, base, {
      preheader: 'Îți răspundem cât mai repede.',
      title: `Mulțumim, ${m.name.split(' ')[0]}!`,
      intro: `Am primit mesajul tău și îți răspundem cât mai repede${s.hours ? `, în programul ${esc(s.hours.charAt(0).toLowerCase() + s.hours.slice(1))}` : ''}.`,
      body: `<div style="background:${C.bg};border-radius:12px;padding:16px;font-size:14px;line-height:1.6;color:${C.muted};white-space:pre-wrap;${FONT}">${esc(m.message)}</div>`,
    }),
    text: `Am primit mesajul tău și îți răspundem cât mai repede.\n\n${m.message}`,
  };
}

export function testEmail(s, base) {
  return {
    subject: `Test email ${s.store_name || 'Chimag'} ✅`,
    html: layout(s, base, { title: 'Emailurile funcționează ✅', intro: 'Dacă citești acest mesaj, magazinul poate trimite emailuri: comenzi noi, confirmări pentru clienți, statusuri și mesaje din formularul de contact.' }),
    text: 'Emailurile funcționează.',
  };
}

// poze pentru produsele din comandă
export async function itemImages(env, items) {
  const ids = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;
  const { results } = await env.DB.prepare(`SELECT id, images FROM products WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  for (const r of results || []) { try { map.set(r.id, JSON.parse(r.images)[0] || ''); } catch { map.set(r.id, ''); } }
  return map;
}

export { ORDER_STATUSES };
