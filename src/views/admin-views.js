import { html, raw } from '../lib/html.js';
import { money, moneyNum, formatDate } from '../lib/util.js';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../lib/db.js';
import { PROVIDERS } from '../shipping/providers.js';
import { JUDETE } from '../lib/judete.js';
import { logoMark } from './layout.js';
import { COUPON_TYPES, CODE_TYPES, wheelConfig, prizeOdds, describeCoupon } from '../lib/coupons.js';
import { parseJSON } from '../lib/util.js';

export function adminLayout({ title, active, body, flash, newCount = 0, msgCount = 0 }) {
  const nav = [
    ['/admin', 'panou', 'Panou'],
    ['/admin/comenzi', 'comenzi', 'Comenzi'],
    ['/admin/facturi', 'facturi', 'Facturi'],
    ['/admin/produse', 'produse', 'Produse'],
    ['/admin/coduri', 'coduri', 'Roată și coduri'],
    ['/admin/clienti', 'clienti', 'Clienți'],
    ['/admin/mesaje', 'mesaje', 'Mesaje'],
    ['/admin/setari', 'setari', 'Setări'],
  ];
  return html`<html lang="ro"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · Admin Chimag</title>
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/admin.css?v=4">
<script src="/assets/admin.js?v=1" defer></script>
</head><body>
<div class="shell">
  <aside class="side">
    <a class="brand" href="/admin">${logoMark()}<span>chimag</span></a>
    <nav>${nav.map(([href, key, label]) => html`<a href="${href}" class="${active === key ? 'on' : ''}">${label}${key === 'comenzi' && newCount ? html`<b class="count">${newCount}</b>` : ''}${key === 'mesaje' && msgCount ? html`<b class="count">${msgCount}</b>` : ''}</a>`)}</nav>
    <div class="side-foot">
      <a href="/" target="_blank">Vezi magazinul</a>
      <form method="post" action="/admin/logout"><button class="linklike">Ieșire</button></form>
    </div>
  </aside>
  <main class="content">
    ${flash?.ok ? html`<div class="flash ok">${flash.ok}</div>` : ''}
    ${flash?.err ? html`<div class="flash err">${flash.err}</div>` : ''}
    ${body}
  </main>
</div>
</body></html>`;
}

export function loginView(error) {
  return html`<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Autentificare · Admin</title><link rel="stylesheet" href="/assets/admin.css?v=4"></head>
<body class="login-body"><form class="login" method="post" action="/admin/login">
  <div class="brand">${logoMark()}<span>chimag</span></div>
  <h1>Administrare</h1>
  ${error ? html`<p class="flash err">${error}</p>` : ''}
  <label>Parolă<input type="password" name="password" autocomplete="current-password" required autofocus></label>
  <button class="btn primary">Intră în cont</button>
</form></body></html>`;
}

const statusChip = (s) => html`<span class="chip st-${s}">${ORDER_STATUSES[s] || s}</span>`;
const payChip = (o) => o.payment_method === 'card'
  ? html`<span class="chip ${o.payment_status === 'platita' ? 'pay-ok' : 'pay-wait'}">Card · ${PAYMENT_STATUSES[o.payment_status]}</span>`
  : html`<span class="chip pay-cod">Ramburs</span>`;

// ---------------- Panou ----------------
const PRESETS = [['azi', 'Azi'], ['ieri', 'Ieri'], ['7z', '7 zile'], ['30z', '30 de zile'], ['luna', 'Luna aceasta'], ['luna-trecuta', 'Luna trecută']];
const pct = (a, b) => (b ? `${String(Math.round((a / b) * 1000) / 10).replace('.', ',')}%` : '–');

