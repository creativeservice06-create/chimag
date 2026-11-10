// Panoul „cine e pe site acum” din /admin/activitate — se actualizează la 30 de secunde
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DEV = { mobil: 'Telefon', desktop: 'Calculator', tableta: 'Tabletă' };
  function load() {
    fetch('/admin/activitate/live', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      $('al-now').textContent = d.now === 0 ? 'Nimeni pe site chiar acum' : d.now === 1 ? '1 persoană pe site acum' : d.now + ' persoane pe site acum';
      $('act-live').classList.toggle('on', d.now > 0);
      $('al-meta').textContent = 'Azi: ' + d.today + ' vizitatori · ultima oră: ' + d.hour + ' · actualizat ' + new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      $('al-list').innerHTML = d.list.map(function (v) {
        return '<div class="al-card"><div class="al-top"><span class="src src-' + esc(v.cls) + '"><i></i>' + esc(v.src) + (v.camp ? '<small>' + esc(v.camp) + '</small>' : '') + '</span>' +
          '<span class="muted">' + esc(DEV[v.device] || v.device) + (v.os ? ' · ' + esc(v.os) : '') + (v.city ? ' · ' + esc(v.city) : '') + (v.country && v.country !== 'RO' ? ' (' + esc(v.country) + ')' : '') + '</span></div>' +
          '<div class="al-page">Acum pe: <b>' + esc(v.page) + '</b></div>' +
          '<div class="al-foot muted">' + v.pages + (v.pages === 1 ? ' pagină' : ' pagini') + ' · ' + esc(v.time) + ' pe site' + (v.bought ? ' · <b class="ok">a comandat ✓</b>' : '') + '</div>' +
          (v.path.length > 1 ? '<div class="al-path muted">' + v.path.map(esc).join(' → ') + '</div>' : '') + '</div>';
      }).join('');
    }).catch(function () { $('al-meta').textContent = 'Nu s-au putut încărca datele live. Reîncerc…'; });
  }
  // actualizare la 30 de secunde, doar cât pagina e vizibilă și folosită; după 10 minute fără activitate se oprește
  var lastUse = Date.now(), paused = false;
  function used() { lastUse = Date.now(); if (paused) { paused = false; load(); } }
  ['mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'focus'].forEach(function (e) { window.addEventListener(e, used, { passive: true }); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) used(); });
  load();
  setInterval(function () {
    if (document.hidden) return;
    if (Date.now() - lastUse > 10 * 60 * 1000) { if (!paused) { paused = true; $('al-meta').textContent = 'Actualizarea live e oprită (10 minute fără activitate) — mișcă mouse-ul sau atinge ecranul ca să pornească din nou.'; } return; }
    load();
  }, 30000);
})();
