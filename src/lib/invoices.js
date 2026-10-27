// Facturare: emitere automată la expediere/livrare, storno la anulare/refuz/retur,
// export pentru SAGA (XML în formatul de import „Facturi” al SAGA C) și transmiterea în e-Factura din SAGA.
import { addOrderEvent, getOrder, getOrderItems } from './db.js';
import { randomToken } from './util.js';
import { roToday, roMidnightUtc } from './profit.js';

export const INV_TRIGGERS = {
  expediata: 'La expediere (când pleacă coletul)',
  livrata: 'La livrare (când clientul primește coletul)',
  manual: 'Doar manual, din pagina comenzii',
};
const ISSUE_ON = { expediata: ['expediata', 'livrata'], livrata: ['livrata'], manual: [] };
const STORNO_ON = ['anulata', 'refuzata', 'retur'];
export const CNP_GENERIC = '0000000000000'; // client persoană fizică fără cod fiscal (regula e-Factura B2C)

// facturile automate se emit doar pentru comenzile plasate din această zi (Setări → Facturare)
const sinceUtc = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s.inv_since || '') ? roMidnightUtc(s.inv_since) : '9999-12-31');
export const roDate = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const cleanSeries = (s) => String(s || 'CHI').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CHI';

// Ce lipsește ca să putem emite facturi (gol = totul e în regulă)
export function invoicingProblem(s) {
  const missing = [];
  if (!s.company_name) missing.push('denumirea firmei');
  if (!s.company_cui) missing.push('CUI-ul');
  if (!s.company_address) missing.push('adresa sediului social');
  return missing.length ? `Completează în Setări → Date firmă: ${missing.join(', ')}.` : '';
}

const vatSplit = (gross, payer, rate) => {
  if (!payer || !rate) return { base: gross, vat: 0 };
  const base = Math.round(gross / (1 + rate / 100));
  return { base, vat: gross - base };
};

// Rândurile facturii, din comandă. Totalul facturii = exact totalul comenzii.
export function buildLines(order, items, payer, rate) {
  const lines = [];
  const add = (desc, code, qty, price, gross) => lines.push({ desc, code: code || '', um: 'buc', qty, price, gross, ...vatSplit(gross, payer, rate) });
  for (const i of items) add(i.title, i.sku, i.qty, i.unit_price, i.unit_price * i.qty);
  if (order.discount) add('Reducere ofertă de pachet', '', 1, -order.discount, -order.discount);
  if (order.coupon_discount) add(`Reducere cod ${order.coupon_code || ''}`.trim(), '', 1, -order.coupon_discount, -order.coupon_discount);
  if (order.shipping) add('Transport', 'TRANSPORT', 1, order.shipping, order.shipping);
  if (order.cod_fee) add('Taxă ramburs', 'RAMBURS', 1, order.cod_fee, order.cod_fee);
  const diff = order.total - lines.reduce((s, l) => s + l.gross, 0);
  if (diff) add(diff < 0 ? 'Reducere' : 'Ajustare', '', 1, diff, diff); // rotunjiri / reduceri vechi
  return lines;
}

export async function getOrderInvoices(env, orderId) {
  const { results } = await env.DB.prepare('SELECT * FROM invoices WHERE order_id = ? ORDER BY id').bind(orderId).all();
  return results || [];
}
export const getInvoiceByToken = (env, token) => env.DB.prepare('SELECT * FROM invoices WHERE token = ?').bind(token).first();
export const getInvoiceById = (env, id) => env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();

export async function nextInvoiceNumber(env, s) {
  const series = cleanSeries(s.inv_series);
  const c = await env.DB.prepare('SELECT value FROM counters WHERE name = ?').bind('inv_' + series).first();
  return { series, next: c ? c.value + 1 : Math.max(1, Number(s.inv_start) || 1) };
}

