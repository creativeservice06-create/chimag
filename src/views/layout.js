import { html, raw, jsonScript } from '../lib/html.js';
import { waLink } from './pages.js';
import { icons } from './icons.js';
import { wheelConfig } from '../lib/coupons.js';

const ASSET_V = '49';

export function layout({ settings, title, description = '', canonical = '', ogImage = '', body, bodyClass = '', jsonLd = null, pageData = null, siteUrl = '', customer = null, categories = [], wheelState = null }) {
  const storeName = settings.store_name || 'Chimag';
  const fullTitle = title ? `${title} | ${storeName}` : `${storeName} – ${settings.tagline || ''}`;
  const config = {
    fbPixel: settings.fb_pixel_id || '',
    ttPixel: settings.tiktok_pixel_id || '',
    currency: 'RON',
    freeShippingThreshold: Number(settings.free_shipping_threshold) || 0,
    shippingCost: Number(settings.shipping_cost) || 0,
  };
  const wheel = wheelConfig(settings);
  const accountsOn = settings.accounts_enabled !== '0';
  if (!accountsOn) wheel.enabled = false; // roata funcționează doar cu conturi de client
  const wheelDot = wheelState && ['ready', 'guest'].includes(wheelState.state);
  if (wheel.enabled) {
    config.wheel = { autoOpen: wheel.autoOpen, delay: wheel.delay, title: wheel.title, hours: wheel.hours, minThird: wheel.minThird, segments: wheel.prizes.map((p) => p.label),
      state: wheelState || { state: accountsOn ? 'guest' : 'off' } };
  }
  return html`<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${fullTitle}</title>
<meta name="description" content="${description || settings.tagline}">
${canonical ? html`<link rel="canonical" href="${canonical}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${storeName}">
<meta property="og:title" content="${title || storeName}">
<meta property="og:description" content="${description || settings.tagline}">
${ogImage ? html`<meta property="og:image" content="${ogImage.startsWith('http') ? ogImage : siteUrl + ogImage}">` : ''}
<meta name="theme-color" content="#0E192A">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css?v=${ASSET_V}">
${jsonLd ? html`<script type="application/ld+json">${jsonScript(jsonLd)}</script>` : ''}
<script>window.CHIMAG=${jsonScript(config)};${pageData ? html`window.PAGE=${jsonScript(pageData)};` : ''}</script>
<script src="/assets/app.js?v=${ASSET_V}" defer></script>
</head>
<body class="${bodyClass}">
${settings.announcement ? html`<div class="announce">${settings.announcement}</div>` : ''}
<header class="site-header">
  <div class="wrap header-inner">
    <button type="button" class="icon-btn menu-btn" data-drawer-open aria-label="Deschide meniul" aria-controls="meniu-mobil">${icons.menu(24)}</button>
    <a href="/" class="logo" aria-label="${storeName} – pagina principală">${logoMark()}<span>${storeName.toLowerCase()}</span></a>
    <form class="header-search" action="/cautare" method="get" role="search">
      <input type="search" name="q" placeholder="Caută produse" aria-label="Caută produse" autocomplete="off">
      <button aria-label="Caută">${icons.search(20)}</button>
    </form>
    <div class="header-actions">
      <button type="button" class="icon-btn search-toggle" data-search-toggle aria-label="Caută">${icons.search(22)}</button>
      ${accountsOn ? html`<a href="/cont" class="icon-btn account-btn" aria-label="${customer ? 'Contul meu' : 'Intră în cont'}">${customer ? html`<span class="avatar-mini">${customer.name.charAt(0).toUpperCase()}</span>` : icons.user(22)}<span class="icon-label">${customer ? 'Contul meu' : 'Cont'}</span></a>` : ''}
      ${wheel.enabled ? html`<button type="button" class="wheel-btn" data-wheel-open aria-label="Roata norocului – câștigă o reducere"><span aria-hidden="true">🎁</span><span class="wheel-dot" data-wheel-dot ${wheelDot ? '' : raw('hidden')}></span></button>` : ''}
      <a href="/cos" class="cart-btn" aria-label="Coșul de cumpărături">${icons.cart(22)}<span class="cart-count" data-cart-count hidden>0</span></a>
    </div>
  </div>
  <form class="mobile-search" action="/cautare" method="get" role="search" data-mobile-search hidden>
    <div class="wrap"><input type="search" name="q" placeholder="Ce cauți?" aria-label="Caută produse" autocomplete="off"><button class="btn btn-primary btn-sm">Caută</button></div>
  </form>
  <nav class="sub-nav" aria-label="Meniu principal">
    <div class="wrap sub-nav-inner">
      <a href="/#produse">Toate produsele</a>
      ${categories.map((c) => html`<a href="/categorie/${c.slug}">${c.name}</a>`)}
      <a href="/comanda">Comanda mea</a>
      <a href="/pagina/contact">Contact</a>
    </div>
  </nav>
  <div class="promo-bar" data-promo-bar hidden></div>
</header>

<div class="drawer" id="meniu-mobil" data-drawer hidden>
  <div class="drawer-backdrop" data-drawer-close></div>
  <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="Meniu">
    <div class="drawer-head">
      <a href="/" class="logo">${logoMark()}<span>${storeName.toLowerCase()}</span></a>
      <button type="button" class="icon-btn" data-drawer-close aria-label="Închide meniul">${icons.close(24)}</button>
    </div>
    <form class="drawer-search" action="/cautare" method="get" role="search">
      <input type="search" name="q" placeholder="Caută produse" aria-label="Caută produse">
      <button aria-label="Caută">${icons.search(20)}</button>
    </form>
    <nav class="drawer-nav">
      <a href="/">${icons.home(22)} Acasă</a>
      <a href="/#produse">${icons.grid(22)} Toate produsele</a>
      ${categories.length ? html`<div class="drawer-cats">${categories.map((c) => html`<a href="/categorie/${c.slug}">${c.name}<small>${c.count}</small></a>`)}</div>` : ''}
      <a href="/comanda">${icons.box(22)} Unde e comanda mea?</a>
      <a href="/pagina/contact">${icons.mail(22)} Contact</a>
      ${wheel.enabled ? html`<button type="button" data-wheel-open data-drawer-close>🎁 Roata norocului</button>` : ''}
    </nav>
    ${accountsOn ? html`<div class="drawer-account">${customer
      ? html`<a class="btn btn-ghost btn-block" href="/cont">${icons.user(20)} Contul meu (${customer.name.split(' ')[0]})</a>`
      : html`<a class="btn btn-primary btn-block" href="/cont/autentificare">Intră în cont</a><a class="btn btn-ghost btn-block" href="/cont/inregistrare">Creează cont</a>`}</div>` : ''}
    <a class="drawer-phone" href="/pagina/contact">${icons.mail(20)}<span><strong>Ai o întrebare?</strong><small>Scrie-ne din pagina de contact</small></span></a>
  </aside>
</div>
<main id="continut">${body}</main>
${footer(settings)}
${waLink(settings.whatsapp) && !String(bodyClass).includes('no-wa') ? html`<a class="wa-float" href="${waLink(settings.whatsapp)}" target="_blank" rel="noopener" aria-label="Scrie-ne pe WhatsApp">${raw('<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3z"/></svg>')}</a>` : ''}
<div class="toast" role="status" aria-live="polite" data-toast></div>
${wheel.enabled ? html`<div class="wheel-modal" data-wheel-modal hidden role="dialog" aria-modal="true" aria-labelledby="wheel-title">
  <div class="wheel-backdrop" data-wheel-close></div>
  <div class="wheel-panel">
    <button type="button" class="wheel-x" data-wheel-close aria-label="Închide">${icons.close(22)}</button>
    <div class="wheel-stage">
      <div class="wheel-pointer" aria-hidden="true"></div>
      <div class="wheel-disc" data-wheel-disc></div>
      <button type="button" class="wheel-hub" data-wheel-spin aria-label="Învârte roata">Învârte</button>
    </div>
    <div class="wheel-copy" data-wheel-copy>
      <h2 id="wheel-title">${wheel.title}</h2>
      <p>Se încarcă…</p>
    </div>
    </div>
  </div>
</div>
<canvas class="confetti" data-confetti aria-hidden="true"></canvas>` : ''}
<div class="consent" data-consent hidden>
  <p>Folosim cookie-uri pentru ca magazinul să funcționeze și, cu acordul tău, pentru a măsura reclamele (Facebook, TikTok). <a href="/pagina/cookies">Detalii</a></p>
  <div class="consent-actions">
    <button type="button" class="btn btn-ghost btn-sm" data-consent-choice="no">Doar necesare</button>
    <button type="button" class="btn btn-primary btn-sm" data-consent-choice="yes">Accept toate</button>
  </div>
</div>
</body>
</html>`;
}

export function logoMark() {
  return html`<svg class="logo-mark" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#155ECC"/><path d="M21.5 11.2A7 7 0 1 0 21.5 20.8" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round"/></svg>`;
}

