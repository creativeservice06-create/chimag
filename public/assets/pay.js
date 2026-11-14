// Plata cu cardul pe chimag.ro (Stripe Embedded Checkout)
(function () {
  var box = document.getElementById('stripe-checkout');
  if (!box) return;
  var err = document.getElementById('pay-error');
  function fail(msg) {
    box.innerHTML = ''; err.hidden = false; err.textContent = msg + ' ';
    var a = document.createElement('a'); a.href = '/multumim/' + box.getAttribute('data-token') + '?plata=anulata'; a.textContent = 'Vezi alte opțiuni de plată';
    err.appendChild(a);
  }
  if (!window.Stripe) { fail('Formularul de plată nu s-a putut încărca. Reîncarcă pagina sau alege plata la livrare.'); return; }
  var stripe = window.Stripe(box.getAttribute('data-pk'), { locale: 'ro' });
  var token = box.getAttribute('data-token');
  stripe.initEmbeddedCheckout({
    fetchClientSecret: function () {
      return fetch('/api/comanda/' + token + '/sesiune', { method: 'POST', headers: { 'content-type': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.redirect) { window.location.href = j.redirect; return new Promise(function () {}); }
          if (!j.clientSecret) throw new Error(j.error || 'Plata nu a putut porni.');
          return j.clientSecret;
        });
    }
  }).then(function (checkout) { box.innerHTML = ''; checkout.mount('#stripe-checkout'); })
    .catch(function (e) { fail((e && e.message) || 'Plata nu a putut porni. Încearcă din nou sau alege plata la livrare.'); });
})();
