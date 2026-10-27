import { html } from '../lib/html.js';
import { moneyNum } from '../lib/util.js';
import { roDate, CNP_GENERIC } from '../lib/invoices.js';

const PAY = { ramburs: 'Ramburs (numerar la livrare)', card: 'Card online' };
const num = (bani) => moneyNum(bani);
const unit = (l) => moneyNum(Math.round(l.base / l.qty));

// Factura ca pagină A4 printabilă (din browser: Printează → Salvează ca PDF).
export function invoicePage(inv, { admin = false, orderToken = '' } = {}) {
  const sup = JSON.parse(inv.supplier_json || '{}');
  const buy = JSON.parse(inv.buyer_json || '{}');
  const lines = JSON.parse(inv.lines_json || '[]');
  const storno = inv.kind === 'storno';
  const vat = !!inv.vat_payer;
  const rate = String(inv.vat_rate).replace('.', ',');
  return html`<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Factura ${inv.full_number}</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#eef2f7;color:#111c2d;font:14px/1.45 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
  .bar{max-width:820px;margin:16px auto 0;padding:0 16px;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
  .bar a,.bar button{font:inherit;font-weight:600;padding:10px 16px;border-radius:9px;border:1px solid #c9d3e0;background:#fff;color:#111c2d;text-decoration:none;cursor:pointer}
  .bar button{background:#155ecc;border-color:#155ecc;color:#fff}
  .sheet{max-width:820px;margin:12px auto 32px;background:#fff;padding:40px 44px;border-radius:12px;box-shadow:0 2px 14px rgba(15,30,60,.08)}
  .top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:2px solid #111c2d;padding-bottom:18px}
  h1{margin:0;font-size:26px;letter-spacing:.02em} .storno h1{color:#b42318}
  .meta{text-align:right;font-size:14px} .meta b{font-size:16px}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:22px 0}
  .parties h2{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#5b6b80}
  .parties p{margin:0} .parties .n{font-weight:700;font-size:15px}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#5b6b80;text-align:left;border-bottom:1px solid #cfd8e3;padding:8px 6px}
  td{padding:9px 6px;border-bottom:1px solid #edf1f6;vertical-align:top} .r{text-align:right} td.r{white-space:nowrap} .c{text-align:center}
  .tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .tot{margin:16px 0 0 auto;width:min(100%,320px)} .tot div{display:flex;justify-content:space-between;padding:5px 0}
  .tot .g{border-top:2px solid #111c2d;margin-top:4px;padding-top:9px;font-size:17px;font-weight:800}
  .foot{margin-top:28px;font-size:12px;color:#5b6b80;border-top:1px solid #edf1f6;padding-top:12px}
  .note{background:#fff4f2;border:1px solid #f5c2bb;border-radius:8px;padding:9px 12px;margin:0 0 14px;color:#7a1c12}
  @media (max-width:640px){.sheet{padding:22px 16px;border-radius:0}.top,.parties{display:block}.meta{text-align:left;margin-top:12px}.parties>div+div{margin-top:16px}
    th:nth-child(3),td:nth-child(3){display:none} td,th{padding:8px 3px;font-size:13px} th{font-size:10.5px} .nv{display:none} .bar{justify-content:stretch} .bar>*{flex:1;text-align:center}}
  @media print{body{background:#fff}.bar{display:none}.sheet{box-shadow:none;margin:0;max-width:none;padding:0}@page{size:A4;margin:14mm}}
</style></head><body>
<div class="bar">
  ${admin ? html`<a href="/admin/comenzi/${inv.order_id}">Înapoi la comandă</a>` : orderToken ? html`<a href="/multumim/${orderToken}">Înapoi la comandă</a>` : ''}
  <button type="button" onclick="window.print()">Descarcă PDF / Printează</button>
</div>
<div class="sheet ${storno ? 'storno' : ''}">
  <div class="top">
    <div><h1>${storno ? 'FACTURĂ STORNO' : 'FACTURĂ'}</h1></div>
    <div class="meta">
      <div>Seria <b>${inv.series}</b> nr. <b>${inv.full_number.slice(inv.series.length)}</b></div>
      <div>Data emiterii: <b>${roDate(inv.issued_on)}</b></div>
      <div>Moneda: RON${vat ? html` · Cota TVA: ${rate}%` : ''}</div>
    </div>
  </div>
  <div class="parties">
    <div>
      <h2>Furnizor</h2>
      <p class="n">${sup.name}</p>
      <p>CUI: ${sup.cui}</p>
      ${sup.reg ? html`<p>Nr. Reg. Com.: ${sup.reg}</p>` : ''}
      ${sup.capital ? html`<p>Capital social: ${sup.capital}</p>` : ''}
      <p>Sediu: ${sup.address}</p>
      ${sup.iban ? html`<p>IBAN: ${sup.iban}${sup.bank ? ` · ${sup.bank}` : ''}</p>` : ''}
      ${!vat ? html`<p>Neplătitor de TVA</p>` : ''}
    </div>
    <div>
      <h2>Cumpărător</h2>
      <p class="n">${buy.name}</p>
      ${buy.cif && buy.cif !== CNP_GENERIC ? html`<p>CIF/CNP: ${buy.cif}</p>` : ''}
      <p>${buy.address}</p>
      <p>${buy.city}, jud. ${buy.county}${buy.zip ? `, ${buy.zip}` : ''}</p>
      <p>${buy.country || 'România'}</p>
    </div>
  </div>
  ${inv.note ? html`<p class="${storno ? 'note' : ''}">${inv.note}</p>` : ''}
  <div class="tw"><table>
    <thead><tr><th class="c">Nr.</th><th>Denumire</th><th class="c">UM</th><th class="r">Cant.</th><th class="r">Preț unitar${vat ? html`<span class="nv"> (fără TVA)</span>` : ''}</th><th class="r">Valoare${vat ? html`<span class="nv"> (fără TVA)</span>` : ''}</th>${vat ? html`<th class="r">TVA</th>` : ''}</tr></thead>
    <tbody>${lines.map((l, k) => html`<tr><td class="c">${k + 1}</td><td>${l.desc}${l.code && !/^(TRANSPORT|RAMBURS)$/.test(l.code) ? html`<br><small style="color:#5b6b80">Cod: ${l.code}</small>` : ''}</td><td class="c">${l.um || 'buc'}</td>
      <td class="r">${l.qty}</td><td class="r">${unit(l)}</td><td class="r">${num(l.base)}</td>${vat ? html`<td class="r">${num(l.vat)}</td>` : ''}</tr>`)}</tbody>
  </table></div>
  <div class="tot">
    ${vat ? html`<div><span>Total fără TVA</span><span>${num(inv.base_total)} lei</span></div><div><span>TVA ${rate}%</span><span>${num(inv.vat_total)} lei</span></div>` : ''}
    <div class="g"><span>Total de plată</span><span>${num(inv.total)} lei</span></div>
  </div>
  <p style="margin-top:14px">Modalitate de plată: ${PAY[inv.payment_method] || inv.payment_method}</p>
  <div class="foot">Factură emisă electronic${sup.email ? ` · ${sup.email}` : ''}. Conform art. 319 alin. (29) din Codul fiscal, semnătura și ștampila nu sunt obligatorii.</div>
</div>
</body></html>`;
}