// Numărul următor se alocă în aceeași tranzacție cu salvarea facturii: fără goluri, fără dubluri.
async function insertInvoice(env, s, data) {
  const series = cleanSeries(s.inv_series);
  const counter = 'inv_' + series;
  const token = randomToken(16);
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO counters(name, value) VALUES (?, ?)').bind(counter, Math.max(1, Number(s.inv_start) || 1) - 1),
    env.DB.prepare(`INSERT INTO invoices (order_id, kind, ref_id, series, number, full_number, token, issued_on, buyer_json, supplier_json,
        lines_json, total, base_total, vat_total, vat_payer, vat_rate, payment_method, note)
      SELECT ?, ?, ?, ?, c.value + 1, ? || printf('%04d', c.value + 1), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      FROM counters c WHERE c.name = ? AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = ? AND kind = ?)`)
      .bind(data.order_id, data.kind, data.ref_id ?? null, series, series, token, data.issued_on, JSON.stringify(data.buyer), JSON.stringify(data.supplier),
        JSON.stringify(data.lines), data.total, data.base_total, data.vat_total, data.vat_payer, data.vat_rate, data.payment_method, data.note || '',
        counter, data.order_id, data.kind),
    env.DB.prepare('UPDATE counters SET value = (SELECT MAX(number) FROM invoices WHERE series = ?) WHERE name = ? AND (SELECT MAX(number) FROM invoices WHERE series = ?) > value')
      .bind(series, counter, series),
  ]);
  return env.DB.prepare('SELECT * FROM invoices WHERE order_id = ? AND kind = ?').bind(data.order_id, data.kind).first();
}

const supplierOf = (s) => ({
  name: s.company_name, cui: s.company_cui, reg: s.company_reg || '', capital: s.company_capital || '',
  address: s.company_address, bank: s.company_bank || '', iban: s.company_iban || '', email: s.email || '',
});
const buyerOf = (o) => ({
  name: o.customer_name, cif: CNP_GENERIC, address: o.address, city: o.city, county: o.county, zip: o.postal_code || '',
  country: 'România', email: o.email || '', phone: o.phone || '',
});

export async function issueInvoice(env, s, orderId) {
  const problem = invoicingProblem(s);
  if (problem) return { ok: false, error: problem };
  const order = await getOrder(env, orderId);
  if (!order) return { ok: false, error: 'Comanda nu există.' };
  const existing = (await getOrderInvoices(env, orderId)).find((i) => i.kind === 'factura');
  if (existing) return { ok: true, invoice: existing, existed: true };
  if (order.status === 'anulata') return { ok: false, error: 'Comanda e anulată.' };
  if (order.payment_method === 'card' && order.payment_status !== 'platita') return { ok: false, error: 'Comanda cu cardul nu este încă plătită.' };
  const payer = s.inv_vat_payer === '1';
  const rate = payer ? Number(String(s.inv_vat_rate || '21').replace(',', '.')) || 0 : 0;
  const lines = buildLines(order, await getOrderItems(env, orderId), payer, rate);
  const sum = (k) => lines.reduce((a, l) => a + l[k], 0);
  const inv = await insertInvoice(env, s, {
    order_id: orderId, kind: 'factura', issued_on: roToday(), buyer: buyerOf(order), supplier: supplierOf(s), lines,
    total: sum('gross'), base_total: sum('base'), vat_total: sum('vat'), vat_payer: payer ? 1 : 0, vat_rate: rate,
    payment_method: order.payment_method, note: `Comanda ${order.number}`,
  });
  if (!inv) return { ok: false, error: 'Factura nu a putut fi salvată.' };
  await addOrderEvent(env, orderId, `Factura ${inv.full_number} emisă (${(inv.total / 100).toFixed(2).replace('.', ',')} lei).`);
  return { ok: true, invoice: inv };
}

export async function issueStorno(env, s, orderId) {
  const list = await getOrderInvoices(env, orderId);
  const orig = list.find((i) => i.kind === 'factura');
  if (!orig) return { ok: false, error: 'Comanda nu are factură.' };
  const had = list.find((i) => i.kind === 'storno');
  if (had) return { ok: true, invoice: had, existed: true };
  const neg = (l) => ({ ...l, qty: -l.qty, gross: -l.gross, base: -l.base, vat: -l.vat });
  const inv = await insertInvoice(env, s, {
    order_id: orderId, kind: 'storno', ref_id: orig.id, issued_on: roToday(), buyer: JSON.parse(orig.buyer_json),
    supplier: supplierOf(s), lines: JSON.parse(orig.lines_json).map(neg),
    total: -orig.total, base_total: -orig.base_total, vat_total: -orig.vat_total, vat_payer: orig.vat_payer, vat_rate: orig.vat_rate,
    payment_method: orig.payment_method, note: `Stornare factura ${orig.full_number} din ${roDate(orig.issued_on)}`,
  });
  if (!inv) return { ok: false, error: 'Storno-ul nu a putut fi salvat.' };
  await addOrderEvent(env, orderId, `Factura storno ${inv.full_number} emisă (anulează ${orig.full_number}).`);
  return { ok: true, invoice: inv };
}

