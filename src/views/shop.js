import { html, raw, paragraphs } from '../lib/html.js';
import { money, moneyNum, slugify } from '../lib/util.js';
import { JUDETE } from '../lib/judete.js';
import { ORDER_STATUSES } from '../lib/db.js';
import { icons, stars } from './icons.js';
import { TIKTOK_PURCHASE_EVENT } from '../lib/tracking.js';

const pctOff = (p) => (p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0);
const img = (p, i = 0) => p.images?.[i] || '/img/placeholder.svg';

export function trustRow(settings) {
  const items = [
    [icons.truck(), 'Livrare 24–48h', 'În toată țara, prin curier'],
    [icons.cash(), 'Plata la livrare', 'Fără niciun avans'],
    [icons.back(), `Retur ${settings.return_days || 14} zile`, 'Fără explicații'],
  ];
  return html`<ul class="trust-row">${items.map(([i, t, sub]) => html`<li>${i}<span><strong>${t}</strong><small>${sub}</small></span></li>`)}</ul>`;
}

function productCard(p, extra = '') {
  const off = pctOff(p);
  const out = p.track_stock && p.stock <= 0;
  return html`<div class="pcard ${extra}" data-cat="${p.category ? slugify(p.category) : ''}">
    <a class="pcard-link" href="/p/${p.slug}">
      <div class="pcard-media">
        <img src="${img(p)}" alt="${p.title}" loading="lazy" width="600" height="600">
        ${off ? html`<span class="tag-save">−${off}%</span>` : ''}
        ${p.badge ? html`<span class="tag-badge">${p.badge}</span>` : ''}
      </div>
      <div class="pcard-body">
        <h3>${p.title}</h3>
        ${p.subtitle ? html`<p class="pcard-sub">${p.subtitle}</p>` : ''}
        <p class="pcard-price"><strong>${money(p.price)}</strong>${p.compare_at_price > p.price ? html`<s>${money(p.compare_at_price)}</s>` : ''}</p>
      </div>
    </a>
    ${out ? html`<span class="pcard-soon">Revine în curând</span>` : html`<button type="button" class="pcard-add" data-quick-add="${p.id}" data-title="${p.title}" data-price="${p.price}" aria-label="Adaugă în coș: ${p.title}">${icons.cart(20)}<span>Adaugă</span></button>`}
  </div>`;
}

