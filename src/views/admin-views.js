import { html, raw } from '../lib/html.js';
import { money, moneyNum, formatDate } from '../lib/util.js';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../lib/db.js';
import { PROVIDERS } from '../shipping/providers.js';
import { JUDETE } from '../lib/judete.js';
import { logoMark } from './layout.js';

export function adminLayout({ title, active, body, flash, newCount = 0 }) {
  const nav = [
    ['/admin', 'panou', 'Panou'],
    ['/admin/comenzi', 'comenzi', 'Comenzi'],
    ['/admin/produse', 'produse', 'Produse'],
    ['/admin/setari', 'setari', 'Setări'],
  ];
  return html`<html lang="ro"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · Admin Chimag</title>
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/admin.css?v=2">
<script src="/assets/admin.js?v=1" defer></script>
</head><body>
<div class="shell">
  <aside class="side">
    <a class="brand" href="/admin">${logoMark()}<span>chimag</span></a>
    <nav>${nav.map(([href, key, label]) => html`<a href="${href}" class="${active === key ? 'on' : ''}">${label}${key === 'comenzi' && newCount ? html`<b class="count">${newCount}</b>` : ''}</a>`)}</nav>
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
<meta name="robots" content="noindex"><title>Autentificare · Admin</title><link rel="stylesheet" href="/assets/admin.css?v=2"></head>
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
export function dashboardView(d) {
  const maxDay = Math.max(1, ...d.days.map((x) => x.revenue));
  const delivered = d.delivery.livrata || 0;
  const refused = d.delivery.refuzata || 0;
  const rate = delivered + refused ? Math.round((delivered / (delivered + refused)) * 100) : null;
  return html`
  <header class="page-head"><h1>Panou</h1><a class="btn" href="/admin/comenzi?status=noua">Comenzi noi de confirmat: ${d.statusCounts.noua || 0}</a></header>
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
      <td><a href="/admin/comenzi/${o.id}"><b>${o.number}</b></a></td>
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

export function orderView({ order: o, items, events, settings, provider }) {
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
        <table class="tbl"><thead><tr><th>Produs</th><th>SKU</th><th class="r">Cant.</th><th class="r">Preț</th><th class="r">Total</th></tr></thead><tbody>
        ${items.map((i) => html`<tr><td>${i.title}</td><td class="muted">${i.sku}</td><td class="r">${i.qty}</td><td class="r">${money(i.unit_price)}</td><td class="r">${money(i.total)}${i.line_discount ? html`<br><small class="muted">−${money(i.line_discount)}</small>` : ''}</td></tr>`)}
        </tbody></table>
        <dl class="sum">
          <div><dt>Subtotal</dt><dd>${money(o.subtotal)}</dd></div>
          ${o.discount ? html`<div><dt>Reducere</dt><dd>−${money(o.discount)}</dd></div>` : ''}
          <div><dt>Transport</dt><dd>${money(o.shipping)}</dd></div>
          ${o.cod_fee ? html`<div><dt>Taxă ramburs</dt><dd>${money(o.cod_fee)}</dd></div>` : ''}
          <div class="grand"><dt>Total</dt><dd>${money(o.total)}</dd></div>
          ${o.payment_method === 'ramburs' ? html`<div><dt>De încasat ramburs</dt><dd><b>${money(o.payment_status === 'platita' ? 0 : o.total)}</b></dd></div>` : ''}
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
      <section class="panel">
        <h2>Livrare</h2>
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
      </section>

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
export function settingsView({ settings: s, products, secrets, siteUrl }) {
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
    </section>
    <section class="panel form-grid">
      <h2 class="span2">Date firmă (apar în subsol și în paginile legale)</h2>
      ${f('company_name', 'Denumire firmă')}
      ${f('company_cui', 'CUI')}
      ${f('company_reg', 'Nr. Registrul Comerțului')}
      ${f('company_address', 'Sediu social')}
    </section>
    <section class="panel form-grid">
      <h2 class="span2">Livrare și prețuri</h2>
      ${f('shipping_cost', 'Cost transport (lei)', { money: true })}
      ${f('free_shipping_threshold', 'Transport gratuit peste (lei, 0 = niciodată)', { money: true })}
      ${f('cod_fee', 'Taxă ramburs (lei, 0 = fără)', { money: true })}
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