function profitPanel(p, r) {
  if (!p) return '';
  const qs = (extra) => `/admin?${new URLSearchParams({ ...(r.scope === 'livrate' ? { comenzi: 'livrate' } : {}), ...extra })}`;
  const max = Math.max(1, ...p.series.map((x) => Math.abs(x.profit)));
  const fmtDay = (d) => d.slice(8, 10) + '.' + d.slice(5, 7);
  return html`<section class="panel profit-panel">
    <div class="profit-head">
      <h2>Profit</h2>
      <div class="chips">${PRESETS.map(([k, label]) => html`<a class="chip-link ${r.preset === k ? 'on' : ''}" href="${qs({ perioada: k })}">${label}</a>`)}</div>
    </div>
    <form method="get" action="/admin" class="profit-range">
      <label>De la<input type="date" name="de_la" value="${r.from}"></label>
      <label>Până la<input type="date" name="pana_la" value="${r.to}"></label>
      <label>Comenzi<select name="comenzi"><option value="toate" ${r.scope !== 'livrate' ? 'selected' : ''}>Toate (fără anulate, refuzate, retur)</option><option value="livrate" ${r.scope === 'livrate' ? 'selected' : ''}>Doar livrate</option></select></label>
      <button class="btn primary">Arată</button>
    </form>
    <p class="muted">Perioada ${fmtDay(r.from)}.${r.from.slice(0, 4)} – ${fmtDay(r.to)}.${r.to.slice(0, 4)} · ${p.orders} ${p.orders === 1 ? 'comandă' : 'comenzi'}</p>

    <div class="kpis profit-kpis">
      <div class="kpi"><h2>Profit estimat</h2><p class="kpi-main ${p.net < 0 ? 'err-txt' : 'ok-txt'}">${money(p.net)}</p><p class="kpi-sub">după cost produse${p.costsSet.courier || p.costsSet.helpship ? ' și livrare' : ''}</p></div>
      <div class="kpi"><h2>Profit din produse</h2><p class="kpi-main">${money(p.gross)}</p><p class="kpi-sub">marjă ${String(p.margin).replace('.', ',')}%</p></div>
      <div class="kpi"><h2>Vânzări produse</h2><p class="kpi-main">${money(p.productRevenue)}</p><p class="kpi-sub">după reduceri · încasări totale ${money(p.collected)}</p></div>
      <div class="kpi"><h2>Cost produse</h2><p class="kpi-main">${money(p.cost)}</p><p class="kpi-sub">prețul cu care le cumperi</p></div>
    </div>

    <dl class="sum profit-sum">
      <div><dt>Vânzări produse (după reduceri)</dt><dd>${money(p.productRevenue)}</dd></div>
      <div><dt>− Cost achiziție produse</dt><dd>−${money(p.cost)}</dd></div>
      <div><dt>+ Transport încasat de la clienți</dt><dd>${money(p.shippingIn)}</dd></div>
      <div><dt>− Cost livrare (${p.parcels} ${p.parcels === 1 ? 'colet' : 'colete'})</dt><dd>${p.costsSet.courier || p.costsSet.helpship ? html`−${money(p.shippingCost)}` : html`<span class="muted">nesetat</span>`}</dd></div>
      <div class="grand"><dt>Profit estimat</dt><dd>${money(p.net)}</dd></div>
    </dl>
    ${!p.costsSet.courier && !p.costsSet.helpship ? html`<p class="hint">Ca să vezi profitul real, trece în <a href="/admin/setari">Setări → Livrare</a> cât plătești tu curierului și Helpship pe colet. Până atunci, transportul încasat de la clienți intră integral la profit.</p>` : ''}
    ${p.missingCost.length ? html`<p class="flash err">Lipsește costul de achiziție la: ${p.missingCost.join(', ')}. Completează-l la produs, altfel profitul apare mai mare decât e.</p>` : ''}

    ${p.series.length > 1 ? html`<h3>Profit pe zile</h3>
    <div class="bars profit-bars">${p.series.map((x) => html`<div class="bar ${x.profit < 0 ? 'neg' : ''}" title="${fmtDay(x.day)}: ${money(x.profit)} · ${x.orders} comenzi">
      <span style="height:${Math.round((Math.abs(x.profit) / max) * 100)}%"></span><small>${p.series.length <= 31 ? fmtDay(x.day).slice(0, 2) : ''}</small></div>`)}</div>` : ''}

    <h3>Profit pe produse</h3>
    ${p.products.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Produs</th><th class="r">Buc.</th><th class="r">Vânzări</th><th class="r">Cost</th><th class="r">Profit</th><th class="r">Marjă</th></tr></thead><tbody>
      ${p.products.map((x) => html`<tr><td>${x.title}</td><td class="r">${x.qty}</td><td class="r">${money(x.revenue)}</td><td class="r">${money(x.cost)}</td><td class="r"><b>${money(x.revenue - x.cost)}</b></td><td class="r">${pct(x.revenue - x.cost, x.revenue)}</td></tr>`)}
    </tbody></table></div>` : html`<p class="muted">Nicio comandă în perioada aleasă.</p>`}
  </section>`;
}

export function dashboardView(d) {
  const maxDay = Math.max(1, ...d.days.map((x) => x.revenue));
  const delivered = d.delivery.livrata || 0;
  const refused = d.delivery.refuzata || 0;
  const rate = delivered + refused ? Math.round((delivered / (delivered + refused)) * 100) : null;
  return html`
  <header class="page-head"><h1>Panou</h1><a class="btn" href="/admin/comenzi?status=noua">Comenzi noi de confirmat: ${d.statusCounts.noua || 0}</a></header>
  ${profitPanel(d.profit, d.range)}
  <section class="kpis">
    ${[['Azi', d.today], ['Ultimele 7 zile', d.week], ['Ultimele 30 de zile', d.month]].map(([label, k]) => html`
      <div class="kpi"><h2>${label}</h2><p class="kpi-main">${money(k.revenue)}</p>
      <p class="kpi-sub">${k.orders} ${k.orders === 1 ? 'comandă' : 'comenzi'} · coș mediu ${money(k.orders ? Math.round(k.revenue / k.orders) : 0)}</p></div>`)}
    <div class="kpi"><h2>Rată de livrare (30 zile)</h2><p class="kpi-main">${rate == null ? '–' : rate + '%'}</p>
      <p class="kpi-sub">${delivered} livrate · ${refused} refuzate</p></div>
  </section>

  <div class="two-col">
    <section class="panel">
      <h2>Vânzări pe zile (14 zile)</h2>
      <div class="bars">${d.days.map((x) => html`<div class="bar" title="${x.label}: ${money(x.revenue)} · ${x.orders} comenzi">
        <span style="height:${Math.round((x.revenue / maxDay) * 100)}%"></span><small>${x.short}</small></div>`)}</div>
    </section>
    <section class="panel">
      <h2>Comenzi pe status</h2>
      <ul class="status-list">${Object.entries(ORDER_STATUSES).map(([k, v]) => html`<li><a href="/admin/comenzi?status=${k}">${statusChip(k)}<b>${d.statusCounts[k] || 0}</b></a></li>`)}</ul>
    </section>
  </div>

  <div class="two-col">
    <section class="panel">
      <h2>Surse de trafic (30 zile)</h2>
      ${d.sources.length ? html`<table class="tbl"><thead><tr><th>Sursă</th><th>Comenzi</th><th>Vânzări</th></tr></thead><tbody>
        ${d.sources.map((s) => html`<tr><td>${s.source}</td><td>${s.orders}</td><td>${money(s.revenue)}</td></tr>`)}</tbody></table>`
        : html`<p class="muted">Apar aici după primele comenzi venite din reclame (parametri utm_source).</p>`}
    </section>
    <section class="panel">
      <h2>Produse vândute (30 zile)</h2>
      ${d.top.length ? html`<table class="tbl"><thead><tr><th>Produs</th><th>Buc.</th><th>Vânzări</th></tr></thead><tbody>
        ${d.top.map((t) => html`<tr><td>${t.title}</td><td>${t.qty}</td><td>${money(t.revenue)}</td></tr>`)}</tbody></table>`
        : html`<p class="muted">Încă nu există vânzări.</p>`}
    </section>
  </div>

  <section class="panel">
    <h2>Ultimele comenzi</h2>
    ${ordersTable(d.latest, false)}
  </section>`;
}

function ordersTable(orders, selectable = true) {
  if (!orders.length) return html`<p class="muted">Nicio comandă aici.</p>`;
  return html`<div class="tbl-wrap"><table class="tbl orders">
    <thead><tr>${selectable ? html`<th><input type="checkbox" data-check-all aria-label="Selectează tot"></th>` : ''}<th>Comandă</th><th>Data</th><th>Client</th><th>Localitate</th><th class="r">Total</th><th>Plată</th><th>Status</th><th>AWB</th></tr></thead>
    <tbody>${orders.map((o) => html`<tr>
      ${selectable ? html`<td><input type="checkbox" name="ids" value="${o.id}" form="bulk" aria-label="Selectează ${o.number}"></td>` : ''}
      <td><a href="/admin/comenzi/${o.id}"><b>${o.number}</b></a>${o.fulfillment_mode === 'helpship' ? html`<br><span class="chip chip-hs">Helpship</span>` : o.fulfillment_mode === 'mixt' ? html`<br><span class="chip chip-hs">2 colete</span>` : ''}</td>
      <td class="nowrap">${formatDate(o.created_at)}</td>
      <td>${o.customer_name}<br><a class="muted" href="tel:${o.phone}">${o.phone}</a></td>
      <td>${o.city}<br><span class="muted">${o.county}</span></td>
      <td class="r nowrap"><b>${money(o.total)}</b></td>
      <td>${payChip(o)}</td>
      <td>${statusChip(o.status)}</td>
      <td class="nowrap">${o.awb ? (o.tracking_url ? html`<a href="${o.tracking_url}" target="_blank">${o.awb}</a>` : o.awb) : o.shipping_error ? html`<span class="err-txt" title="${o.shipping_error}">eroare</span>` : html`<span class="muted">–</span>`}</td>
    </tr>`)}</tbody></table></div>`;
}

// ---------------- Comenzi ----------------
export function ordersView({ orders, status, q, counts, page, hasMore }) {
  const tabs = [['', 'Toate'], ...Object.entries(ORDER_STATUSES)];
  const qs = (extra) => {
    const p = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), ...extra });
    return '?' + p.toString();
  };
  return html`
  <header class="page-head"><h1>Comenzi</h1><a class="btn" href="/admin/comenzi/export.csv${qs({})}">Export CSV</a></header>
  <nav class="tabs">${tabs.map(([k, v]) => html`<a href="/admin/comenzi${k ? `?status=${k}` : ''}" class="${status === k ? 'on' : ''}">${v} <small>${k ? counts[k] || 0 : counts._all || 0}</small></a>`)}</nav>
  <div class="toolbar">
    <form method="get" class="search">
      ${status ? html`<input type="hidden" name="status" value="${status}">` : ''}
      <input type="search" name="q" value="${q}" placeholder="Caută după nr. comandă, nume, telefon, AWB">
      <button class="btn">Caută</button>
    </form>
    <form method="post" action="/admin/comenzi/bulk" id="bulk" class="bulk" data-bulk>
      <select name="action" required>
        <option value="">Acțiune pentru selectate…</option>
        <option value="confirmata">Marchează Confirmată</option>
        <option value="awb">Generează AWB</option>
        <option value="expediata">Marchează Expediată</option>
        <option value="livrata">Marchează Livrată</option>
        <option value="refuzata">Marchează Refuzată</option>
        <option value="anulata">Anulează</option>
      </select>
      <button class="btn">Aplică</button>
    </form>
  </div>
  ${ordersTable(orders)}
  <nav class="pager">
    ${page > 1 ? html`<a class="btn" href="${qs({ page: page - 1 })}">Pagina anterioară</a>` : ''}
    ${hasMore ? html`<a class="btn" href="${qs({ page: page + 1 })}">Pagina următoare</a>` : ''}
  </nav>`;
}

export function orderView({ order: o, items, events, settings, provider, hsOn = false, invoices = [], invProblem = '' }) {
  const providerObj = PROVIDERS[o.shipping_provider || settings.shipping_provider] || PROVIDERS.test;
  const quick = {
    noua: [['confirmata', 'Confirmă comanda', 'primary'], ['anulata', 'Anulează', '']],
    confirmata: [['expediata', 'Marchează Expediată', ''], ['anulata', 'Anulează', '']],
    expediata: [['livrata', 'Livrată', 'primary'], ['refuzata', 'Refuzată', '']],
    refuzata: [['retur', 'Retur primit în depozit', '']],
  }[o.status] || [];
  return html`
  <header class="page-head">
    <div><a class="back" href="/admin/comenzi">Comenzi</a><h1>${o.number} ${statusChip(o.status)}</h1>
    <p class="muted">Plasată ${formatDate(o.created_at)} · ${payChip(o)}</p></div>
    <div class="actions">
      ${quick.map(([s, label, cls]) => html`<form method="post" action="/admin/comenzi/${o.id}/status"><input type="hidden" name="status" value="${s}"><button class="btn ${cls}" ${s === 'anulata' ? raw('data-confirm="Sigur anulezi comanda? Stocul se readaugă."') : ''}>${label}</button></form>`)}
      <form method="post" action="/admin/comenzi/${o.id}/status" class="inline">
        <select name="status" aria-label="Schimbă statusul">${Object.entries(ORDER_STATUSES).map(([k, v]) => html`<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`)}</select>
        <button class="btn">Salvează</button>
      </form>
    </div>
  </header>

  <div class="order-grid">
    <div>
      <section class="panel">
        <h2>Produse</h2>
        <table class="tbl"><thead><tr><th>Produs</th><th>SKU</th><th>Livrează</th><th class="r">Cant.</th><th class="r">Preț</th><th class="r">Total</th></tr></thead><tbody>
        ${items.map((i) => html`<tr><td>${i.title}</td><td class="muted">${i.sku}</td><td>${i.fulfillment === 'helpship' ? html`<span class="chip chip-hs">Helpship</span>` : html`<span class="muted">Noi</span>`}</td><td class="r">${i.qty}</td><td class="r">${money(i.unit_price)}</td><td class="r">${money(i.total)}${i.line_discount ? html`<br><small class="muted">−${money(i.line_discount)}</small>` : ''}</td></tr>`)}
        </tbody></table>
        <dl class="sum">
          <div><dt>Subtotal</dt><dd>${money(o.subtotal)}</dd></div>
          ${o.discount ? html`<div><dt>Reducere pachet</dt><dd>−${money(o.discount)}</dd></div>` : ''}
          ${o.coupon_discount || o.coupon_code ? html`<div><dt>Cod ${o.coupon_code}</dt><dd>${o.coupon_discount ? html`−${money(o.coupon_discount)}` : 'transport gratuit'}</dd></div>` : ''}
          <div><dt>Transport</dt><dd>${money(o.shipping)}</dd></div>
          ${o.cod_fee ? html`<div><dt>Taxă ramburs</dt><dd>${money(o.cod_fee)}</dd></div>` : ''}
          <div class="grand"><dt>Total</dt><dd>${money(o.total)}</dd></div>
          ${o.payment_method === 'ramburs' ? html`<div><dt>De încasat ramburs</dt><dd><b>${money(o.payment_status === 'platita' ? 0 : o.total)}</b></dd></div>` : ''}
          ${o.fulfillment_mode === 'mixt' ? html`<div><dt>· colet Helpship</dt><dd>${money(o.hs_total)}</dd></div><div><dt>· colet propriu</dt><dd>${money(o.own_total)}</dd></div>` : ''}
        </dl>
      </section>

      <section class="panel">
        <h2>Client și adresă</h2>
        <form method="post" action="/admin/comenzi/${o.id}/client" class="form-grid">
          <label>Nume<input name="customer_name" value="${o.customer_name}" required></label>
          <label>Telefon<input name="phone" value="${o.phone}" required></label>
          <label>Email<input name="email" value="${o.email}"></label>
          <label>Județ<select name="county">${JUDETE.map((j) => html`<option ${j === o.county ? 'selected' : ''}>${j}</option>`)}</select></label>
          <label>Localitate<input name="city" value="${o.city}" required></label>
          <label>Cod poștal<input name="postal_code" value="${o.postal_code}"></label>
          <label class="span2">Adresă<input name="address" value="${o.address}" required></label>
          <label class="span2">Observații client<textarea name="notes" rows="2">${o.notes}</textarea></label>
          <label class="span2">Notițe interne (nu le vede clientul)<textarea name="admin_notes" rows="2">${o.admin_notes}</textarea></label>
          <div class="span2"><button class="btn">Salvează datele</button> <a class="btn ghost" href="tel:${o.phone}">Sună clientul</a></div>
        </form>
      </section>
    </div>

    <div>
      ${o.fulfillment_mode !== 'own' ? html`<section class="panel hs-panel">
        <h2>Helpship ${o.fulfillment_mode === 'mixt' ? '· coletul 1' : ''}</h2>
        ${o.fulfillment_mode === 'mixt'
          ? html`<p>Produsele marcate „Helpship” pleacă din depozitul lor. Ramburs colet: <b>${money(o.payment_status === 'platita' ? 0 : o.hs_total)}</b></p>
            ${o.hs_awb ? html`<p class="awb">AWB <b>${o.hs_awb}</b>${o.hs_courier ? ` · ${o.hs_courier}` : ''}${o.hs_tracking_url ? html` · <a href="${o.hs_tracking_url}" target="_blank">urmărește</a>` : ''}</p>` : html`<p class="muted">Așteaptă AWB de la depozit${o.hs_status ? ` · ${o.hs_status}` : ''}.</p>`}`
          : html`<p>Toată comanda se livrează din depozitul Helpship. AWB-ul îl generează depozitul și apare aici automat.</p>`}
        ${o.hs_error ? html`<p class="flash err">${o.hs_error}</p>` : ''}
        <p class="muted">${o.hs_order_id ? html`Trimisă la depozit${o.hs_sent_at ? ` · ${formatDate(o.hs_sent_at)}` : ''}${o.hs_status ? ` · status: ${o.hs_status}` : ''}` : hsOn ? 'Încă netrimisă la depozit.' : 'Legătura cu Helpship nu este încă configurată.'}</p>
        ${hsOn && o.status !== 'anulata' ? html`<form method="post" action="/admin/comenzi/${o.id}/helpship"><button class="btn" ${o.hs_order_id ? raw('data-confirm="Comanda a fost deja trimisă. O retrimiți (poate crea un duplicat la depozit)?"') : ''}>${o.hs_order_id ? 'Retrimite la Helpship' : 'Trimite acum la Helpship'}</button></form>` : ''}
      </section>` : ''}

      ${o.fulfillment_mode !== 'helpship' ? html`<section class="panel">
        <h2>Livrare${o.fulfillment_mode === 'mixt' ? html` · coletul 2 (de la noi)` : ''}</h2>
        ${o.fulfillment_mode === 'mixt' ? html`<p>Doar produsele marcate „Noi”. Ramburs colet: <b>${money(o.payment_status === 'platita' ? 0 : o.own_total)}</b></p>` : ''}
        <p class="muted">Furnizor: <b>${providerObj.label}</b></p>
        ${o.awb ? html`
          <p class="awb">AWB <b>${o.awb}</b>${o.courier ? ` · ${o.courier}` : ''}</p>
          ${o.shipping_status ? html`<p class="muted">Ultimul status curier: ${o.shipping_status}</p>` : ''}
          <div class="btn-row">
            <a class="btn primary" href="/admin/comenzi/${o.id}/eticheta" target="_blank">Printează eticheta</a>
            ${o.tracking_url ? html`<a class="btn" href="${o.tracking_url}" target="_blank">Urmărește coletul</a>` : ''}
            <form method="post" action="/admin/comenzi/${o.id}/awb-anulare"><button class="btn danger" data-confirm="Anulezi AWB-ul ${o.awb}?">Anulează AWB</button></form>
          </div>` : html`
          ${o.shipping_error ? html`<p class="flash err">${o.shipping_error}</p>` : ''}
          <form method="post" action="/admin/comenzi/${o.id}/awb"><button class="btn primary">Generează AWB</button></form>`}
        <details class="manual-awb"><summary>Introdu AWB-ul manual</summary>
          <form method="post" action="/admin/comenzi/${o.id}/awb-manual" class="form-grid">
            <label>AWB<input name="awb" value="${o.awb}"></label>
            <label>Curier<input name="courier" value="${o.courier}" placeholder="ex: FAN Courier, Sameday, Cargus"></label>
            <div class="span2"><button class="btn">Salvează AWB</button></div>
          </form>
        </details>
      </section>` : html`${o.awb ? html`<section class="panel"><h2>Livrare</h2><p class="awb">AWB <b>${o.awb}</b>${o.courier ? ` · ${o.courier}` : ''}</p>${o.tracking_url ? html`<a class="btn" href="${o.tracking_url}" target="_blank">Urmărește coletul</a>` : ''}</section>` : ''}`}

      ${invoicePanel(o, invoices, settings, invProblem)}

      <section class="panel">
        <h2>Plată</h2>
        <p>${o.payment_method === 'card' ? 'Card online (Stripe)' : 'Ramburs la livrare'} · ${PAYMENT_STATUSES[o.payment_status]}</p>
        ${o.payment_method === 'ramburs' && o.status === 'livrata' && o.payment_status !== 'platita' ? html`<form method="post" action="/admin/comenzi/${o.id}/incasat"><button class="btn">Marchează banii încasați</button></form>` : ''}
      </section>

      <section class="panel">
        <h2>Sursa comenzii</h2>
        <dl class="meta">
          <div><dt>Sursă</dt><dd>${o.utm_source || (o.fbclid ? 'facebook' : o.ttclid ? 'tiktok' : 'direct')}</dd></div>
          ${o.utm_campaign ? html`<div><dt>Campanie</dt><dd>${o.utm_campaign}</dd></div>` : ''}
          ${o.utm_medium ? html`<div><dt>Mediu</dt><dd>${o.utm_medium}</dd></div>` : ''}
        </dl>
      </section>

      <section class="panel">
        <h2>Istoric</h2>
        <ol class="timeline">${events.map((e) => html`<li><time>${formatDate(e.created_at)}</time>${e.message}</li>`)}</ol>
      </section>
    </div>
  </div>`;
}

const fmtD = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

function invoicePanel(o, invoices, s, problem) {
  const f = invoices.find((i) => i.kind === 'factura');
  const st = invoices.find((i) => i.kind === 'storno');
  const auto = s.inv_enabled === '1';
  const when = { expediata: 'la expediere', livrata: 'la livrare', manual: '' }[s.inv_trigger] || 'la expediere';
  return html`<section class="panel">
    <h2>Factură</h2>
    ${invoices.map((i) => html`<p><a href="/admin/facturi/${i.id}" target="_blank"><b>${i.kind === 'storno' ? 'Storno' : 'Factura'} ${i.full_number}</b></a> · ${fmtD(i.issued_on)} · ${money(i.total)}</p>`)}
    ${!f ? html`
      ${problem ? html`<p class="flash err">${problem}</p>` : html`<p class="muted">${auto && when ? `Se emite automat ${when}.` : s.inv_enabled !== '1' ? html`Încă neemisă. <b>Emiterea automată e oprită</b> – o pornești din <a href="/admin/setari#facturare">Setări → Facturare</a>.` : 'Încă neemisă.'}</p>`}
      ${!problem && o.status !== 'anulata' ? html`<form method="post" action="/admin/comenzi/${o.id}/factura">
        <label class="check"><input type="checkbox" name="email" value="1" ${o.email ? 'checked' : 'disabled'}> Trimite factura clientului pe email</label>
        <button class="btn" data-confirm="Emiți factura acum? Numărul se alocă definitiv.">Emite factura acum</button></form>` : ''}`
    : !st ? html`<p class="muted">Dacă comanda e anulată, refuzată sau returnată, storno-ul se emite automat.</p>
      <form method="post" action="/admin/comenzi/${o.id}/storno"><button class="btn danger" data-confirm="Emiți factura storno pentru ${f.full_number}? Anulează integral factura.">Stornează factura</button></form>` : ''}
  </section>`;
}

export function invoicesView({ list, range: r, settings: s, problem, next }) {
  const qs = (extra) => `/admin/facturi?${new URLSearchParams(extra)}`;
  const dl = (fmt) => `/admin/facturi/saga.${fmt}?${new URLSearchParams({ de_la: r.from, pana_la: r.to })}`;
  const facturi = list.filter((i) => i.kind === 'factura');
  const storno = list.filter((i) => i.kind === 'storno');
  const sum = (a, k = 'total') => a.reduce((x, i) => x + i[k], 0);
  return html`
  <header class="page-head"><div><h1>Facturi</h1><p class="muted">Seria ${next.series} · următorul număr: <b>${next.series}${String(next.next).padStart(4, '0')}</b> · ${s.inv_enabled === '1' ? 'emitere automată pornită' : html`<span class="err-txt">emitere automată oprită</span>`} · <a href="/admin/setari#facturare">setări</a></p></div></header>
  ${problem ? html`<p class="flash err">${problem}</p>` : ''}
  <section class="panel">
    <div class="profit-head"><h2>Perioada</h2>
      <div class="chips">${PRESETS.map(([k, label]) => html`<a class="chip-link ${r.preset === k ? 'on' : ''}" href="${qs({ perioada: k })}">${label}</a>`)}</div></div>
    <form method="get" action="/admin/facturi" class="profit-range">
      <label>De la<input type="date" name="de_la" value="${r.from}"></label>
      <label>Până la<input type="date" name="pana_la" value="${r.to}"></label>
      <button class="btn primary">Arată</button>
    </form>
    <div class="kpis">
      <div class="kpi"><h2>Facturi</h2><p class="kpi-main">${facturi.length}</p><p class="kpi-sub">${money(sum(facturi))}</p></div>
      <div class="kpi"><h2>Storno</h2><p class="kpi-main">${storno.length}</p><p class="kpi-sub">${money(sum(storno))}</p></div>
      <div class="kpi"><h2>Total net</h2><p class="kpi-main">${money(sum(list))}</p><p class="kpi-sub">${s.inv_vat_payer === '1' ? `din care TVA ${money(sum(list, 'vat_total'))}` : 'neplătitor de TVA'}</p></div>
    </div>
    <h3>Export pentru SAGA</h3>
    <div class="btn-row">
      <a class="btn primary" href="${dl('xml')}">Descarcă XML (toate facturile, un fișier)</a>
      <a class="btn" href="${dl('zip')}">Descarcă ZIP (câte un XML pe factură)</a>
    </div>
    <p class="hint" style="margin-top:12px">În SAGA: <b>Diverse → Import date → Facturi (XML)</b>, alegi fișierul, apoi verifici facturile în <b>Ieșiri</b> și le trimiți în e-Factura din SAGA. Termen legal: 5 zile lucrătoare de la emitere.</p>
  </section>
  <section class="panel">
    <h2>Facturi emise (${list.length})</h2>
    ${list.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Număr</th><th>Data</th><th>Tip</th><th>Comanda</th><th>Client</th><th class="r">Total</th></tr></thead><tbody>
      ${list.map((i) => html`<tr><td><a href="/admin/facturi/${i.id}" target="_blank"><b>${i.full_number}</b></a></td><td>${fmtD(i.issued_on)}</td>
        <td>${i.kind === 'storno' ? html`<span class="chip st-anulata">Storno</span>` : html`<span class="chip st-livrata">Factură</span>`}</td>
        <td><a href="/admin/comenzi/${i.order_id}">${i.order_number}</a></td><td>${JSON.parse(i.buyer_json || '{}').name || ''}</td><td class="r">${money(i.total)}</td></tr>`)}
    </tbody></table></div>` : html`<p class="muted">Nicio factură în perioada aleasă.</p>`}
  </section>`;
}