// ---------------- Pagina principală ----------------
export function homePage({ settings, products, categories = [], bestsellers = [], reviews = [], wheelOn = false }) {
  const featured = products.filter((p) => p.featured);
  const lead = featured[0] || products[0];
  const mosaic = lead ? [lead, ...products.filter((p) => p !== lead)].slice(0, 3) : [];
  const threshold = Number(settings.free_shipping_threshold) || 0;
  const returnDays = settings.return_days || 14;
  const inStock = (p) => !(p.track_stock && p.stock <= 0);
  const spot = featured.find(inStock) || products.find(inStock) || null;
  const spotImg = spot ? (spot === lead && spot.images?.[1] ? spot.images[1] : img(spot)) : '';
  const offers = spot ? (spot.bundles || []).filter((x) => x.qty > 1 && x.pct > 0) : [];

  const faq = [
    ['Cât costă transportul?', threshold ? `${money(settings.shipping_cost)} pe comandă, iar peste ${money(threshold)} transportul este gratuit.` : `${money(settings.shipping_cost)} pe comandă.`],
    ['În cât timp ajunge coletul?', `${settings.delivery_text || 'Livrăm prin curier în 24–48 de ore lucrătoare'}. Curierul te sună înainte să ajungă.`],
    ['Pot returna un produs?', `Da. Ai ${returnDays} zile de la primire să te răzgândești, fără să ne spui motivul. Detaliile sunt în pagina Retur și garanție.`],
    ['Ce fac dacă produsul are o problemă?', 'Ne scrii din pagina de contact, cu numărul comenzii și o poză. Găsim împreună soluția: înlocuire sau returnarea banilor, conform garanției legale.'],
  ];
  const tile = (p, big) => html`<a class="hv-tile ${big ? 'hv-tile-big' : ''}" href="/p/${p.slug}">
    <img src="${img(p)}" alt="${p.title}" width="${big ? 720 : 360}" height="${big ? 720 : 360}" ${big ? raw('fetchpriority="high"') : raw('loading="lazy"')}>
    ${pctOff(p) ? html`<span class="tag-save">−${pctOff(p)}%</span>` : ''}
    <span class="hv-tile-info"><span class="hv-tile-name">${p.title}</span><b>${money(p.price)}</b></span>
  </a>`;

  return html`
  <section class="hv-hero">
    <div class="wrap hv-hero-inner">
      <div class="hv-hero-copy">
        <p class="hv-kicker"><span class="hv-dot"></span>Magazin online · livrare în toată țara</p>
        <h1>${settings.tagline || 'Produse utile, la prețuri bune, livrate rapid'}</h1>
        <p class="hv-lead">Produse practice pentru casă, bucătărie, copii și aventură, alese cu grijă și descrise cinstit. Comanzi în două minute și plătești abia când primești coletul.</p>
        <div class="hv-actions">
          <a class="btn btn-primary btn-lg" href="#produse">Vezi produsele</a>
          ${spot ? html`<a class="btn btn-ghost btn-lg" href="/p/${spot.slug}">Recomandarea noastră</a>` : ''}
        </div>
      </div>
      ${mosaic.length ? html`<div class="hv-mosaic hv-n${mosaic.length}">
        ${tile(mosaic[0], true)}
        ${mosaic.slice(1).map((p) => tile(p, false))}
      </div>` : ''}
    </div>
    <div class="wrap">
      <ul class="hv-strip" aria-label="Avantaje">
        <li>${icons.truck(20)}<span><b>Livrare 24–48h</b>${threshold ? html`<small>gratuită peste ${money(threshold)}</small>` : html`<small>în toată țara</small>`}</span></li>
        <li>${icons.cash(20)}<span><b>Plata la livrare</b><small>fără niciun avans</small></span></li>
        <li>${icons.back(20)}<span><b>Retur ${returnDays} zile</b><small>fără explicații</small></span></li>
        <li>${icons.doc(20)}<span><b>Factură pe email</b><small>pe numele tău</small></span></li>
      </ul>
    </div>
  </section>

  <section class="wrap section hv-sec" id="produse">
    <div class="section-head section-head-row">
      <div><p class="eyebrow">Produse</p><h2>Toate produsele</h2><p>Prețurile afișate sunt finale. Reducerile la 2 sau 3 bucăți se aplică automat în coș.</p></div>
    </div>
    ${categories.length >= 2 ? html`<div class="filter-chips" role="tablist" aria-label="Filtrează după categorie">
      <button type="button" class="chip on" data-filter="">Toate <small>${products.length}</small></button>
      ${categories.map((c) => html`<button type="button" class="chip" data-filter="${c.slug}">${c.name} <small>${c.count}</small></button>`)}
    </div>` : ''}
    ${products.length
      ? html`<div class="pgrid" data-filter-grid>${products.map((p, i) => productCard(p, products.length % 2 && i === products.length - 1 ? 'pcard-wide' : ''))}</div>`
      : html`<p class="empty">Adaugă primul produs din panoul de administrare.</p>`}
  </section>

  ${wheelOn ? html`<section class="wrap hv-wheel">
    <button type="button" class="wheel-promo" data-wheel-open>
      <span class="wheel-promo-emoji" aria-hidden="true">🎁</span>
      <span class="wheel-promo-text"><strong>Ai o surpriză!</strong><small>Învârte roata norocului și poți câștiga o reducere.</small></span>
      <span class="wheel-promo-cta">Încearcă</span>
    </button>
  </section>` : ''}

  ${spot ? html`<section class="wrap section hv-sec">
    <div class="hv-spot">
      <a class="hv-spot-media" href="/p/${spot.slug}"><img src="${spotImg}" alt="${spot.title}" width="720" height="720" loading="lazy"></a>
      <div class="hv-spot-copy">
        <p class="eyebrow">Recomandarea noastră</p>
        <h2>${spot.title}</h2>
        ${spot.subtitle ? html`<p class="hv-spot-sub">${spot.subtitle}</p>` : ''}
        ${spot.benefits.length ? html`<ul class="hv-spot-list">${spot.benefits.slice(0, 4).map((x) => html`<li>${icons.check(16)}<span>${x}</span></li>`)}</ul>` : ''}
        <div class="hv-spot-price"><strong>${money(spot.price)}</strong>${spot.compare_at_price > spot.price ? html`<s>${money(spot.compare_at_price)}</s>` : ''}
          ${offers.length ? html`<span class="hv-spot-offers">${offers.map((o) => html`<span>${o.qty} buc. <b>−${o.pct}%</b></span>`)}</span>` : ''}</div>
        <div class="hv-spot-actions">
          <button type="button" class="btn btn-primary btn-lg" data-quick-add="${spot.id}" data-title="${spot.title}" data-price="${spot.price}">${icons.cart(20)} Adaugă în coș</button>
          <a class="btn btn-ghost btn-lg" href="/p/${spot.slug}">Vezi detalii</a>
        </div>
      </div>
    </div>
  </section>` : ''}

  <section class="hv-how" id="cum-comanzi">
    <div class="wrap">
      <div class="section-head hv-how-head"><p class="eyebrow">Cum comanzi</p><h2>Simplu, fără cont și fără card</h2></div>
      <ol class="hv-how-steps">
        <li><span class="hv-how-ic">${icons.cart(24)}<i>1</i></span><h3>Alegi produsele</h3><p>Le pui în coș. Reducerea la 2 sau 3 bucăți apare pe loc.</p></li>
        <li><span class="hv-how-ic">${icons.home(24)}<i>2</i></span><h3>Completezi adresa</h3><p>Nume, telefon, email și adresa. Durează sub două minute.</p></li>
        <li><span class="hv-how-ic">${icons.truck(24)}<i>3</i></span><h3>Urmărești coletul</h3><p>Primești pe email numărul de urmărire când pleacă din depozit.</p></li>
        <li><span class="hv-how-ic">${icons.cash(24)}<i>4</i></span><h3>Plătești la livrare</h3><p>Plătești curierului și primești factura pe email.</p></li>
      </ol>
    </div>
  </section>

  ${reviews.length ? html`<section class="wrap section hv-sec">
    <div class="section-head section-head-row"><div><p class="eyebrow">Recenzii</p><h2>Ce spun clienții</h2></div></div>
    <div class="review-scroller">${reviews.map((r) => html`<article class="review-card">
      ${stars(r.rating, 16)}
      <p>„${r.text.length > 220 ? r.text.slice(0, 217) + '…' : r.text}”</p>
      <footer><strong>${r.name}</strong>${r.city ? html`<span>${r.city}</span>` : ''}<a href="/p/${r.slug}">${r.product}</a></footer>
    </article>`)}</div>
  </section>` : ''}

  <section class="wrap section hv-sec" id="intrebari">
    <div class="faq3 hv-faq">
      <div class="faq3-head">
        <span class="faq3-ico" aria-hidden="true">?</span>
        <h2>Întrebări frecvente</h2>
        <p class="muted">Răspunsuri scurte la ce ne întreabă cel mai des clienții.</p>
      </div>
      <div class="faq3-grid">${faq.map(([q, a], i) => html`<details class="faq3-item" ${i === 0 ? raw('open') : ''}><summary><span class="faq3-q">${q}</span><span class="faq3-tog" aria-hidden="true"></span></summary><div class="faq3-a"><p>${a}</p></div></details>`)}</div>
      <p class="hv-faq-more">Nu ai găsit răspunsul? <a class="btn btn-ghost" href="/pagina/contact">${icons.mail(18)} Scrie-ne un mesaj</a></p>
    </div>
  </section>`;
}

