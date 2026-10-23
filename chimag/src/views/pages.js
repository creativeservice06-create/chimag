import { html } from '../lib/html.js';
import { money } from '../lib/util.js';
import { icons } from './icons.js';

// Șabloane de pagini legale, completate automat cu datele firmei din Setări.
// Sunt un punct de plecare bun, dar merită verificate de un jurist înainte de lansare.

const company = (s) => html`<p><strong>${s.company_name || '[Numele firmei]'}</strong>, CUI ${s.company_cui || '[CUI]'}, ${s.company_reg || '[Nr. Reg. Com.]'}, cu sediul în ${s.company_address || '[adresa]'}, email ${s.email || '[email]'}, telefon ${s.phone || '[telefon]'}.</p>`;

export const PAGES = {
  livrare: {
    title: 'Livrare și plată',
    body: (s) => html`
      <h2>Livrare</h2>
      <p>Livrăm în toată România prin curier. ${s.delivery_text || ''}. Curierul te sună înainte de livrare.</p>
      <p>Costul transportului este ${money(s.shipping_cost)}${Number(s.free_shipping_threshold) ? html`, iar pentru comenzile de peste ${money(s.free_shipping_threshold)} transportul este gratuit` : ''}.</p>
      <p>După expediere primești numărul de AWB, cu care poți urmări coletul. Îl găsești și pe pagina comenzii.</p>
      <h2>Plata</h2>
      <p><strong>Ramburs:</strong> plătești curierului, la primirea coletului.${Number(s.cod_fee) ? ` Taxa de ramburs este ${money(s.cod_fee)}.` : ''}</p>
      ${s.card_enabled === '1' ? html`<p><strong>Card online:</strong> plata este procesată securizat de Stripe. Noi nu vedem și nu stocăm datele cardului.</p>` : ''}
      <p>Prețurile afișate includ TVA.</p>`,
  },
  retur: {
    title: 'Retur și garanție',
    body: (s) => html`
      <h2>Dreptul de retragere</h2>
      <p>Ai dreptul să returnezi produsele în termen de ${Math.max(14, Number(s.return_days) || 14)} zile de la primire, fără să precizezi motivul (OUG 34/2014).</p>
      <p>Ca să returnezi, scrie-ne la ${s.email || '[email]'} sau sună la ${s.phone || '[telefon]'} cu numărul comenzii. Îți spunem adresa de retur. Costul transportului de retur este suportat de tine, dacă nu am convenit altfel.</p>
      <p>Banii îți sunt rambursați în cel mult 14 zile de la data la care ne-ai anunțat retragerea, după ce primim produsele înapoi. Produsele trebuie să fie în starea în care le-ai primit, cu accesoriile incluse.</p>
      <h2>Garanție</h2>
      <p>Toate produsele beneficiază de garanția legală de conformitate (Legea 449/2003 și OUG 140/2021). Dacă un produs nu funcționează cum trebuie, contactează-ne și îl reparăm, îl înlocuim sau îți returnăm banii.</p>`,
  },
  contact: {
    title: 'Contact',
    body: (s) => html`
      <ul class="contact-list">
        ${s.phone ? html`<li>${icons.phone(20)} <a href="tel:${s.phone.replace(/\s/g, '')}">${s.phone}</a></li>` : ''}
        ${s.email ? html`<li>${icons.mail(20)} <a href="mailto:${s.email}">${s.email}</a></li>` : ''}
        ${s.hours ? html`<li>${icons.clock(20)} ${s.hours}</li>` : ''}
      </ul>
      <h2>Date firmă</h2>
      ${company(s)}`,
  },
  termeni: {
    title: 'Termeni și condiții',
    body: (s) => html`
      <h2>1. Cine suntem</h2>
      <p>Site-ul este operat de:</p>${company(s)}
      <h2>2. Comanda</h2>
      <p>Plasarea unei comenzi pe site reprezintă o ofertă de cumpărare. Contractul se încheie în momentul în care confirmăm comanda (telefonic, prin email sau prin expedierea produselor). Ne rezervăm dreptul de a refuza comenzi cu date incomplete sau evident false.</p>
      <h2>3. Prețuri</h2>
      <p>Prețurile sunt în lei și includ TVA. Prețul tăiat afișat lângă unele produse este cel mai mic preț practicat de noi în ultimele 30 de zile înainte de reducere.</p>
      <h2>4. Livrare, plată și retur</h2>
      <p>Detaliile sunt în paginile <a href="/pagina/livrare">Livrare și plată</a> și <a href="/pagina/retur">Retur și garanție</a>.</p>
      <h2>5. Litigii</h2>
      <p>Încercăm să rezolvăm amiabil orice nemulțumire. Poți apela și la ANPC (<a href="https://anpc.ro" target="_blank" rel="noopener">anpc.ro</a>), la procedura SAL (<a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener">anpc.ro/ce-este-sal</a>) sau la platforma europeană SOL (<a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">ec.europa.eu/consumers/odr</a>).</p>`,
  },
  confidentialitate: {
    title: 'Politica de confidențialitate',
    body: (s) => html`
      <p>Operatorul datelor tale este:</p>${company(s)}
      <h2>Ce date colectăm și de ce</h2>
      <p>Pentru a livra comanda folosim numele, telefonul, adresa și, dacă ni-l dai, emailul. Temeiul legal este executarea contractului (art. 6(1)(b) GDPR) și obligațiile legale contabile (art. 6(1)(c)).</p>
      <h2>Cui transmitem datele</h2>
      <p>Firmei de curierat și, după caz, partenerului logistic care pregătește coletul; procesatorului de plăți Stripe, pentru plățile cu cardul; furnizorului de găzduire (Cloudflare). Dacă accepți cookie-urile de marketing, Meta (Facebook) și TikTok primesc date despre vizită și comandă, parțial criptate (hash), pentru măsurarea reclamelor.</p>
      <h2>Cât timp le păstrăm</h2>
      <p>Datele comenzilor se păstrează cât cere legislația contabilă (în prezent 10 ani pentru documentele justificative).</p>
      <h2>Drepturile tale</h2>
      <p>Ai dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție. Scrie-ne la ${s.email || '[email]'}. Poți depune plângere la ANSPDCP (<a href="https://www.dataprotection.ro" target="_blank" rel="noopener">dataprotection.ro</a>).</p>`,
  },
  cookies: {
    title: 'Politica de cookie-uri',
    body: () => html`
      <h2>Cookie-uri necesare</h2>
      <p>Coșul de cumpărături și alegerea ta privind cookie-urile se salvează local în browser. Fără ele magazinul nu poate funcționa.</p>
      <h2>Cookie-uri de marketing (doar cu acordul tău)</h2>
      <p>Meta Pixel și TikTok Pixel ne ajută să știm dacă reclamele funcționează. Se încarcă doar dacă alegi „Accept toate".</p>
      <p><button type="button" class="btn btn-ghost" data-consent-reset>Schimbă alegerea privind cookie-urile</button></p>`,
  },
};

export function staticPage(slug, settings) {
  const p = PAGES[slug];
  if (!p) return null;
  return { title: p.title, body: html`<div class="wrap narrow prose page"><h1>${p.title}</h1>${p.body(settings)}</div>` };
}
