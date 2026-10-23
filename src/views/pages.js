import { html } from '../lib/html.js';
import { money } from '../lib/util.js';
import { icons } from './icons.js';
import { wheelConfig, prizeOdds, describeCoupon } from '../lib/coupons.js';

// Pagini legale, completate automat cu datele firmei din Admin → Setări.
// Sunt un punct de plecare solid, dar merită citite de un jurist înainte de lansare.

const shop = (s) => s.store_name || 'Chimag';
const site = 'www.chimag.ro';

// Afișează doar datele firmei care sunt completate (fără paranteze goale pentru clienți)
function companyLine(s) {
  const parts = [];
  if (s.company_name) parts.push(html`<strong>${s.company_name}</strong>`);
  if (s.company_cui) parts.push(html`CUI ${s.company_cui}`);
  if (s.company_reg) parts.push(html`Nr. Reg. Com. ${s.company_reg}`);
  if (s.company_address) parts.push(html`sediul în ${s.company_address}`);
  if (s.phone) parts.push(html`telefon <a href="tel:${s.phone.replace(/\s/g, '')}">${s.phone}</a>`);
  if (s.email) parts.push(html`email <a href="mailto:${s.email}">${s.email}</a>`);
  return html`<p>${parts.map((p, i) => html`${i ? ', ' : ''}${p}`)}.</p>`;
}

const contactShort = (s) => [
  s.email ? html`email la <a href="mailto:${s.email}">${s.email}</a>` : '',
  s.phone ? html`telefon la <a href="tel:${s.phone.replace(/\s/g, '')}">${s.phone}</a>` : '',
].filter(Boolean).map((x, i, a) => html`${i ? (i === a.length - 1 ? ' sau ' : ', ') : ''}${x}`);

const returnDays = (s) => Math.max(14, Number(s.return_days) || 14);