// ---------------- Pagina de produs ----------------
// iconița potrivită pentru un avantaj, după cuvintele din text
const BENEFIT_ICONS = [
  [/electric|priz|baterie|usb|reîncărc|acumulator|curent/i, 'battery'],
  [/culor|color|nuanț/i, 'palette'],
  [/temporiz|somn|noapte|adoarme|veghe/i, 'moon'],
  [/secund|minut|rapid|repede|instant/i, 'clock'],
  [/curăț|demont|spăl|igien/i, 'sparkle'],
  [/ușoar|portabil|rucsac|călător|compact|buzunar|torpedou|\bg\b/i, 'box'],
  [/silicon|moale|sigur|rezistent|durabil|nu se sparge/i, 'shield'],
];
function benefitIcon(text, i) {
  const hit = BENEFIT_ICONS.find(([re]) => re.test(text));
  return icons[hit ? hit[1] : ['sparkle', 'shield', 'clock', 'box'][i % 4]];
}

export function productPage({ settings, product: p, reviews, related = [], siteUrl }) {
  const off = pctOff(p);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const bundles = (p.bundles || []).filter((b) => Number(b.qty) >= 1).sort((a, b) => a.qty - b.qty);
  const lowStock = p.track_stock && p.stock > 0 && p.stock <= 10;
  const outOfStock = p.track_stock && p.stock <= 0;
  const threshold = Number(settings.free_shipping_threshold) || 0;
  const freeQty = threshold && p.price > 0 ? Math.ceil(threshold / p.price) : 0;
  const shipNote = !threshold ? '' : p.price >= threshold ? '<strong>Transport gratuit</strong> pentru acest produs'
    : freeQty <= 5 ? `<strong>Transport gratuit</strong> dacă iei ${freeQty} bucăți sau comanzi peste ${money(threshold)}`
    : `<strong>Transport gratuit</strong> la comenzile peste ${money(threshold)}`;
  const specs = (p.specs || []).filter((x) => x.k && x.v);

  return html`
  <div class="wrap pdp">
    <nav class="crumbs" aria-label="Navigare"><a href="/">Acasă</a><span>/</span><a href="/#produse">Produse</a><span>/</span><span>${p.title}</span></nav>
    <div class="pdp-grid">
      <div class="gallery" data-gallery>
        <div class="gallery-main">
          <div class="gallery-track" data-gallery-track>${p.images.length ? p.images.map((src, i) => html`<div class="gallery-slide"><img src="${src}" alt="${p.title}${i ? ` – poza ${i + 1}` : ''}" width="900" height="900" ${i === 0 ? raw('fetchpriority="high"') : raw('loading="lazy"')} draggable="false"></div>`) : html`<div class="gallery-slide"><img src="${img(p)}" alt="${p.title}" width="900" height="900"></div>`}</div>
          ${off ? html`<span class="tag-save tag-lg">−${off}%</span>` : ''}
          ${p.images.length > 1 ? html`
          <button type="button" class="gallery-nav prev" data-gallery-prev aria-label="Poza anterioară">${raw('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>')}</button>
          <button type="button" class="gallery-nav next" data-gallery-next aria-label="Poza următoare">${raw('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>')}</button>
          <div class="gallery-dots" aria-hidden="true">${p.images.map((_, i) => html`<span class="${i === 0 ? 'active' : ''}"></span>`)}</div>` : ''}
        </div>
        ${p.images.length > 1 ? html`<div class="gallery-thumbs">${p.images.map((src, i) => html`
          <button type="button" class="${i === 0 ? 'active' : ''}" data-gallery-thumb="${i}" aria-label="Poza ${i + 1}">
            <img src="${src}" alt="" width="120" height="120" loading="lazy">
          </button>`)}</div>` : ''}
      </div>

      <div class="buybox" id="cumpara">
        ${p.badge ? html`<span class="badge-inline">${p.badge}</span>` : ''}
        <h1>${p.title}</h1>
        ${p.subtitle ? html`<p class="pdp-sub">${p.subtitle}</p>` : ''}
        ${reviews.length ? html`<a href="#recenzii" class="rating-link">${stars(avg)} <span>${avg.toFixed(1)} · ${reviews.length} ${reviews.length === 1 ? 'recenzie' : 'recenzii'}</span></a>` : ''}

        <div class="price-block">
          <div class="price-now" data-price-now>${money(p.price)}</div>
          ${p.compare_at_price > p.price ? html`
            <div class="price-was"><s>${money(p.compare_at_price)}</s></div>
            <div class="price-save">Economisești ${money(p.compare_at_price - p.price)}</div>` : ''}
        </div>

        ${shipNote ? html`<p class="ship-note">${icons.truck(18)}<span>${raw(shipNote)}</span></p>` : ''}

        ${p.benefits.length ? html`<ul class="benefits">${p.benefits.slice(0, 4).map((b) => html`<li>${icons.check(18)}<span>${b}</span></li>`)}</ul>` : ''}

        <form class="buy-form" data-buy-form data-product-id="${p.id}" data-product-price="${p.price}" data-product-title="${p.title}">
          ${bundles.length > 1 ? html`
          <fieldset class="bundles">
            <legend>Alege oferta</legend>
            ${bundles.map((b, i) => {
              const gross = p.price * b.qty;
              const net = Math.round(gross * (1 - (Number(b.pct) || 0) / 100));
              return html`<label class="bundle ${b.label ? 'has-label' : ''}">
                <input type="radio" name="qty" value="${b.qty}" ${i === 0 ? 'checked' : ''} data-total="${net}">
                <span class="bundle-main">
                  <strong>${b.qty} ${b.qty === 1 ? 'bucată' : 'bucăți'}</strong>
                  ${Number(b.pct) > 0 ? html`<span class="bundle-save">−${b.pct}% la total</span>` : html`<span class="bundle-each">preț standard</span>`}
                </span>
                <span class="bundle-price"><strong>${money(net)}</strong>${net < gross ? html`<s>${money(gross)}</s>` : ''}</span>
                ${b.label ? html`<span class="bundle-flag">${b.label}</span>` : ''}
              </label>`;
            })}
          </fieldset>` : html`
          <div class="qty-row">
            <span>Cantitate</span>
            <div class="qty" data-qty>
              <button type="button" data-qty-dec aria-label="Scade cantitatea">${icons.minus(18)}</button>
              <input type="number" name="qty" value="1" min="1" max="${p.track_stock ? Math.max(1, Math.min(p.stock, 50)) : 50}" inputmode="numeric" aria-label="Cantitate">
              <button type="button" data-qty-inc aria-label="Crește cantitatea">${icons.plus(18)}</button>
            </div>
          </div>`}

          ${outOfStock
            ? html`<p class="stock-out">Momentan nu mai avem în stoc. Revino în curând.</p>`
            : html`
          <button type="submit" class="btn btn-primary btn-xl btn-block" data-buy-now>Comandă acum – plătești la livrare</button>
          <button type="button" class="btn btn-ghost btn-block" data-add-to-cart>${icons.cart(20)} Adaugă în coș</button>`}
          ${lowStock ? html`<p class="stock-low">Au mai rămas ${p.stock} bucăți în stoc.</p>` : ''}
        </form>

        <ul class="assurance">
          <li>${icons.truck(22)}<strong>Livrare rapidă</strong><small data-delivery-date data-short>În 24–48h</small></li>
          <li>${icons.cash(22)}<strong>Plata la livrare</strong><small>Plătești curierului</small></li>
          <li>${icons.back(22)}<strong>Retur ${settings.return_days || 14} zile</strong><small>Fără explicații</small></li>
        </ul>

        <div class="pdp-acc">
          <details><summary>Livrare și plată</summary><div>
            <p>${settings.delivery_text}. Primești pe email numărul AWB ca să urmărești coletul.</p>
            <p>Plătești la livrare, curierului${settings.card_enabled === '1' ? ', sau online cu cardul' : ''}. Transportul costă ${money(settings.shipping_cost)}${threshold ? html`, iar peste ${money(threshold)} este gratuit` : ''}.</p>
          </div></details>
          <details><summary>Retur și garanție</summary><div>
            <p>Ai ${settings.return_days || 14} zile să returnezi produsul, fără să ne spui motivul. Îți dăm banii înapoi după ce primim coletul.</p>
            <p><a href="/pagina/retur">Vezi condițiile de retur</a></p>
          </div></details>
          ${specs.length ? html`<details><summary>Specificații</summary><dl class="specs">${specs.map((x) => html`<div><dt>${x.k}</dt><dd>${x.v}</dd></div>`)}</dl></details>` : ''}
        </div>
      </div>
    </div>

  </div>

  ${p.benefits.length ? html`<section class="pdp-highlights" aria-label="Pe scurt despre produs"><div class="wrap">
    <ul class="hl-grid">${p.benefits.slice(0, 4).map((b, i) => {
      const [t, ...rest] = String(b).split(/,\s*|\s+–\s+|:\s*/);
      return html`<li><span class="hl-ico">${benefitIcon(b, i)(24)}</span><strong>${t}</strong>${rest.length ? html`<span>${rest.join(', ')}</span>` : ''}</li>`;
    })}</ul>
  </div></section>` : ''}

  ${p.description ? html`<section class="pdp-about"><div class="wrap about-grid">
    <div class="about-head">
      <p class="eyebrow">Despre produs</p>
      <h2>${p.subtitle || p.title}</h2>
    </div>
    <div class="about-body">${paragraphs(p.description)}</div>
  </div></section>` : ''}

  ${(p.sections || []).length ? html`<section class="pdp-story"><div class="wrap story2">
    ${p.sections.map((sec, i) => html`<article class="s2-row ${i % 2 ? 'rev' : ''}">
      ${sec.image ? html`<div class="s2-media"><img src="${sec.image}" alt="${sec.title || p.title}" width="900" height="900" loading="lazy"></div>` : ''}
      <div class="s2-text">
        <span class="s2-num">${String(i + 1).padStart(2, '0')}</span>
        ${sec.title ? html`<h2>${sec.title}</h2>` : ''}
        ${paragraphs(sec.text || '')}
      </div>
    </article>`)}
  </div></section>` : ''}


  ${p.faq.length || reviews.length ? html`<div class="wrap pdp-bottom">
    ${p.faq.length ? html`<section class="faq3">
      <div class="faq3-head">
        <span class="faq3-ico" aria-hidden="true">?</span>
        <h2>Întrebări frecvente</h2>
        <p class="muted">Răspunsuri scurte la ce ne întreabă cel mai des clienții.</p>
      </div>
      <div class="faq3-grid">${p.faq.map((f, i) => html`<details class="faq3-item" ${i === 0 ? raw('open') : ''}><summary><span class="faq3-q">${f.q}</span><span class="faq3-tog" aria-hidden="true"></span></summary><div class="faq3-a">${paragraphs(f.a)}</div></details>`)}</div>
    </section>` : ''}
    ${reviews.length ? html`<section id="recenzii" class="reviews">
      <h2>Ce spun clienții</h2>
      <div class="reviews-summary">${stars(avg, 20)} <strong>${avg.toFixed(1)} din 5</strong> <span>din ${reviews.length} ${reviews.length === 1 ? 'recenzie' : 'recenzii'}</span></div>
      <div class="review-list">${reviews.map((r) => html`<article class="review">
        <header>${stars(r.rating, 14)}<strong>${r.name}</strong>${r.city ? html`<span>${r.city}</span>` : ''}</header>
        ${paragraphs(r.text)}
      </article>`)}</div>
    </section>` : ''}
  </div>` : ''}

  ${related.length ? html`<section class="wrap related">
    <h2>Te-ar mai putea interesa</h2>
    <div class="pgrid">${related.map(productCard)}</div>
  </section>` : ''}

  ${outOfStock ? '' : html`<div class="sticky-buy" data-sticky-buy>
    <div class="sticky-info"><strong>${money(p.price)}</strong>${p.compare_at_price > p.price ? html`<s>${money(p.compare_at_price)}</s>` : ''}</div>
    <a href="#cumpara" class="btn btn-primary">Comandă acum</a>
  </div>`}`;
}