// Apelată după fiecare schimbare de status: emite factura sau storno-ul, după setări.
export async function syncInvoice(env, s, orderId) {
  const order = await getOrder(env, orderId);
  if (!order) return null;
  const due = (ISSUE_ON[s.inv_trigger] || ISSUE_ON.expediata).includes(order.status);
  // dacă factura ar fi trebuit emisă acum, dar n-a putut, scriem motivul în istoricul comenzii
  const skip = s.inv_enabled !== '1' ? 'emiterea automată e oprită (Setări → Facturare → bifează „Emite facturi automat”)'
    : invoicingProblem(s) ? invoicingProblem(s)
    : order.created_at < sinceUtc(s) ? `comanda e plasată înainte de data de start a facturării (${s.inv_since ? roDate(s.inv_since) : 'nesetată'}, Setări → Facturare)` : '';
  if (skip) {
    if (due && s.inv_trigger !== 'manual') await addOrderEvent(env, orderId, `Factura nu s-a emis automat: ${skip}. O poți emite din caseta „Factură”.`);
    return null;
  }
  const list = await getOrderInvoices(env, orderId);
  const has = (k) => list.some((i) => i.kind === k);
  try {
    if (STORNO_ON.includes(order.status)) return has('factura') && !has('storno') ? await issueStorno(env, s, orderId) : null;
    if ((ISSUE_ON[s.inv_trigger] || ISSUE_ON.expediata).includes(order.status) && !has('factura')) return await issueInvoice(env, s, orderId);
  } catch (e) {
    await addOrderEvent(env, orderId, `Factura nu s-a putut emite: ${String(e?.message || e).slice(0, 200)}`);
  }
  return null;
}

// Plasă de siguranță (cron): comenzile la care factura/storno-ul n-a apucat să se emită.
export async function syncInvoices(env, s) {
  if (s.inv_enabled !== '1' || invoicingProblem(s)) return;
  const issue = ISSUE_ON[s.inv_trigger] || ISSUE_ON.expediata;
  const q = (arr) => arr.map(() => '?').join(',');
  const parts = [];
  const params = [];
  if (issue.length) { parts.push(`(o.status IN (${q(issue)}) AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id AND i.kind = 'factura'))`); params.push(...issue); }
  parts.push(`(o.status IN (${q(STORNO_ON)}) AND EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id AND i.kind = 'factura')
    AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id AND i.kind = 'storno'))`);
  params.push(...STORNO_ON);
  const { results } = await env.DB.prepare(`SELECT o.id FROM orders o WHERE o.created_at >= ? AND (${parts.join(' OR ')}) ORDER BY o.id LIMIT 30`)
    .bind(sinceUtc(s), ...params).all();
  for (const r of results || []) await syncInvoice(env, s, r.id);
}

export async function listInvoices(env, from, to) {
  const { results } = await env.DB.prepare(`SELECT i.*, o.number AS order_number, o.status AS order_status FROM invoices i
    JOIN orders o ON o.id = i.order_id WHERE i.issued_on >= ? AND i.issued_on <= ? ORDER BY i.series, i.number`).bind(from, to).all();
  return results || [];
}

// ---------------- Export SAGA ----------------
const x = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const n2 = (bani) => (bani / 100).toFixed(2);
const n4 = (v) => (Math.round(v * 10000) / 10000).toFixed(4);

