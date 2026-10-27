/* chimag.ro – logica din browser: coș, finalizare comandă, pixeli (doar cu acord), atribuire reclame. */
(function () {
  'use strict';
  var CFG = window.CHIMAG || {};
  var PAGE = window.PAGE || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var money = function (bani) { return fmt.format((bani || 0) / 100) + ' lei'; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  /* ---------------- Meniu mobil + căutare ---------------- */
  (function navigation() {
    var drawer = $('[data-drawer]');
    var lastFocus = null;
    function openDrawer() {
      if (!drawer) return;
      lastFocus = document.activeElement;
      drawer.hidden = false;
      requestAnimationFrame(function () { drawer.classList.add('open'); });
      document.documentElement.classList.add('drawer-open');
      var first = $('.drawer-search input', drawer); if (first) setTimeout(function () { $('[data-drawer-close].icon-btn', drawer).focus(); }, 50);
    }
    function closeDrawer() {
      if (!drawer || drawer.hidden) return;
      drawer.classList.remove('open');
      document.documentElement.classList.remove('drawer-open');
      setTimeout(function () { drawer.hidden = true; }, 250);
      if (lastFocus) lastFocus.focus();
    }
    $$('[data-drawer-open]').forEach(function (b) { b.addEventListener('click', openDrawer); });
    if (drawer) {
      $$('[data-drawer-close]', drawer).forEach(function (b) { b.addEventListener('click', closeDrawer); });
      $$('.drawer-nav a', drawer).forEach(function (a) { a.addEventListener('click', closeDrawer); });
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

    var ms = $('[data-mobile-search]');
    $$('[data-search-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!ms) return;
        ms.hidden = !ms.hidden;
        b.setAttribute('aria-expanded', String(!ms.hidden));
        if (!ms.hidden) $('input', ms).focus();
      });
    });
  })();

  /* ---------------- Atribuire (de unde vine clientul) ---------------- */
  (function captureAttribution() {
    var p = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'ttclid'];
    var found = {};
    keys.forEach(function (k) { if (p.get(k)) found[k] = p.get(k).slice(0, 200); });
    if (Object.keys(found).length) { found.ts = Date.now(); store.set('chimag_attr', found); }
  })();
  function attribution() {
    var a = store.get('chimag_attr', {}) || {};
    if (a.ts && Date.now() - a.ts > 1000 * 60 * 60 * 24 * 30) a = {};
    var m = document.cookie.match(/(?:^|; )_fbp=([^;]+)/);
    a.fbp = m ? decodeURIComponent(m[1]) : '';
    var t = document.cookie.match(/(?:^|; )_ttp=([^;]+)/);
    a.ttp = t ? decodeURIComponent(t[1]) : '';
    return a;
  }

  /* ---------------- Consimțământ + pixeli ---------------- */
  var queue = [];
  var pixelsReady = false;
  function loadPixels() {
    if (pixelsReady) return;
    pixelsReady = true;
    if (CFG.fbPixel) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', CFG.fbPixel);
      window.fbq('track', 'PageView');
    }
    if (CFG.ttPixel) {
      /* eslint-disable */
      !function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=r+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
        ttq.load(CFG.ttPixel); ttq.page();
      }(window, document, 'ttq');
      /* eslint-enable */
    }
    queue.forEach(function (e) { fire(e[0], e[1], e[2]); });
    queue = [];
  }
  // name: ViewContent | AddToCart | InitiateCheckout | Purchase
  var TT_NAMES = { ViewContent: 'ViewContent', AddToCart: 'AddToCart', InitiateCheckout: 'InitiateCheckout', Purchase: 'Purchase' };
  function fire(name, data, eventId) {
    try {
      if (window.fbq) {
        window.fbq('track', name, {
          value: data.value, currency: 'RON', content_type: 'product',
          content_ids: (data.contents || []).map(function (c) { return c.id; }),
          contents: (data.contents || []).map(function (c) { return { id: c.id, quantity: c.quantity }; }),
          num_items: (data.contents || []).reduce(function (s, c) { return s + c.quantity; }, 0),
        }, eventId ? { eventID: eventId } : undefined);
      }
      if (window.ttq) {
        if (data.identify) { try { window.ttq.identify(data.identify); } catch (e) { /* */ } }
        window.ttq.track(data.ttEvent || TT_NAMES[name] || name, {
          value: data.value, currency: 'RON', content_type: 'product',
          contents: (data.contents || []).map(function (c) { return { content_id: c.id, quantity: c.quantity, price: c.price, content_name: c.name }; }),
        }, eventId ? { event_id: eventId } : undefined);
      }
    } catch (e) { /* tracking-ul nu trebuie să strice niciodată pagina */ }
  }
  function track(name, data, eventId) {
    var c = store.get('chimag_consent', null);
    if (c === 'no') return;
    if (pixelsReady) fire(name, data, eventId); else queue.push([name, data, eventId]);
  }
  (function consent() {
    var box = $('[data-consent]');
    var c = store.get('chimag_consent', null);
    if (c === 'yes') loadPixels();
    else if (c === null && box && (CFG.fbPixel || CFG.ttPixel)) box.hidden = false;
    var prefs = $('[data-consent-prefs]'), setBtn = $('[data-consent-settings]'), saveBtn = $('[data-consent-save]');
    if (setBtn) setBtn.addEventListener('click', function () {
      var open = prefs.hidden;
      prefs.hidden = !open; saveBtn.hidden = !open; setBtn.hidden = open;
      var yes = $('[data-consent-choice="yes"]'); if (yes) yes.hidden = open;
    });
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var v = $('[data-consent-ads]') && $('[data-consent-ads]').checked ? 'yes' : 'no';
      store.set('chimag_consent', v);
      if (box) box.hidden = true;
      if (v === 'yes') loadPixels(); else queue = [];
    });
    $$('[data-consent-choice]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-consent-choice');
        store.set('chimag_consent', v);
        if (box) box.hidden = true;
        if (v === 'yes') loadPixels(); else queue = [];
      });
    });
    $$('[data-consent-reset]').forEach(function (b) {
      b.addEventListener('click', function () { store.del('chimag_consent'); location.reload(); });
    });
  })();

  /* ---------------- Coș ---------------- */
  function getCart() { var c = store.get('chimag_cart', []); return Array.isArray(c) ? c : []; }
  function setCart(c) { store.set('chimag_cart', c); updateCount(true); }
  function addToCart(id, qty) {
    var c = getCart();
    var line = c.filter(function (l) { return l.id === id; })[0];
    if (line) line.qty = Math.min(50, line.qty + qty); else c.push({ id: id, qty: qty });
    setCart(c);
  }
  // filtre pe categorii în lista de produse de pe prima pagină
  (function filters() {
    var grid = $('[data-filter-grid]');
    if (!grid) return;
    $$('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter');
        $$('[data-filter]').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        $$('.pcard', grid).forEach(function (c) { c.hidden = !!f && c.getAttribute('data-cat') !== f; });
      });
    });
    // bulele de categorii: filtrează lista de mai jos și coboară la ea (fără altă pagină)
    $$('[data-cat-jump]').forEach(function (a) {
      a.addEventListener('click', function () {
        var chip = $('[data-filter="' + a.getAttribute('data-cat-jump') + '"]');
        if (chip) chip.click();
      });
    });
  })();

  // buton rapid „Adaugă" pe cardurile de produs
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-quick-add]');
    if (!b) return;
    e.preventDefault();
    var pid = Number(b.getAttribute('data-quick-add'));
    addToCart(pid, 1);
    b.classList.add('added'); setTimeout(function () { b.classList.remove('added'); }, 1400);
    if (typeof track === 'function') track('AddToCart', { contents: [{ id: String(pid), quantity: 1 }] });
    toast('Adăugat în coș: ' + esc(b.getAttribute('data-title') || 'produs') + '. <a href="/cos">Vezi coșul</a>');
  });
  function updateCount(animate) {
    var n = getCart().reduce(function (s, l) { return s + l.qty; }, 0);
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = n; el.hidden = n === 0;
      if (animate) { el.classList.remove('count-pop'); void el.offsetWidth; el.classList.add('count-pop'); }
    });
  }
  updateCount(false);

  var toastTimer;
  function toast(htmlText) {
    var t = $('[data-toast]'); if (!t) return;
    t.innerHTML = htmlText; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3500);
  }

  function priceCart(items, opts) {
    return fetch('/api/cart', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: items, payment: (opts && opts.payment) || 'ramburs', bump: !!(opts && opts.bump), coupon: store.get('chimag_coupon', '') }),
    }).then(function (r) { return r.json(); });
  }

  function totalsHtml(p, opts) {
    var rows = '<div><dt>Subtotal</dt><dd>' + money(p.subtotal) + '</dd></div>';
    if (p.discount) rows += '<div class="save"><dt>Reducere pachet</dt><dd>−' + money(p.discount) + '</dd></div>';
    var cOk = p.coupon && p.coupon.ok;
    if (cOk && p.couponDiscount) rows += '<div class="save"><dt>Cod ' + esc(p.coupon.code) + '</dt><dd>−' + money(p.couponDiscount) + '</dd></div>';
    rows += '<div><dt>Transport</dt><dd>' + (p.shipping ? money(p.shipping) : (cOk && p.coupon.type === 'transport' ? 'Gratuit (cod)' : 'Gratuit')) + '</dd></div>';
    if (p.codFee) rows += '<div><dt>Taxă ramburs</dt><dd>' + money(p.codFee) + '</dd></div>';
    rows += '<div class="grand"><dt>Total</dt><dd>' + money(p.total) + '</dd></div>';
    return rows;
  }

  function couponHtml(p) {
    var c = p.coupon;
    if (c && c.ok) {
      return '<div class="coupon-applied"><span>🎁 <strong>' + esc(c.label) + '</strong> aplicat' + (c.hint ? '<br><small>' + esc(c.hint) + '</small>' : '') +
        '</span><button type="button" class="link-btn" data-coupon-remove>Scoate codul</button></div>';
    }
    return (c && !c.ok ? '<p class="coupon-error">' + esc(c.code) + ': ' + esc(c.error) + ' <button type="button" class="link-btn" data-coupon-remove>Scoate codul</button></p>' : '') +
      '<details class="coupon-box"' + (c && !c.ok ? ' open' : '') + '><summary>Ai un cod de reducere?</summary>' +
      '<div class="coupon-form"><input type="text" data-coupon-input placeholder="Scrie codul" autocomplete="off" autocapitalize="characters" aria-label="Cod de reducere">' +
      '<button type="button" class="btn btn-ghost" data-coupon-apply>Aplică</button></div></details>';
  }
  function bindCoupon(root, refresh) {
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-coupon-remove]')) { store.del('chimag_coupon'); updatePromoBar(); refresh(); }
      if (e.target.closest('[data-coupon-apply]')) {
        var inp = root.querySelector('[data-coupon-input]');
        var v = (inp && inp.value || '').trim().toUpperCase();
        if (v) { store.set('chimag_coupon', v); refresh(); }
      }
    });
    root.addEventListener('keydown', function (e) {
      if (e.target.matches && e.target.matches('[data-coupon-input]') && e.key === 'Enter') { e.preventDefault(); root.querySelector('[data-coupon-apply]').click(); }
    });
  }

  function shipProgress(p) {
    if (!CFG.freeShippingThreshold || !p.lines.length) return '';
    if (!p.freeShippingLeft) return '<div class="ship-progress">Ai transport gratuit.</div>';
    var pct = Math.max(4, Math.min(100, 100 - (p.freeShippingLeft / CFG.freeShippingThreshold) * 100));
    return '<div class="ship-progress">Mai adaugă ' + money(p.freeShippingLeft) + ' și ai transport gratuit.<div class="bar"><span style="width:' + pct + '%"></span></div></div>';
  }

  /* ---------------- Pagina de produs ---------------- */
  (function productPage() {
    var form = $('[data-buy-form]');
    if (!form) return;
    document.body.classList.add('pdp-page');
    var id = Number(form.getAttribute('data-product-id'));
    var price = Number(form.getAttribute('data-product-price'));
    var title = form.getAttribute('data-product-title');

    // Galerie
    // Galerie: swipe stânga/dreapta pe telefon, săgeți și miniaturi pe calculator
    (function gallery() {
      var track = $('[data-gallery-track]');
      if (!track) return;
      var slides = track.children, count = slides.length, cur = 0;
      var thumbs = $$('[data-gallery-thumb]'), dots = $$('.gallery-dots span');
      function mark(i) {
        cur = i;
        thumbs.forEach(function (t, k) { t.classList.toggle('active', k === i); });
        dots.forEach(function (d, k) { d.classList.toggle('active', k === i); });
        var th = thumbs[i]; if (th && th.parentNode.scrollWidth > th.parentNode.clientWidth) th.parentNode.scrollTo({ left: th.offsetLeft - 20, behavior: 'smooth' });
      }
      function go(i, smooth) {
        i = (i + count) % count;
        track.scrollTo({ left: i * track.clientWidth, behavior: smooth === false ? 'auto' : 'smooth' });
        mark(i);
      }
      var t;
      track.addEventListener('scroll', function () {
        clearTimeout(t);
        t = setTimeout(function () { var i = Math.round(track.scrollLeft / track.clientWidth); if (i !== cur) mark(i); }, 60);
      }, { passive: true });
      thumbs.forEach(function (b, k) { b.addEventListener('click', function () { go(k); }); });
      var prev = $('[data-gallery-prev]'), next = $('[data-gallery-next]');
      if (prev) prev.addEventListener('click', function () { go(cur - 1); });
      if (next) next.addEventListener('click', function () { go(cur + 1); });
      track.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') go(cur - 1); if (e.key === 'ArrowRight') go(cur + 1); });
      window.addEventListener('resize', function () { go(cur, false); });
    })();

    // Cantitate
    var qtyInput = $('input[type=number][name=qty]', form);
    if (qtyInput) {
      var max = Number(qtyInput.max) || 50;
      var setQ = function (v) { qtyInput.value = Math.max(1, Math.min(max, v || 1)); };
      $('[data-qty-dec]', form).addEventListener('click', function () { setQ(Number(qtyInput.value) - 1); });
      $('[data-qty-inc]', form).addEventListener('click', function () { setQ(Number(qtyInput.value) + 1); });
      qtyInput.addEventListener('change', function () { setQ(Number(qtyInput.value)); });
    }
    function qty() {
      var r = $('input[name=qty]:checked', form);
      if (r) return Number(r.value) || 1;
      return qtyInput ? Number(qtyInput.value) || 1 : 1;
    }
    function selectedTotal() {
      var r = $('input[name=qty]:checked', form);
      return r ? Number(r.getAttribute('data-total')) : price * qty();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      track('AddToCart', { value: selectedTotal() / 100, contents: [{ id: String(id), quantity: qty(), price: price / 100, name: title }] });
      var c = getCart(), q = qty(), line = c.filter(function (l) { return l.id === id; })[0];
      if (line) line.qty = q; else c.push({ id: id, qty: q });
      setCart(c);
      location.href = '/cos';
    });
    var addBtn = $('[data-add-to-cart]', form);
    if (addBtn) addBtn.addEventListener('click', function () {
      addToCart(id, qty());
      track('AddToCart', { value: selectedTotal() / 100, contents: [{ id: String(id), quantity: qty(), price: price / 100, name: title }] });
      toast('Adăugat în coș. <a href="/cos">Vezi coșul</a>');
    });

    // Data estimată de livrare (zile lucrătoare)
    var dd = $('[data-delivery-date]');
    if (dd) {
      var addBiz = function (d, n) { d = new Date(d); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6 !== 0) n--; } return d; };
      var now = new Date();
      var f = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
      if (dd.hasAttribute('data-short')) {
        var a = addBiz(now, 1), b = addBiz(now, 2), m = new Intl.DateTimeFormat('ro-RO', { month: 'short' });
        dd.textContent = 'Ajunge ' + (a.getMonth() === b.getMonth() ? a.getDate() + '–' + b.getDate() + ' ' + m.format(b) : a.getDate() + ' ' + m.format(a) + ' – ' + b.getDate() + ' ' + m.format(b));
      } else dd.textContent = 'Primești între ' + f.format(addBiz(now, 1)) + ' și ' + f.format(addBiz(now, 2));
    }

    // Bara „Comandă acum" lipită jos pe mobil, când butonul principal nu se vede
    var sticky = $('[data-sticky-buy]');
    var buyBtn = $('[data-buy-now]');
    if (sticky && buyBtn && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var e = entries[0];
        var on = !e.isIntersecting && e.boundingClientRect.top < 0;
        sticky.classList.toggle('show', on);
        document.body.classList.toggle('sticky-on', on);
      }).observe(buyBtn);
    }

    if (PAGE.product) track('ViewContent', { value: PAGE.product.price / 100, contents: [{ id: String(PAGE.product.id), quantity: 1, price: PAGE.product.price / 100, name: PAGE.product.title }] });
  })();

  /* ---------------- Finalizare comandă ---------------- */
  (function checkout() {
    var form = $('[data-checkout-form]');
    if (!form) return;
    // link vechi /finalizare?buy=ID:CANT -> produsul intră în coș
    var params = new URLSearchParams(location.search);
    if (params.get('buy')) {
      var c0 = getCart();
      params.get('buy').split(',').forEach(function (s) {
        var p = s.split(':'), id = Number(p[0]), q = Math.max(1, Math.min(50, Number(p[1]) || 1));
        if (!id) return;
        var l = c0.filter(function (x) { return x.id === id; })[0];
        if (l) l.qty = q; else c0.push({ id: id, qty: q });
      });
      setCart(c0);
      if (history.replaceState) history.replaceState(null, '', '/cos');
    }
    var linesEl = $('[data-cart-lines]');
    var freeEl = $('[data-summary-free]');
    var couponEl = $('[data-summary-coupon]');
    var totalsEl = $('[data-summary-totals]');
    var errEl = $('[data-form-error]');
    var submitBtn = $('[data-submit]');
    var mainEl = $('[data-co-main]'), emptyEl = $('[data-cart-empty]'), headEl = $('[data-co-head]'), countEl = $('[data-cart-items]');
    var last = null;
    var tracked = false;
    var x = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    function items() { return getCart(); }

    // păstrează datele completate dacă clientul revine (sau le ia din contul clientului)
    var saved = PAGE.customer || store.get('chimag_customer', {});
    ['name', 'phone', 'county', 'city', 'address', 'email', 'postalCode'].forEach(function (k) {
      if (saved[k] && form.elements[k] && !form.elements[k].value) form.elements[k].value = saved[k];
    });

    function opts() {
      var pay = form.elements.payment;
      return { payment: pay ? (pay.value || 'ramburs') : 'ramburs', bump: !!(form.elements.bump && form.elements.bump.checked) };
    }
    function freeBar(p) {
      if (!CFG.freeShippingThreshold) return '';
      if (!p.freeShippingLeft) return '<div class="cart-free done">✓ <strong>Ai transport gratuit</strong></div>';
      var pct = Math.max(4, Math.min(100, 100 - (p.freeShippingLeft / CFG.freeShippingThreshold) * 100));
      return '<div class="cart-free">Mai adaugă <strong>' + money(p.freeShippingLeft) + '</strong> pentru transport gratuit<div class="bar"><span style="width:' + pct + '%"></span></div></div>';
    }
    function showEmpty(empty) {
      mainEl.hidden = empty; emptyEl.hidden = !empty; headEl.hidden = empty;
    }
    function refresh() {
      var list = items();
      if (!list.length) { showEmpty(true); return; }
      showEmpty(false);
      priceCart(list, opts()).then(function (p) {
        last = p;
        // scoate din coș produsele care nu mai există
        var valid = p.lines.filter(function (l) { return !l.isBump; }).map(function (l) { return l.id; });
        var cleaned = list.filter(function (i) { return valid.indexOf(i.id) !== -1; });
        if (cleaned.length !== list.length) { setCart(cleaned); if (!cleaned.length) { showEmpty(true); return; } }
        var n = p.lines.filter(function (l) { return !l.isBump; }).reduce(function (s, l) { return s + l.qty; }, 0);
        if (countEl) countEl.textContent = '(' + n + (n === 1 ? ' produs)' : ' produse)');
        linesEl.innerHTML = (p.errors.length ? '<p class="form-error">' + p.errors.map(esc).join('<br>') + '</p>' : '') +
          '<ul class="cart-items">' + p.lines.map(function (l) {
            var gross = l.unitPrice * l.qty;
            var ctrl = l.isBump ? '<span class="cart-bump-tag">Ofertă la comandă</span>' :
              '<div class="qty qty-pill" data-line="' + l.id + '"><button type="button" data-d="-1" aria-label="Scade cantitatea">−</button><input value="' + l.qty + '" readonly aria-label="Cantitate"><button type="button" data-d="1" aria-label="Crește cantitatea">+</button></div>';
            return '<li class="cart-item"><a class="cart-thumb" href="/p/' + esc(l.slug) + '"><img src="' + esc(l.image) + '" alt="" width="88" height="88"></a>' +
              '<div class="cart-info"><h3><a href="/p/' + esc(l.slug) + '">' + esc(l.title) + '</a></h3>' +
              ((p.split || {}).mode === 'mixt' ? '<span class="parcel-tag">' + (l.parcel === 'helpship' ? 'Coletul 1' : 'Coletul 2') + '</span>' : '') +
              '<p class="cart-unit">' + money(l.unitPrice) + ' / buc.' + (l.pct && !l.isBump ? ' · <span class="line-save">economisești ' + money(gross - l.total) + '</span>' : '') + '</p>' +
              '<div class="cart-row">' + ctrl + '<div class="cart-price"><strong>' + money(l.total) + '</strong>' + (l.total < gross ? '<s>' + money(gross) + '</s>' : '') + '</div></div>' +
              '</div>' +
              (l.isBump ? '' : '<button type="button" class="cart-x" data-remove="' + l.id + '" aria-label="Șterge ' + esc(l.title) + '">' + x + '</button>') +
              (l.nextTier ? '<button type="button" class="tier-hint" data-tier="' + l.id + ':' + l.nextTier.qty + '"><span class="tier-text">Mai adaugă ' + l.nextTier.add + ' și ai <strong>−' + l.nextTier.pct + '%</strong><small>' + money(l.nextTier.unit) + ' / buc. la toate</small></span><span class="tier-add">+ Adaugă</span></button>' : '') + '</li>';
          }).join('') + '</ul>';
        if (freeEl) freeEl.innerHTML = freeBar(p);
        totalsEl.innerHTML = totalsHtml(p);
        if (couponEl) couponEl.innerHTML = couponHtml(p);
        if (p.coupon && p.coupon.ok) updatePromoBar(p.coupon);
        // comandă cu produse din depozite diferite: clientul află că vine în 2 colete
        var splitEl = $('[data-split-note]');
        if (splitEl) {
          var sp = p.split || {};
          if (sp.mode === 'mixt') {
            var cod = opts().payment !== 'card';
            splitEl.innerHTML = '<strong>📦 Comanda ta ajunge în 2 colete separate</strong>' +
              '<span>Produsele pleacă din depozite diferite, așa că vei primi două colete, fiecare cu AWB-ul lui. ' +
              (cod ? 'Plătești fiecare colet curierului care ți-l aduce: <b>' + money(sp.hs) + '</b> și <b>' + money(sp.own) + '</b>. Totalul rămâne același, ' + money(p.total) + '.' : 'Totalul plătit rămâne același.') + '</span>';
            splitEl.hidden = false;
          } else splitEl.hidden = true;
        }
        submitBtn.disabled = !!p.errors.length;
        submitBtn.textContent = (opts().payment === 'card' ? 'Plătește acum ' : 'Finalizează comanda · ') + money(p.total);
        if (!tracked && p.lines.length) {
          tracked = true;
          track('InitiateCheckout', { value: p.total / 100, contents: p.lines.map(function (l) { return { id: String(l.id), quantity: l.qty, price: l.unitPrice / 100, name: l.title }; }) });
        }
      });
    }
    linesEl.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      var c = getCart();
      if (t.hasAttribute('data-tier')) {
        var tp = t.getAttribute('data-tier').split(':'), tid = Number(tp[0]), tq = Number(tp[1]);
        c.forEach(function (l) { if (l.id === tid) l.qty = Math.min(50, tq); });
        setCart(c); refresh(); toast('Reducerea de pachet a fost aplicată.'); return;
      }
      if (t.hasAttribute('data-remove')) {
        var rid = Number(t.getAttribute('data-remove'));
        setCart(c.filter(function (l) { return l.id !== rid; })); refresh(); return;
      }
      var wrap = t.closest('[data-line]');
      if (wrap) {
        var id = Number(wrap.getAttribute('data-line'));
        c.forEach(function (l) { if (l.id === id) l.qty = Math.max(1, Math.min(50, l.qty + Number(t.getAttribute('data-d')))); });
        setCart(c); refresh();
      }
    });
    form.addEventListener('change', function (e) {
      if (e.target.name === 'payment' || e.target.name === 'bump') refresh();
    });
    if (couponEl) bindCoupon(couponEl, refresh);
    refresh();

    function setErr(name, msg) {
      var el = form.elements[name]; if (!el) return;
      var f = el.closest('.field'); if (!f) return;
      f.classList.toggle('invalid', !!msg);
      var e = f.querySelector('.err');
      if (msg) { if (!e) { e = document.createElement('span'); e.className = 'err'; f.appendChild(e); } e.textContent = msg; }
      else if (e) e.remove();
    }
    function validate() {
      var v = function (n) { return (form.elements[n].value || '').trim(); };
      var errors = {};
      if (v('name').length < 3 || v('name').indexOf(' ') === -1) errors.name = 'Scrie numele și prenumele.';
      var phone = v('phone').replace(/[^\d+]/g, '').replace(/^\+40|^0040/, '0');
      var rest = phone.slice(2);
      if (!/^0[2-7]\d{8}$/.test(phone) || /^(\d)\1+$/.test(rest) || '0123456789'.indexOf(rest) > -1 || '9876543210'.indexOf(rest) > -1 || /^0{4,}/.test(rest)) errors.phone = 'Număr de telefon invalid (ex: 0722 123 456).';
      if (!v('county')) errors.county = 'Alege județul.';
      if (v('city').length < 2) errors.city = 'Scrie localitatea.';
      if (v('address').length < 5) errors.address = 'Scrie adresa completă (stradă și număr).';
      var em = v('email');
      if (!em) errors.email = 'Scrie adresa de email.';
      else if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(em) || em.indexOf('..') > -1) errors.email = 'Adresa de email nu este validă.';
      else if (/@(gmial|gmal|gmai|gnail|gamil|gmaill|yaho|yahooo|yhoo|hotmial|hotmal|outlok)\.|@gmail\.(co|cm|con|om|ro)$|@yahoo\.(cm|con|co)$|\.(con|cmo|comm)$/i.test(em)) errors.email = 'Verifică adresa de email, pare să aibă o greșeală de scriere.';
      ['name', 'phone', 'county', 'city', 'address', 'email'].forEach(function (n) { setErr(n, errors[n]); });
      var first = Object.keys(errors)[0];
      if (first) form.elements[first].focus();
      return !first;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errEl.hidden = true;
      if (!validate()) return;
      var data = {};
      ['name', 'phone', 'county', 'city', 'address', 'email', 'postalCode', 'notes'].forEach(function (k) { data[k] = (form.elements[k].value || '').trim(); });
      store.set('chimag_customer', { name: data.name, phone: data.phone, county: data.county, city: data.city, address: data.address, email: data.email, postalCode: data.postalCode });
      var o = opts();
      submitBtn.disabled = true;
      var oldText = submitBtn.textContent;
      submitBtn.textContent = 'Se trimite comanda…';
      fetch('/api/comanda', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: items(), customer: data, payment: o.payment, bump: o.bump, attribution: attribution(), coupon: store.get('chimag_coupon', '') }),
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.j && res.j.couponError) refresh();
          if (!res.ok || !res.j.redirect) throw new Error(res.j.error || 'Comanda nu a putut fi trimisă.');
          setCart([]);
          if (store.get('chimag_coupon', '')) { store.del('chimag_coupon'); store.del('chimag_wheel'); }
          location.href = res.j.redirect;
        })
        .catch(function (err) {
          errEl.textContent = err.message + ' Dacă problema persistă, sună-ne.';
          errEl.hidden = false;
          submitBtn.disabled = false;
          submitBtn.textContent = oldText;
        });
    });
  })();

  /* ---------------- Bară promoție (cod activ + cronometru) ---------------- */
  var promoTimer = null;
  function updatePromoBar(fromServer) {
    var bar = $('[data-promo-bar]');
    if (!bar) return;
    var code = store.get('chimag_coupon', '');
    var w = store.get('chimag_wheel', null);
    var info = fromServer || (w && w.code === code ? w : null);
    clearInterval(promoTimer);
    if (!code || !info) { bar.hidden = true; return; }
    var exp = info.expiresAt ? Date.parse(info.expiresAt) : 0;
    function tick() {
      var left = exp ? exp - Date.now() : 0;
      if (exp && left <= 0) { bar.hidden = true; store.del('chimag_coupon'); clearInterval(promoTimer); return; }
      var t = '';
      if (exp) {
        var h = Math.floor(left / 3600e3), m = Math.floor(left / 60e3) % 60, sec = Math.floor(left / 1e3) % 60;
        t = ' · expiră în <b>' + h + ':' + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec + '</b>';
      }
      bar.innerHTML = '<div class="wrap">🎁 <strong>' + esc(info.label) + '</strong><span class="pb-long"> se aplică automat la comandă</span><span class="pb-short"> activă</span>' + t + '</div>';
      bar.hidden = false;
    }
    tick();
    if (exp) promoTimer = setInterval(tick, 1000);
  }
  updatePromoBar();

  /* ---------------- Confeti (fără biblioteci) ---------------- */
  function confetti() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = $('[data-confetti]'); if (!c) return;
    var ctx = c.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; c.style.display = 'block';
    ctx.scale(dpr, dpr);
    var colors = ['#155ecc', '#78aae9', '#f6b73c', '#ffffff', '#112b4d', '#ff6b6b'];
    var parts = [];
    for (var i = 0; i < 180; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.45,
        vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 6,
        w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        color: colors[i % colors.length],
      });
    }
    var start = performance.now();
    (function frame(now) {
      var t = now - start;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(function (p) {
        p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - t / 3200);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r)));
        ctx.restore();
      });
      if (t < 3200) requestAnimationFrame(frame); else { ctx.clearRect(0, 0, innerWidth, innerHeight); c.style.display = 'none'; }
    })(start);
  }

  /* ---------------- Roata norocului ---------------- */
  (function wheel() {
    var W = CFG.wheel;
    var modal = $('[data-wheel-modal]');
    if (!W || !modal) return;
    var disc = $('[data-wheel-disc]', modal);
    var copy = $('[data-wheel-copy]', modal);
    var segs = W.segments;
    var n = segs.length, a = 360 / n;
    var palette = ['#155ecc', '#0e192a', '#2f7be6', '#112b4d'];
    var spinning = false;

    // desenează roata (SVG)
    var R = 150, svg = '<svg viewBox="-160 -160 320 320" aria-hidden="true"><circle r="158" fill="#0e192a"/>';
    function pt(deg, r) { var rad = (deg - 90) * Math.PI / 180; return [Math.cos(rad) * r, Math.sin(rad) * r]; }
    for (var i = 0; i < n; i++) {
      var s0 = pt(i * a, R), s1 = pt((i + 1) * a, R);
      var fill = (n % palette.length === 1 && i === n - 1) ? '#2f7be6' : palette[i % palette.length];
      svg += '<path d="M0 0 L' + s0[0].toFixed(2) + ' ' + s0[1].toFixed(2) + ' A' + R + ' ' + R + ' 0 0 1 ' + s1[0].toFixed(2) + ' ' + s1[1].toFixed(2) + ' Z" fill="' + fill + '" stroke="#ffffff" stroke-opacity=".18" stroke-width="1.5"/>';
      var mid = i * a + a / 2, tp = pt(mid, R * 0.62);
      var words = String(segs[i]).split(' ');
      var lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : (words.length === 2 && segs[i].length > 11 ? words : [segs[i]]);
      var fs = n > 8 ? 12.5 : n > 6 ? 14.5 : 16;
      svg += '<text transform="translate(' + tp[0].toFixed(2) + ' ' + tp[1].toFixed(2) + ') rotate(' + (mid > 180 ? mid + 90 : mid - 90) + ')" fill="#fff" font-size="' + fs + '" font-weight="800" text-anchor="middle" font-family="Plus Jakarta Sans, Inter, sans-serif">' +
        lines.map(function (l, j) { return '<tspan x="0" dy="' + (j === 0 ? (lines.length > 1 ? -0.35 : 0.35) : 1.15) + 'em">' + esc(l) + '</tspan>'; }).join('') + '</text>';
    }
    for (var k = 0; k < n * 2; k++) { var d = pt(k * a / 2, 152); svg += '<circle cx="' + d[0].toFixed(2) + '" cy="' + d[1].toFixed(2) + '" r="3" fill="' + (k % 2 ? '#f6b73c' : '#ffffff') + '"/>'; }
    disc.innerHTML = svg + '</svg>';

    function rotateTo(index, animate) {
      var jitter = (Math.random() - 0.5) * a * 0.6;
      var target = 360 * (animate ? 7 : 0) + (360 - (index * a + a / 2)) + (animate ? jitter : 0);
      disc.style.transition = animate ? 'transform 5.6s cubic-bezier(.12,.72,.08,1)' : 'none';
      disc.style.transform = 'rotate(' + target + 'deg)';
    }

    var st = W.state || { state: 'guest' };
    var hours = W.hours || 2;
    var legal = '<p class="wheel-legal"><a href="/pagina/regulament-roata">Regulament și șanse</a></p>';
    var here = location.pathname + '?roata';
    var regUrl = '/cont/inregistrare?next=' + encodeURIComponent(here);
    var loginUrl = '/cont/autentificare?next=' + encodeURIComponent(here);
    var oreTxt = hours === 1 ? 'o oră' : hours + ' ore';

    function hub(on, label) {
      var h = $('.wheel-hub', modal); if (!h) return;
      h.disabled = !on; h.textContent = label || 'Învârte';
    }
    function continueBtn(primary) {
      return '<button type="button" class="btn ' + (primary ? 'btn-primary' : 'btn-ghost') + ' btn-lg btn-block" data-wheel-close-btn>Continuă cumpărăturile</button>';
    }
    function nextInfo(s) {
      if (!s) return '';
      if (s.state === 'wait-order') return 'Următoarea învârtire se deblochează după prima comandă plasată din cont.';
      if (s.state === 'wait-amount') return 'A treia învârtire se deblochează după o comandă de peste ' + money(s.minThird || W.minThird) + ' plasată din cont.';
      if (s.state === 'done') return 'Ai folosit toate cele ' + (s.total || 3) + ' învârtiri.';
      if (s.state === 'ready') return 'Ai deja următoarea învârtire disponibilă!';
      return '';
    }
    function fmtTime(iso) { return new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit' }).format(Date.parse(iso)); }

    function render(s, opt) {
      opt = opt || {};
      var h = '';
      if (opt.lost) {
        hub(false, '🙂');
        h = '<p class="wheel-lost">De data asta nu ai câștigat</p><h2 id="wheel-title">Mai mult noroc data viitoare!</h2>' +
          (nextInfo(s) ? '<p>' + esc(nextInfo(s)) + (s.state === 'wait-order' || s.state === 'wait-amount' ? ' Te anunțăm pe email.' : '') + '</p>' : '') + continueBtn(true);
      } else if (s.state === 'guest') {
        hub(false, 'Învârte');
        h = '<h2 id="wheel-title">' + esc(W.title) + '</h2><p>Roata e pentru clienții cu cont. Fă-ți un cont gratuit și învârți imediat.</p>' +
          '<a class="btn btn-primary btn-lg btn-block" href="' + regUrl + '">Creează cont și învârte</a>' +
          '<a class="btn btn-ghost btn-block" href="' + loginUrl + '">Am deja cont</a>';
      } else if (s.state === 'ready') {
        hub(true, 'Învârte');
        h = '<p class="wheel-step">Învârtirea ' + s.stage + ' din ' + (s.total || 3) + '</p><h2 id="wheel-title">' + esc(W.title) + '</h2>' +
          '<p>Dacă câștigi, reducerea se aplică automat la comandă și e valabilă ' + oreTxt + '.</p>' +
          '<button type="button" class="btn btn-primary btn-lg btn-block" data-wheel-spin>Învârte roata</button>';
      } else if (s.state === 'voucher') {
        hub(false, '🎉');
        var cartN = getCart().length;
        h = '<p class="wheel-won">' + (opt.fresh ? '🎉 Felicitări! Ai câștigat' : 'Premiul tău') + '</p><h2 id="wheel-title">' + esc(s.label) + '</h2>' +
          ((s.description && s.description !== s.label) || s.min ? '<p>' + esc(s.description && s.description !== s.label ? s.description : 'Valabil') + (s.min ? ' la comenzi de minim ' + money(s.min) : '') + '.</p>' : '') +
          '<p class="wheel-code">Codul tău: <strong>' + esc(s.code) + '</strong></p>' +
          '<p class="wheel-note">Se aplică automat la comandă. Valabil până la ora ' + fmtTime(s.expiresAt) + '.</p>' +
          continueBtn(!cartN) + (cartN ? '<a class="btn btn-primary btn-lg btn-block" href="/cos">Finalizează comanda</a>' : '');
      } else if (s.state === 'wait-order' || s.state === 'wait-amount') {
        hub(false, '🔒');
        h = '<p class="wheel-step">Învârtirea ' + s.stage + ' din ' + (s.total || 3) + '</p>' +
          '<h2 id="wheel-title">' + (s.state === 'wait-order' ? 'Încă o învârtire după prima comandă' : 'Ultima învârtire te așteaptă') + '</h2>' +
          '<p>' + (s.state === 'wait-order' ? 'Plasează prima comandă din contul tău și deblochezi următoarea învârtire.' : 'O deblochezi cu o comandă de peste ' + money(s.minThird || W.minThird) + ' plasată din cont.') + ' Te anunțăm pe email.</p>' + continueBtn(true);
      } else if (s.state === 'done') {
        hub(false, '⭐');
        h = '<h2 id="wheel-title">Ai folosit toate învârtirile</h2><p>Mulțumim că ești clientul nostru! Urmărește-ne pentru alte promoții.</p>' + continueBtn(true);
      } else {
        h = '<h2 id="wheel-title">Roata nu este activă momentan</h2>' + continueBtn(true);
      }
      copy.innerHTML = h + legal;
      $$('[data-wheel-spin]', copy).forEach(function (b) { b.addEventListener('click', spin); });
      $$('[data-wheel-close-btn]', copy).forEach(function (b) { b.addEventListener('click', close); });
    }

    // premiul activ din cont se aplică automat la comandă (și pe alt dispozitiv)
    function syncCoupon(s) {
      if (s.state === 'voucher') {
        store.set('chimag_wheel', { code: s.code, label: s.label, expiresAt: s.expiresAt });
        if (!store.get('chimag_coupon', '')) store.set('chimag_coupon', s.code);
      } else {
        var w = store.get('chimag_wheel', null);
        if (w && store.get('chimag_coupon', '') === w.code && s.state !== 'guest') store.del('chimag_coupon');
        store.del('chimag_wheel');
      }
      updatePromoBar();
    }
    function updateDot() { var d = $('[data-wheel-dot]'); if (d) d.hidden = !(st.state === 'ready' || st.state === 'guest'); }
    syncCoupon(st);

    var scrollY = 0;
    function lockScroll(on) {
      var b = document.body, h = document.documentElement;
      if (on) { scrollY = window.scrollY; b.style.top = -scrollY + 'px'; b.classList.add('no-scroll'); h.classList.add('no-scroll'); }
      else {
        // revine instant unde era pagina, fără animația de derulare de sus
        h.style.scrollBehavior = 'auto';
        b.classList.remove('no-scroll'); h.classList.remove('no-scroll'); b.style.top = '';
        window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
        setTimeout(function () { h.style.scrollBehavior = ''; }, 0);
      }
    }
    // fereastra nu se derulează și nu lasă pagina din spate să se miște (mouse, touchpad, deget)
    ['wheel', 'touchmove'].forEach(function (ev) { modal.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });

    function open() {
      modal.hidden = false;
      lockScroll(true);
      rotateTo(0, false);
      render(st);
      fetch('/api/roata', { headers: { accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (s) {
        if (spinning || !s || !s.state) return;
        st = s; syncCoupon(st); updateDot();
        if (!modal.hidden) render(st);
      }).catch(function () {});
      setTimeout(function () { var b = $('[data-wheel-spin]', modal) || $('a.btn', copy) || $('[data-wheel-close]', modal); if (b) b.focus(); }, 50);
      if (/[?&]roata/.test(location.search) && history.replaceState) history.replaceState(null, '', location.pathname + location.hash);
    }
    function close() {
      if (spinning) return;
      modal.hidden = true;
      lockScroll(false);
      if (st.state === 'ready' || st.state === 'guest') store.set('chimag_wheel_later', Date.now());
    }

    function spin() {
      if (spinning || st.state !== 'ready') return;
      spinning = true;
      $$('[data-wheel-spin]', modal).forEach(function (b) { b.disabled = true; });
      fetch('/api/roata', { method: 'POST' }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
        .then(function (res) {
          if (!res.ok) {
            if (res.j && res.j.wheel) { st = res.j.wheel; } else if (res.status === 401) { st = { state: 'guest' }; }
            var e = new Error(res.j.error || 'Roata nu a putut fi învârtită.'); e.keep = true; throw e;
          }
          var w = res.j;
          rotateTo(w.index, true);
          setTimeout(function () {
            spinning = false;
            st = w.wheel || st;
            updateDot();
            if (w.nothing) { syncCoupon(st); render(st, { lost: true }); return; }
            store.set('chimag_coupon', w.code);
            syncCoupon(st);
            confetti();
            render(st, { fresh: true });
          }, 5800);
        })
        .catch(function (err) {
          spinning = false;
          render(st);
          toast(esc(err.message));
        });
    }

    updateDot();
    $$('[data-wheel-open]').forEach(function (b) { b.addEventListener('click', open); });
    $$('[data-wheel-close]', modal).forEach(function (b) { b.addEventListener('click', close); });
    $$('[data-wheel-spin]', modal).forEach(function (b) { b.addEventListener('click', spin); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });

    // apare singură doar când clientul are ceva de făcut (vizitator nou sau învârtire disponibilă); dacă o închizi, revine după 24h
    if (/[?&]roata/.test(location.search)) { open(); return; }
    var later = store.get('chimag_wheel_later', 0);
    var skip = /^\/(finalizare|cos|multumim|admin|pagina|cont)/.test(location.pathname);
    if (W.autoOpen && !skip && (st.state === 'guest' || st.state === 'ready') && Date.now() - later > 24 * 3600e3) {
      setTimeout(function () { if (modal.hidden) open(); }, W.delay * 1000);
    }
  })();

  /* ---------------- Formular de contact ---------------- */
  (function contact() {
    var form = $('[data-contact-form]');
    if (!form) return;
    var err = $('[data-contact-error]', form), ok = $('[data-contact-ok]', form), btn = $('[data-contact-submit]', form);
    var q = new URLSearchParams(location.search);
    function done() { $$('h2, .field, .field-row, .hint-small, [data-contact-submit], [data-contact-error]', form).forEach(function (el) { if (!ok.contains(el)) el.hidden = true; }); ok.hidden = false; }
    if (q.get('trimis')) done();
    if (q.get('eroare')) { err.textContent = q.get('eroare'); err.hidden = false; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var data = {};
      ['name', 'phone', 'email', 'order_number', 'subject', 'message', 'website'].forEach(function (k) { data[k] = (form.elements[k] && form.elements[k].value || '').trim(); });
      var problem = data.name.length < 2 ? 'Scrie-ne numele tău.' :
        (!data.phone && !data.email) ? 'Lasă-ne un telefon sau un email, ca să-ți putem răspunde.' :
        data.message.length < 10 ? 'Mesajul e prea scurt. Spune-ne puțin mai mult.' : '';
      if (problem) { err.textContent = problem; err.hidden = false; return; }
      btn.disabled = true; var old = btn.textContent; btn.textContent = 'Se trimite…';
      fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) { if (!res.ok) throw new Error(res.j.error || 'Mesajul nu a putut fi trimis.'); done(); })
        .catch(function (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; btn.textContent = old; });
    });
  })();

  /* ---------------- Mulțumim: eveniment Purchase (o singură dată) ---------------- */
  (function purchase() {
    var el = $('[data-purchase]');
    if (!el) return;
    var data; try { data = JSON.parse(el.getAttribute('data-purchase')); } catch (e) { return; }
    var key = 'chimag_tracked_' + data.eventId;
    if (store.get(key, false)) return;
    store.set(key, true);
    track('Purchase', data, data.eventId);
  })();
})();