export function labelView({ order: o, items, settings }) {
  const cod = o.payment_method === 'ramburs' && o.payment_status !== 'platita' ? o.total : 0;
  return html`<html lang="ro"><head><meta charset="utf-8"><title>Etichetă ${o.number}</title>
<style>
  @page { size: 100mm 150mm; margin: 4mm; }
  body { font: 13px/1.35 system-ui, sans-serif; margin: 0; color: #000; }
  .label { width: 92mm; min-height: 140mm; border: 2px solid #000; padding: 4mm; box-sizing: border-box; display: grid; gap: 3mm; align-content: start; }
  .row { border-bottom: 1px solid #000; padding-bottom: 3mm; }
  h2 { font-size: 11px; margin: 0 0 1mm; text-transform: uppercase; letter-spacing: .05em; }
  .big { font-size: 18px; font-weight: 800; }
  .awb { font: 800 22px/1 monospace; text-align: center; padding: 3mm 0; border: 2px solid #000; }
  .cod { font-size: 20px; font-weight: 800; }
  .noprint { margin: 10px 0; } @media print { .noprint { display: none; } }
</style></head><body>
<div class="noprint"><button onclick="print()">Printează</button></div>
<div class="label">
  <div class="awb">${o.awb || o.number}</div>
  <div class="row"><h2>Destinatar</h2><div class="big">${o.customer_name}</div>${o.phone}<br>${o.address}<br>${o.city}, jud. ${o.county} ${o.postal_code}</div>
  <div class="row"><h2>Expeditor</h2>${settings.sender_name || settings.store_name} · ${settings.sender_phone || settings.phone}<br>${settings.sender_address}, ${settings.sender_city}, ${settings.sender_county}</div>
  <div class="row"><h2>Ramburs</h2><div class="cod">${cod ? `${moneyNum(cod)} RON` : 'NU – achitat'}</div></div>
  <div class="row"><h2>Conținut · ${o.number}</h2>${items.map((i) => html`${i.qty} × ${i.sku || i.title}<br>`)}</div>
  ${o.notes ? html`<div><h2>Observații</h2>${o.notes}</div>` : ''}
</div></body></html>`;
}

