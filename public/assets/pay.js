// Plata cu cardul pe chimag.ro.
// Varianta principală: câmpurile Stripe (Apple Pay / Google Pay + card) așezate de noi, fără rezumatul Stripe.
// Plasă de siguranță: dacă ceva nu pornește, trecem automat pe formularul Stripe întreg (varianta de dinainte).
(function () {
  var box = document.getElementById('stripe-checkout');
  if (!box) return;
  var err = document.getElementById('pay-error');
  var pk = box.getAttribute('data-pk');
  var token = box.getAttribute('data-token');
  var done = false; // după fallback nu mai atingem nimic din varianta nouă

  function log(m) { try { navigator.sendBeacon('/api/comanda/' + token + '/jurnal', String(m).slice(0, 300)); } catch (e) { /* */ } }
  function fail(msg) {
    var fa = document.querySelector('form.pay-alt'); if (fa) fa.hidden = false;
    box.innerHTML = ''; err.hidden = false; err.textContent = msg + ' ';
    var a = document.createElement('a'); a.href = '/cos'; a.textContent = 'Înapoi la comandă';
    err.appendChild(a);
  }
  function secret(ui) {
    return fetch('/api/comanda/' + token + '/sesiune' + (ui ? '?ui=' + ui : ''), { method: 'POST', headers: { 'content-type': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.redirect) { window.location.href = j.redirect; return new Promise(function () {}); }
        if (!j.clientSecret) throw new Error(j.error || 'Plata nu a putut porni.');
        return j.clientSecret;
      });
  }

  // ---------- varianta de rezervă: formularul Stripe întreg (Stripe.js v3) ----------
  function embedded() {
    if (done) return; done = true;
    log('fallback: pagina Stripe');
    box.className = ''; box.innerHTML = '<p class="pay-loading">Te ducem pe pagina de plată securizată Stripe…</p>';
    var f = document.querySelector('form.pay-alt');
    if (f) { f.submit(); return; }
    fail('Formularul de plată nu s-a putut încărca. Reîncarcă pagina sau alege plata la livrare.');
  }

  // ---------- varianta nouă ----------
  function elements() {
    var Stripe = window.Stripe;
    if (!Stripe) return embedded();
    var stripe = Stripe(pk, { locale: 'ro' });
    var init = stripe.initCheckoutElementsSdk || stripe.initCheckout;
    if (!init) return embedded();

    box.className = 'pe';
    box.innerHTML =
      '<div class="pe-express" id="pe-express"></div>' +
      '<div class="pe-or" id="pe-or" hidden><span>sau plătește cu cardul</span></div>' +
      '<div id="pe-payment"></div>' +
      '<button type="button" class="btn btn-primary btn-lg btn-block pe-pay" id="pe-pay" disabled>Se încarcă…</button>' +
      '<p class="pe-msg" id="pe-msg" role="alert" hidden></p>';
    var payBtn = document.getElementById('pe-pay');
    var msg = document.getElementById('pe-msg');
    function show(t) { msg.textContent = t || ''; msg.hidden = !t; }

    var checkout;
    try {
      checkout = init.call(stripe, {
        clientSecret: secret('elements'),
        elementsOptions: {
          fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' }],
          appearance: {
            theme: 'stripe',
            variables: { colorPrimary: '#155ecc', colorText: '#101d30', colorTextSecondary: '#56657a', colorDanger: '#b42318', fontFamily: 'Inter, system-ui, sans-serif', borderRadius: '10px', spacingUnit: '4px' },
          },
        },
      });
    } catch (e) { return embedded(); }

    // dacă în 20 de secunde formularul nu e gata, trecem pe varianta de rezervă
    var ready = false;
    var timer = setTimeout(function () { if (!ready) embedded(); }, 20000);
    // linkul spre pagina Stripe apare doar dacă formularul întârzie
    setTimeout(function () { var f = document.querySelector('form.pay-alt'); if (f && !ready) f.hidden = false; }, 8000);

    var actions = null;
    var canConfirm = false;
    function label(s) {
      try {
        var amount = s && s.total && s.total.total && s.total.total.amount;
        if (amount) payBtn.textContent = 'Plătește ' + amount;
      } catch (e) { /* păstrăm textul */ }
    }
    try {
      checkout.on('change', function (s) { if (done) return; canConfirm = !!(s && s.canConfirm); label(s); });
    } catch (e) { /* nu e obligatoriu */ }

    // Apple Pay / Google Pay sus; dacă nu se pot afișa acolo, apar ca opțiuni în formularul de card
    var express = null;
    try { express = checkout.createExpressCheckoutElement({ buttonHeight: 48 }); }
    catch (e1) { log('express opts: ' + (e1 && e1.message)); try { express = checkout.createExpressCheckoutElement(); } catch (e2) { log('express: ' + (e2 && e2.message)); express = null; } }
    if (express) {
      express.on('ready', function (ev) {
        var av = (ev && ev.availablePaymentMethods) || null;
        var any = !!av && Object.keys(av).some(function (k) { return av[k]; });
        document.getElementById('pe-or').hidden = !any;
        if (!any) { document.getElementById('pe-express').style.display = 'none'; log('express ready, none: ' + JSON.stringify(av)); }
        mountPay(any);
      });
      express.on('loaderror', function (ev) { log('express loaderror: ' + JSON.stringify((ev && ev.error) || ev).slice(0, 250)); });
      express.on('confirm', function (ev) {
        if (!actions) return;
        show('');
        actions.confirm({ expressCheckoutConfirmEvent: ev }).then(function (r) {
          if (r && r.type === 'error') show(r.error && r.error.message);
        });
      });
      try { express.mount('#pe-express'); } catch (e3) { log('express mount: ' + (e3 && e3.message)); express = null; }
    }
    // formularul de card: fără Apple/Google Pay dacă ele apar deja sus, altfel cu ele înăuntru
    var payMounted = false;
    var noCountry = false;
    var billing = { name: box.getAttribute('data-name') || undefined, address: { country: 'RO' } };
    function mountPay(walletsOnTop) {
      if (payMounted || done) return; payMounted = true;
      try {
        var opts = walletsOnTop ? { layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' } } : { layout: 'tabs' };
        // fără câmpul „Țară”: toate comenzile sunt din România, trimitem noi țara la plată
        var pay;
        pay = checkout.createPaymentElement(opts); noCountry = false;
        pay.on('ready', function () { if (done) return; ready = true; clearTimeout(timer); });
        pay.on('loaderror', function (ev) { log('payment loaderror: ' + JSON.stringify((ev && ev.error) || ev).slice(0, 250)); if (!ready) embedded(); });
        pay.mount('#pe-payment');
      } catch (e) { log('payment: ' + (e && e.message)); embedded(); }
    }
    if (!express) { document.getElementById('pe-express').style.display = 'none'; mountPay(false); }
    else setTimeout(function () { if (!payMounted) { log('express slow'); mountPay(false); } }, 6000);

    Promise.resolve(checkout.loadActions ? checkout.loadActions() : { type: 'success', actions: checkout })
      .then(function (r) {
        if (done) return;
        if (!r || r.type !== 'success') { embedded(); return; }
        actions = r.actions;
        try { label(actions.getSession ? actions.getSession() : null); } catch (e) { /* */ }
        payBtn.disabled = false;
        if (/Se încarcă/.test(payBtn.textContent)) payBtn.textContent = 'Plătește acum';
      })
      .catch(function () { embedded(); });

    payBtn.addEventListener('click', function () {
      if (!actions || payBtn.classList.contains('loading')) return;
      show('');
      var old = payBtn.textContent;
      payBtn.classList.add('loading'); payBtn.textContent = 'Se procesează plata…';
      var go = function () {
        if (!noCountry) return actions.confirm();
        try { return Promise.resolve(actions.confirm({ billingAddress: billing })); }
        catch (e) { log('confirm billing: ' + (e && e.message)); return actions.confirm(); }
      };
      go().then(function (r) {
        // dacă plata a reușit, Stripe ne duce singur la pagina comenzii
        if (r && r.type === 'error') show(r.error && r.error.message);
        payBtn.classList.remove('loading'); payBtn.textContent = old;
      }).catch(function (e) {
        log('confirm: ' + (e && e.message));
        payBtn.classList.remove('loading'); payBtn.textContent = old;
        // eroare de integrare (nu de card): trecem pe formularul Stripe întreg, ca clientul să poată plăti
        if (noCountry) { embedded(); return; }
        show('Plata nu a putut fi trimisă. Încearcă din nou.');
      });
    });
  }

  elements();
})();
