import { html, raw, paragraphs } from '../lib/html.js';
import { money, moneyNum } from '../lib/util.js';
import { JUDETE } from '../lib/judete.js';
import { ORDER_STATUSES } from '../lib/db.js';
import { icons, stars } from './icons.js';
import { TIKTOK_PURCHASE_EVENT } from '../lib/tracking.js';

const pctOff = (p) => (p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0);
const img = (p, i = 0) => p.images?.[i] || '/img/placeholder.svg';

export function trustRow(settings) {
  const items = [
    [icons.truck(), settings.delivery_text || 'Livrare rapidă prin curier'],
    [icons.cash(), 'Plătești la livrare, după ce vezi coletul'],
    [icons.back(), `Retur în ${settings.return_days || 14} zile`],
    [icons.shield(), 'Garanție pentru toate produsele'],
  ];
  return html`<ul class="trust-row">${items.map(([i, t]) => html`<li>${i}<span>${t}</span></li>`)}</ul>`;
}

function productCard(p) {
  const off = pctOff(p);
  return html`<a class="pcard" href="/p/${p.slug}">
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
  </a>`;
}

// ---------------- Pagina principală ----------------
export function homePage({ settings, products, categories = [], bestsellers = [], reviews = [], wheelOn = false }) {
  const featured = products.filter((p) => p.featured);
  const hero = featured[0] || products[0];
  const spotlight = featured.find((p) => p !== hero) || null;
  const threshold = Number(settings.free_shipping_threshold) || 0;
  const returnDays = settings.return_days || 14;

  const faq = [
    ['Cum plătesc?', `Plătești curierului, la livrare, după ce primești coletul${settings.card_enabled === '1' ? ', sau online cu cardul, la finalizarea comenzii' : ''}. Nu ai nimic de plătit în avans.`],
    ['În cât timp primesc comanda?', `${settings.delivery_text || 'Livrăm prin curier în 24–48 de ore lucrătoare'}. Curierul te sună înainte să ajungă.`],
    ['Cât costă transportul?', threshold ? `${money(settings.shipping_cost)} pe comandă, iar peste ${money(threshold)} transportul este gratuit.` : `${money(settings.shipping_cost)} pe comandă.`],
    ['Pot returna un produs?', `Da. Ai ${returnDays} zile de la primire să te răzgândești, fără să ne spui motivul. Detaliile sunt în pagina Retur și garanție.`],
    ['Trebuie să îmi fac cont?', 'Nu. Completezi doar numele, telefonul și adresa de livrare. Durează mai puțin de două minute.'],
  ];

  return html`
  <section class="home-hero">
    <div class="wrap home-hero-inner">
      <div class="home-hero-copy">
        <p class="eyebrow-light">Magazin online cu livrare în toată țara</p>
        <h1>${settings.tagline || 'Lucruri bune pentru acasă, livrate rapid'}</h1>
        <p class="home-hero-lead">Alegem puține produse, dar bune, și le trimitem repede. Comanzi în două minute, fără cont, și plătești abia când ai coletul în mână.</p>
        <div class="home-hero-actions">
          <a class="btn btn-primary btn-lg" href="#produse">Vezi produsele</a>
          <a class="btn btn-outline-light btn-lg" href="#cum-comanzi">Cum comanzi</a>
        </div>
        <ul class="hero-checks">
          <li>${icons.check(18)} Plata la livrare</li>
          <li>${icons.check(18)} Livrare în 24–48h</li>
          <li>${icons.check(18)} Retur în ${returnDays} zile</li>
        </ul>
      </div>
      ${hero ? html`<a class="hero-card" href="/p/${hero.slug}">
        <div class="hero-card-media">
          <img src="${img(hero)}" alt="${hero.title}" width="640" height="640" fetchpriority="high">
          ${pctOff(hero) ? html`<span class="tag-save tag-lg">−${pctOff(hero)}%</span>` : ''}
          ${hero.badge ? html`<span class="tag-badge">${hero.badge}</span>` : ''}
        </div>
        <div class="hero-card-body">
          <h2>${hero.title}</h2>
          ${hero.subtitle ? html`<p>${hero.subtitle}</p>` : ''}
          <div class="hero-card-foot">
            <span class="hero-card-price"><strong>${money(hero.price)}</strong>${hero.compare_at_price > hero.price ? html`<s>${money(hero.compare_at_price)}</s>` : ''}</span>
            <span class="btn btn-primary btn-sm">Comandă acum</span>
          </div>
        </div>
      </a>` : ''}
    </div>
  </section>

  <section class="wrap">${trustRow(settings)}</section>

  ${categories.length >= 2 ? html`<section class="wrap section section-tight">
    <div class="section-head"><p class="eyebrow">Categorii</p><h2>Cumpără pe categorii</h2></div>
    <div class="cat-grid">${categories.map((c) => html`<a class="cat-card" href="/categorie/${c.slug}">
      <span class="cat-media"><img src="${c.image || '/img/placeholder.svg'}" alt="" width="240" height="240" loading="lazy"></span>
      <span class="cat-name">${c.name}</span><span class="cat-count">${c.count === 1 ? '1 produs' : `${c.count} produse`}</span>
    </a>`)}</div>
  </section>` : ''}

  ${bestsellers.length ? html`<section class="wrap section section-tight">
    <div class="section-head section-head-row"><div><p class="eyebrow">Preferatele clienților</p><h2>Cele mai vândute</h2></div><a class="link-more" href="#produse">Vezi toate produsele</a></div>
    <div class="pscroller">${bestsellers.map(productCard)}</div>
  </section>` : ''}

  <section class="wrap section" id="produse">
    <div class="section-head section-head-row">
      <div>
        <p class="eyebrow">Produse</p>
        <h2>Alese pentru casa ta</h2>
      </div>
      ${threshold ? html`<p class="section-note">${icons.truck(18)} Transport gratuit la comenzile peste ${money(threshold)}</p>` : ''}
    </div>
    ${products.length
      ? html`<div class="pgrid">${products.map(productCard)}</div>`
      : html`<p class="empty">Adaugă primul produs din panoul de administrare.</p>`}
  </section>

  <section class="promo-band">
    <div class="wrap promo-band-inner">
      <div class="promo-item">${icons.truck(30)}<span><strong>${threshold ? `Transport gratuit peste ${money(threshold)}` : 'Livrare rapidă'}</strong><small>${settings.delivery_text || 'Livrare prin curier în toată țara'}</small></span></div>
      <div class="promo-item">${icons.cash(30)}<span><strong>Plătești la livrare</strong><small>Fără plată în avans, fără cont</small></span></div>
      ${wheelOn ? html`<button type="button" class="promo-item promo-wheel" data-wheel-open><span class="promo-emoji" aria-hidden="true">🎁</span><span><strong>Învârte roata norocului</strong><small>și poți câștiga o reducere</small></span></button>`
        : html`<div class="promo-item">${icons.back(30)}<span><strong>Retur în ${returnDays} zile</strong><small>Fără să ne explici de ce</small></span></div>`}
    </div>
  </section>

  ${spotlight ? html`<section class="spotlight">
    <div class="wrap spotlight-inner">
      <a class="spotlight-media" href="/p/${spotlight.slug}"><img src="${img(spotlight)}" alt="${spotlight.title}" width="640" height="640" loading="lazy"></a>
      <div class="spotlight-copy">
        <p class="eyebrow">Recomandarea noastră</p>
        <h2>${spotlight.title}</h2>
        ${spotlight.subtitle ? html`<p class="spotlight-sub">${spotlight.subtitle}</p>` : ''}
        ${spotlight.benefits.length ? html`<ul class="benefits">${spotlight.benefits.slice(0, 4).map((b) => html`<li>${icons.check(18)}<span>${b}</span></li>`)}</ul>` : ''}
        <div class="spotlight-buy">
          <span class="hero-card-price"><strong>${money(spotlight.price)}</strong>${spotlight.compare_at_price > spotlight.price ? html`<s>${money(spotlight.compare_at_price)}</s>` : ''}</span>
          ${spotlight.compare_at_price > spotlight.price ? html`<span class="price-save">Economisești ${money(spotlight.compare_at_price - spotlight.price)}</span>` : ''}
        </div>
        <a class="btn btn-primary btn-lg" href="/p/${spotlight.slug}">Vezi produsul</a>
      </div>
    </div>
  </section>` : ''}

  ${reviews.length ? html`<section class="wrap section">
    <div class="section-head section-head-row"><div><p class="eyebrow">Recenzii</p><h2>Ce spun clienții</h2></div></div>
    <div class="review-scroller">${reviews.map((r) => html`<article class="review-card">
      ${stars(r.rating, 16)}
      <p>„${r.text.length > 220 ? r.text.slice(0, 217) + '…' : r.text}”</p>
      <footer><strong>${r.name}</strong>${r.city ? html`<span>${r.city}</span>` : ''}<a href="/p/${r.slug}">${r.product}</a></footer>
    </article>`)}</div>
  </section>` : ''}

  <section class="wrap section">
    <div class="section-head">
      <p class="eyebrow">De ce Chimag</p>
      <h2>Cumperi fără grijă</h2>
    </div>
    <div class="reasons">
      <article class="reason">${icons.cash(26)}<h3>Plătești la livrare</h3><p>Nu dai niciun ban în avans. Plătești curierului când ai coletul.</p></article>
      <article class="reason">${icons.truck(26)}<h3>Livrare rapidă</h3><p>${settings.delivery_text || 'Livrăm prin curier în 24–48 de ore'}, în toată țara.</p></article>
      <article class="reason">${icons.back(26)}<h3>Retur simplu</h3><p>Ai ${returnDays} zile să te răzgândești, fără să ne explici de ce.</p></article>
      <article class="reason">${icons.chat(26)}<h3>Vorbești cu un om</h3><p>Ne scrii din <a href="/pagina/contact">pagina de contact</a> și primești un răspuns clar, de la un om.</p></article>
    </div>
  </section>

  <section class="section steps-section" id="cum-comanzi">
    <div class="wrap">
      <div class="section-head"><p class="eyebrow">Cum comanzi</p><h2>Trei pași, două minute</h2></div>
      <ol class="steps">
        <li><span class="step-n">1</span><h3>Alegi produsul</h3><p>Vezi pozele, detaliile și ofertele de pachet.</p></li>
        <li><span class="step-n">2</span><h3>Completezi adresa</h3><p>Nume, telefon și adresă. Fără cont, fără parole.</p></li>
        <li><span class="step-n">3</span><h3>Plătești la livrare</h3><p>Curierul îți aduce coletul, iar tu plătești atunci.</p></li>
      </ol>
    </div>
  </section>

  <section class="wrap section faq-home" id="intrebari">
    <div class="faq-home-head">
      <p class="eyebrow">Întrebări frecvente</p>
      <h2>Ce e bine să știi înainte să comanzi</h2>
      <p class="muted">Nu ai găsit răspunsul? <a href="/pagina/contact">Scrie-ne</a> și te ajutăm.</p>
    </div>
    <div class="faq">${faq.map(([q, a]) => html`<details><summary>${q}</summary><div><p>${a}</p></div></details>`)}</div>
  </section>

  <section class="cta-band">
    <div class="wrap cta-band-inner">
      <div>
        <h2>Ai o întrebare înainte să comanzi?</h2>
        <p>Scrie-ne și îți răspundem cât mai repede${settings.hours ? `, ${settings.hours.charAt(0).toLowerCase() + settings.hours.slice(1)}` : ''}.</p>
      </div>
      <a class="btn btn-primary btn-lg" href="/pagina/contact">${icons.mail(20)} Contactează-ne</a>
    </div>
  </section>`;
}

