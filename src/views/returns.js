// Paginile publice de retur: /retur (găsește comanda) și /retur/:token (cererea de retragere)
import { html } from '../lib/html.js';
import { money, formatDate } from '../lib/util.js';
import { RETURN_STATUSES, RETURN_REASONS, fmtIban, returnAddressLines, returnWindow } from '../lib/returns.js';

const addrBox = () => html`<div class="ret-addr"><span class="ret-addr-lbl">Adresa de retur</span>${returnAddressLines().map((l, i) => (i === 0 ? html`<strong>${l}</strong>` : html`<span>${l}</span>`))}</div>`;

const howTo = (days = 14) => html`<ol class="ret-steps">
  <li><b>Trimiți cererea de mai sus.</b> Primești imediat pe email confirmarea, cu data și ora cererii.</li>
  <li><b>Împachetezi produsele</b>, cu accesoriile primite, și scrii pe colet <b>„Retur” + numărul comenzii</b>.</li>
  <li><b>Trimiți coletul cu orice curier</b> (FAN Courier, Sameday, Poșta, easybox) la adresa de retur, în cel mult 14 zile de la cerere. Transportul de retur îl plătești tu.</li>
  <li><b>Primești banii</b> în contul indicat, după ce coletul ajunge la depozit, în cel mult 14 zile de la cerere.</li>
</ol>`;

export function returnLookupPage({ settings, error = '', number = '' }) {
  return html`<div class="wrap narrow page ret-page">
    <h1>Returnează un produs</h1>
    <p class="page-lead">Ai ${returnWindow(settings)} zile de la primirea coletului să te răzgândești, fără să ne spui de ce. Scrie numărul comenzii și telefonul sau emailul folosit la comandă.</p>
    <form method="post" action="/retur" class="card track-form">
      ${error ? html`<p class="form-error">${error}</p>` : ''}
      <div class="field-row">
        <div class="field"><label for="r-number">Număr comandă</label><input id="r-number" name="number" required value="${number}" placeholder="ex: CHI-1024" autocapitalize="characters"></div>
        <div class="field"><label for="r-contact">Telefon sau email</label><input id="r-contact" name="contact" required placeholder="07xx xxx xxx sau email" autocomplete="tel"></div>
      </div>
      <button class="btn btn-primary btn-lg btn-block">Continuă</button>
    </form>
    <section class="card"><h2>Cum funcționează returul</h2>${howTo()}${addrBox()}</section>
    <p class="muted center">Detalii complete în <a href="/pagina/retur">Politica de retur</a>. Preferi pe hârtie? Folosește <a href="/pagina/formular-retragere">formularul de retragere</a>.</p>
  </div>`;
}

