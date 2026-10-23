# chimag.ro – magazin online

Magazin rapid, optimizat pentru trafic din TikTok și Facebook Ads, cu panou de administrare și integrare de curierat.
Rulează integral pe Cloudflare (gratuit la început): **Workers** (site + API), **D1** (baza de date), **R2** (poze).
Nu are dependențe externe la rulare – doar JavaScript, deci se încarcă foarte repede pe mobil.

## Ce conține

**Magazin**
- Prima pagină cu produsul vedetă, banda de încredere, grila de produse, „Cum comanzi".
- Pagina de produs tip landing: galerie, preț vechi tăiat + economia în lei, beneficii, **oferte de pachet** (ex: 2 buc −10%), dată estimată de livrare, întrebări frecvente, recenzii, bară „Comandă acum" lipită jos pe mobil.
- „Comandă acum" duce direct la finalizare (fără coș) – cel mai scurt drum pentru clientul din reclamă. Există și coș clasic.
- Finalizare pe o singură pagină, fără cont: nume, telefon, județ, localitate, adresă. **Ramburs** + **card (Stripe)** opțional.
- Ofertă la finalizare („Adaugă și…" cu reducere) și transport gratuit peste un prag, cu bară de progres în coș.
- Pagina de status a comenzii pentru client (link unic), cu AWB și link de urmărire.
- Pagini legale completate automat cu datele firmei: termeni, GDPR, cookie-uri, livrare, retur, contact, linkuri ANPC SAL/SOL.
- SEO: titluri, Open Graph (preview frumos când dai share), date structurate Product, sitemap.xml, robots.txt.

**Reclame**
- Meta Pixel + TikTok Pixel cu evenimentele ViewContent, AddToCart, InitiateCheckout, Purchase (se încarcă doar după acordul pentru cookie-uri, cum cere GDPR).
- Opțional, **Conversions API** pe server (Facebook și TikTok) – recuperează conversiile pierdute pe iPhone / cu adblock. Deduplicare automată cu pixelul.
- Se salvează sursa fiecărei comenzi (utm_source, utm_campaign, fbclid, ttclid) → vezi în panou ce reclamă vinde.

**Administrare** (`/admin`)
- Panou: vânzări azi / 7 / 30 zile, coș mediu, **rată de livrare** (livrate vs refuzate – esențial la ramburs), grafic pe zile, surse de trafic, top produse.
- Comenzi: filtre pe status, căutare (număr, nume, telefon, AWB), acțiuni în masă (confirmă, generează AWB, livrată…), export CSV pentru Excel.
- Detaliu comandă: editare adresă, notițe interne, schimbare status, **Generează AWB**, anulare AWB, AWB manual, etichetă printabilă, istoric complet.
- Produse: adăugare/editare, încărcare poze, stoc, preț de achiziție, oferte de pachet, întrebări frecvente, recenzii.
- Setări: date firmă, transport, taxă ramburs, ofertă la finalizare, curier, plăți, pixeli.

**Curierat / logistică** – furnizor interschimbabil din Setări:
| Furnizor | Ce face |
|---|---|
| Test | AWB fictiv, ca să probezi tot fluxul înainte de contract |
| Manual | Generezi AWB-ul în altă platformă și îl scrii în comandă |
| SmartShip | Generează AWB prin API-ul lor (după ce primești documentația) |
| Helpship | Fulfillment: depozitul lor preia comenzile confirmate prin API și trimite înapoi AWB-ul |

Opțiunea „Generează AWB automat când confirm comanda" face totul dintr-un singur click. La fiecare 30 de minute magazinul verifică singur statusul coletelor și marchează Livrată / Refuzată.

---

## Lansare pas cu pas

Ai nevoie de: cont GitHub, cont Cloudflare (gratuit), domeniul chimag.ro.

### 1. Urcă proiectul pe GitHub
1. Pe github.com → **New repository** → nume `chimag` → **Private** → Create.
2. Pe calculatorul tău, în folderul proiectului:
   ```bash
   git remote add origin https://github.com/CONTUL-TAU/chimag.git
   git push -u origin main
   ```
   (sau trage fișierele direct în pagina repo-ului, cu „uploading an existing file")

### 2. Creează baza de date (D1)
1. Cloudflare → **Storage & Databases → D1 SQL Database → Create** → nume `chimag-db`.
2. Copiază **Database ID** și pune-l în `wrangler.toml` la `database_id`. Fă commit + push.
3. În pagina bazei de date → tab **Console**: lipește tot conținutul din `migrations/0001_init.sql` și apasă Execute. Apoi la fel cu `seed/seed.sql` (setări + 4 produse demo).
   Alternativ, din terminal: `npx wrangler login`, apoi `npm run db:migrate` și `npm run db:seed`.

### 3. Creează spațiul pentru poze (R2)
Cloudflare → **R2 Object Storage → Create bucket** → nume `chimag-media`.
(R2 cere un card pe cont, dar primii 10 GB sunt gratuiți. Dacă nu vrei R2 acum, șterge blocul `[[r2_buckets]]` din `wrangler.toml` și pune poze prin linkuri.)

### 4. Conectează GitHub la Cloudflare
1. Cloudflare → **Workers & Pages → Create → Import a repository** → alege `chimag`.
2. Build command: gol. Deploy command: `npx wrangler deploy`. Save and Deploy.
3. De acum, la fiecare `git push` site-ul se actualizează singur în ~30 de secunde.

### 5. Setează parolele și cheile (secrete)
Worker-ul `chimag` → **Settings → Variables and Secrets → Add** (tip **Secret**):
| Nume | Valoare |
|---|---|
| `ADMIN_PASSWORD` | parola ta pentru /admin (lungă!) |
| `SESSION_SECRET` | un șir aleator de minim 32 de caractere |
| `RESEND_API_KEY` | opțional, doar dacă nu folosești Email Routing |
| `ADMIN_PATH` | adresa secretă a panoului, ex. `intrare-k7m2p9` (vezi mai jos) |
| `WAREHOUSE_API_KEY` | cheie aleatoare, o dai depozitului (Helpship) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | doar pentru plata cu cardul |
| `SMARTSHIP_API_URL`, `SMARTSHIP_API_KEY` | când le primești de la SmartShip |
| `FB_CAPI_TOKEN`, `TIKTOK_EVENTS_TOKEN` | opțional, evenimente pe server |

Un șir aleator îl poți genera pe [1password.com/password-generator](https://1password.com/password-generator).

### 6. Leagă domeniul chimag.ro
1. Cloudflare → **Add a domain** → `chimag.ro` → plan Free. Cloudflare îți dă 2 nameservere.
2. La firma de la care ai cumpărat domeniul, înlocuiește nameserverele cu cele de la Cloudflare (durează câteva ore).
3. Worker-ul `chimag` → **Settings → Domains & Routes → Add → Custom domain**: adaugă `www.chimag.ro` și `chimag.ro`. Magazinul redirecționează automat `chimag.ro` → `www.chimag.ro`.

### 7. Configurează magazinul
Intră pe `www.chimag.ro/admin` → **Setări**: date firmă (CUI, Reg. Com., sediu – obligatorii legal), telefon, email, cost transport, pixeli. Apoi **Produse**: șterge produsele demo și adaugă-le pe ale tale.

---

## Plata cu cardul (Stripe)
1. Cont pe stripe.com (acceptă firme din România) → **Developers → API keys** → copiază Secret key → `STRIPE_SECRET_KEY`.
2. **Developers → Webhooks → Add endpoint**: `https://www.chimag.ro/webhooks/stripe`, eveniment `checkout.session.completed` → copiază Signing secret → `STRIPE_WEBHOOK_SECRET`.
3. În admin → Setări → bifează „Activează plata cu cardul".

## Pixeli și reclame
- Admin → Setări → Reclame: pune ID-ul pixelului Meta și TikTok.
- În reclame, pune la linkuri parametri UTM, ca să vezi în panou ce vinde:
  `https://www.chimag.ro/p/lampa-birou?utm_source=tiktok&utm_campaign=lampa-oct`
- Opțional, Conversions API: Meta Events Manager → Settings → **Generate access token** → `FB_CAPI_TOKEN`; TikTok Events Manager → pixel → Settings → **Generate access token** → `TIKTOK_EVENTS_TOKEN`.

## Conectarea cu un depozit (Helpship sau alt fulfillment)
Helpship nu are documentație API publică. Pe Shopify se leagă printr-o aplicație care **preia** comenzile din magazin. Magazinul tău oferă exact același tip de API, deci le trimiți acest paragraf:

> Avem un magazin propriu. Comenzile confirmate se pot prelua din API-ul nostru REST, autentificare `Authorization: Bearer <cheie>`:
> - `GET https://www.chimag.ro/api/fulfillment/orders?status=confirmata` – comenzile de pregătit (client, adresă, produse cu SKU, sumă ramburs)
> - `POST https://www.chimag.ro/api/fulfillment/orders/{numar}` cu `{"awb":"...","courier":"FAN Courier"}` – trimiteți AWB-ul (comanda trece automat în „Expediată")
> - `POST .../orders/{numar}` cu `{"status":"livrata"}` sau `"refuzata"` / `"retur"` – status livrare
> - `GET https://www.chimag.ro/api/fulfillment/products` și `POST /api/fulfillment/stock` cu `[{"sku":"...","stock":12}]` – sincronizare stoc
> Ne puteți spune dacă preferați să vă trimitem noi comenzile într-un API al vostru?

Dacă ei preferă să le trimiți tu comenzile (push), setezi `HELPSHIP_API_URL` + `HELPSHIP_API_KEY` și se ajustează funcția `toHelpship()` din `src/shipping/providers.js` după documentația lor. La fel pentru SmartShip: `toSmartShip()` în același fișier. Restul magazinului nu se schimbă.

Fluxul cu Helpship: comanda intră → o confirmi (telefonic, dacă vrei) → apare în API → Helpship o ambalează și trimite AWB-ul → statusul se actualizează singur.

---

## Emailuri (formular de contact și comenzi noi)
Mesajele din formularul de contact se salvează mereu în **Admin → Mesaje**. Ca să le primești și pe email (plus un email la fiecare comandă nouă), nu ai nevoie de parola Yahoo – folosim **Cloudflare Email Routing**, gratuit:

1. Domeniul `chimag.ro` trebuie să fie pe Cloudflare (pasul 6).
2. Cloudflare → `chimag.ro` → **Email → Email Routing → Get started**. Acceptă înregistrările DNS propuse.
3. La **Destination addresses** adaugă `chirilasadrian@yahoo.com` și apasă linkul de confirmare primit pe Yahoo.
4. În `wrangler.toml` scoate `# ` din fața celor 3 rânduri `[[send_email]]`, apoi commit.
5. Admin → Mesaje → **Trimite un email de test**. Dacă nu apare în Inbox, verifică Spam și marchează „Nu e spam".

Alternativă fără domeniu pe Cloudflare: cont gratuit pe resend.com, iar cheia API o pui ca secret `RESEND_API_KEY` (cu varianta gratuită, emailurile pleacă doar spre adresa cu care ți-ai făcut contul Resend).

## Panoul de admin ascuns
Dacă setezi secretul `ADMIN_PATH` (ex. `intrare-k7m2p9`), `/admin` arată ca o pagină inexistentă pentru oricine.
Pe fiecare dispozitiv de pe care lucrezi deschizi o dată `https://www.chimag.ro/intrare-k7m2p9`: primești o cheie în browser valabilă un an, apoi `/admin` merge normal.
Dacă schimbi `ADMIN_PATH`, toate cheile vechi devin invalide. Dacă ștergi `ADMIN_PATH`, `/admin` devine din nou vizibil (tot cu parolă).

## Roata norocului și coduri de reducere
Din **Admin → Roată și coduri**:
- pornești sau oprești roata (butonul 🎁 de lângă coș și fereastra care apare la intrare);
- alegi premiile (transport gratuit, reducere %, reducere în lei, 1+1 gratis), șansele, comanda minimă și cât timp e valabil codul;
- creezi coduri proprii (ex. `TIKTOK10`) pe care clientul le scrie la finalizarea comenzii.

Premiul se decide pe server (nu poate fi trucat din browser), fiecare cod din roată merge o singură dată, iar de pe același dispozitiv se poate învârti de maxim 3 ori pe zi. Pragul de transport gratuit se calculează înaintea reducerii, ca un premiu să nu scumpească niciodată comanda. Regulamentul cu șansele reale se generează automat la `/pagina/regulament-roata`.

**Instalare pe o bază de date existentă:** rulează o dată `setup/roata-console.sql` în Cloudflare → D1 → chimag-db → Console.

---

## Rulare locală (opțional, pentru modificări)
```bash
npm install
cp .dev.vars.example .dev.vars        # pune o parolă de test
npm run db:migrate:local && npm run db:seed:local
npm run dev                            # http://localhost:8787  și  /admin
```

## Structura proiectului
```
src/index.js              rutele magazinului, plasarea comenzii, webhook Stripe
src/admin.js              panoul de administrare
src/fulfillment-api.js    API-ul pentru depozit (Helpship etc.)
src/cron.js               verificarea automată a statusului coletelor
src/shipping/providers.js adaptoarele de curierat (Test, Manual, SmartShip, Helpship)
src/lib/                  baza de date, prețuri, comenzi, Stripe, pixeli pe server
src/views/                paginile (magazin, admin, pagini legale)
public/assets/            CSS și JavaScript pentru browser
migrations/               structura bazei de date
seed/                     setări inițiale + produse demo
```

## Înainte de lansare – listă de verificat
- [ ] Datele firmei completate în Setări (apar în subsol și în paginile legale).
- [ ] Paginile legale citite și, ideal, verificate de un jurist.
- [ ] Produsele demo șterse.
- [ ] Prețul tăiat = cel mai mic preț din ultimele 30 de zile (obligatoriu legal la reduceri).
- [ ] Recenzii: doar recenzii reale, de la clienți reali (cele inventate sunt interzise și se amendează de ANPC).
- [ ] O comandă de test plasată de pe telefon, de la cap la coadă.

## Pași următori recomandați
- **Facturare automată** (SmartBill sau Oblio) – factura emisă la generarea AWB-ului, pusă în colet.
- **Email/SMS de confirmare** către client (ex. prin Resend sau un furnizor de SMS).
- Confirmare telefonică a comenzilor ramburs înainte de expediere – scade mult rata de refuz.
