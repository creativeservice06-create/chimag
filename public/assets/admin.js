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
  // Previne dublu-submit
  document.addEventListener('submit', function (e) {
    var btn = e.target.querySelector('button:not([type=button])');
    if (btn && !e.defaultPrevented) setTimeout(function () { btn.disabled = true; }, 0);
  });
})();
