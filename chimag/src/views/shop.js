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
export function homePage({ settings, products }) {
  const hero = products.find((p) => p.featured) || products[0];
  const rest = products;
  const threshold = Number(settings.free_shipping_threshold) || 0;
  return html`
  ${hero ? html`<section class="hero">
    <div class="wrap hero-inner">
      <div class="hero-copy">
        <h1>${settings.tagline || 'Lucruri bune pentru acasă'}</h1>
        <p class="hero-lead">Produse alese cu grijă, la prețuri corecte. Comanzi în două minute, fără cont, și plătești abia când primești coletul.</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="#produse">Vezi produsele</a>
          ${threshold ? html`<span class="hero-note">${icons.truck(18)} Transport gratuit peste ${money(threshold)}</span>` : ''}
        </div>
      </div>
      <a class="hero-product" href="/p/${hero.slug}">
        <img src="${img(hero)}" alt="${hero.title}" width="720" height="720" fetchpriority="high">
        <span class="price-sticker">
          <small>${hero.title}</small>
          <strong>${money(hero.price)}</strong>
          ${pctOff(hero) ? html`<em>economisești ${money(hero.compare_at_price - hero.price)}</em>` : ''}
        </span>
      </a>
    </div>
  </section>` : ''}

  <section class="wrap">${trustRow(settings)}</section>

  <section class="wrap section" id="produse">
    <div class="section-head">
      <h2>Produsele noastre</h2>
      <p>${settings.delivery_text || 'Livrare rapidă prin curier'}. Plătești când primești coletul.</p>
    </div>
    ${rest.length
      ? html`<div class="pgrid">${rest.map(productCard)}</div>`
      : html`<p class="empty">Adaugă primul produs din panoul de administrare.</p>`}
  </section>

  <section class="section steps-section">
    <div class="wrap">
      <div class="section-head"><h2>Cum comanzi</h2></div>
      <ol class="steps">
        <li><span class="step-n">1</span><h3>Alegi produsul</h3><p>Vezi detaliile, pozele și ofertele de pachet.</p></li>
        <li><span class="step-n">2</span><h3>Completezi adresa</h3><p>Nume, telefon și adresă. Fără cont, fără parole.</p></li>
        <li><span class="step-n">3</span><h3>Plătești la livrare</h3><p>Curierul îți aduce coletul în 24–48h, iar tu plătești atunci.</p></li>
      </ol>
    </div>
  </section>`;
}

// ---------------- Pagina de produs ----------------
export function productPage({ settings, product: p, reviews, siteUrl }) {
  const off = pctOff(p);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const bundles = (p.bundles || []).filter((b) => Number(b.qty) >= 1).sort((a, b) => a.qty - b.qty);
  const lowStock = p.track_stock && p.stock > 0 && p.stock <= 10;
  const outOfStock = p.track_stock && p.stock <= 0;

  return html`
  <div class="wrap pdp">
    <nav class="crumbs" aria-label="Navigare"><a href="/">Acasă</a><span>/</span><a href="/#produse">Produse</a><span>/</span><span>${p.title}</span></nav>
    <div class="pdp-grid">
      <div class="gallery" data-gallery>
        <div class="gallery-main">
          <img src="${img(p)}" alt="${p.title}" width="900" height="900" data-gallery-main fetchpriority="high">
          ${off ? html`<span class="tag-save tag-lg">−${off}%</span>` : ''}
        </div>
        ${p.images.length > 1 ? html`<div class="gallery-thumbs">${p.images.map((src, i) => html`
          <button type="button" class="${i === 0 ? 'active' : ''}" data-gallery-thumb="${src}" aria-label="Poza ${i + 1}">
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
          <li>${icons.truck(20)}<span><strong data-delivery-date>Livrare în 24–48h</strong><br><small>${settings.delivery_text}</small></span></li>
          <li>${icons.cash(20)}<span><strong>Plata la livrare</strong><br><small>Deschizi coletul, plătești curierului</small></span></li>
          <li>${icons.back(20)}<span><strong>Retur ${settings.return_days || 14} zile</strong><br><small>Fără să ne spui motivul</small></span></li>
        </ul>
      </div>
    </div>

    <div class="pdp-details">
      ${p.description ? html`<section class="prose"><h2>Despre produs</h2>${paragraphs(p.description)}</section>` : ''}
      ${p.benefits.length > 4 ? html`<section><h2>Pe scurt</h2><ul class="benefits">${p.benefits.map((b) => html`<li>${icons.check(18)}<span>${b}</span></li>`)}</ul></section>` : ''}
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
export function checkoutPage({ settings, bump }) {
  const cardOn = settings.card_enabled === '1';
  return html`<div class="wrap checkout">
    <h1>Finalizează comanda</h1>
    <div class="checkout-grid">
      <form class="checkout-form" data-checkout-form novalidate>
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
              <label for="f-email">Email <span class="opt">(opțional)</span></label>
              <input id="f-email" name="email" type="email" autocomplete="email" placeholder="pentru confirmarea comenzii">
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
        <button type="submit" class="btn btn-primary btn-xl btn-block" data-submit>Plasează comanda</button>
        <p class="legal-note">Plasând comanda ești de acord cu <a href="/pagina/termeni" target="_blank">termenii și condițiile</a> și confirmi că ai citit <a href="/pagina/confidentialitate" target="_blank">politica de confidențialitate</a>. Comanda implică obligația de plată.</p>
      </form>

      <aside class="summary" data-summary>
        <h2>Comanda ta</h2>
        <div data-summary-lines><p class="muted">Se încarcă…</p></div>
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
        <p>Numărul comenzii: <strong>${order.number}</strong>. ${fresh ? 'Te sunăm în scurt timp pentru confirmare.' : ''}</p>
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
        ${order.discount ? html`<div class="save"><dt>Reducere</dt><dd>−${money(order.discount)}</dd></div>` : ''}
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
    ${settings.phone ? html`<p class="center muted">Ai o întrebare? Sună-ne la <a href="tel:${settings.phone.replace(/\s/g, '')}">${settings.phone}</a>.</p>` : ''}
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
