// Factura ca PDF A4 (generat pe server, același aspect pe telefon și pe calculator).
import { PdfDoc, parseTTF } from './pdf.js';
import { moneyNum } from './util.js';
import { roDate, CNP_GENERIC } from './invoices.js';

const C = { ink: '#101d30', muted: '#5b6b80', line: '#dfe5ed', soft: '#f3f6fb', navy: '#0e192a', blue: '#155ecc', red: '#b42318', redSoft: '#fff1ef' };
const PAY = { ramburs: 'Ramburs (numerar la livrare)', card: 'Card online' };

let FONTS = null;
async function loadFonts(env) {
  if (FONTS) return FONTS;
  const get = async (name) => {
    const r = await env.ASSETS.fetch(new Request(`https://assets.local/assets/fonts/${name}`));
    if (!r.ok) throw new Error(`fontul ${name} lipsește`);
    const ttf = parseTTF(new Uint8Array(await r.arrayBuffer()));
    // varianta deja comprimată a fontului (generată o dată, în public/assets/fonts/*.ttf.z) – evită comprimarea pe server
    const z = await env.ASSETS.fetch(new Request(`https://assets.local/assets/fonts/${name}.z`)).catch(() => null);
    if (z && z.ok) ttf.packed = new Uint8Array(await z.arrayBuffer());
    return ttf;
  };
  FONTS = { R: await get('pjs-Regular.ttf'), B: await get('pjs-Bold.ttf') };
  return FONTS;
}

