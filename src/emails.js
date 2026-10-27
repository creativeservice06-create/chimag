import { esc } from './lib/html.js';
import { money, formatDate } from './lib/util.js';
import { ORDER_STATUSES } from './lib/db.js';

// Șabloane de email (HTML cu tabele + stiluri inline = arată corect în Yahoo, Gmail, Outlook și pe telefon).

const C = { navy: '#0e192a', blue: '#155ecc', ink: '#101d30', muted: '#56657a', line: '#dfe5ed', bg: '#f3f6fb', tint: '#eaf2fd', amber: '#f6b73c' };
const FONT = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

const abs = (base, url) => (!url ? '' : /^https?:\/\//.test(url) ? url : base + url);

function layout(s, base, { preheader = '', title, intro = '', body = '', cta = null }) {
  const company = [s.company_name, s.company_cui ? `CUI ${s.company_cui}` : '', s.company_reg, s.company_address].filter(Boolean).join(' · ');
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};${FONT}color:${C.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:16px 8px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${C.line};">
  <tr><td style="background:#ffffff;padding:14px 22px;border-bottom:1px solid ${C.line};">
    <a href="${esc(base)}" style="text-decoration:none;"><img src="${esc(base)}/img/logo-email-v2.png" width="141" height="46" alt="${esc((s.store_name || 'chimag').toLowerCase())}" style="display:block;border:0;width:141px;height:46px;color:${C.ink};font-size:22px;font-weight:800;${FONT}"></a>
  </td></tr>
  <tr><td style="padding:24px 22px 6px;">
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:${C.ink};${FONT}">${esc(title)}</h1>
    ${intro ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${C.muted};">${intro}</p>` : ''}
  </td></tr>
  <tr><td style="padding:0 22px 8px;">${body}</td></tr>
  ${cta ? `<tr><td style="padding:12px 22px 24px;"><a href="${esc(cta.href)}" style="display:inline-block;background:${C.blue};color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 24px;border-radius:10px;${FONT}">${esc(cta.label)}</a></td></tr>` : '<tr><td style="padding:8px"></td></tr>'}
  <tr><td style="background:${C.bg};padding:18px 22px;font-size:13px;line-height:1.6;color:${C.muted};border-top:1px solid ${C.line};">
    Ai întrebări? Scrie-ne din <a href="${esc(base)}/pagina/contact" style="color:${C.blue};">pagina de contact</a>${s.email ? ` sau la <a href="mailto:${esc(s.email)}" style="color:${C.blue};">${esc(s.email)}</a>` : ''}.<br>
    ${esc(company)} · <a href="${esc(base)}" style="color:${C.muted};">${esc(base.replace(/^https?:\/\//, ''))}</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function itemsTable(base, items, images, admin = false) {
  const rows = items.map((i) => {
    const img = abs(base, images.get(i.product_id));
    return `<tr>
      <td width="72" style="padding:10px 0;border-bottom:1px solid ${C.line};vertical-align:top;">${img ? `<img src="${esc(img)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:10px;background:${C.bg};border:1px solid ${C.line};">` : ''}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${C.line};font-size:15px;line-height:1.4;vertical-align:top;">${esc(i.title)}<br><span style="color:${C.muted};font-size:13px;">${i.qty} buc. × ${money(i.unit_price)}${admin && i.fulfillment === 'helpship' ? ' · <span style="color:#8a5a00;font-weight:700;">Helpship</span>' : ''}</span></td>
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

// rând cu numărul comenzii, data și plata (3 coloane scurte, încap și pe telefon)
function summaryStrip(o) {
  const cell = (label, value, last) => `<td width="33%" style="padding:12px 14px;${last ? '' : `border-right:1px solid ${C.line};`}vertical-align:top;">
    <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};">${label}</div>
    <div style="margin-top:3px;font-size:15px;font-weight:700;color:${C.ink};white-space:nowrap;">${value}</div></td>`;
  const date = formatDate(o.created_at).split(',')[0];
  const pay = o.payment_method === 'card' ? (o.payment_status === 'platita' ? 'Card, plătită' : 'Card') : 'Ramburs';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid ${C.line};border-radius:12px;${FONT}"><tr>
    ${cell('Comanda', esc(o.number))}${cell('Data', esc(date))}${cell('Plata', pay, true)}
  </tr></table>`;
}

// comandă în 2 colete (o parte pleacă din depozitul Helpship)
function splitBox(o, admin = false) {
  if (o.fulfillment_mode !== 'mixt' && !(admin && o.fulfillment_mode === 'helpship')) return '';
  const cod = !(o.payment_method === 'card' && o.payment_status === 'platita');
  const text = o.fulfillment_mode === 'helpship'
    ? 'Toată comanda se livrează din depozitul Helpship (AWB-ul îl generează depozitul).'
    : admin
      ? `2 colete: Helpship ${money(o.hs_total)} · colet propriu ${money(o.own_total)} (AWB din admin).`
      : `Produsele pleacă din depozite diferite, așa că vei primi 2 colete, fiecare cu AWB-ul lui.${cod ? ` Plătești fiecare colet curierului care ți-l aduce: <strong>${money(o.hs_total)}</strong> și <strong>${money(o.own_total)}</strong>.` : ''}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#fff8e8;border:1px solid #f3dca6;border-radius:12px;${FONT}"><tr><td style="padding:12px 14px;font-size:14px;line-height:1.5;color:#5c4100;">
    <strong>📦 ${admin ? 'Livrare' : 'Comanda ta vine în 2 colete'}</strong><br>${text}</td></tr></table>`;
}

function addressBox(o) {
  const place = [o.address, o.city, o.county ? `jud. ${o.county}` : '', o.postal_code].filter(Boolean).map(esc).join(', ');
  const contact = [o.phone, o.email].filter(Boolean).map(esc).join(' · ');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;background:${C.bg};border-radius:12px;${FONT}"><tr><td style="padding:14px 16px;font-size:14px;line-height:1.55;color:${C.ink};">
    <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};margin-bottom:4px;">Livrare la</div>
    <strong>${esc(o.customer_name)}</strong><br>${place}${contact ? `<br><span style="color:${C.muted};">${contact}</span>` : ''}
    ${o.notes ? `<br><span style="color:${C.muted};">Observații: ${esc(o.notes)}</span>` : ''}
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
      intro: `${esc(o.customer_name)} din ${esc(o.city)} · ${formatDate(o.created_at)}${o.coupon_code ? ` · cod <strong>${esc(o.coupon_code)}</strong>` : ''}${o.utm_source ? ` · sursa ${esc(o.utm_source)}${o.utm_campaign ? ` / ${esc(o.utm_campaign)}` : ''}` : ''}`,
      body: summaryStrip(o) + splitBox(o, true) + itemsTable(base, items, images, true) + totalsTable(o) + addressBox(o),
      cta: { label: 'Deschide comanda în admin', href: `${base}/admin/comenzi/${o.id}` },
    }),
    text: `Comandă nouă ${o.number}\n\n${textItems(items)}\n\nTotal: ${money(o.total)}\nClient: ${o.customer_name}, ${o.phone}\n${o.address}, ${o.city}, ${o.county}\n\n${base}/admin/comenzi/${o.id}`,
  };
}

export function customerOrderEmail(s, base, o, items, images) {
  return {
    subject: `Comanda ta ${o.number} a fost primită`,
    html: layout(s, base, {
      preheader: `Mulțumim! Total ${money(o.total)}. Îți scriem când o expediem.`,
      title: `Mulțumim, ${o.customer_name.split(' ')[0]}! Am primit comanda.`,
      intro: 'Îți scriem din nou când o expediem, cu numărul AWB pentru urmărire.',
      body: summaryStrip(o) + splitBox(o) + itemsTable(base, items, images) + totalsTable(o) + addressBox(o),
      cta: { label: 'Vezi statusul comenzii', href: `${base}/multumim/${o.token}` },
    }),
    text: `Mulțumim! Am primit comanda ${o.number}.\n\n${textItems(items)}\n\nTotal: ${money(o.total)}\n\nStatusul comenzii: ${base}/multumim/${o.token}`,
  };
}

const STATUS_COPY = {
  confirmata: { subject: 'Comanda {n} a fost confirmată', title: 'Comanda ta e confirmată ✅', intro: 'O pregătim pentru expediere. Îți trimitem numărul AWB imediat ce pleacă spre tine.' },
  expediata: { subject: 'Comanda {n} a fost expediată 🚚', title: 'Comanda ta e pe drum 🚚', intro: 'Coletul a plecat spre tine. Curierul te sună înainte de livrare.' },
  livrata: { subject: 'Comanda {n} a fost livrată', title: 'Comanda ta a fost livrată 🎉', intro: 'Sperăm să te bucuri de produse! Dacă ai orice problemă, scrie-ne și o rezolvăm.' },
  anulata: { subject: 'Comanda {n} a fost anulată', title: 'Comanda ta a fost anulată', intro: 'Dacă nu tu ai cerut anularea sau vrei să plasezi din nou comanda, scrie-ne și te ajutăm.' },
  retur: { subject: 'Am primit returul pentru comanda {n}', title: 'Am primit produsele returnate', intro: 'Verificăm produsele și îți returnăm banii în cel mult 14 zile, conform politicii de retur.' },
};
export const STATUS_EMAILS = Object.keys(STATUS_COPY);

export function customerStatusEmail(s, base, o, items, images, invoice = null) {
  let c = STATUS_COPY[o.status];
  if (!c) return null;
  if (o.fulfillment_mode === 'mixt' && o.status === 'expediata') {
    // la comenzile în 2 colete, emailul de expediere e pentru coletul nostru
    c = { subject: 'Un colet din comanda {n} e pe drum 🚚', title: 'Un colet e pe drum 🚚', intro: 'Comanda ta vine în 2 colete, iar unul dintre ele tocmai a plecat spre tine. Curierul te sună înainte de livrare.' };
    items = items.filter((i) => i.fulfillment !== 'helpship');
  }
  const awb = o.status === 'expediata' && o.awb
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:${C.tint};border-radius:12px;${FONT}"><tr><td style="padding:14px 16px;font-size:15px;">AWB: <strong>${esc(o.awb)}</strong>${o.courier ? ` · ${esc(o.courier)}` : ''}${o.tracking_url ? `<br><a href="${esc(o.tracking_url)}" style="color:${C.blue};font-weight:700;">Urmărește coletul</a>` : ''}</td></tr></table>`
    : '';
  return {
    subject: c.subject.replace('{n}', o.number),
    html: layout(s, base, {
      preheader: c.intro, title: c.title, intro: c.intro,
      body: awb + (invoice ? invoiceBox(base, invoice) : '') + summaryStrip(o) + itemsTable(base, items, images) + totalsTable(o),
      cta: { label: 'Vezi comanda', href: `${base}/multumim/${o.token}` },
    }),
    text: `${c.title}\n${c.intro}\n${o.awb ? `AWB: ${o.awb} ${o.tracking_url || ''}\n` : ''}${invoice ? `Factura ${invoice.full_number}: ${base}/factura/${invoice.token}\n` : ''}\nComanda: ${base}/multumim/${o.token}`,
  };
}

const invoiceBox = (base, inv) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid ${C.line};border-radius:12px;${FONT}"><tr><td style="padding:12px 16px;font-size:15px;">🧾 Factura <strong>${esc(inv.full_number)}</strong> · <a href="${esc(base)}/factura/${esc(inv.token)}" style="color:${C.blue};font-weight:700;">Vezi și descarcă factura</a></td></tr></table>`;

export function invoiceEmail(s, base, o, inv) {
  return {
    subject: `Factura ${inv.full_number} pentru comanda ${o.number}`,
    html: layout(s, base, {
      preheader: `Factura pentru comanda ${o.number} este gata.`,
      title: 'Factura ta 🧾',
      intro: `Factura pentru comanda <strong style="color:${C.ink}">${esc(o.number)}</strong> este gata. O poți deschide, descărca în format PDF sau printa oricând.`,
      body: invoiceBox(base, inv),
      cta: { label: 'Vezi factura', href: `${base}/factura/${inv.token}` },
    }),
    text: `Factura ${inv.full_number} pentru comanda ${o.number}: ${base}/factura/${inv.token}`,
  };
}

export function parcelShippedEmail(s, base, o, items, images) {
  const awb = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:${C.tint};border-radius:12px;${FONT}"><tr><td style="padding:14px 16px;font-size:15px;">AWB: <strong>${esc(o.hs_awb)}</strong>${o.hs_courier ? ` · ${esc(o.hs_courier)}` : ''}${o.hs_tracking_url ? `<br><a href="${esc(o.hs_tracking_url)}" style="color:${C.blue};font-weight:700;">Urmărește coletul</a>` : ''}</td></tr></table>`;
  const cod = !(o.payment_method === 'card' && o.payment_status === 'platita');
  return {
    subject: `Un colet din comanda ${o.number} e pe drum 🚚`,
    html: layout(s, base, {
      preheader: 'Unul dintre cele două colete ale comenzii tale a plecat spre tine.',
      title: 'Un colet e pe drum 🚚',
      intro: `Comanda ta vine în 2 colete. Acesta conține produsele de mai jos${cod ? ` și îl plătești curierului: <strong style="color:${C.ink}">${money(o.hs_total)}</strong>` : ''}. Celălalt colet are AWB-ul lui și te anunțăm separat despre el.`,
      body: awb + itemsTable(base, items, images),
      cta: { label: 'Vezi comanda', href: `${base}/multumim/${o.token}` },
    }),
    text: `Un colet din comanda ${o.number} e pe drum. AWB ${o.hs_awb} ${o.hs_tracking_url || ''}`,
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

// ---------- Roata norocului ----------
export function wheelUnlockedEmail(s, base, customer, st) {
  const first = customer.name.split(' ')[0];
  return {
    subject: `🎁 Ai o nouă învârtire la roata norocului`,
    html: layout(s, base, {
      preheader: 'Intră pe site și învârte roata. Reducerea câștigată e valabilă ' + st.hours + ' ore.',
      title: `${first}, ai o nouă învârtire!`,
      intro: `Mulțumim pentru comandă! Ai deblocat învârtirea ${st.stage} din ${st.total} la roata norocului. Intră în cont pe site și apasă pe 🎁 de lângă coș. Dacă câștigi, reducerea se aplică automat și e valabilă ${st.hours} ${st.hours === 1 ? 'oră' : 'ore'}.`,
      cta: { label: 'Învârte roata', href: `${base}/?roata` },
      body: `<p style="font-size:13px;color:${C.muted};${FONT}">Detalii în <a href="${esc(base)}/pagina/regulament-roata" style="color:${C.blue};">regulamentul campaniei</a>.</p>`,
    }),
    text: `Ai o nouă învârtire la roata norocului: ${base}/?roata`,
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