export function returnOrderPage({ order, items, images, elig, existing = [], error = '', sent = false, form = {} }) {
  const WINDOW_DAYS = elig.days || 14;
  const last = existing[0];
  const head = html`<h1>Retur pentru comanda ${order.number}</h1>`;
  if (sent && last) {
    return html`<div class="wrap narrow page ret-page">${head}
      <div class="card ret-ok"><h2>✅ Am primit cererea ta de retur R-${last.id}</h2>
        <p>Înregistrată pe <b>${formatDate(last.created_at)}</b>. Ți-am trimis confirmarea și pe email${order.email ? html` la <b>${order.email}</b>` : ''}.</p>
        <p>Suma de rambursat: <b>${money(last.amount)}</b>${last.full_return ? ' (toată comanda, inclusiv transportul inițial)' : ''}.</p></div>
      <section class="card"><h2>Ce urmează</h2>${howTo()}${addrBox()}</section>
      <p class="center"><a class="btn btn-ghost" href="/">Înapoi la magazin</a></p>
    </div>`;
  }
  const list = existing.length ? html`<section class="card"><h2>Cererile tale de retur</h2><ul class="ret-list">${existing.map((r) => html`<li>
      <div><b>R-${r.id}</b> · ${formatDate(r.created_at)}<small>${r.items.map((i) => `${i.qty} × ${i.title}`).join(', ')} · ${money(r.amount)}</small></div>
      <span class="ret-st st-${r.status}">${RETURN_STATUSES[r.status]}</span></li>`)}</ul>
      ${existing.some((r) => r.status === 'noua') ? html`<p class="muted">Ai trimis deja cererea. Acum trimite coletul la adresa de mai jos; te anunțăm pe email când îți returnăm banii.</p>${addrBox()}` : ''}</section>` : '';
  if (!elig.ok) {
    return html`<div class="wrap narrow page ret-page">${head}${list}
      <div class="card">${elig.why === 'anulata'
        ? html`<p>Comanda este anulată sau nu a fost ridicată, deci nu e nimic de returnat.</p>`
        : html`<p>Termenul legal de ${WINDOW_DAYS} zile pentru retragere a expirat (comanda a fost livrată pe ${formatDate(elig.delivered)}).</p><p>Dacă produsul are o problemă, beneficiezi de garanția legală de 2 ani: <a href="/pagina/contact">scrie-ne</a> și te ajutăm.</p>`}</div>
    </div>`;
  }
  const allOpen = existing.some((r) => r.status === 'noua' || r.status === 'primita');
  const card = order.payment_method === 'card' && order.payment_status === 'platita';
  return html`<div class="wrap narrow page ret-page">${head}
    <p class="page-lead">${elig.until ? html`Poți trimite cererea până pe <b>${formatDate(elig.until.toISOString().slice(0, 19).replace('T', ' ')).slice(0, 10)}</b>.` : elig.before ? 'Comanda nu a fost încă livrată; poți anunța de pe acum că renunți la ea.' : 'Poți trimite cererea de retur mai jos.'}</p>
    ${list}
    <form method="post" action="/retur/${order.token}" class="card ret-form">
      <h2>${allOpen ? 'Mai returnezi și alte produse?' : 'Ce produse returnezi?'}</h2>
      ${error ? html`<p class="form-error">${error}</p>` : ''}
      <ul class="ret-items">${items.map((i) => {
        const img = images.get(i.product_id)?.img;
        const sel = form.items ? form.items[i.id] ?? 0 : i.qty;
        return html`<li><label class="ret-item">
          <span class="ri-img">${img ? html`<img src="${img}" alt="" width="52" height="52" loading="lazy">` : ''}</span>
          <span class="ri-name">${i.title}<small>${i.qty} buc. · ${money(i.total)}</small></span>
          <select name="qty_${i.id}" aria-label="Câte bucăți returnezi din ${i.title}">${Array.from({ length: i.qty + 1 }, (_, q) => html`<option value="${q}" ${q === Number(sel) ? 'selected' : ''}>${q === 0 ? 'Nu returnez' : `${q} buc.`}</option>`)}</select>
        </label></li>`;
      })}</ul>
      <div class="field"><label for="r-reason">Motiv <span class="opt">(opțional, nu e obligatoriu)</span></label>
        <select id="r-reason" name="reason"><option value="">Prefer să nu spun</option>${RETURN_REASONS.map((r) => html`<option ${form.reason === r ? 'selected' : ''}>${r}</option>`)}</select></div>
      ${card ? html`<p class="muted">Ai plătit cu cardul: banii se întorc pe același card.</p>` : html`
      <div class="field-row">
        <div class="field"><label for="r-iban">IBAN pentru rambursare</label><input id="r-iban" name="iban" required value="${form.iban ? fmtIban(form.iban) : ''}" placeholder="RO49 AAAA 1B31 0075 9384 0000" autocomplete="off" autocapitalize="characters" inputmode="text"></div>
        <div class="field"><label for="r-holder">Titularul contului</label><input id="r-holder" name="holder" required value="${form.holder ?? order.customer_name}" autocomplete="name"></div>
      </div>`}
      <div class="field"><label for="r-msg">Mesaj <span class="opt">(opțional)</span></label><textarea id="r-msg" name="message" rows="3" placeholder="Orice detaliu util pentru noi">${form.message || ''}</textarea></div>
      <button class="btn btn-primary btn-lg btn-block">Trimite cererea de retragere</button>
      <p class="muted ret-legal">Prin trimitere îți exerciți dreptul de retragere din contract (OUG nr. 34/2014). Primești imediat confirmarea pe email, cu data și ora cererii.</p>
    </form>
    <section class="card"><h2>Cum trimiți coletul</h2>${howTo()}${addrBox()}</section>
  </div>`;
}