export const PAGES = {
  livrare: {
    title: 'Livrare și plată',
    body: (s) => html`
      <h2>Unde livrăm</h2>
      <p>Livrăm prin curier la orice adresă din România.</p>
      <h2>În cât timp</h2>
      <p>${s.delivery_text || 'Livrarea durează de regulă 24–48 de ore lucrătoare'} de la confirmarea comenzii. Curierul te sună înainte de livrare. În perioadele aglomerate (sărbători, campanii) termenul poate crește cu 1–2 zile; te anunțăm dacă se întâmplă.</p>
      <h2>Cât costă</h2>
      <p>Transportul costă ${money(s.shipping_cost)} pe comandă${Number(s.free_shipping_threshold) ? html`. Pentru comenzile de peste ${money(s.free_shipping_threshold)}, transportul este <strong>gratuit</strong>` : ''}. Costul exact îl vezi în coș, înainte să plasezi comanda.</p>
      <h2>Urmărirea coletului</h2>
      <p>După expediere, comanda primește un număr de AWB. Îl găsești pe pagina comenzii, al cărei link îl primești la finalizare, împreună cu linkul de urmărire de la curier.</p>
      <h2>Metode de plată</h2>
      <p><strong>Ramburs (plata la livrare):</strong> plătești curierului, în momentul în care primești coletul.${Number(s.cod_fee) ? ` Taxa de ramburs este ${money(s.cod_fee)}.` : ' Nu percepem taxă de ramburs.'}</p>
      ${s.card_enabled === '1' ? html`<p><strong>Card online:</strong> Visa, Mastercard, Apple Pay sau Google Pay, prin procesatorul Stripe. Datele cardului sunt introduse direct la Stripe; noi nu le vedem și nu le stocăm.</p>` : ''}
      <p>Toate prețurile afișate sunt în lei și includ TVA, acolo unde se aplică. Factura fiscală se emite pe numele tău și o primești odată cu coletul sau pe email.</p>
      <h2>Colet deteriorat</h2>
      <p>Dacă la livrare observi că ambalajul este vizibil deteriorat, deschide coletul în fața curierului sau refuză-l și anunță-ne. Îți trimitem un produs nou fără niciun cost.</p>`,
  },

  retur: {
    title: 'Retur și garanție',
    body: (s) => html`
      <h2>Dreptul de retragere – ${returnDays(s)} zile</h2>
      <p>Conform OUG nr. 34/2014, ai dreptul să te retragi din contract în termen de <strong>${returnDays(s)} zile calendaristice</strong> de la data la care tu (sau o persoană desemnată de tine) ai intrat în posesia produselor, fără să precizezi motivul și fără penalități.</p>
      <h2>Cum returnezi</h2>
      <ol>
        <li>Ne anunți decizia de retragere înainte de expirarea termenului: ${contactShort(s)}. Poți folosi <a href="/pagina/formular-retragere">formularul de retragere</a>, dar nu este obligatoriu; ajunge orice declarație clară.</li>
        <li>Ne trimiți produsele în cel mult 14 zile de la data la care ne-ai anunțat. Îți comunicăm adresa de retur când ne contactezi.</li>
        <li>Costul transportului de retur este suportat de tine, cu excepția cazului în care produsul este neconform sau am greșit noi comanda.</li>
      </ol>
      <h2>Rambursarea banilor</h2>
      <p>Îți returnăm toate sumele plătite, inclusiv costul livrării standard, în cel mult 14 zile de la data la care ne-ai informat despre retragere. Putem amâna rambursarea până primim produsele înapoi sau până ne trimiți dovada expedierii lor, oricare dintre acestea intervine prima. Pentru plata ramburs, banii se returnează prin transfer bancar în contul pe care ni-l indici; pentru plata cu cardul, pe același card.</p>
      <h2>Starea produselor returnate</h2>
      <p>Poți verifica produsele așa cum ai face-o într-un magazin fizic. Răspunzi doar de diminuarea valorii lor rezultată din manipulări care depășesc ce este necesar pentru a le verifica natura, caracteristicile și funcționarea.</p>
      <h2>Excepții</h2>
      <p>Dreptul de retragere nu se aplică produselor sigilate care, din motive de igienă sau de protecție a sănătății, nu pot fi returnate după desigilare, precum și celorlalte excepții prevăzute de art. 16 din OUG 34/2014. Dacă un produs intră într-o astfel de categorie, scriem acest lucru clar pe pagina lui.</p>
      <h2>Garanția de conformitate</h2>
      <p>Toate produsele beneficiază de garanția legală de conformitate de 2 ani de la livrare (OUG nr. 140/2021). Dacă un produs nu funcționează cum trebuie, contactează-ne și, la alegerea ta, îl reparăm sau îl înlocuim gratuit; dacă acest lucru nu este posibil, îți returnăm banii sau reducem prețul.</p>`,
  },

  'formular-retragere': {
    title: 'Formular de retragere',
    body: (s) => html`
      <p>Completează și trimite acest formular doar dacă dorești să te retragi din contract (conform Anexei nr. 2 la OUG nr. 34/2014). Îl poți copia într-un email sau îl poți tipări.</p>
      <div class="legal-form">
        <p>Către ${s.company_name || shop(s)}${s.company_address ? `, ${s.company_address}` : ''}${s.email ? `, ${s.email}` : ''}:</p>
        <p>Vă informez prin prezenta cu privire la retragerea mea din contractul de vânzare a următoarelor produse:</p>
        <p>.................................................................................................</p>
        <p>Comandate la data de / primite la data de: ........................................</p>
        <p>Numărul comenzii: ........................................</p>
        <p>Numele consumatorului: ........................................</p>
        <p>Adresa consumatorului: ........................................</p>
        <p>Contul bancar (IBAN) pentru rambursare, în cazul plății ramburs: ........................................</p>
        <p>Semnătura (doar dacă formularul este trimis pe hârtie): ....................</p>
        <p>Data: ....................</p>
      </div>
      <p><button type="button" class="btn btn-ghost" onclick="window.print()">Tipărește formularul</button></p>`,
  },

  'regulament-roata': {
    title: 'Regulamentul „Roata norocului"',
    body: (s) => {
      const w = wheelConfig(s);
      const odds = prizeOdds(w.prizes);
      return html`
      <p>Campania promoțională „Roata norocului" este organizată de ${s.company_name || shop(s)}${s.company_cui ? `, CUI ${s.company_cui}` : ''}, pe site-ul ${site}.</p>
      ${w.enabled ? '' : html`<p><strong>Campania nu este activă în acest moment.</strong></p>`}
      <h2>1. Cine participă</h2>
      <p>Orice persoană fizică cu vârsta de cel puțin 18 ani care vizitează site-ul. Participarea este gratuită și nu este condiționată de o cumpărare.</p>
      <h2>2. Cum funcționează</h2>
      <p>Fiecare vizitator poate învârti roata o singură dată. Fiecare învârtire câștigă unul dintre premiile de mai jos, ales automat și aleatoriu pe serverul nostru, cu șansele indicate. Premiul este un cod de reducere personal, de unică folosință, care se aplică automat la comandă și este valabil ${w.hours} de ore de la câștigare.</p>
      <h2>3. Premii și șanse de câștig</h2>
      ${w.prizes.length ? html`<table class="odds"><thead><tr><th>Premiu</th><th>Condiții</th><th>Șansă</th></tr></thead><tbody>
        ${w.prizes.map((p, i) => html`<tr><td>${p.label}</td><td>${describeCoupon(p)}${p.min ? ` la comenzi de minim ${money(p.min)}` : ''}</td><td>${String(odds[i]).replace('.', ',')}%</td></tr>`)}
      </tbody></table>` : html`<p>Nu există premii configurate.</p>`}
      <h2>4. Condiții de utilizare</h2>
      <ul>
        <li>Codul se poate folosi la o singură comandă și nu se poate transforma în bani.</li>
        <li>Codul nu se cumulează cu alte coduri de reducere. Reducerea „1+1 gratis" nu se cumulează cu reducerea de pachet pentru același produs; se aplică cea mai avantajoasă.</li>
        <li>Dacă returnezi produsele, se rambursează suma efectiv plătită.</li>
        <li>Ne rezervăm dreptul de a anula codurile obținute prin metode automate sau abuzive (de exemplu, învârtiri repetate de pe aceleași dispozitive).</li>
      </ul>
      <h2>5. Durata și modificări</h2>
      <p>Campania se desfășoară până la oprirea ei de către organizator, anunțată prin dispariția roții de pe site. Codurile deja câștigate rămân valabile până la expirarea lor.</p>
      <h2>6. Date personale</h2>
      <p>Pentru campanie nu cerem date personale. Adresa IP este folosită doar pentru prevenirea abuzurilor, conform <a href="/pagina/confidentialitate">Politicii de confidențialitate</a>.</p>`;
    },
  },

  contact: {
    title: 'Contact',
    body: (s) => html`
      <ul class="contact-list">
        ${s.phone ? html`<li>${icons.phone(20)} <a href="tel:${s.phone.replace(/\s/g, '')}">${s.phone}</a></li>` : ''}
        ${s.email ? html`<li>${icons.mail(20)} <a href="mailto:${s.email}">${s.email}</a></li>` : ''}
        ${s.hours ? html`<li>${icons.clock(20)} ${s.hours}</li>` : ''}
      </ul>
      <p>Pentru o comandă deja plasată, ai la îndemână numărul comenzii (de forma CHI-1234); te ajutăm mai repede.</p>
      <h2>Date de identificare</h2>
      <p>Magazinul online ${site} este operat de:</p>
      ${companyLine(s)}
      <h2>Soluționarea reclamațiilor</h2>
      <p>Ne poți contacta oricând pentru orice nemulțumire și îți răspundem în cel mult 3 zile lucrătoare. Poți apela și la Autoritatea Națională pentru Protecția Consumatorilor (<a href="https://anpc.ro" target="_blank" rel="noopener">anpc.ro</a>).</p>`,
  },

  termeni: {
    title: 'Termeni și condiții',
    body: (s) => html`
      <h2>1. Cine suntem</h2>
      <p>Site-ul ${site} („Site-ul") este operat de:</p>${companyLine(s)}
      <p>Folosind Site-ul sau plasând o comandă, accepți acești termeni. Te rugăm să-i citești înainte să comanzi.</p>
      <h2>2. Produse și prețuri</h2>
      <p>Prezentăm produsele cât mai fidel, dar culorile din fotografii pot diferi ușor de realitate în funcție de ecran. Prețurile sunt în lei și includ TVA, acolo unde se aplică. Costul transportului este afișat separat, înainte de plasarea comenzii.</p>
      <p>Prețul tăiat afișat lângă un produs aflat la reducere reprezintă cel mai mic preț practicat de noi pentru acel produs în ultimele 30 de zile înainte de aplicarea reducerii (conform Legii nr. 363/2007, modificată prin OG nr. 26/2022).</p>
      <h2>3. Comanda și încheierea contractului</h2>
      <p>Plasarea comenzii reprezintă o ofertă de cumpărare din partea ta și implică obligația de plată. Contractul se încheie în momentul în care confirmăm comanda, telefonic sau în scris, ori când expediem produsele. Putem refuza sau anula o comandă dacă datele de livrare sunt incomplete sau vădit greșite, dacă produsul nu mai este disponibil sau dacă prețul afișat conține o eroare evidentă; în aceste cazuri te anunțăm și îți returnăm orice sumă plătită.</p>
      <h2>4. Plata</h2>
      <p>Poți plăti ramburs, la livrare${s.card_enabled === '1' ? ', sau online cu cardul, prin Stripe' : ''}. Detalii în pagina <a href="/pagina/livrare">Livrare și plată</a>.</p>
      <h2>5. Livrarea</h2>
      <p>Livrăm prin curier în toată România. Riscul de pierdere sau deteriorare a produselor trece asupra ta în momentul în care tu sau o persoană desemnată de tine intrați în posesia lor. Refuzul nejustificat al unui colet comandat ne generează costuri de transport dus-întors; ne rezervăm dreptul de a nu mai accepta comenzi ramburs de la persoanele care refuză repetat colete.</p>
      <h2>6. Dreptul de retragere și garanția</h2>
      <p>Ai ${returnDays(s)} zile să te retragi din contract, fără să precizezi motivul, iar produsele beneficiază de garanția legală de conformitate. Detalii complete în pagina <a href="/pagina/retur">Retur și garanție</a> și <a href="/pagina/formular-retragere">formularul de retragere</a>.</p>
      <h2>7. Răspundere</h2>
      <p>Nu răspundem pentru întârzieri sau imposibilitatea de a livra cauzate de situații de forță majoră. Folosește produsele conform instrucțiunilor din descriere și de pe ambalaj.</p>
      <h2>8. Proprietate intelectuală</h2>
      <p>Textele, fotografiile, logo-ul și designul Site-ului ne aparțin sau sunt folosite cu acordul titularilor și nu pot fi copiate fără acordul nostru scris.</p>
      <h2>9. Date personale</h2>
      <p>Prelucrăm datele tale conform <a href="/pagina/confidentialitate">Politicii de confidențialitate</a> și <a href="/pagina/cookies">Politicii de cookie-uri</a>.</p>
      <h2>10. Litigii</h2>
      <p>Încercăm să rezolvăm amiabil orice neînțelegere: scrie-ne și îți răspundem în cel mult 3 zile lucrătoare. Dacă nu ajungem la o soluție, te poți adresa Autorității Naționale pentru Protecția Consumatorilor (<a href="https://anpc.ro" target="_blank" rel="noopener">anpc.ro</a>), poți folosi procedura de soluționare alternativă a litigiilor (<a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener">SAL</a>) sau platforma europeană de soluționare online a litigiilor (<a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">SOL</a>). Legea aplicabilă este legea română.</p>
      <h2>11. Modificări</h2>
      <p>Putem actualiza acești termeni. Pentru fiecare comandă se aplică versiunea în vigoare la data plasării ei.</p>`,
  },

  confidentialitate: {
    title: 'Politica de confidențialitate',
    body: (s) => html`
      <p>Ne pasă de datele tale. Mai jos explicăm, pe scurt și clar, ce date colectăm, de ce, cât le păstrăm și ce drepturi ai, conform Regulamentului (UE) 2016/679 (GDPR).</p>
      <h2>1. Operatorul datelor</h2>${companyLine(s)}
      <h2>2. Ce date colectăm</h2>
      <ul>
        <li><strong>La plasarea comenzii:</strong> nume, telefon, adresă de livrare, județ, localitate și, opțional, email și cod poștal.</li>
        <li><strong>Date tehnice:</strong> adresa IP și tipul de browser, folosite pentru securitate și prevenirea fraudei.</li>
        <li><strong>Sursa vizitei:</strong> parametri din linkul prin care ai ajuns pe Site (de exemplu, campania de reclamă).</li>
      </ul>
      <p>Datele cardului, dacă plătești online, sunt introduse direct la procesatorul Stripe; noi nu le primim și nu le stocăm.</p>
      <h2>3. De ce le folosim și pe ce temei</h2>
      <ul>
        <li>Procesarea și livrarea comenzii, comunicarea despre comandă, returnări și garanție – executarea contractului (art. 6 alin. 1 lit. b GDPR).</li>
        <li>Emiterea facturii și păstrarea evidențelor contabile – obligație legală (art. 6 alin. 1 lit. c).</li>
        <li>Prevenirea fraudei și securitatea Site-ului – interes legitim (art. 6 alin. 1 lit. f).</li>
        <li>Măsurarea eficienței reclamelor (Meta, TikTok) – doar cu acordul tău, dat prin bannerul de cookie-uri (art. 6 alin. 1 lit. a). Îți poți retrage acordul oricând.</li>
      </ul>
      <h2>4. Cui transmitem datele</h2>
      <ul>
        <li>Firmelor de curierat și, după caz, partenerului logistic care depozitează și ambalează produsele – pentru livrare.</li>
        <li>Stripe – pentru plățile cu cardul.</li>
        <li>Cloudflare – furnizorul de găzduire al Site-ului.</li>
        <li>Meta Platforms și TikTok – doar dacă ai acceptat cookie-urile de marketing; datele de contact transmise acestora sunt criptate ireversibil (hash).</li>
        <li>Autorităților, atunci când legea ne obligă.</li>
      </ul>
      <p>Unii dintre acești furnizori pot prelucra date în afara Spațiului Economic European; în aceste cazuri transferul se face pe baza clauzelor contractuale standard aprobate de Comisia Europeană sau a altor garanții prevăzute de GDPR.</p>
      <h2>5. Cât timp le păstrăm</h2>
      <p>Datele comenzilor și facturile se păstrează pe durata impusă de legislația financiar-contabilă (Legea contabilității nr. 82/1991). Datele tehnice se păstrează cel mult 12 luni.</p>
      <h2>6. Drepturile tale</h2>
      <p>Ai dreptul de acces, de rectificare, de ștergere, de restricționare a prelucrării, de portabilitate, de opoziție și dreptul de a nu face obiectul unei decizii bazate exclusiv pe prelucrare automată. Pentru a le exercita, contactează-ne: ${contactShort(s)}. Îți răspundem în cel mult o lună.</p>
      <p>Ai, de asemenea, dreptul să depui o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (<a href="https://www.dataprotection.ro" target="_blank" rel="noopener">dataprotection.ro</a>).</p>
      <h2>7. Securitate</h2>
      <p>Site-ul folosește conexiune criptată (HTTPS), iar accesul la datele comenzilor este restricționat și protejat prin parolă.</p>`,
  },

  cookies: {
    title: 'Politica de cookie-uri',
    body: () => html`
      <p>Cookie-urile și tehnologiile similare sunt fișiere mici salvate în browserul tău. Le folosim astfel:</p>
      <h2>Strict necesare (fără acord)</h2>
      <ul>
        <li><strong>Coșul de cumpărături și datele de livrare completate</strong> – salvate local în browser, ca să nu le pierzi dacă revii pe Site.</li>
        <li><strong>Alegerea ta privind cookie-urile</strong> – ca să nu te întrebăm la fiecare vizită.</li>
        <li><strong>Sursa vizitei</strong> (de exemplu, campania prin care ai ajuns) – păstrată 30 de zile, ca să știm ce reclame funcționează.</li>
      </ul>
      <h2>Marketing (doar cu acordul tău)</h2>
      <ul>
        <li><strong>Meta Pixel</strong> (Meta Platforms Ireland Ltd.) – măsoară ce reclame Facebook și Instagram aduc vizite și comenzi.</li>
        <li><strong>TikTok Pixel</strong> (TikTok Technology Ltd.) – același lucru, pentru reclamele TikTok.</li>
      </ul>
      <p>Acestea se încarcă doar după ce alegi „Accept toate". Dacă alegi „Doar necesare", nu se încarcă deloc.</p>
      <h2>Cum îți schimbi alegerea</h2>
      <p>Poți schimba oricând alegerea cu butonul de mai jos sau ștergând datele site-ului din setările browserului.</p>
      <p><button type="button" class="btn btn-ghost" data-consent-reset>Schimbă alegerea privind cookie-urile</button></p>`,
  },
};

export function staticPage(slug, settings) {
  const p = PAGES[slug];
  if (!p) return null;
  return { title: p.title, body: html`<div class="wrap narrow prose page"><h1>${p.title}</h1>${p.body(settings)}</div>` };
}