// ---------------- Produse ----------------
export function productsView(products) {
  return html`
  <header class="page-head"><h1>Produse</h1><a class="btn primary" href="/admin/produse/nou">Adaugă produs</a></header>
  ${products.length ? html`<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th></th><th>Produs</th><th class="r">Preț</th><th class="r">Stoc</th><th>Stare</th><th class="r">Ordine</th></tr></thead>
    <tbody>${products.map((p) => html`<tr>
      <td class="thumb"><img src="${p.images[0] || '/img/placeholder.svg'}" alt="" width="48" height="48"></td>
      <td><a href="/admin/produse/${p.id}"><b>${p.title}</b></a><br><span class="muted">${p.sku || '—'} · /p/${p.slug}</span></td>
      <td class="r nowrap">${money(p.price)}${p.compare_at_price ? html`<br><s class="muted">${money(p.compare_at_price)}</s>` : ''}</td>
      <td class="r ${p.track_stock && p.stock <= 5 ? 'err-txt' : ''}">${p.track_stock ? p.stock : '∞'}</td>
      <td>${p.active ? html`<span class="chip st-livrata">Activ</span>` : html`<span class="chip">Ascuns</span>`}${p.featured ? html` <span class="chip st-confirmata">Recomandat</span>` : ''}</td>
      <td class="r">${p.sort}</td>
    </tr>`)}</tbody></table></div>` : html`<p class="muted">Niciun produs. Adaugă primul produs.</p>`}`;
}