export function productJsonLd(p, reviews, siteUrl) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.title, description: p.subtitle || p.title,
    image: p.images.map((i) => (i.startsWith('http') ? i : siteUrl + i)), sku: p.sku || String(p.id),
    offers: {
      '@type': 'Offer', priceCurrency: 'RON', price: (p.price / 100).toFixed(2), url: `${siteUrl}/p/${p.slug}`,
      availability: p.track_stock && p.stock <= 0 ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    },
  };
  if (reviews.length) {
    ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1), reviewCount: reviews.length };
  }
  return ld;
}

// ---------------- Coș ----------------
// ---------------- Finalizare comandă ----------------
export function checkoutPage({ settings, bump, loggedIn = false }) {
  const cardOn = settings.card_enabled === '1';
  return html`<div class="wrap checkout">
    <div class="co-head" data-co-head><h1>Coșul tău</h1><span class="cart-head-count" data-cart-items></span></div>

    <div data-cart-empty hidden>
      <div class="cart-empty">
        <div class="cart-empty-icon">${icons.cart(40)}</div>
        <h1>Coșul tău este gol</h1>
        <p>Adaugă produsele preferate și revino aici ca să finalizezi comanda.</p>
        <a class="btn btn-primary btn-lg" href="/#produse">Începe cumpărăturile</a>
      </div>
    </div>

    <div class="co-grid" data-co-main>
      <section class="co-cart">
        <div data-cart-lines><div class="cart-loading" aria-busy="true"><span></span></div></div>
        <div class="co-summary" data-summary>
          <div data-summary-free></div>
          <div data-summary-coupon></div>
          <dl class="totals" data-summary-totals></dl>
        </div>
        <a class="co-continue" href="/#produse">← Continuă cumpărăturile</a>
      </section>

      <form class="checkout-form co-form" id="checkout-form" data-checkout-form novalidate>

        ${!loggedIn && settings.accounts_enabled !== '0' ? html`<p class="checkout-login">Ai cont? <a href="/cont/autentificare?next=/cos">Intră în cont</a> și completăm datele automat. Poți comanda și fără cont.</p>` : ''}
        <section>
          <h2>Date de livrare</h2>
          <div class="field">
            <label for="f-name">Nume și prenume</label>
            <input id="f-name" name="name" autocomplete="name" required minlength="3" placeholder="ex: Maria Popescu">
          </div>
          <div class="field">
            <label for="f-phone">Telefon</label>
            <input id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="07xx xxx xxx">
            <small>Curierul te sună înainte de livrare.</small>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="f-county">Județ</label>
              <select id="f-county" name="county" required autocomplete="address-level1">
                <option value="">Alege județul</option>
                ${JUDETE.map((j) => html`<option>${j}</option>`)}
              </select>
            </div>
            <div class="field">
              <label for="f-city">Localitate</label>
              <input id="f-city" name="city" autocomplete="address-level2" required placeholder="ex: Ploiești">
            </div>
          </div>
          <div class="field">
            <label for="f-address">Adresă completă</label>
            <input id="f-address" name="address" autocomplete="street-address" required minlength="5" placeholder="Strada, număr, bloc, scară, apartament">
          </div>
          <div class="field-row">
            <div class="field">
              <label for="f-email">Email</label>
              <input id="f-email" name="email" type="email" autocomplete="email" inputmode="email" required placeholder="primești confirmarea și AWB-ul">
            </div>
            <div class="field">
              <label for="f-zip">Cod poștal <span class="opt">(opțional)</span></label>
              <input id="f-zip" name="postalCode" autocomplete="postal-code" inputmode="numeric">
            </div>
          </div>
          <div class="field">
            <label for="f-notes">Observații <span class="opt">(opțional)</span></label>
            <textarea id="f-notes" name="notes" rows="2" placeholder="ex: sunați înainte, interfon 12"></textarea>
          </div>
        </section>

        <section>
          <h2>Plata</h2>
          <div class="pay-options">
            <label class="pay-option">
              <input type="radio" name="payment" value="ramburs" checked>
              <span>${icons.cash(22)}<span><strong>Plata la livrare (ramburs)</strong><small>Plătești curierului când primești coletul${Number(settings.cod_fee) ? ` · taxă ${money(settings.cod_fee)}` : ''}</small></span></span>
            </label>
            ${cardOn ? html`<label class="pay-option">
              <input type="radio" name="payment" value="card">
              <span>${icons.lock(22)}<span><strong>Card online</strong><small>Visa, Mastercard, Apple Pay, Google Pay – procesat securizat de Stripe</small></span></span>
            </label>` : ''}
          </div>
        </section>

        ${bump ? html`<label class="bump">
          <input type="checkbox" name="bump" value="1" data-bump>
          <img src="${img(bump)}" alt="" width="72" height="72">
          <span>
            <strong>Adaugă și ${bump.title}</strong>
            <span>doar <b>${money(Math.round(bump.price * (1 - (Number(settings.bump_discount_pct) || 0) / 100)))}</b>${Number(settings.bump_discount_pct) ? html` în loc de <s>${money(bump.price)}</s>` : ''}, doar acum, la această comandă.</span>
          </span>
        </label>` : ''}

      </form>

      <div class="co-final">
        <div class="split-note" data-split-note hidden></div>
        <p class="form-error" data-form-error hidden></p>
        <button type="submit" form="checkout-form" class="btn btn-primary btn-xl btn-block" data-submit>Finalizează comanda</button>
        <p class="legal-note">Plasând comanda ești de acord cu <a href="/pagina/termeni" target="_blank">termenii și condițiile</a> și confirmi că ai citit <a href="/pagina/confidentialitate" target="_blank">politica de confidențialitate</a>. Comanda implică obligația de plată. Ai dreptul la retur în ${settings.return_days || 14} zile (dreptul de retragere) – vezi <a href="/pagina/retur" target="_blank">condițiile de retur</a>.</p>
      </div>
    </div>
  </div>`;
}