// ---------------- Pagina de produs ----------------
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
          ${specs.length ? html`<details><summary>Specificații</summary><dl class="specs">${specs.map((x) => html`<div><dt>${x.k}</dt><dd>${x.v}</dd></div>`)}</dl></details>` : ''}
          <details><summary>Livrare și plată</summary><div>
            <p>${settings.delivery_text}. Primești pe email numărul AWB ca să urmărești coletul.</p>
            <p>Plătești la livrare, curierului${settings.card_enabled === '1' ? ', sau online cu cardul' : ''}. Transportul costă ${money(settings.shipping_cost)}${threshold ? html`, iar peste ${money(threshold)} este gratuit` : ''}.</p>
          </div></details>
          <details><summary>Retur și garanție</summary><div>
            <p>Ai ${settings.return_days || 14} zile să returnezi produsul, fără să ne spui motivul. Îți dăm banii înapoi după ce primim coletul.</p>
            <p><a href="/pagina/retur">Vezi condițiile de retur</a></p>
          </div></details>
        </div>
      </div>
    </div>

    ${(p.sections || []).length ? html`<div class="story">
      ${p.description ? html`<section class="story-intro"><h2>Despre produs</h2>${paragraphs(p.description)}</section>` : ''}
      ${p.sections.map((s, i) => html`<section class="story-row ${i % 2 ? 'rev' : ''}">
        ${s.image ? html`<div class="story-media"><img src="${s.image}" alt="${s.title || p.title}" width="800" height="800" loading="lazy"></div>` : ''}
        <div class="story-text">${s.title ? html`<h2>${s.title}</h2>` : ''}${paragraphs(s.text || '')}</div>
      </section>`)}
    </div>` : ''}


    <div class="pdp-details">
      ${p.description && !(p.sections || []).length ? html`<section class="prose"><h2>Despre produs</h2>${paragraphs(p.description)}</section>` : ''}
      ${p.faq.length ? html`<section class="faq"><h2>Întrebări frecvente</h2>${p.faq.map((f) => html`<details><summary>${f.q}</summary><div>${paragraphs(f.a)}</div></details>`)}</section>` : ''}
      ${reviews.length ? html`<section id="recenzii" class="reviews">
        <h2>Ce spun clienții</h2>
        <div class="reviews-summary">${stars(avg, 20)} <strong>${avg.toFixed(1)} din 5</strong> <span>din ${reviews.length} ${reviews.length === 1 ? 'recenzie' : 'recenzii'}</span></div>
        <div class="review-list">${reviews.map((r) => html`<article class="review">
          <header>${stars(r.rating, 14)}<strong>${r.name}</strong>${r.city ? html`<span>${r.city}</span>` : ''}</header>
          ${paragraphs(r.text)}
        </article>`)}</div>
      </section>` : ''}
    </div>
  </div>

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
export function cartPage() {
  return html`<div class="wrap narrow cart-page">
    <h1>Coșul tău</h1>
    <div data-cart-view><p class="muted">Se încarcă…</p></div>
  </div>`;
}