export function productFormView({ product: p, reviews = [], hasR2 }) {
  const isNew = !p.id;
  const faqText = (p.faq || []).map((f) => `${f.q}\n${f.a}`).join('\n\n');
  const sectionsText = (p.sections || []).map((x) => `${x.title || ''}\n${x.image || ''}\n${x.text || ''}`).join('\n---\n');
  const specsText = (p.specs || []).map((x) => `${x.k}: ${x.v}`).join('\n');
  const bundlesText = (p.bundles || []).map((b) => `${b.qty} | ${b.pct} | ${b.label || ''}`.trim()).join('\n');
  return html`
  <header class="page-head"><div><a class="back" href="/admin/produse">Produse</a><h1>${isNew ? 'Produs nou' : p.title}</h1></div>
    ${!isNew ? html`<a class="btn" href="/p/${p.slug}" target="_blank">Vezi în magazin</a>` : ''}</header>
  <form method="post" action="/admin/produse/${isNew ? 'nou' : p.id}" enctype="multipart/form-data" class="product-form">
    <div class="order-grid">
      <div>
        <section class="panel form-grid">
          <label class="span2">Nume produs<input name="title" value="${p.title || ''}" required></label>
          <label class="span2">Subtitlu (o frază care vinde)<input name="subtitle" value="${p.subtitle || ''}" placeholder="ex: Ține cafeaua caldă 12 ore"></label>
          <label class="span2">Descriere <small>(rând gol = paragraf nou)</small><textarea name="description" rows="8">${p.description || ''}</textarea></label>
          <label class="span2">Beneficii <small>(unul pe rând; primele 4 apar lângă butonul de comandă)</small><textarea name="benefits" rows="5">${(p.benefits || []).join('\n')}</textarea></label>
          <label class="span2">Întrebări frecvente <small>(întrebarea pe primul rând, răspunsul dedesubt, rând gol între ele)</small><textarea name="faq" rows="6">${faqText}</textarea></label>
          <label class="span2">Specificații <small>(una pe rând, sub forma <b>Nume: valoare</b>, ex: Material: Silicon)</small><textarea name="specs" rows="6" placeholder="Material: Silicon moale&#10;Dimensiuni: 14 × 8 cm">${specsText}</textarea></label>
          <label class="span2">Secțiuni de prezentare <small>(apar sub butonul de comandă, cu poza alternând stânga–dreapta. Pentru fiecare secțiune: titlul pe primul rând, linkul pozei pe al doilea, apoi textul. Separă secțiunile cu un rând care conține doar <b>---</b>)</small><textarea name="sections" rows="10" placeholder="Somn liniștit, fără teamă de întuneric&#10;/img/poza.jpg&#10;Textul secțiunii...&#10;---&#10;Următorul titlu&#10;...">${sectionsText}</textarea></label>
        </section>

        <section class="panel">
          <h2>Poze</h2>
          <div class="img-list">${(p.images || []).map((src, i) => html`<figure><img src="${src}" alt="" width="110" height="110"><figcaption>${i === 0 ? 'Principală' : `#${i + 1}`}</figcaption></figure>`)}</div>
          <label>Linkuri poze <small>(una pe rând, prima e poza principală; poți schimba ordinea sau șterge rânduri)</small><textarea name="images" rows="4">${(p.images || []).join('\n')}</textarea></label>
          ${hasR2 ? html`<label>Încarcă poze noi <small>(JPG/PNG/WebP, max 5 MB fiecare, se adaugă la final)</small><input type="file" name="upload" accept="image/jpeg,image/png,image/webp" multiple></label>`
            : html`<p class="muted">Încărcarea directă a pozelor se activează după ce conectezi R2 (vezi README).</p>`}
        </section>
      </div>
      <div>
        <section class="panel form-grid">
          <h2 class="span2">Preț și stoc</h2>
          <label>Preț (lei)<input name="price" value="${p.price ? moneyNum(p.price) : ''}" required inputmode="decimal"></label>
          <label>Preț vechi tăiat (lei)<input name="compare_at_price" value="${p.compare_at_price ? moneyNum(p.compare_at_price) : ''}" inputmode="decimal"></label>
          <label>Cost achiziție (lei)<input name="cost_price" value="${p.cost_price ? moneyNum(p.cost_price) : ''}" inputmode="decimal"></label>
          <label>SKU / cod<input name="sku" value="${p.sku || ''}"></label>
          <label>Stoc<input name="stock" type="number" min="0" value="${p.stock ?? 0}"></label>
          <label>Greutate (grame)<input name="weight_g" type="number" min="1" value="${p.weight_g ?? 500}"></label>
          <div class="span2 dims">
            <span class="dims-label">Dimensiuni colet (cm) <small>– cu ambalaj, cum ajunge la curier</small></span>
            <div class="dims-row">
              <label>Lungime<input name="length_cm" inputmode="decimal" value="${p.length_cm || ''}" placeholder="ex: 15"></label>
              <label>Lățime<input name="width_cm" inputmode="decimal" value="${p.width_cm || ''}" placeholder="ex: 10"></label>
              <label>Înălțime<input name="height_cm" inputmode="decimal" value="${p.height_cm || ''}" placeholder="ex: 10"></label>
            </div>
          </div>
          <label class="check span2"><input type="checkbox" name="track_stock" value="1" ${p.track_stock !== 0 ? 'checked' : ''}> Urmărește stocul (nu se mai poate comanda la stoc 0)</label>
          <p class="hint span2">Legea cere ca prețul tăiat să fie cel mai mic preț practicat în ultimele 30 de zile înainte de reducere.</p>
        </section>
        <section class="panel form-grid">
          <h2 class="span2">Oferte de pachet</h2>
          <label class="span2">Câte un rând: <b>cantitate | reducere % | etichetă</b><textarea name="bundles" rows="4" placeholder="1 | 0 |&#10;2 | 10 | Cel mai ales&#10;3 | 15 | Cea mai bună ofertă">${bundlesText}</textarea></label>
        </section>
        <section class="panel form-grid">
          <h2 class="span2">Afișare</h2>
          <label>Etichetă<input name="badge" value="${p.badge || ''}" placeholder="ex: Best seller"></label>
          <label>Categorie<input name="category" value="${p.category || ''}"></label>
          <label class="span2">Cine livrează<select name="fulfillment">
            <option value="" ${!p.fulfillment ? 'selected' : ''}>Noi (generez AWB din admin)</option>
            <option value="helpship" ${p.fulfillment === 'helpship' ? 'selected' : ''}>Helpship (comanda pleacă automat la depozit)</option>
          </select></label>
          <label>Adresă (slug)<input name="slug" value="${p.slug || ''}" placeholder="se generează din nume"></label>
          <label>Ordine afișare<input name="sort" type="number" value="${p.sort ?? 0}"></label>
          <label class="check"><input type="checkbox" name="active" value="1" ${p.active !== 0 ? 'checked' : ''}> Activ în magazin</label>
          <label class="check"><input type="checkbox" name="featured" value="1" ${p.featured ? 'checked' : ''}> Recomandat (apare sus pe prima pagină)</label>
        </section>
        <div class="sticky-save"><button class="btn primary big">${isNew ? 'Creează produsul' : 'Salvează modificările'}</button></div>
      </div>
    </div>
  </form>

  ${!isNew ? html`
  <section class="panel">
    <h2>Recenzii</h2>
    <p class="hint">Adaugă doar recenzii reale, primite de la clienți (ex: pe WhatsApp, email, telefon). Recenziile inventate sunt interzise de lege (Directiva Omnibus / OUG 58/2022) și pot aduce amenzi ANPC.</p>
    ${reviews.length ? html`<table class="tbl"><tbody>${reviews.map((r) => html`<tr><td>${'★'.repeat(r.rating)}</td><td><b>${r.name}</b> ${r.city}<br>${r.text}</td>
      <td><form method="post" action="/admin/produse/${p.id}/recenzii/${r.id}/sterge"><button class="btn danger sm" data-confirm="Ștergi recenzia?">Șterge</button></form></td></tr>`)}</tbody></table>` : ''}
    <form method="post" action="/admin/produse/${p.id}/recenzii" class="form-grid">
      <label>Nume client<input name="name" required></label>
      <label>Oraș<input name="city"></label>
      <label>Stele<select name="rating">${[5, 4, 3, 2, 1].map((n) => html`<option>${n}</option>`)}</select></label>
      <label class="span2">Text recenzie<textarea name="text" rows="2" required></textarea></label>
      <div class="span2"><button class="btn">Adaugă recenzia</button></div>
    </form>
  </section>
  <section class="panel danger-zone">
    <form method="post" action="/admin/produse/${p.id}/sterge"><button class="btn danger" data-confirm="Ștergi definitiv produsul? Comenzile vechi rămân neatinse.">Șterge produsul</button></form>
  </section>` : ''}`;
}