// ---------------- Mulțumim / status comandă ----------------
const STEPS = [['noua', 'Plasată'], ['confirmata', 'Confirmată'], ['expediata', 'Expediată'], ['livrata', 'Livrată']];
const STOPPED = { anulata: 'Comanda a fost anulată.', refuzata: 'Coletul a fost refuzat la livrare.', retur: 'Produsele au fost returnate.' };
const dayTime = (sql) => {
  const d = new Date(sql.replace(' ', 'T') + 'Z');
  return d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function orderProgress(order, events) {
  const when = { noua: order.created_at };
  for (const e of events) for (const [k, label] of STEPS) if (!when[k] && e.message.includes(`→ ${label}`)) when[k] = e.created_at;
  const stopped = STOPPED[order.status];
  const idx = stopped ? -1 : STEPS.findIndex(([k]) => k === order.status);
  // la o comandă oprită, etapele parcurse sunt cele care au o dată
  const done = (i) => (stopped ? !!when[STEPS[i][0]] : i <= idx);
  return html`<ol class="progress ${stopped ? 'is-stopped' : ''}">
    ${STEPS.map(([k, label], i) => html`<li class="${done(i) ? 'done' : ''} ${i > 0 && done(i) && done(i - 1) ? 'joined' : ''} ${!stopped && i === idx ? 'current' : ''}">
      <span class="dot">${done(i) ? icons.check(14) : ''}</span>
      <span class="lbl">${label}</span>
      <span class="when">${when[k] && done(i) ? dayTime(when[k]) : ''}</span>
    </li>`)}
  </ol>
  ${stopped ? html`<p class="progress-stop">${stopped}</p>` : ''}`;
}

export function thankYouPage({ settings, order, items, payment, invoices = [], events = [], products = new Map(), identify = null }) {
  const isCard = order.payment_method === 'card';
  const paid = order.payment_status === 'platita';
  const fresh = Date.now() - Date.parse(order.created_at.replace(' ', 'T') + 'Z') < 1000 * 60 * 60 * 6;
  const purchase = {
    eventId: order.number, value: order.total / 100, currency: 'RON',
    contents: items.map((i) => ({ id: String(i.product_id), quantity: i.qty, price: i.unit_price / 100, name: i.title })),
    ttEvent: TIKTOK_PURCHASE_EVENT,
    identify: identify || undefined, // email/telefon criptate, pentru potrivirea cu reclamele TikTok
  };
  // pentru card, evenimentul Purchase pleacă doar după plată
  const trackPurchase = fresh && (!isCard || paid);

  return html`<div class="wrap narrow thanks" ${trackPurchase ? raw(`data-purchase='${JSON.stringify(purchase).replace(/'/g, '&#39;')}'`) : ''}>
    ${isCard && !paid ? html`
      <div class="thanks-head warn">
        <h1>Plata nu a fost finalizată</h1>
        <p>Comanda ${order.number} este salvată, dar plata cu cardul ${payment === 'anulata' ? 'a fost anulată' : 'nu a fost încă confirmată'}.</p>
        <form method="post" action="/api/comanda/${order.token}/plata"><button class="btn btn-primary btn-lg">Încearcă din nou plata</button></form>
        <form method="post" action="/api/comanda/${order.token}/ramburs" class="mt"><button class="btn btn-ghost">Plătesc la livrare (ramburs)</button></form>
      </div>` : html`
      <div class="thanks-head">
        ${STOPPED[order.status] ? '' : html`<span class="thanks-icon">${icons.check(34)}</span>`}
        <h1>${fresh && ['noua', 'confirmata'].includes(order.status) ? 'Mulțumim, comanda e plasată!' : `Comanda ${order.number}`}</h1>
        ${fresh && ['noua', 'confirmata'].includes(order.status) ? html`<p>Numărul comenzii: <strong>${order.number}</strong>.</p>` : html`<p class="muted">Plasată pe ${dayTime(order.created_at)}</p>`}
      </div>`}

    ${order.fulfillment_mode === 'mixt' ? html`<div class="split-note"><strong>📦 Comanda ta vine în 2 colete separate</strong><span>Produsele pleacă din depozite diferite, așa că vei primi două colete, fiecare cu AWB-ul lui.${isCard && paid ? '' : html` Plătești fiecare colet curierului care ți-l aduce: <b>${money(order.hs_total)}</b> și <b>${money(order.own_total)}</b>.`}</span></div>` : ''}

    <section class="order-status card">
      <div class="card-head"><h2>Statusul comenzii</h2><span class="status status-${order.status}">${ORDER_STATUSES[order.status]}</span></div>
      ${orderProgress(order, events)}
      <p class="status-line">
      ${order.fulfillment_mode !== 'mixt' && order.awb ? html`${icons.truck(18)} AWB ${order.tracking_url ? html`<a href="${order.tracking_url}" target="_blank" rel="noopener">${order.awb}</a>` : order.awb}${order.courier ? ` (${order.courier})` : ''}` : ''}</p>
      ${order.fulfillment_mode === 'mixt' ? html`<ul class="parcel-list">
        ${[
          ['Coletul 1', items.filter((i) => i.fulfillment === 'helpship'), order.hs_awb, order.hs_tracking_url, order.hs_courier],
          ['Coletul 2', items.filter((i) => i.fulfillment !== 'helpship'), order.awb, order.tracking_url, order.courier],
        ].map(([label, list, awb, url, courier]) => html`<li>
          <strong>${label}</strong><span class="muted">${list.map((i) => `${i.qty} × ${i.title}`).join(', ')}</span>
          <span>${awb ? html`AWB ${url ? html`<a href="${url}" target="_blank" rel="noopener">${awb}</a>` : awb}${courier ? ` (${courier})` : ''}` : html`<span class="muted">În pregătire – AWB-ul apare aici când pleacă coletul</span>`}</span>
        </li>`)}
      </ul>` : ''}
      <p class="muted small">Păstrează această pagină: poți reveni oricând aici ca să vezi statusul comenzii.</p>
    </section>

    ${invoices.length ? html`<section class="card invoice-card">
      <h2>Factură</h2>
      ${invoices.map((f) => html`<div class="invoice-row">
        <span class="invoice-ico">${icons.doc(22)}</span>
        <span class="invoice-meta"><strong>${f.kind === 'storno' ? 'Factură storno' : 'Factura'} ${f.full_number}</strong>
          <span class="muted">${f.issued_on.slice(8, 10)}.${f.issued_on.slice(5, 7)}.${f.issued_on.slice(0, 4)} · ${money(f.total)} · PDF</span></span>
        <span class="invoice-actions">
          <a class="btn btn-primary" href="/factura/${f.token}?descarca">${icons.download(18)} Descarcă</a>
          <a class="btn btn-ghost" href="/factura/${f.token}" target="_blank" rel="noopener">Deschide</a>
        </span>
      </div>`)}
    </section>` : ''}

    <section class="card">
      <h2>Produse</h2>
      <ul class="order-items">${items.map((i) => {
        const p = products.get(i.product_id) || {};
        const inner = html`<span class="oi-img">${p.img ? html`<img src="${p.img}" alt="" width="56" height="56" loading="lazy">` : ''}</span>
          <span class="oi-name">${i.title}<small>${i.qty} buc. × ${money(i.unit_price)}</small></span>`;
        return html`<li>${p.slug ? html`<a class="oi-link" href="/p/${p.slug}">${inner}</a>` : html`<span class="oi-link">${inner}</span>`}<strong>${money(i.total)}</strong></li>`;
      })}</ul>
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div>
        ${order.discount ? html`<div class="save"><dt>Reducere pachet</dt><dd>−${money(order.discount)}</dd></div>` : ''}
        ${order.coupon_discount ? html`<div class="save"><dt>Cod ${order.coupon_code}</dt><dd>−${money(order.coupon_discount)}</dd></div>` : ''}
        <div><dt>Transport</dt><dd>${order.shipping ? money(order.shipping) : 'Gratuit'}</dd></div>
        ${order.cod_fee ? html`<div><dt>Taxă ramburs</dt><dd>${money(order.cod_fee)}</dd></div>` : ''}
        <div class="grand"><dt>${isCard && paid ? 'Total plătit' : order.status === 'livrata' ? 'Total plătit la livrare' : ['anulata', 'refuzata', 'retur'].includes(order.status) ? 'Total comandă' : 'Total de plată la livrare'}</dt><dd>${money(order.total)}</dd></div>
      </dl>
    </section>

    <section class="card">
      <h2>Livrare la</h2>
      <p>${order.customer_name}<br>${order.address}<br>${order.city}, ${order.county}<br>${order.phone}</p>
    </section>

    <p class="center"><a class="btn btn-ghost" href="/">Înapoi la magazin</a></p>
    <p class="center muted">Ai o întrebare? <a href="/pagina/contact">Scrie-ne</a> și te ajutăm.</p>
  </div>`;
}

export function searchPage({ settings, q, products, all, mode }) {
  const isCat = mode === 'category';
  return html`<div class="wrap search-page">
    <header class="search-head">
      <nav class="crumbs" aria-label="Navigare"><a href="/">Acasă</a><span>/</span><span>${isCat ? q : 'Căutare'}</span></nav>
      <h1>${isCat ? q : q ? html`Rezultate pentru „${q}”` : 'Caută în magazin'}</h1>
      ${!isCat ? html`<form class="search-big" action="/cautare" method="get" role="search">
        <input type="search" name="q" value="${q}" placeholder="Ce cauți?" aria-label="Caută produse" ${q ? '' : 'autofocus'}>
        <button class="btn btn-primary">${icons.search(20)} Caută</button>
      </form>` : ''}
      ${q ? html`<p class="muted">${products.length === 1 ? '1 produs' : `${products.length} produse`}</p>` : ''}
    </header>
    ${products.length ? html`<div class="pgrid">${products.map(productCard)}</div>`
      : q ? html`<div class="empty-box"><p>Nu am găsit nimic pentru „${q}”. Încearcă alt cuvânt sau uită-te prin produsele noastre.</p></div>
        ${all.length ? html`<h2 class="mt-l">Poate te interesează</h2><div class="pgrid">${all.slice(0, 8).map(productCard)}</div>` : ''}` : ''}
  </div>`;
}

export function trackOrderPage({ settings, error }) {
  return html`<div class="wrap narrow page track-page">
    <h1>Unde e comanda mea?</h1>
    <p class="page-lead">Scrie numărul comenzii și telefonul folosit la comandă. Îți arătăm statusul și, după expediere, numărul AWB cu link de urmărire.</p>
    <form method="post" action="/comanda" class="card track-form">
      ${error ? html`<p class="form-error">${error}</p>` : ''}
      <div class="field-row">
        <div class="field"><label for="t-number">Număr comandă</label><input id="t-number" name="number" required placeholder="ex: CHI-1024" autocapitalize="characters"></div>
        <div class="field"><label for="t-phone">Telefon</label><input id="t-phone" name="phone" type="tel" inputmode="tel" required placeholder="07xx xxx xxx" autocomplete="tel"></div>
      </div>
      <button class="btn btn-primary btn-lg btn-block">Vezi comanda</button>
    </form>
    <p class="muted center">Numărul comenzii îl găsești pe pagina de confirmare și în emailul de confirmare. Nu-l mai ai? <a href="/pagina/contact">Scrie-ne</a>.</p>
  </div>`;
}

export function notFoundPage() {
  return html`<div class="wrap narrow center notfound">
    <h1>Pagina nu există</h1>
    <p>Poate produsul a fost scos din ofertă sau linkul are o greșeală.</p>
    <a class="btn btn-primary" href="/">Mergi la magazin</a>
  </div>`;
}

export { pctOff, moneyNum };