function footer(s) {
  const year = new Date().getFullYear();
  const socials = [
    ['facebook_url', 'Facebook', '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>'],
    ['instagram_url', 'Instagram', '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".8" fill="currentColor"/>'],
    ['tiktok_url', 'TikTok', '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.6 2.4 4.4 5 4.6"/>'],
  ].filter(([k]) => s[k]);
  return html`<footer class="site-footer">
  <div class="wrap footer-top">
    <div class="footer-brand">
      <a href="/" class="logo">${logoMark()}<span>${(s.store_name || 'chimag').toLowerCase()}</span></a>
      ${s.email || s.hours ? html`<ul class="footer-contact-list">
        ${s.email ? html`<li>${icons.mail(18)}<a href="mailto:${s.email}">${s.email}</a></li>` : ''}
        ${s.hours ? html`<li>${icons.clock(18)}<span>${s.hours}</span></li>` : ''}
      </ul>` : ''}
      ${socials.length ? html`<div class="socials">${socials.map(([k, name, d]) => html`<a href="${s[k]}" target="_blank" rel="noopener" aria-label="${name}">${raw(`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`)}</a>`)}</div>` : ''}
    </div>
    <nav class="footer-cols" aria-label="Linkuri utile">
      <div>
        <h3>Cumpărături</h3>
        <ul>
          <li><a href="/#produse">Toate produsele</a></li>
          <li><a href="/comanda">Urmărește comanda</a></li>
          ${s.accounts_enabled !== '0' ? html`<li><a href="/cont">Contul meu</a></li>` : ''}
          <li><a href="/#intrebari">Întrebări frecvente</a></li>
        </ul>
      </div>
      <div>
        <h3>Asistență clienți</h3>
        <ul>
          <li><a href="/pagina/contact">Contact</a></li>
          <li><a href="/pagina/livrare">Livrare și plată</a></li>
          <li><a href="/pagina/retur">Returnări și garanție</a></li>
          <li><a href="/pagina/formular-retragere">Formular de retragere</a></li>
        </ul>
      </div>
      <div>
        <h3>Informații legale</h3>
        <ul>
          <li><a href="/pagina/termeni">Termeni și condiții</a></li>
          <li><a href="/pagina/confidentialitate">Politica de confidențialitate</a></li>
          <li><a href="/pagina/cookies">Politica de cookie-uri</a></li>
          ${wheelConfig(s).enabled && s.accounts_enabled !== '0' ? html`<li><a href="/pagina/regulament-roata">Regulament campanie</a></li>` : ''}
          <li><a href="https://anpc.ro" target="_blank" rel="noopener">ANPC</a></li>
        </ul>
        <a class="anpc-badge" href="https://reclamatiisal.anpc.ro/" target="_blank" rel="noopener"><img src="/img/anpc-sal.png?v=3" alt="ANPC – Soluționarea alternativă a litigiilor (SAL)" width="250" height="61" loading="lazy"></a>
      </div>
    </nav>
  </div>
  <div class="wrap footer-bottom">
    <p>© ${year} ${s.company_name || s.store_name}${s.company_cui ? ` · CUI ${s.company_cui}` : ''}${s.company_reg ? ` · ${s.company_reg}` : ''}${s.company_address ? ` · ${s.company_address}` : ''}</p>
  </div>
</footer>`;
}