// ---------------- Setări ----------------
export function settingsView({ settings: s, products, secrets, siteUrl, invNext = { series: 'CHI', next: 1 } }) {
  const f = (name, label, attrs = {}) => html`<label class="${attrs.span ? 'span2' : ''}">${label}${attrs.hint ? html` <small>${attrs.hint}</small>` : ''}<input name="${name}" value="${attrs.money ? moneyNum(s[name]) : s[name] || ''}" ${attrs.placeholder ? raw(`placeholder="${attrs.placeholder}"`) : ''}></label>`;
  const ok = (v) => (v ? html`<span class="chip st-livrata">configurat</span>` : html`<span class="chip">lipsește</span>`);
  return html`
  <header class="page-head"><h1>Setări</h1></header>
  <form method="post" action="/admin/setari" class="settings">
    <section class="panel form-grid">
      <h2 class="span2">Magazin</h2>
      ${f('store_name', 'Nume magazin')}
      ${f('tagline', 'Slogan (titlul primei pagini)')}
      ${f('announcement', 'Bandă de anunț (sus, pe toate paginile)', { span: true })}
      ${f('phone', 'Telefon')}
      ${f('email', 'Email')}
      ${f('hours', 'Program')}
      ${f('whatsapp', 'WhatsApp (număr de telefon)', { placeholder: 'ex: 0740 231 358 – gol = fără buton WhatsApp' })}
    </section>
    <section class="panel form-grid">
      <h2 class="span2">Notificări pe email</h2>
      ${f('contact_email', 'Unde primești mesajele și comenzile', { placeholder: 'ex: chirilasadrian@yahoo.com' })}
      <label class="check"><input type="checkbox" name="notify_orders" value="1" ${s.notify_orders === '1' ? 'checked' : ''}> Trimite-mi email la fiecare comandă nouă</label>
      <label class="check"><input type="checkbox" name="customer_emails" value="1" ${s.customer_emails !== '0' ? 'checked' : ''}> Trimite clienților emailuri (confirmare comandă, status, AWB)</label>
      <label class="check"><input type="checkbox" name="accounts_enabled" value="1" ${s.accounts_enabled !== '0' ? 'checked' : ''}> Clienții își pot face cont în magazin</label>
      <p class="hint span2">Trimitere email: ${secrets.email?.ok ? html`<span class="chip st-livrata">activă – ${secrets.email.via}</span>${secrets.email.customers ? '' : html` <span class="chip">doar spre tine</span>`}` : html`<span class="chip">neconfigurată</span> – comenzile și mesajele se salvează oricum în admin. Vezi README → „Emailuri”.`} <a href="/admin/mesaje">Trimite un email de test</a></p>
    </section>
    <section class="panel form-grid">
      <h2 class="span2">Rețele sociale (apar în subsolul site-ului)</h2>
      ${f('facebook_url', 'Facebook', { placeholder: 'https://facebook.com/…' })}
      ${f('instagram_url', 'Instagram', { placeholder: 'https://instagram.com/…' })}
      ${f('tiktok_url', 'TikTok', { placeholder: 'https://tiktok.com/@…' })}
    </section>
    <section class="panel form-grid">
      <h2 class="span2">Date firmă (apar în subsol și în paginile legale)</h2>
      ${f('company_name', 'Denumire firmă')}
      ${f('company_cui', 'CUI')}
      ${f('company_reg', 'Nr. Registrul Comerțului')}
      ${f('company_address', 'Sediu social')}
      ${f('company_capital', 'Capital social', { hint: '(opțional, apare pe factură)' })}
      ${f('company_bank', 'Banca', { hint: '(opțional, pe factură)' })}
      ${f('company_iban', 'IBAN', { hint: '(opțional, pe factură)' })}
    </section>
    <section class="panel form-grid">
      <h2 class="span2">Livrare și prețuri</h2>
      ${f('shipping_cost', 'Cost transport (lei)', { money: true })}
      ${f('free_shipping_threshold', 'Transport gratuit peste (lei, 0 = niciodată)', { money: true })}
      ${f('cod_fee', 'Taxă ramburs (lei, 0 = fără)', { money: true })}
      ${f('cost_courier', 'Cât plătești tu curierului pe colet (lei) – pentru profit', { money: true })}
      ${f('cost_helpship', 'Cât plătești Helpship pe colet (lei) – pentru profit', { money: true })}
      ${f('return_days', 'Zile retur (minim 14)')}
      ${f('delivery_text', 'Text livrare', { span: true })}
    </section>
    <section class="panel form-grid">
      <h2 class="span2">Ofertă la finalizarea comenzii</h2>
      <label>Produs oferit<select name="bump_product_id"><option value="">Fără ofertă</option>${products.map((p) => html`<option value="${p.id}" ${String(p.id) === String(s.bump_product_id) ? 'selected' : ''}>${p.title}</option>`)}</select></label>
      ${f('bump_discount_pct', 'Reducere ofertă (%)')}
      <p class="hint span2">Apare ca o căsuță „Adaugă și…" chiar înainte de butonul de comandă. E unul dintre cele mai simple moduri de a crește valoarea coșului.</p>
    </section>
    <section class="panel form-grid">
      <h2 class="span2">Curierat și AWB</h2>
      <label>Furnizor<select name="shipping_provider">${Object.values(PROVIDERS).map((p) => html`<option value="${p.id}" ${p.id === s.shipping_provider ? 'selected' : ''}>${p.label}</option>`)}</select></label>
      <label class="check"><input type="checkbox" name="auto_awb_on_confirm" value="1" ${s.auto_awb_on_confirm === '1' ? 'checked' : ''}> Generează AWB automat când confirm comanda</label>
      ${f('sender_name', 'Expeditor – nume')}
      ${f('sender_phone', 'Expeditor – telefon')}
      ${f('sender_county', 'Expeditor – județ')}
      ${f('sender_city', 'Expeditor – localitate')}
      ${f('sender_address', 'Expeditor – adresă', { span: true })}
      ${f('parcel_contents', 'Conținut colet (pe AWB)', { span: true })}
      <div class="span2 hint">
        <p>Chei API: SmartShip ${ok(secrets.smartship)} · Helpship (push) ${ok(secrets.helpship)} · API depozit ${ok(secrets.warehouse)}</p>
        <p>API pentru depozit (Helpship sau alt partener): <code>${siteUrl}/api/fulfillment/orders</code>, autentificare <code>Authorization: Bearer WAREHOUSE_API_KEY</code>. Detalii în README.</p>
      </div>
    </section>
    <section class="panel form-grid" id="facturare">
      <h2 class="span2">Facturare</h2>
      <label class="check span2"><input type="checkbox" name="inv_enabled" value="1" ${s.inv_enabled === '1' ? 'checked' : ''}> Emite facturi automat (și storno la anulare, refuz sau retur)</label>
      <label>Seria facturilor<input name="inv_series" value="${s.inv_series || 'CHI'}" maxlength="8"></label>
      <label>Următorul număr <small>(ex: ${invNext.series}${String(invNext.next).padStart(4, '0')})</small><input name="inv_next" type="number" min="1" value="${invNext.next}"><input type="hidden" name="inv_next_orig" value="${invNext.next}"></label>
      <label>Când se emite factura<select name="inv_trigger">
        <option value="expediata" ${s.inv_trigger !== 'livrata' && s.inv_trigger !== 'manual' ? 'selected' : ''}>La expediere (când pleacă coletul)</option>
        <option value="livrata" ${s.inv_trigger === 'livrata' ? 'selected' : ''}>La livrare (când clientul primește coletul)</option>
        <option value="manual" ${s.inv_trigger === 'manual' ? 'selected' : ''}>Doar manual, din pagina comenzii</option>
      </select></label>
      <label>Facturez automat comenzile plasate din<input type="date" name="inv_since" value="${s.inv_since || ''}"></label>
      <label>TVA<select name="inv_vat_payer">
        <option value="0" ${s.inv_vat_payer !== '1' ? 'selected' : ''}>Firma NU este plătitoare de TVA</option>
        <option value="1" ${s.inv_vat_payer === '1' ? 'selected' : ''}>Firma este plătitoare de TVA</option>
      </select></label>
      <label>Cota TVA (%) <small>(doar dacă ești plătitor; prețurile din magazin includ TVA)</small><input name="inv_vat_rate" value="${s.inv_vat_rate || '21'}" inputmode="decimal"></label>
      <p class="hint span2">Clientul primește linkul facturii în emailul de expediere sau livrare și o vede pe pagina comenzii. Clienții persoane fizice apar cu codul generic 0000000000000, cum cere e-Factura. Exportul pentru SAGA e în <a href="/admin/facturi">Facturi</a>. Pe factură apar datele din „Date firmă” (denumire, CUI și sediul sunt obligatorii).</p>
    </section>
    <section class="panel form-grid">
      <h2 class="span2">Helpship (depozit)</h2>
      <p class="span2">Legătura: ${secrets.helpshipApi ? html`<b class="ok-txt">configurată</b>` : html`<b class="err-txt">oprită</b> – adaugă în Cloudflare secretele <code>HELPSHIP_CLIENT_ID</code>, <code>HELPSHIP_CLIENT_SECRET</code> și <code>HELPSHIP_ACCOUNT_ID</code>`}.</p>
      <label class="span2">Când trimitem comanda la Helpship<select name="helpship_send">
        <option value="placed" ${s.helpship_send !== 'confirmed' ? 'selected' : ''}>Imediat ce e plasată (cardul: după plată)</option>
        <option value="confirmed" ${s.helpship_send === 'confirmed' ? 'selected' : ''}>Doar după ce o confirm eu (status Confirmată)</option>
      </select></label>
      <p class="hint span2">Pleacă doar produsele marcate „Helpship” la „Cine livrează”. Dacă o comandă are și alte produse, se împarte în 2 colete. AWB-ul și statusul vin automat de la depozit (verificare la 30 de minute).</p>
    </section>
    <section class="panel form-grid">
      <h2 class="span2">Plăți</h2>
      <label class="check span2"><input type="checkbox" name="card_enabled" value="1" ${s.card_enabled === '1' ? 'checked' : ''}> Activează plata cu cardul (Stripe)</label>
      <p class="hint span2">Stripe: cheie secretă ${ok(secrets.stripe)} · webhook ${ok(secrets.stripeWebhook)}. Webhook-ul se setează în Stripe la adresa <code>${siteUrl}/webhooks/stripe</code>, evenimentul <code>checkout.session.completed</code>.</p>
    </section>
    <section class="panel form-grid">
      <h2 class="span2">Reclame (pixeli)</h2>
      ${f('fb_pixel_id', 'Meta (Facebook) Pixel ID', { placeholder: 'ex: 123456789012345' })}
      ${f('tiktok_pixel_id', 'TikTok Pixel ID', { placeholder: 'ex: CXXXXXXXXXXXXXXX' })}
      <p class="hint span2">Evenimente trimise automat: ViewContent, AddToCart, InitiateCheckout, Purchase. Conversions API pe server: Facebook ${ok(secrets.fbCapi)} · TikTok ${ok(secrets.ttEvents)}.</p>
    </section>
    <div class="sticky-save"><button class="btn primary big">Salvează setările</button></div>
  </form>`;
}

