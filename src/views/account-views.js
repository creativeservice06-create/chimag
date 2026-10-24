import { html } from '../lib/html.js';
import { money, formatDate } from '../lib/util.js';
import { ORDER_STATUSES } from '../lib/db.js';
import { JUDETE } from '../lib/judete.js';
import { icons } from './icons.js';

const alert = (type, msg) => (msg ? html`<p class="alert alert-${type}">${msg}</p>` : '');

function authShell(title, lead, inner, side = true) {
  return html`<div class="wrap auth-page">
    <div class="auth-card">
      <h1>${title}</h1>
      ${lead ? html`<p class="page-lead">${lead}</p>` : ''}
      ${inner}
    </div>
    ${side ? html`<aside class="auth-perks">
      <h2>De ce să-ți faci cont</h2>
      <ul>
        <li>${icons.box(22)}<span><strong>Toate comenzile într-un loc</strong>Vezi statusul și AWB-ul oricând.</span></li>
        <li>${icons.truck(22)}<span><strong>Comanzi mai repede</strong>Adresa de livrare e completată automat.</span></li>
        <li>${icons.mail(22)}<span><strong>Ești la curent</strong>Primești pe email confirmarea și fiecare schimbare de status.</span></li>
      </ul>
      <p class="muted">Poți comanda și fără cont. Contul e doar mai comod.</p>
    </aside>` : ''}
  </div>`;
}

export function registerView({ error = '', values = {}, next = '' } = {}) {
  return authShell('Creează-ți cont', 'Durează un minut.', html`
    <form method="post" action="/cont/inregistrare" class="auth-form" novalidate>
      ${alert('err', error)}
      ${next ? html`<input type="hidden" name="next" value="${next}">` : ''}
      ${next.includes('roata') ? html`<p class="alert alert-ok">🎁 După ce îți faci contul, te întorci pe pagina unde erai și poți învârti roata.</p>` : ''}
      <div class="field"><label for="r-name">Nume și prenume</label><input id="r-name" name="name" autocomplete="name" required value="${values.name || ''}"></div>
      <div class="field"><label for="r-email">Email</label><input id="r-email" name="email" type="email" autocomplete="email" required value="${values.email || ''}"></div>
      <div class="field"><label for="r-phone">Telefon <span class="opt">(opțional)</span></label><input id="r-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" value="${values.phone || ''}"></div>
      <div class="field"><label for="r-pass">Parolă</label><input id="r-pass" name="password" type="password" autocomplete="new-password" required minlength="8"><small>Cel puțin 8 caractere.</small></div>
      <label class="check-row"><input type="checkbox" name="terms" value="1" required> <span>Am citit și sunt de acord cu <a href="/pagina/termeni" target="_blank">termenii</a> și <a href="/pagina/confidentialitate" target="_blank">politica de confidențialitate</a>.</span></label>
      <button class="btn btn-primary btn-lg btn-block">Creează contul</button>
      <p class="auth-switch">Ai deja cont? <a href="/cont/autentificare${next ? `?next=${encodeURIComponent(next)}` : ''}">Intră în cont</a></p>
    </form>`);
}

export function loginView({ error = '', notice = '', values = {}, next = '' } = {}) {
  return authShell('Intră în cont', '', html`
    <form method="post" action="/cont/autentificare" class="auth-form" novalidate>
      ${alert('ok', notice)}${alert('err', error)}
      <input type="hidden" name="next" value="${next}">
      <div class="field"><label for="l-email">Email</label><input id="l-email" name="email" type="email" autocomplete="email" required value="${values.email || ''}"></div>
      <div class="field"><label for="l-pass">Parolă</label><input id="l-pass" name="password" type="password" autocomplete="current-password" required></div>
      <p class="auth-forgot"><a href="/cont/parola-uitata">Ai uitat parola?</a></p>
      <button class="btn btn-primary btn-lg btn-block">Intră în cont</button>
      <p class="auth-switch">Nu ai cont? <a href="/cont/inregistrare${next && next !== '/cont' ? `?next=${encodeURIComponent(next)}` : ''}">Creează unul acum</a></p>
    </form>`);
}

export function forgotView({ sent = false, error = '' } = {}) {
  return authShell('Ai uitat parola?', sent ? '' : 'Scrie emailul contului și îți trimitem un link pentru o parolă nouă.', sent
    ? html`<p class="alert alert-ok">Dacă există un cont cu acest email, ți-am trimis un link de resetare. Verifică și folderul Spam. Linkul e valabil o oră.</p><p><a href="/cont/autentificare">Înapoi la autentificare</a></p>`
    : html`<form method="post" action="/cont/parola-uitata" class="auth-form" novalidate>
      ${alert('err', error)}
      <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>
      <button class="btn btn-primary btn-lg btn-block">Trimite linkul</button>
      <p class="auth-switch"><a href="/cont/autentificare">Înapoi la autentificare</a></p>
    </form>`, false);
}

