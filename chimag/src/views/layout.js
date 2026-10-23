import { html, jsonScript } from '../lib/html.js';
import { icons } from './icons.js';

const ASSET_V = '1';

export function layout({ settings, title, description = '', canonical = '', ogImage = '', body, bodyClass = '', jsonLd = null, pageData = null, siteUrl = '' }) {
  const storeName = settings.store_name || 'Chimag';
  const fullTitle = title ? `${title} | ${storeName}` : `${storeName} – ${settings.tagline || ''}`;
  const config = {
    fbPixel: settings.fb_pixel_id || '',
    ttPixel: settings.tiktok_pixel_id || '',
    currency: 'RON',
    freeShippingThreshold: Number(settings.free_shipping_threshold) || 0,
    shippingCost: Number(settings.shipping_cost) || 0,
  };
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
<meta name="theme-color" content="#0E4F4A">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css?v=${ASSET_V}">
${jsonLd ? html`<script type="application/ld+json">${jsonScript(jsonLd)}</script>` : ''}
<script>window.CHIMAG=${jsonScript(config)};${pageData ? html`window.PAGE=${jsonScript(pageData)};` : ''}</script>
<script src="/assets/app.js?v=${ASSET_V}" defer></script>
</head>
<body class="${bodyClass}">
${settings.announcement ? html`<div class="announce">${settings.announcement}</div>` : ''}
<header class="site-header">
  <div class="wrap header-inner">
    <a href="/" class="logo" aria-label="${storeName} – pagina principală">${logoMark()}<span>${storeName.toLowerCase()}</span></a>
    <nav class="main-nav" aria-label="Meniu">
      <a href="/#produse">Produse</a>
      <a href="/pagina/livrare">Livrare</a>
      <a href="/pagina/contact">Contact</a>
    </nav>
    <a href="/cos" class="cart-btn" aria-label="Coșul de cumpărături">${icons.cart(22)}<span class="cart-count" data-cart-count hidden>0</span></a>
  </div>
</header>
<main id="continut">${body}</main>
${footer(settings)}
<div class="toast" role="status" aria-live="polite" data-toast></div>
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
  return html`<svg class="logo-mark" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#0E4F4A"/><path d="M21.5 11.2A7 7 0 1 0 21.5 20.8" fill="none" stroke="#F2B33D" stroke-width="3.4" stroke-linecap="round"/></svg>`;
}

function footer(s) {
  const year = new Date().getFullYear();
  return html`<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a href="/" class="logo">${logoMark()}<span>${(s.store_name || 'chimag').toLowerCase()}</span></a>
      <p>${s.tagline}</p>
      ${s.phone ? html`<p class="footer-contact">${icons.phone(18)} <a href="tel:${s.phone.replace(/\s/g, '')}">${s.phone}</a></p>` : ''}
      ${s.email ? html`<p class="footer-contact">${icons.mail(18)} <a href="mailto:${s.email}">${s.email}</a></p>` : ''}
      ${s.hours ? html`<p class="footer-contact">${icons.clock(18)} ${s.hours}</p>` : ''}
    </div>
    <div>
      <h3>Comenzi</h3>
      <ul>
        <li><a href="/pagina/livrare">Livrare și plată</a></li>
        <li><a href="/pagina/retur">Retur și garanție</a></li>
        <li><a href="/pagina/contact">Contact</a></li>
      </ul>
    </div>
    <div>
      <h3>Informații legale</h3>
      <ul>
        <li><a href="/pagina/termeni">Termeni și condiții</a></li>
        <li><a href="/pagina/confidentialitate">Confidențialitate (GDPR)</a></li>
        <li><a href="/pagina/cookies">Politica de cookie-uri</a></li>
        <li><a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener">ANPC – SAL</a></li>
        <li><a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">Soluționarea online a litigiilor</a></li>
      </ul>
    </div>
  </div>
  <div class="wrap footer-legal">
    <p>© ${year} ${s.company_name || s.store_name}${s.company_cui ? ` · CUI ${s.company_cui}` : ''}${s.company_reg ? ` · ${s.company_reg}` : ''}</p>
    ${s.card_enabled === '1'
      ? html`<p class="pay-methods">Plata la livrare sau cu cardul <span class="pill">Visa</span><span class="pill">Mastercard</span><span class="pill">Apple Pay</span></p>`
      : html`<p class="pay-methods">Plata ramburs, la livrare</p>`}
  </div>
</footer>`;
}