// ---------------- Roată și coduri ----------------
export function couponsView({ settings: s, coupons, stats, filter }) {
  const w = wheelConfig(s);
  const raw = parseJSON(s.wheel_prizes, []);
  const rows = Array.from({ length: 8 }, (_, i) => raw[i] || { label: '', type: 'procent', value: '', weight: '', min: '' });
  const odds = prizeOdds(rows.map((r) => ({ weight: r.label ? Math.max(0, Number(r.weight) || 0) : 0 })));
  const fmtVal = (r) => (r.type === 'lei' ? (r.value ? moneyNum(r.value) : '') : r.type === 'procent' ? r.value : '');
  return html`
  <header class="page-head"><h1>Roată și coduri</h1>${w.enabled ? html`<span class="chip st-livrata">Roata e pornită</span>` : html`<span class="chip">Roata e oprită</span>`}</header>

  <section class="kpis">
    <div class="kpi"><h2>Învârtiri (30 zile)</h2><p class="kpi-main">${stats.spins}</p></div>
    <div class="kpi"><h2>Coduri din roată folosite</h2><p class="kpi-main">${stats.wheelUsed}</p><p class="kpi-sub">${stats.spins ? Math.round((stats.wheelUsed / stats.spins) * 100) : 0}% din învârtiri</p></div>
    <div class="kpi"><h2>Comenzi cu cod (30 zile)</h2><p class="kpi-main">${stats.orders}</p><p class="kpi-sub">${money(stats.revenue)} vânzări</p></div>
    <div class="kpi"><h2>Reduceri acordate (30 zile)</h2><p class="kpi-main">${money(stats.discount)}</p></div>
  </section>

  <form method="post" action="/admin/coduri/roata" class="panel">
    <h2>Roata norocului</h2>
    <div class="form-grid">
      <label class="check"><input type="checkbox" name="wheel_enabled" value="1" ${s.wheel_enabled === '1' ? 'checked' : ''}> Roata este pornită (apare butonul 🎁 lângă coș)</label>
      <label class="check"><input type="checkbox" name="wheel_auto_open" value="1" ${s.wheel_auto_open === '1' ? 'checked' : ''}> Apare singură la intrarea pe site</label>
      <label>Apare după (secunde)<input name="wheel_delay" type="number" min="0" max="120" value="${s.wheel_delay || 5}"></label>
      <label>Codul câștigat e valabil (ore)<input name="wheel_hours" type="number" min="1" max="720" value="${s.wheel_hours || 2}"></label>
      <label>A 3-a învârtire: comandă de minim (lei)<input name="wheel_min_third" inputmode="decimal" value="${moneyNum(Number(s.wheel_min_third) || 25000)}"></label>
      <p class="hint span2">Roata e doar pentru clienții cu cont: învârtirea 1 la contul nou, a 2-a după prima comandă din cont, a 3-a după o comandă peste suma de mai sus. Fiecare învârtire nouă se deblochează după ce premiul anterior a fost folosit sau a expirat.</p>
      <label class="span2">Titlu<input name="wheel_title" value="${s.wheel_title || ''}"></label>
    </div>
    <h3 class="mt">Premii</h3>
    <p class="hint">Premiile cu șansa 0 sau fără nume nu apar pe roată. Șansele se calculează din „pondere": un premiu cu pondere 30 iese de 3 ori mai des decât unul cu pondere 10. Pe roată pot fi între 2 și 8 premii.</p>
    <div class="tbl-wrap"><table class="tbl prizes">
      <thead><tr><th>Nume pe roată</th><th>Tip</th><th>Valoare</th><th>Pondere</th><th>Șansă</th><th>Comandă minimă (lei)</th></tr></thead>
      <tbody>${rows.map((r, i) => html`<tr>
        <td><input name="p_label" value="${r.label}" maxlength="24" placeholder="ex: Transport gratuit"></td>
        <td><select name="p_type">${Object.entries(COUPON_TYPES).map(([k, v]) => html`<option value="${k}" ${k === r.type ? 'selected' : ''}>${v}</option>`)}</select></td>
        <td><input name="p_value" value="${fmtVal(r)}" inputmode="decimal" placeholder="% sau lei"></td>
        <td><input name="p_weight" value="${r.label ? r.weight : ''}" inputmode="numeric" placeholder="ex: 20"></td>
        <td class="r nowrap">${r.label && odds[i] ? `${String(odds[i]).replace('.', ',')}%` : '–'}</td>
        <td><input name="p_min" value="${r.min ? moneyNum(r.min) : ''}" inputmode="decimal" placeholder="0"></td>
      </tr>`)}</tbody></table></div>
    <p class="hint">La „Reducere %" scrii procentul (ex: 10), la „Reducere în lei" suma (ex: 15). Pentru „Transport gratuit", „1+1 gratis" și „Fără premiu" valoarea nu contează. „Fără premiu" înseamnă că acea felie a roții nu câștigă nimic. Șansele apar public în <a href="/pagina/regulament-roata" target="_blank">regulament</a>.</p>
    <div class="btn-row mt"><button class="btn primary">Salvează roata</button><a class="btn" href="/?roata=test" target="_blank">Vezi pe site</a></div>
  </form>

  <section class="panel">
    <h2>Creează un cod de reducere</h2>
    <p class="hint">Pentru reclame, influenceri sau clienți fideli, de exemplu TIKTOK10. Clientul îl scrie la finalizarea comenzii.</p>
    <form method="post" action="/admin/coduri/nou" class="form-grid">
      <label>Cod<input name="code" required maxlength="30" placeholder="ex: TIKTOK10" style="text-transform:uppercase"></label>
      <label>Tip<select name="type">${CODE_TYPES.map((k) => html`<option value="${k}">${COUPON_TYPES[k]}</option>`)}</select></label>
      <label>Valoare (% sau lei)<input name="value" inputmode="decimal" placeholder="ex: 10"></label>
      <label>Comandă minimă (lei)<input name="min_order" inputmode="decimal" placeholder="0"></label>
      <label>Număr maxim de folosiri (0 = nelimitat)<input name="max_uses" type="number" min="0" value="0"></label>
      <label>Expiră la (opțional)<input name="expires" type="date"></label>
      <div class="span2"><button class="btn primary">Creează codul</button></div>
    </form>
  </section>

  <section class="panel">
    <div class="page-head"><h2>Coduri</h2>
      <nav class="tabs small">${[['manual', 'Create de mine'], ['roata', 'Din roată'], ['folosite', 'Folosite']].map(([k, v]) => html`<a href="/admin/coduri?f=${k}" class="${filter === k ? 'on' : ''}">${v}</a>`)}</nav>
    </div>
    ${coupons.length ? html`<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Cod</th><th>Reducere</th><th>Folosit</th><th>Expiră</th><th>Stare</th><th></th></tr></thead>
      <tbody>${coupons.map((c) => html`<tr>
        <td><b>${c.code}</b>${c.label && c.source === 'roata' ? html`<br><span class="muted">${c.label}</span>` : ''}</td>
        <td>${describeCoupon(c)}${c.min_order ? html`<br><span class="muted">minim ${money(c.min_order)}</span>` : ''}</td>
        <td>${c.used_count}${c.max_uses ? ` / ${c.max_uses}` : ''}</td>
        <td class="nowrap">${c.expires_at ? formatDate(c.expires_at) : 'nu expiră'}</td>
        <td>${c.active ? html`<span class="chip st-livrata">Activ</span>` : html`<span class="chip">Oprit</span>`}</td>
        <td class="r nowrap">
          <form method="post" action="/admin/coduri/${c.id}/comuta" class="inline-form"><button class="btn sm">${c.active ? 'Oprește' : 'Pornește'}</button></form>
          ${c.used_count ? '' : html`<form method="post" action="/admin/coduri/${c.id}/sterge" class="inline-form"><button class="btn sm danger" data-confirm="Ștergi codul ${c.code}?">Șterge</button></form>`}
        </td>
      </tr>`)}</tbody></table></div>` : html`<p class="muted">Niciun cod aici încă.</p>`}
  </section>`;
}