export function resetView({ token, error = '', invalid = false } = {}) {
  return authShell('Alege o parolă nouă', '', invalid
    ? html`<p class="alert alert-err">Linkul a expirat sau a fost deja folosit.</p><p><a class="btn btn-primary" href="/cont/parola-uitata">Cere un link nou</a></p>`
    : html`<form method="post" action="/cont/resetare/${token}" class="auth-form" novalidate>
      ${alert('err', error)}
      <div class="field"><label for="p1">Parolă nouă</label><input id="p1" name="password" type="password" autocomplete="new-password" required minlength="8"><small>Cel puțin 8 caractere.</small></div>
      <div class="field"><label for="p2">Repetă parola</label><input id="p2" name="password2" type="password" autocomplete="new-password" required></div>
      <button class="btn btn-primary btn-lg btn-block">Salvează parola</button>
    </form>`, false);
}

const statusChip = (s) => html`<span class="status status-${s}">${ORDER_STATUSES[s] || s}</span>`;

const WHEEL_NOTE = {
  ready: (w) => html`<div class="alert alert-ok wheel-alert">🎁 <span><strong>Ai o învârtire disponibilă la roata norocului</strong> (învârtirea ${w.stage} din ${w.total}).</span> <button type="button" class="btn btn-primary btn-sm" data-wheel-open>Învârte roata</button></div>`,
  voucher: (w) => html`<div class="alert alert-ok wheel-alert">🎁 <span>Premiul tău de la roată: <strong>${w.label}</strong>, cod <strong>${w.code}</strong>. Se aplică automat la comandă.</span></div>`,
};

export function accountView({ c, orders, notice = '', error = '', emailOk, wheel = null }) {
  const first = c.name.split(' ')[0];
  return html`<div class="wrap account">
    <header class="account-head">
      <div class="account-avatar" aria-hidden="true">${first.charAt(0).toUpperCase()}</div>
      <div><h1>Salut, ${first}!</h1><p class="muted">${c.email}${c.email_verified ? '' : html` · <span class="warn-txt">email neconfirmat</span>`}</p></div>
      <form method="post" action="/cont/iesire" class="account-logout"><button class="btn btn-ghost">Ieși din cont</button></form>
    </header>
    ${alert('ok', notice)}${alert('err', error)}
    ${wheel && WHEEL_NOTE[wheel.state] ? WHEEL_NOTE[wheel.state](wheel) : ''}
    ${c.email_verified ? '' : html`<div class="alert alert-warn">Confirmă adresa de email ca să vezi aici și comenzile plasate fără cont cu ${c.email}.
      ${emailOk ? html`<form method="post" action="/cont/retrimite-confirmare" class="inline"><button class="link-btn">Retrimite emailul de confirmare</button></form>` : ''}</div>`}

    <div class="account-grid">
      <section class="account-orders">
        <h2>Comenzile mele</h2>
        ${orders.length ? html`<ul class="order-cards">${orders.map((o) => html`<li>
          <a class="order-card" href="/multumim/${o.token}">
            <span class="order-card-top"><strong>${o.number}</strong>${statusChip(o.status)}</span>
            <span class="order-card-meta">${formatDate(o.created_at)} · ${o.payment_method === 'card' ? 'card' : 'ramburs'}</span>
            <span class="order-card-bottom"><span>${o.awb ? html`AWB ${o.awb}` : 'Vezi detaliile'}</span><strong>${money(o.total)}</strong></span>
          </a></li>`)}</ul>`
          : html`<div class="empty-box"><p>Nu ai încă nicio comandă.</p><a class="btn btn-primary" href="/#produse">Vezi produsele</a></div>`}
      </section>

      <div class="account-side">
        <section class="card">
          <h2>Datele mele și adresa de livrare</h2>
          <form method="post" action="/cont/profil" class="form-stack">
            <div class="field"><label for="a-name">Nume și prenume</label><input id="a-name" name="name" required value="${c.name}"></div>
            <div class="field"><label for="a-phone">Telefon</label><input id="a-phone" name="phone" type="tel" value="${c.phone}"></div>
            <div class="field-row">
              <div class="field"><label for="a-county">Județ</label><select id="a-county" name="county"><option value="">Alege</option>${JUDETE.map((j) => html`<option ${j === c.county ? 'selected' : ''}>${j}</option>`)}</select></div>
              <div class="field"><label for="a-city">Localitate</label><input id="a-city" name="city" value="${c.city}"></div>
            </div>
            <div class="field"><label for="a-address">Adresă</label><input id="a-address" name="address" value="${c.address}" placeholder="Strada, număr, bloc, apartament"></div>
            <div class="field"><label for="a-zip">Cod poștal</label><input id="a-zip" name="postal_code" value="${c.postal_code}"></div>
            <button class="btn btn-primary">Salvează</button>
          </form>
        </section>
        <section class="card">
          <h2>Schimbă parola</h2>
          <form method="post" action="/cont/parola" class="form-stack">
            <div class="field"><label for="c-old">Parola actuală</label><input id="c-old" name="current" type="password" autocomplete="current-password" required></div>
            <div class="field"><label for="c-new">Parola nouă</label><input id="c-new" name="password" type="password" autocomplete="new-password" required minlength="8"></div>
            <button class="btn btn-ghost">Schimbă parola</button>
          </form>
        </section>
        <p class="muted small">Vrei să-ți ștergem contul? <a href="/pagina/contact">Scrie-ne</a> și îl ștergem.</p>
      </div>
    </div>
  </div>`;
}
