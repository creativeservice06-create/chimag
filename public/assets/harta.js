// Harta comenzilor pe județe (admin). Doar afișare, nu trimite nimic.
(function () {
  'use strict';
  var GEO = window.RO_JUDETE, box = document.getElementById('hm-map'), dataEl = document.getElementById('hm-data');
  if (!GEO || !box || !dataEl) return;
  var NAMES = { alba: 'Alba', arad: 'Arad', arges: 'Argeș', bacau: 'Bacău', bihor: 'Bihor', 'bistrita-nasaud': 'Bistrița-Năsăud', botosani: 'Botoșani', braila: 'Brăila', brasov: 'Brașov', bucuresti: 'București', buzau: 'Buzău', calarasi: 'Călărași', 'caras-severin': 'Caraș-Severin', cluj: 'Cluj', constanta: 'Constanța', covasna: 'Covasna', dambovita: 'Dâmbovița', dolj: 'Dolj', galati: 'Galați', giurgiu: 'Giurgiu', gorj: 'Gorj', harghita: 'Harghita', hunedoara: 'Hunedoara', ialomita: 'Ialomița', iasi: 'Iași', ilfov: 'Ilfov', maramures: 'Maramureș', mehedinti: 'Mehedinți', mures: 'Mureș', neamt: 'Neamț', olt: 'Olt', prahova: 'Prahova', salaj: 'Sălaj', 'satu-mare': 'Satu Mare', sibiu: 'Sibiu', suceava: 'Suceava', teleorman: 'Teleorman', timis: 'Timiș', tulcea: 'Tulcea', valcea: 'Vâlcea', vaslui: 'Vaslui', vrancea: 'Vrancea' };
  var rows = []; try { rows = JSON.parse(dataEl.textContent || '[]'); } catch (e) { rows = []; }
  var data = {}, rev = {}, other = 0;
  rows.forEach(function (r) { if (GEO.c[r.slug]) { data[r.slug] = (data[r.slug] || 0) + r.n; rev[r.slug] = (rev[r.slug] || 0) + r.revenue; } else other += r.n; });
  var vals = Object.keys(data).map(function (k) { return data[k]; });
  var total = vals.reduce(function (a, b) { return a + b; }, 0) + other, max = Math.max.apply(null, vals.concat([1]));
  var lei = function (b) { return (b / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' lei'; };
  var pc = function (n) { return total ? Math.round(n / total * 100) + '%' : '0%'; };
  var STEPS = ['#eef3fb', '#cfe0f8', '#9fc1f0', '#5f97e3', '#2a6cd4', '#0f4aa6'];
  var color = function (n) { return !n ? STEPS[0] : STEPS[Math.min(5, 1 + Math.floor(Math.sqrt(n) / Math.sqrt(max) * 4.999))]; };
  var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), tip = document.getElementById('hm-tip');
  svg.setAttribute('viewBox', '0 0 ' + GEO.w + ' ' + GEO.h); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Harta României pe județe, cu numărul de comenzi');
  Object.keys(GEO.c).forEach(function (k) {
    var p = document.createElementNS(ns, 'path'); p.setAttribute('d', GEO.c[k].d); p.setAttribute('fill', color(data[k] || 0));
    var show = function (ev) {
      var r = box.getBoundingClientRect(), pt = ev.touches ? ev.touches[0] : ev, n = data[k] || 0;
      tip.innerHTML = '<b>' + NAMES[k] + '</b>' + n + (n === 1 ? ' comandă' : ' comenzi') + ' · ' + pc(n) + '<br>' + (n ? lei(rev[k] || 0) : '–');
      tip.style.left = (pt.clientX - r.left) + 'px'; tip.style.top = (pt.clientY - r.top) + 'px'; tip.style.opacity = 1;
    };
    p.addEventListener('mousemove', show); p.addEventListener('touchstart', show, { passive: true });
    p.addEventListener('mouseleave', function () { tip.style.opacity = 0; });
    svg.appendChild(p);
  });
  Object.keys(GEO.c).forEach(function (k) {
    var n = data[k] || 0, c = GEO.c[k]; if (!n) return;
    var off = k === 'ilfov' ? [-34, -26] : [0, 0];
    if (k === 'bucuresti') { var ci = document.createElementNS(ns, 'circle'); ci.setAttribute('cx', c.x); ci.setAttribute('cy', c.y); ci.setAttribute('r', 15); ci.setAttribute('class', 'hm-buc'); svg.appendChild(ci); }
    var dark = k === 'bucuresti' || color(n) === STEPS[4] || color(n) === STEPS[5];
    var t = document.createElementNS(ns, 'text'); t.setAttribute('x', c.x + off[0]); t.setAttribute('y', c.y + off[1]);
    t.setAttribute('class', 'hm-lbl' + (dark ? ' light' : '') + (k === 'bucuresti' ? ' sm' : '')); t.textContent = n; svg.appendChild(t);
  });
  box.insertBefore(svg, box.firstChild);
  document.getElementById('hm-legend').innerHTML = 'Mai puține' + STEPS.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + 'Mai multe · gri deschis = nicio comandă';
  var sorted = Object.keys(data).map(function (k) { return [k, data[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  document.getElementById('hm-rank').innerHTML = sorted.length ? sorted.slice(0, 10).map(function (e, i) {
    return '<li><span class="n">' + (i + 1) + '</span><div><div class="nm">' + NAMES[e[0]] + '<small>' + pc(e[1]) + '</small></div><div class="hm-bar"><span style="width:' + Math.round(e[1] / max * 100) + '%"></span></div></div><span class="v">' + e[1] + '<small>' + lei(rev[e[0]] || 0) + '</small></span></li>';
  }).join('') : '<li class="muted">Nicio comandă în perioada aleasă.</li>';
  var missing = Object.keys(GEO.c).filter(function (k) { return !data[k]; }).map(function (k) { return NAMES[k]; }).sort(function (a, b) { return a.localeCompare(b, 'ro'); });
  document.getElementById('hm-none').textContent = (missing.length && sorted.length ? 'Fără comenzi încă (' + missing.length + '): ' + missing.join(', ') : '') + (other ? ' · ' + other + ' cu județ nerecunoscut' : '');
  var top3 = sorted.slice(0, 3).reduce(function (s, e) { return s + e[1]; }, 0);
  var k = [['Comenzi', String(total), 'în toată țara'], ['Județe active', sorted.length + ' / 42', 'cu cel puțin o comandă'],
    ['Primul județ', sorted.length ? NAMES[sorted[0][0]] : '–', sorted.length ? sorted[0][1] + ' comenzi · ' + pc(sorted[0][1]) : 'nicio comandă'],
    ['Top 3 județe', total ? pc(top3) : '–', 'din toate comenzile']];
  document.getElementById('hm-kpis').innerHTML = k.map(function (x) { return '<div class="d2-kpi"><div class="d2-kpi-top"><span>' + x[0] + '</span></div><div class="d2-kpi-val"><strong>' + x[1] + '</strong></div><small>' + x[2] + '</small></div>'; }).join('');
})();
