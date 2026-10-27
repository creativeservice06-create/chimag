(function () {
  'use strict';
  // Confirmare pentru acțiunile ireversibile
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-confirm]');
    if (b && !confirm(b.getAttribute('data-confirm'))) e.preventDefault();
  });
  // Selectează toate comenzile
  var all = document.querySelector('[data-check-all]');
  if (all) all.addEventListener('change', function () {
    document.querySelectorAll('input[name=ids]').forEach(function (c) { c.checked = all.checked; });
  });
  // Acțiune în masă: cere confirmare
  var bulk = document.querySelector('[data-bulk]');
  if (bulk) bulk.addEventListener('submit', function (e) {
    var n = document.querySelectorAll('input[name=ids]:checked').length;
    var sel = bulk.querySelector('select');
    if (!n) { e.preventDefault(); alert('Selectează cel puțin o comandă.'); return; }
    if (!confirm('Aplici „' + sel.options[sel.selectedIndex].text + '" pentru ' + n + ' comenzi?')) e.preventDefault();
  });
  // Tabele → carduri pe telefon: fiecare celulă primește eticheta coloanei (din antet)
  document.querySelectorAll('table.tbl').forEach(function (t) {
    if (t.classList.contains('no-cards')) return;
    var heads = [].map.call(t.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
    t.querySelectorAll('tbody tr, tfoot tr').forEach(function (tr) {
      var i = 0, mainSet = false;
      [].forEach.call(tr.children, function (td) {
        var span = Number(td.getAttribute('colspan')) || 1;
        if (!td.hasAttribute('data-label')) td.setAttribute('data-label', span > 1 ? '' : (heads[i] || ''));
        var onlyCheck = td.querySelector('input[type=checkbox]') && !td.textContent.trim() && td.children.length === 1;
        if (onlyCheck) td.classList.add('sel');
        else if (!mainSet && !td.classList.contains('thumb') && td.textContent.trim()) { td.classList.add('c-main'); mainSet = true; }
        i += span;
      });
    });
    t.classList.add('cardable');
  });
  // „Mai mult” din bara de jos: se închide la click în afară
  var more = document.querySelector('.tabbar .more');
  if (more) document.addEventListener('click', function (e) { if (more.open && !more.contains(e.target)) more.open = false; });

  // Previne dublu-submit
  document.addEventListener('submit', function (e) {
    var btn = e.target.querySelector('button:not([type=button])');
    if (btn && !e.defaultPrevented) setTimeout(function () { btn.disabled = true; }, 0);
  });
})();