// ---------------- Finalizare comandă ----------------
export function checkoutPage({ settings, bump, loggedIn = false }) {
  const cardOn = settings.card_enabled === '1';
  return html`<div class="wrap checkout">
    <h1>Finalizează comanda</h1>
    <div class="checkout-grid">
      <form class="checkout-form" data-checkout-form novalidate>
        ${!loggedIn && settings.accounts_enabled !== '0' ? html`<p class="checkout-login">Ai cont? <a href="/cont/autentificare?next=/finalizare">Intră în cont</a> și completăm datele automat. Poți comanda și fără cont.</p>` : ''}
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
              <label for="f-email">Email <span class="opt">(recomandat)</span></label>
              <input id="f-email" name="email" type="email" autocomplete="email" placeholder="primești confirmarea și AWB-ul">
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

        <p class="form-error" data-form-error hidden></p>
        <button type="submit" class="btn btn-primary btn-xl btn-block" data-submit>Finalizează comanda</button>
        <p class="legal-note">Plasând comanda ești de acord cu <a href="/pagina/termeni" target="_blank">termenii și condițiile</a> și confirmi că ai citit <a href="/pagina/confidentialitate" target="_blank">politica de confidențialitate</a>. Comanda implică obligația de plată. Ai dreptul la retur în ${settings.return_days || 14} zile (dreptul de retragere) – vezi <a href="/pagina/retur" target="_blank">condițiile de retur</a>.</p>
      </form>

      <aside class="summary" data-summary>
        <h2>Comanda ta</h2>
        <div data-summary-lines><p class="muted">Se încarcă…</p></div>
        <div data-summary-coupon></div>
        <dl class="totals" data-summary-totals></dl>
        ${trustMini()}
      </aside>
    </div>
  </div>`;
}