export async function invoicePdf(env, inv, { storeName = 'chimag', site = 'www.chimag.ro' } = {}) {
  const sup = JSON.parse(inv.supplier_json || '{}');
  const buy = JSON.parse(inv.buyer_json || '{}');
  const lines = JSON.parse(inv.lines_json || '[]');
  const storno = inv.kind === 'storno';
  const vat = !!inv.vat_payer;
  const rate = String(inv.vat_rate).replace('.', ',');
  const doc = new PdfDoc(await loadFonts(env));
  const M = 42, R = doc.W - M, CW = R - M; // margini
  const BOTTOM = doc.H - 70;

  // ---------- antet ----------
  doc.text((storeName || 'chimag').toLowerCase(), M, 62, { font: 'B', size: 24, color: C.blue });
  doc.text(site, M, 78, { size: 8.5, color: C.muted });
  doc.text(storno ? 'FACTURĂ STORNO' : 'FACTURĂ', R, 58, { font: 'B', size: 22, color: storno ? C.red : C.ink, align: 'right' });
  doc.text(`Seria ${inv.series}  nr. ${inv.full_number.slice(inv.series.length)}`, R, 76, { font: 'B', size: 10.5, align: 'right' });
  doc.text(`Data emiterii: ${roDate(inv.issued_on)}`, R, 90, { size: 9.5, align: 'right' });
  doc.text(`Moneda: RON${vat ? `  ·  Cota TVA: ${rate}%` : ''}`, R, 103, { size: 9.5, color: C.muted, align: 'right' });
  doc.line(M, 116, R, 116, { color: C.ink, lw: 1.4 });

  // ---------- furnizor / cumpărător ----------
  const colW = (CW - 14) / 2;
  const supLines = [
    ['B', sup.name], ['R', `CUI: ${sup.cui}`], sup.reg ? ['R', `Nr. Reg. Com.: ${sup.reg}`] : null,
    sup.capital ? ['R', `Capital social: ${sup.capital}`] : null, ['R', `Sediu: ${sup.address}`],
    sup.iban ? ['R', `IBAN: ${sup.iban}`] : null, sup.bank ? ['R', `Banca: ${sup.bank}`] : null,
    !vat ? ['R', 'Neplătitor de TVA'] : null,
  ].filter(Boolean);
  const buyLines = [
    ['B', buy.name], buy.cif && buy.cif !== CNP_GENERIC ? ['R', `CIF/CNP: ${buy.cif}`] : null,
    ['R', buy.address], ['R', `${buy.city}, jud. ${buy.county}${buy.zip ? `, ${buy.zip}` : ''}`], ['R', buy.country || 'România'],
  ].filter(Boolean);
  const layoutParty = (arr) => arr.flatMap(([f, t]) => doc.wrap(t, f, f === 'B' ? 10.5 : 9.2, colW - 24).map((l) => [f, l]));
  const sl = layoutParty(supLines), bl = layoutParty(buyLines);
  const boxH = 34 + Math.max(sl.length, bl.length) * 13;
  const boxY = 130;
  [[M, 'FURNIZOR', sl], [M + colW + 14, 'CUMPĂRĂTOR', bl]].forEach(([x, label, arr]) => {
    doc.rect(x, boxY, colW, boxH, { fill: C.soft });
    doc.text(label, x + 12, boxY + 18, { font: 'B', size: 7.5, color: C.muted });
    arr.forEach(([f, t], i) => doc.text(t, x + 12, boxY + 34 + i * 13, { font: f, size: f === 'B' ? 10.5 : 9.2 }));
  });
  let y = boxY + boxH + 22;

  // ---------- notă (comanda / storno) ----------
  if (storno) {
    doc.rect(M, y - 13, CW, 22, { fill: C.redSoft, stroke: '#f5c2bb' });
    doc.text(inv.note, M + 10, y + 1, { size: 9.2, color: C.red });
    y += 26;
  } else if (inv.note) {
    doc.text(`${inv.note}  ·  Plata: ${PAY[inv.payment_method] || inv.payment_method}`, M, y, { size: 9.2, color: C.muted });
    y += 16;
  }

  // ---------- tabel ----------
  const cols = vat
    ? [['Nr.', 24, 'c'], ['Denumire produs / serviciu', 0, 'l'], ['UM', 30, 'c'], ['Cant.', 38, 'r'], ['Preț unitar', 66, 'r'], ['Valoare', 70, 'r'], ['TVA', 58, 'r']]
    : [['Nr.', 24, 'c'], ['Denumire produs / serviciu', 0, 'l'], ['UM', 34, 'c'], ['Cant.', 42, 'r'], ['Preț unitar', 78, 'r'], ['Valoare', 84, 'r']];
  const fixed = cols.reduce((s, c) => s + c[1], 0);
  cols[1][1] = CW - fixed;
  const xs = []; cols.reduce((x, c) => { xs.push(x); return x + c[1]; }, M);
  const cellX = (i) => (cols[i][2] === 'r' ? xs[i] + cols[i][1] - 6 : cols[i][2] === 'c' ? xs[i] + cols[i][1] / 2 : xs[i] + 6);
  const header = () => {
    doc.rect(M, y, CW, 22, { fill: C.navy });
    cols.forEach((c, i) => doc.text(c[0] + (vat && (i === 4 || i === 5) ? '*' : ''), cellX(i), y + 14.5, { font: 'B', size: 8, color: '#ffffff', align: { r: 'right', c: 'center', l: 'left' }[c[2]] }));
    y += 22;
  };
  const footer = (page, total) => {
    doc.line(M, doc.H - 46, R, doc.H - 46);
    doc.text(`Factură emisă electronic${sup.email ? ` · ${sup.email}` : ''} · Semnătura și ștampila nu sunt obligatorii (art. 319 alin. 29 Cod fiscal).`, M, doc.H - 32, { size: 7.5, color: C.muted });
    doc.text(`Pagina ${page} din ${total}`, R, doc.H - 20, { size: 7.5, color: C.muted, align: 'right' });
  };
  header();
  lines.forEach((l, k) => {
    const desc = doc.wrap(l.desc, 'R', 9.2, cols[1][1] - 12);
    const showCode = l.code && !/^(TRANSPORT|RAMBURS)$/.test(l.code);
    const h = 10 + desc.length * 12 + (showCode ? 11 : 0);
    if (y + h > BOTTOM - 10) { doc.addPage(); y = 50; header(); }
    if (k % 2 === 1) doc.rect(M, y, CW, h, { fill: '#fafbfd' });
    const base = y + 15;
    const vals = [String(k + 1), null, l.um || 'buc', String(l.qty), moneyNum(Math.round(l.base / l.qty)), moneyNum(l.base), vat ? moneyNum(l.vat) : null];
    vals.forEach((v, i) => { if (v != null && cols[i]) doc.text(v, cellX(i), base, { size: 9.2, align: { r: 'right', c: 'center', l: 'left' }[cols[i][2]] }); });
    desc.forEach((d, i) => doc.text(d, cellX(1), base + i * 12, { size: 9.2 }));
    if (showCode) doc.text(`Cod: ${l.code}`, cellX(1), base + desc.length * 12, { size: 7.5, color: C.muted });
    y += h;
    doc.line(M, y, R, y);
  });

  // ---------- totaluri ----------
  const totRows = vat ? [['Total fără TVA', inv.base_total], [`TVA ${rate}%`, inv.vat_total]] : [];
  const needed = 26 + totRows.length * 18 + 40;
  if (y + needed > BOTTOM) { doc.addPage(); y = 50; }
  y += 22;
  const TX = R - 230;
  totRows.forEach(([label, v]) => { doc.text(label, TX, y, { size: 9.5, color: C.muted }); doc.text(`${moneyNum(v)} lei`, R, y, { size: 9.5, align: 'right' }); y += 18; });
  doc.rect(TX - 10, y - 8, 240, 32, { fill: storno ? C.redSoft : C.soft });
  doc.text(storno ? 'Total storno' : 'Total de plată', TX, y + 12, { font: 'B', size: 11 });
  doc.text(`${moneyNum(inv.total)} lei`, R - 4, y + 12, { font: 'B', size: 13, color: storno ? C.red : C.ink, align: 'right' });
  y += 44;
  if (vat) doc.text('* Prețurile unitare și valorile sunt fără TVA.', M, y, { size: 7.5, color: C.muted });
  if (storno) doc.text(`Plata inițială: ${PAY[inv.payment_method] || inv.payment_method}`, M, y + (vat ? 12 : 0), { size: 8.5, color: C.muted });

  const total = doc.pages.length;
  doc.pages.forEach((p, i) => { doc.page = p; footer(i + 1, total); });
  return doc.output({ title: `${storno ? 'Factura storno' : 'Factura'} ${inv.full_number}`, author: sup.name || '' });
}

export const invoicePdfName = (inv) => `${inv.kind === 'storno' ? 'Factura-storno' : 'Factura'}-${inv.full_number}.pdf`;

// PDF-ul facturii ca răspuns HTTP: se deschide în browser (pe telefon, în vizualizatorul de PDF) sau se descarcă
export async function invoicePdfResponse(env, inv, download = false) {
  const { getSettings } = await import('./db.js');
  const settings = await getSettings(env);
  const pdf = await invoicePdf(env, inv, { storeName: settings.store_name, site: String(env.SITE_URL || 'https://www.chimag.ro').replace(/^https?:\/\//, '').replace(/\/$/, '') });
  return new Response(pdf, { headers: {
    'content-type': 'application/pdf', 'content-disposition': `${download ? 'attachment' : 'inline'}; filename="${invoicePdfName(inv)}"`,
    'cache-control': 'no-store', 'x-robots-tag': 'noindex',
  } });
}