function sagaFactura(inv) {
  const sup = JSON.parse(inv.supplier_json || '{}');
  const buy = JSON.parse(inv.buyer_json || '{}');
  const lines = JSON.parse(inv.lines_json || '[]');
  const t = (tag, v) => `<${tag}>${x(v)}</${tag}>`;
  return `  <Factura>
    <Antet>
      ${t('FurnizorNume', sup.name)}
      ${t('FurnizorCIF', sup.cui)}
      ${t('FurnizorNrRegCom', sup.reg)}
      ${t('FurnizorCapital', sup.capital)}
      ${t('FurnizorAdresa', sup.address)}
      ${t('FurnizorBanca', sup.bank)}
      ${t('FurnizorIBAN', sup.iban)}
      ${t('FurnizorInformatiiSuplimentare', '')}
      ${t('ClientNume', buy.name)}
      ${t('ClientInformatiiSuplimentare', [buy.email, buy.phone].filter(Boolean).join(' · '))}
      ${t('ClientCIF', buy.cif || CNP_GENERIC)}
      ${t('ClientNrRegCom', '')}
      ${t('ClientJudet', buy.county)}
      ${t('ClientAdresa', [buy.address, buy.city, buy.zip].filter(Boolean).join(', '))}
      ${t('ClientBanca', '')}
      ${t('ClientIBAN', '')}
      ${t('FacturaNumar', inv.full_number)}
      ${t('FacturaData', roDate(inv.issued_on))}
      ${t('FacturaScadenta', roDate(inv.issued_on))}
      ${t('FacturaTaxareInversa', 'Nu')}
      ${t('FacturaTVAIncasare', 'Nu')}
      ${t('FacturaTip', inv.kind === 'storno' ? 'Storno' : '')}
      ${t('FacturaInformatiiSuplimentare', inv.note)}
      ${t('FacturaMoneda', 'RON')}
    </Antet>
    <Detalii>
      <Continut>
${lines.map((l, k) => `        <Linie>
          ${t('LinieNrCrt', k + 1)}
          ${t('Descriere', l.desc)}
          ${t('CodArticolFurnizor', l.code)}
          ${t('UM', l.um || 'buc')}
          ${t('Cantitate', l.qty)}
          ${t('Pret', n4(l.base / 100 / l.qty))}
          ${t('Valoare', n2(l.base))}
          ${t('ProcTVA', inv.vat_payer ? inv.vat_rate : 0)}
          ${t('TVA', n2(l.vat))}
        </Linie>`).join('\n')}
      </Continut>
    </Detalii>
  </Factura>`;
}

export const sagaXml = (invoices) => `<?xml version="1.0" encoding="UTF-8"?>\n<Facturi>\n${invoices.map(sagaFactura).join('\n')}\n</Facturi>\n`;
export const sagaFileName = (inv) => `F_${String(JSON.parse(inv.supplier_json || '{}').cui || '').replace(/\s/g, '')}_${inv.full_number}_${roDate(inv.issued_on)}.xml`;

// ---------------- ZIP simplu (fără compresie), ca să descarci câte un fișier XML pe factură ----------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zipFiles(files) {
  const enc = new TextEncoder();
  const chunks = []; const central = []; let offset = 0;
  const d = new Date(); const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = enc.encode(f.name); const data = enc.encode(f.content); const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    chunks.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, size, true); e.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((s, b) => s + b.length, 0));
  let p = 0; for (const b of all) { out.set(b, p); p += b.length; }
  return out;
}

// ---------------- Ștergere (pentru teste) ----------------
// După ștergere, numărătoarea seriei coboară la ultimul număr rămas, ca să nu rămână goluri la final.
async function resetCounters(env, s, series) {
  for (const ser of new Set(series)) {
    const start = Math.max(1, Number(s.inv_start) || 1) - 1;
    await env.DB.prepare('UPDATE counters SET value = COALESCE((SELECT MAX(number) FROM invoices WHERE series = ?), ?) WHERE name = ?')
      .bind(ser, start, 'inv_' + ser).run();
  }
}

export async function deleteInvoices(env, s, ids) {
  if (!ids.length) return 0;
  const q = ids.map(() => '?').join(',');
  // o factură ștearsă își ia cu ea și storno-ul
  const { results } = await env.DB.prepare(`SELECT * FROM invoices WHERE id IN (${q}) OR ref_id IN (${q})`).bind(...ids, ...ids).all();
  const rows = results || [];
  if (!rows.length) return 0;
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM invoices WHERE id IN (${rows.map(() => '?').join(',')})`).bind(...rows.map((r) => r.id)),
    ...rows.map((r) => env.DB.prepare('INSERT INTO order_events(order_id, message) VALUES (?, ?)').bind(r.order_id, `${r.kind === 'storno' ? 'Factura storno' : 'Factura'} ${r.full_number} a fost ștearsă din admin.`)),
  ]);
  await resetCounters(env, s, rows.map((r) => r.series));
  return rows.length;
}

export async function deleteOrderInvoices(env, s, orderId) {
  const { results } = await env.DB.prepare('SELECT id, series FROM invoices WHERE order_id = ?').bind(orderId).all();
  if (!results?.length) return;
  await env.DB.prepare('DELETE FROM invoices WHERE order_id = ?').bind(orderId).run();
  await resetCounters(env, s, results.map((r) => r.series));
}