function trustMini() {
  return html`<ul class="trust-mini">
    <li>${icons.shield(18)} Datele tale sunt folosite doar pentru comandă</li>
    <li>${icons.back(18)} Retur simplu dacă nu îți place</li>
  </ul>`;
}

// ---------------- Mulțumim / status comandă ----------------
export function thankYouPage({ settings, order, items, payment }) {
  const isCard = order.payment_method === 'card';
  const paid = order.payment_status === 'platita';
  const fresh = Date.now() - Date.parse(order.created_at.replace(' ', 'T') + 'Z') < 1000 * 60 * 60 * 6;
  const purchase = {
    eventId: order.number, value: order.total / 100, currency: 'RON',
    contents: items.map((i) => ({ id: String(i.product_id), quantity: i.qty, price: i.unit_price / 100, name: i.title })),
    ttEvent: TIKTOK_PURCHASE_EVENT,
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
        <span class="thanks-icon">${icons.check(34)}</span>
        <h1>${fresh ? 'Mulțumim, comanda e plasată!' : `Comanda ${order.number}`}</h1>
        <p>Numărul comenzii: <strong>${order.number}</strong>.</p>
      </div>`}

    <section class="order-status card">
      <h2>Status</h2>
      <p class="status-line"><span class="status status-${order.status}">${ORDER_STATUSES[order.status]}</span>
      ${order.awb ? html` · AWB ${order.tracking_url ? html`<a href="${order.tracking_url}" target="_blank" rel="noopener">${order.awb}</a>` : order.awb}${order.courier ? ` (${order.courier})` : ''}` : ''}</p>
      <p class="muted">Păstrează această pagină: poți reveni oricând aici ca să vezi statusul comenzii.</p>
    </section>

    <section class="card">
      <h2>Produse</h2>
      <ul class="order-lines">${items.map((i) => html`<li><span>${i.qty} × ${i.title}</span><strong>${money(i.total)}</strong></li>`)}</ul>
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div>
        ${order.discount ? html`<div class="save"><dt>Reducere pachet</dt><dd>−${money(order.discount)}</dd></div>` : ''}
        ${order.coupon_discount ? html`<div class="save"><dt>Cod ${order.coupon_code}</dt><dd>−${money(order.coupon_discount)}</dd></div>` : ''}
        <div><dt>Transport</dt><dd>${order.shipping ? money(order.shipping) : 'Gratuit'}</dd></div>
        ${order.cod_fee ? html`<div><dt>Taxă ramburs</dt><dd>${money(order.cod_fee)}</dd></div>` : ''}
        <div class="grand"><dt>Total ${isCard && paid ? 'plătit' : 'de plată la livrare'}</dt><dd>${money(order.total)}</dd></div>
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
