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
  var TT_NAMES = { ViewContent: 'ViewContent', AddToCart: 'AddToCart', InitiateCheckout: 'InitiateCheckout', Purchase: 'CompletePayment' };
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
  function updateCount(animate) {
    var n = getCart().reduce(function (s, l) { return s + l.qty; }, 0);
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = n; el.hidden = n === 0;
      if (animate) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
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
    var main = $('[data-gallery-main]');
    $$('[data-gallery-thumb]').forEach(function (b) {
      b.addEventListener('click', function () {
        main.src = b.getAttribute('data-gallery-thumb');
        $$('[data-gallery-thumb]').forEach(function (x) { x.classList.toggle('active', x === b); });
      });
    });

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
      location.href = '/finalizare?buy=' + id + ':' + qty();
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
        sticky.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0);
      }).observe(buyBtn);
    }

    if (PAGE.product) track('ViewContent', { value: PAGE.product.price / 100, contents: [{ id: String(PAGE.product.id), quantity: 1, price: PAGE.product.price / 100, name: PAGE.product.title }] });
  })();

  /* ---------------- Pagina coș ---------------- */
  (function cartPage() {
    var view = $('[data-cart-view]');
    if (!view) return;
    function render() {
      var items = getCart();
      if (!items.length) {
        view.innerHTML = '<p>Coșul este gol.</p><p><a class="btn btn-primary" href="/#produse">Vezi produsele</a></p>';
        return;
      }
      priceCart(items).then(function (p) {
        // scoate din coș produsele care nu mai există
        var valid = p.lines.map(function (l) { return l.id; });
        var cleaned = items.filter(function (i) { return valid.indexOf(i.id) !== -1; });
        if (cleaned.length !== items.length) setCart(cleaned);
        var lines = p.lines.map(function (l) {
          return '<li class="cart-line"><a href="/p/' + esc(l.slug) + '"><img src="' + esc(l.image) + '" alt="" width="84" height="84"></a>' +
            '<div><h3><a href="/p/' + esc(l.slug) + '">' + esc(l.title) + '</a></h3>' +
            '<div class="qty" data-line="' + l.id + '"><button type="button" data-d="-1" aria-label="Scade">−</button><input value="' + l.qty + '" readonly aria-label="Cantitate"><button type="button" data-d="1" aria-label="Crește">+</button></div> ' +
            '<button type="button" class="link-btn" data-remove="' + l.id + '">Șterge</button>' +
            (l.pct ? '<div class="line-save">Reducere pachet −' + l.pct + '%</div>' : '') + '</div>' +
            '<div class="line-total">' + money(l.total) + '</div></li>';
        }).join('');
        view.innerHTML = (p.errors.length ? '<p class="form-error">' + p.errors.map(esc).join('<br>') + '</p>' : '') +
          shipProgress(p) + '<ul class="cart-lines">' + lines + '</ul>' + couponHtml(p) + '<dl class="totals">' + totalsHtml(p) + '</dl>' +
          '<div class="cart-actions"><a class="btn btn-primary btn-xl btn-block" href="/finalizare">Finalizează comanda</a><a class="btn btn-ghost btn-block" href="/#produse">Continuă cumpărăturile</a></div>';
      });
    }
    bindCoupon(view, render);
    view.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t || t.hasAttribute('data-coupon-remove') || t.hasAttribute('data-coupon-apply')) return;
      var c = getCart();
      if (t.hasAttribute('data-remove')) {
        var rid = Number(t.getAttribute('data-remove'));
        setCart(c.filter(function (l) { return l.id !== rid; })); render(); return;
      }
      var wrap = t.closest('[data-line]');
      if (wrap) {
        var id = Number(wrap.getAttribute('data-line'));
        c.forEach(function (l) { if (l.id === id) l.qty = Math.max(1, Math.min(50, l.qty + Number(t.getAttribute('data-d')))); });
        setCart(c); render();
      }
    });
    render();
  })();

  /* ---------------- Finalizare comandă ---------------- */
  (function checkout() {
    var form = $('[data-checkout-form]');
    if (!form) return;
    var params = new URLSearchParams(location.search);
    var buy = params.get('buy');
    var fromCart = !buy;
    var items = fromCart ? getCart() : buy.split(',').map(function (s) { var p = s.split(':'); return { id: Number(p[0]), qty: Number(p[1]) || 1 }; });
    var linesEl = $('[data-summary-lines]');
    var couponEl = $('[data-summary-coupon]');
    var totalsEl = $('[data-summary-totals]');
    var errEl = $('[data-form-error]');
    var submitBtn = $('[data-submit]');
    var last = null;
    var tracked = false;

    if (!items.length) {
      linesEl.innerHTML = '<p>Coșul este gol. <a href="/#produse">Alege un produs</a>.</p>';
      submitBtn.disabled = true;
      return;
    }

    // păstrează datele completate dacă clientul revine (sau le ia din contul clientului)
    var saved = PAGE.customer || store.get('chimag_customer', {});
    ['name', 'phone', 'county', 'city', 'address', 'email', 'postalCode'].forEach(function (k) {
      if (saved[k] && form.elements[k] && !form.elements[k].value) form.elements[k].value = saved[k];
    });

    function opts() {
      var pay = form.elements.payment;
      return { payment: pay ? (pay.value || 'ramburs') : 'ramburs', bump: !!(form.elements.bump && form.elements.bump.checked) };
    }
    function refresh() {
      priceCart(items, opts()).then(function (p) {
        last = p;
        linesEl.innerHTML = (p.errors.length ? '<p class="form-error">' + p.errors.map(esc).join('<br>') + '</p>' : '') +
          p.lines.map(function (l) {
            return '<div class="summary-line"><img src="' + esc(l.image) + '" alt="" width="56" height="56"><div>' + esc(l.title) +
              '<div class="q">' + l.qty + ' buc.' + (l.pct ? ' · −' + l.pct + '%' : '') + '</div></div><strong>' + money(l.total) + '</strong></div>';
          }).join('');
        totalsEl.innerHTML = totalsHtml(p);
        if (couponEl) couponEl.innerHTML = couponHtml(p);
        if (p.coupon && p.coupon.ok) updatePromoBar(p.coupon);
        submitBtn.textContent = (opts().payment === 'card' ? 'Plătește ' : 'Plasează comanda · ') + money(p.total);
        if (!tracked && p.lines.length) {
          tracked = true;
          track('InitiateCheckout', { value: p.total / 100, contents: p.lines.map(function (l) { return { id: String(l.id), quantity: l.qty, price: l.unitPrice / 100, name: l.title }; }) });
        }
      });
    }
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
      if (!/^0[2-7]\d{8}$/.test(phone)) errors.phone = 'Număr de telefon invalid (ex: 0722 123 456).';
      if (!v('county')) errors.county = 'Alege județul.';
      if (v('city').length < 2) errors.city = 'Scrie localitatea.';
      if (v('address').length < 5) errors.address = 'Scrie adresa completă (stradă și număr).';
      if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) errors.email = 'Adresa de email nu pare corectă.';
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
        body: JSON.stringify({ items: items, customer: data, payment: o.payment, bump: o.bump, attribution: attribution(), coupon: store.get('chimag_coupon', '') }),
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.j && res.j.couponError) refresh();
          if (!res.ok || !res.j.redirect) throw new Error(res.j.error || 'Comanda nu a putut fi trimisă.');
          if (fromCart) setCart([]);
          if (store.get('chimag_coupon', '')) { store.del('chimag_coupon'); var w = store.get('chimag_wheel', null); if (w) { w.used = true; store.set('chimag_wheel', w); } }
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
      bar.innerHTML = '<div class="wrap">🎁 <strong>' + esc(info.label) + '</strong> se aplică automat la comandă' + t + '</div>';
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
      var mid = i * a + a / 2, tp = pt(mid, R * 0.6);
      var words = String(segs[i]).split(' ');
      var lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : (words.length === 2 && segs[i].length > 11 ? words : [segs[i]]);
      var fs = n > 8 ? 10 : n > 6 ? 11.5 : 13;
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

    function showLost() {
      var hub = $('.wheel-hub', modal); if (hub) { hub.textContent = '🙂'; hub.disabled = true; hub.setAttribute('aria-label', 'Roata a fost învârtită'); }
      copy.innerHTML = '<p class="wheel-lost">De data asta nu ai câștigat</p>' +
        '<h2 id="wheel-title">Mai mult noroc data viitoare!</h2>' +
        '<p>Poți comanda oricum, cu plata la livrare și retur în 14 zile.</p>' +
        '<a class="btn btn-primary btn-lg btn-block" href="/#produse" data-wheel-go>Vezi produsele</a>' +
        '<p class="wheel-legal"><a href="/pagina/regulament-roata">Regulament și șanse</a></p>';
      var go = $('[data-wheel-go]', copy);
      if (go) go.addEventListener('click', close);
    }
    function showResult(w, fresh) {
      if (w.nothing) return showLost();
      var hub = $('.wheel-hub', modal); if (hub) { hub.textContent = '🎉'; hub.disabled = true; hub.setAttribute('aria-label', 'Roata a fost învârtită'); }
      var exp = Date.parse(w.expiresAt);
      var cartN = getCart().length;
      copy.innerHTML = '<p class="wheel-won">' + (fresh ? '🎉 Felicitări! Ai câștigat' : 'Premiul tău') + '</p>' +
        '<h2 id="wheel-title">' + esc(w.label) + '</h2>' +
        ((w.description !== w.label || w.min) ? '<p>' + esc(w.description !== w.label ? w.description : 'Valabil') + (w.min ? ' la comenzi de minim ' + money(w.min) : '') + '.</p>' : '') +
        (w.used ? '<p class="wheel-note">Premiul a fost deja folosit la o comandă.</p>' :
          (exp < Date.now() ? '<p class="wheel-note">Premiul a expirat.</p>' :
            '<p class="wheel-code">Codul tău: <strong>' + esc(w.code) + '</strong></p><p class="wheel-note">Se aplică automat la comandă. Expiră ' +
              new Intl.DateTimeFormat('ro-RO', { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(exp) + '.</p>' +
              '<a class="btn btn-primary btn-lg btn-block" href="' + (cartN ? '/finalizare' : '/#produse') + '" data-wheel-go>' + (cartN ? 'Finalizează comanda' : 'Alege produsele') + '</a>')) +
        '<p class="wheel-legal"><a href="/pagina/regulament-roata">Regulament și șanse</a></p>';
      var go = $('[data-wheel-go]', copy);
      if (go) go.addEventListener('click', close);
    }

    var scrollY = 0;
    function lockScroll(on) {
      var b = document.body, h = document.documentElement;
      if (on) { scrollY = window.scrollY; b.style.top = -scrollY + 'px'; b.classList.add('no-scroll'); h.classList.add('no-scroll'); }
      else { b.classList.remove('no-scroll'); h.classList.remove('no-scroll'); b.style.top = ''; window.scrollTo(0, scrollY); }
    }
    // fereastra nu se derulează și nu lasă pagina din spate să se miște (mouse, touchpad, deget)
    ['wheel', 'touchmove'].forEach(function (ev) { modal.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });

    function open() {
      var w = store.get('chimag_wheel', null);
      modal.hidden = false;
      lockScroll(true);
      if (w) { rotateTo(w.index, false); showResult(w, false); }
      setTimeout(function () { var b = $('[data-wheel-spin]', modal) || $('[data-wheel-close]', modal); if (b) b.focus(); }, 50);
    }
    function close() {
      if (spinning) return;
      modal.hidden = true;
      lockScroll(false);
      if (!store.get('chimag_wheel', null)) store.set('chimag_wheel_later', Date.now());
    }

    function spin() {
      if (spinning || store.get('chimag_wheel', null)) return;
      spinning = true;
      $$('[data-wheel-spin]', modal).forEach(function (b) { b.disabled = true; });
      fetch('/api/roata', { method: 'POST' }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.error || 'Roata nu a putut fi învârtită.');
          var w = res.j;
          rotateTo(w.index, true);
          setTimeout(function () {
            spinning = false;
            store.set('chimag_wheel', w);
            updateDot();
            if (w.nothing) { showLost(); return; }
            store.set('chimag_coupon', w.code);
            updatePromoBar();
            confetti();
            showResult(w, true);
          }, 5800);
        })
        .catch(function (err) {
          spinning = false;
          $$('[data-wheel-spin]', modal).forEach(function (b) { b.disabled = false; });
          toast(esc(err.message));
        });
    }

    function updateDot() { var d = $('[data-wheel-dot]'); if (d) d.hidden = !!store.get('chimag_wheel', null); }
    updateDot();

    $$('[data-wheel-open]').forEach(function (b) { b.addEventListener('click', open); });
    $$('[data-wheel-close]', modal).forEach(function (b) { b.addEventListener('click', close); });
    $$('[data-wheel-spin]', modal).forEach(function (b) { b.addEventListener('click', spin); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });

    // apare singură la prima vizită (nu în timpul comenzii); dacă o închizi, revine după 24h
    if (/[?&]roata/.test(location.search)) { open(); return; }
    var later = store.get('chimag_wheel_later', 0);
    var skip = /^\/(finalizare|multumim|admin|pagina)/.test(location.pathname);
    if (W.autoOpen && !skip && !store.get('chimag_wheel', null) && Date.now() - later > 24 * 3600e3) {
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