// ---------------- Mesaje ----------------
export function messagesView({ messages, email, settings: s }) {
  return html`
  <header class="page-head"><h1>Mesaje</h1>
    <form method="post" action="/admin/mesaje/test-email"><button class="btn" ${email.ok ? '' : 'disabled'}>Trimite un email de test</button></form>
  </header>
  <p class="hint">${email.ok
    ? html`Mesajele noi și comenzile se trimit pe email la <b>${s.contact_email || '(nesetat)'}</b> prin ${email.via}.`
    : html`Trimiterea pe email nu e configurată încă, dar toate mesajele apar aici. Configurarea e descrisă în README → „Emailuri”.`}</p>
  ${messages.length ? html`<div class="msg-list">${messages.map((m) => html`<article class="panel msg ${m.is_read ? '' : 'unread'}">
    <header class="msg-head">
      <div><b>${m.name}</b> ${m.is_read ? '' : html`<span class="chip st-noua">nou</span>`}<br>
        <span class="muted">${formatDate(m.created_at)} · ${m.subject || 'Fără subiect'}${m.order_number ? ` · comanda ${m.order_number}` : ''}</span></div>
      <div class="btn-row">
        ${m.phone ? html`<a class="btn sm" href="tel:${m.phone}">Sună ${m.phone}</a>` : ''}
        ${m.email ? html`<a class="btn sm" href="mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || 'mesajul tău'))}">Răspunde pe email</a>` : ''}
        <form method="post" action="/admin/mesaje/${m.id}/${m.is_read ? 'necitit' : 'citit'}" class="inline-form"><button class="btn sm">${m.is_read ? 'Marchează necitit' : 'Marchează citit'}</button></form>
        <form method="post" action="/admin/mesaje/${m.id}/sterge" class="inline-form"><button class="btn sm danger" data-confirm="Ștergi mesajul?">Șterge</button></form>
      </div>
    </header>
    <p class="msg-body">${m.message}</p>
  </article>`)}</div>` : html`<p class="muted">Niciun mesaj încă. Formularul e pe pagina <a href="/pagina/contact" target="_blank">Contact</a>.</p>`}`;
}

// ---------------- Clienți ----------------
const custStatus = (c) => (!c.active ? html`<span class="chip st-anulata">Dezactivat</span>` : c.email_verified ? html`<span class="chip st-livrata">Activ</span>` : html`<span class="chip st-noua">Email neconfirmat</span>`);

export function customersView({ customers, q, filter, counts }) {
  const tabs = [['', 'Toți'], ['activi', 'Activi'], ['neconfirmati', 'Email neconfirmat'], ['dezactivati', 'Dezactivați']];
  return html`
  <header class="page-head"><h1>Clienți</h1><a class="btn primary" href="/admin/clienti/nou">Adaugă client</a></header>
  <nav class="tabs">${tabs.map(([k, v]) => html`<a href="/admin/clienti${k ? `?f=${k}` : ''}" class="${filter === k ? 'on' : ''}">${v} <small>${counts[k || 'all'] || 0}</small></a>`)}</nav>
  <div class="toolbar"><form method="get" class="search">${filter ? html`<input type="hidden" name="f" value="${filter}">` : ''}<input type="search" name="q" value="${q}" placeholder="Caută după nume, email sau telefon"><button class="btn">Caută</button></form></div>
  ${customers.length ? html`<div class="tbl-wrap"><table class="tbl orders">
    <thead><tr><th>Client</th><th>Telefon</th><th class="r">Comenzi</th><th class="r">Total cumpărat</th><th>Înregistrat</th><th>Ultima autentificare</th><th>Stare</th></tr></thead>
    <tbody>${customers.map((c) => html`<tr>
      <td><a href="/admin/clienti/${c.id}"><b>${c.name}</b></a><br><span class="muted">${c.email}</span></td>
      <td class="nowrap">${c.phone || html`<span class="muted">–</span>`}</td>
      <td class="r">${c.orders}</td>
      <td class="r nowrap">${money(c.spent)}</td>
      <td class="nowrap">${formatDate(c.created_at)}</td>
      <td class="nowrap">${c.last_login ? formatDate(c.last_login) : html`<span class="muted">–</span>`}</td>
      <td>${custStatus(c)}</td>
    </tr>`)}</tbody></table></div>` : html`<p class="muted">Niciun client aici.</p>`}`;
}

export function customerFormView({ error = '', values = {}, emailOk }) {
  return html`
  <header class="page-head"><div><a class="back" href="/admin/clienti">Clienți</a><h1>Client nou</h1></div></header>
  ${error ? html`<div class="flash err">${error}</div>` : ''}
  <form method="post" action="/admin/clienti/nou" class="panel form-grid">
    <label>Nume și prenume<input name="name" required value="${values.name || ''}"></label>
    <label>Email<input name="email" type="email" required value="${values.email || ''}"></label>
    <label>Telefon<input name="phone" value="${values.phone || ''}"></label>
    <label>Parolă <small>(opțional)</small><input name="password" type="text" autocomplete="off" placeholder="gol = clientul își alege singur parola"></label>
    <p class="hint span2">${emailOk
      ? 'Dacă lași parola goală, clientul primește pe email un link (valabil 7 zile) ca să-și aleagă singur parola. Așa nu trebuie să-i comunici tu parola.'
      : 'Emailurile nu sunt configurate: setează o parolă și comunic-o clientului, sau configurează emailurile ca să primească link.'}</p>
    <div class="span2"><button class="btn primary">Creează clientul</button></div>
  </form>`;
}

export function customerView({ c, orders, events, stats, emailOk }) {
  return html`
  <header class="page-head">
    <div><a class="back" href="/admin/clienti">Clienți</a><h1>${c.name} ${custStatus(c)}</h1>
      <p class="muted">${c.email} · client din ${formatDate(c.created_at)}${c.last_login ? ` · ultima autentificare ${formatDate(c.last_login)}` : ''}</p></div>
    <div class="actions">
      ${emailOk ? html`<form method="post" action="/admin/clienti/${c.id}/reseteaza"><button class="btn">Trimite link de parolă nouă</button></form>` : ''}
      ${c.email_verified ? '' : html`<form method="post" action="/admin/clienti/${c.id}/confirma"><button class="btn">Marchează email confirmat</button></form>`}
      <form method="post" action="/admin/clienti/${c.id}/${c.active ? 'dezactiveaza' : 'activeaza'}"><button class="btn ${c.active ? 'danger' : 'primary'}" ${c.active ? 'data-confirm="Dezactivezi contul? Clientul nu se mai poate autentifica, dar comenzile rămân."' : ''}>${c.active ? 'Dezactivează contul' : 'Reactivează contul'}</button></form>
    </div>
  </header>

  <section class="kpis">
    <div class="kpi"><h2>Comenzi</h2><p class="kpi-main">${stats.orders}</p></div>
    <div class="kpi"><h2>Total cumpărat</h2><p class="kpi-main">${money(stats.spent)}</p><p class="kpi-sub">fără comenzi anulate</p></div>
    <div class="kpi"><h2>Coș mediu</h2><p class="kpi-main">${money(stats.orders ? Math.round(stats.spent / stats.orders) : 0)}</p></div>
    <div class="kpi"><h2>Livrate / refuzate</h2><p class="kpi-main">${stats.delivered} / ${stats.refused}</p></div>
  </section>

  <div class="order-grid">
    <div>
      <section class="panel">
        <h2>Comenzi</h2>
        ${orders.length ? html`<table class="tbl"><thead><tr><th>Comandă</th><th>Data</th><th>Status</th><th class="r">Total</th></tr></thead><tbody>
          ${orders.map((o) => html`<tr><td><a href="/admin/comenzi/${o.id}"><b>${o.number}</b></a></td><td class="nowrap">${formatDate(o.created_at)}</td><td><span class="chip st-${o.status}">${ORDER_STATUSES[o.status]}</span></td><td class="r nowrap">${money(o.total)}</td></tr>`)}
        </tbody></table>` : html`<p class="muted">Nicio comandă.</p>`}
      </section>
      <section class="panel">
        <h2>Istoric</h2>
        ${events.length ? html`<ol class="timeline">${events.map((e) => html`<li><time>${formatDate(e.created_at)}</time>${e.message}</li>`)}</ol>` : html`<p class="muted">Fără evenimente.</p>`}
      </section>
    </div>
    <div>
      <section class="panel">
        <h2>Date client</h2>
        <form method="post" action="/admin/clienti/${c.id}" class="form-grid">
          <label class="span2">Nume<input name="name" required value="${c.name}"></label>
          <label class="span2">Email<input name="email" type="email" required value="${c.email}"></label>
          <label>Telefon<input name="phone" value="${c.phone}"></label>
          <label>Județ<select name="county"><option value="">–</option>${JUDETE.map((j) => html`<option ${j === c.county ? 'selected' : ''}>${j}</option>`)}</select></label>
          <label>Localitate<input name="city" value="${c.city}"></label>
          <label>Cod poștal<input name="postal_code" value="${c.postal_code}"></label>
          <label class="span2">Adresă<input name="address" value="${c.address}"></label>
          <label class="span2">Notițe interne<textarea name="admin_notes" rows="2">${c.admin_notes}</textarea></label>
          <label class="span2">Parolă nouă <small>(opțional – completează doar dacă vrei s-o schimbi tu)</small><input name="password" type="text" autocomplete="off"></label>
          <div class="span2"><button class="btn primary">Salvează</button></div>
        </form>
      </section>
      <section class="panel danger-zone">
        <h2>Ștergere cont</h2>
        <p class="hint">Șterge contul și datele lui (la cererea clientului, conform GDPR). Comenzile rămân în evidență pentru contabilitate, dar nu mai sunt legate de cont.</p>
        <form method="post" action="/admin/clienti/${c.id}/sterge"><button class="btn danger" data-confirm="Ștergi definitiv contul ${c.email}?">Șterge contul</button></form>
      </section>
    </div>
  </div>`;
}
