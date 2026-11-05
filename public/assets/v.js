// Activitate pe site (chimag): pagini văzute și timp activ. Fără cookie-uri și fără stocare în browser.
(function () {
  try {
    if (!window.JSON || !document.addEventListener) return;
    var pv = Math.random().toString(36).slice(2) + Date.now().toString(36);
    var active = 0, last = Date.now(), visible = !document.hidden, maxScroll = 0, beats = 0;
    var tick = function () { var n = Date.now(); if (visible) active += n - last; last = n; };
    var send = function (t) {
      try {
        tick();
        var d = { t: t, pv: pv, s: Math.round(active / 1000), sc: maxScroll };
        if (t === 'v') { d.p = location.pathname; d.q = location.search.slice(0, 400); d.r = (document.referrer || '').slice(0, 300); d.wd = navigator.webdriver ? 1 : 0; }
        var body = JSON.stringify(d);
        if (navigator.sendBeacon) navigator.sendBeacon('/api/v', new Blob([body], { type: 'text/plain' }));
        else if (window.fetch) fetch('/api/v', { method: 'POST', body: body, keepalive: true, headers: { 'content-type': 'text/plain' } });
      } catch (e) {}
    };
    send('v');
    document.addEventListener('visibilitychange', function () { tick(); visible = !document.hidden; if (!visible) send('p'); });
    window.addEventListener('pagehide', function () { send('p'); });
    window.addEventListener('scroll', function () {
      var h = document.documentElement, p = Math.round(((window.scrollY || 0) + window.innerHeight) / Math.max(1, h.scrollHeight) * 100);
      if (p > maxScroll) maxScroll = Math.min(100, p);
    }, { passive: true });
    var iv = setInterval(function () { if (document.hidden) return; if (++beats > 90) { clearInterval(iv); return; } send('p'); }, 20000);
  } catch (e) {}
})();
