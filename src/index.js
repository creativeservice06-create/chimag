import { htmlResponse, json, redirect, normalizePhone, isEmail, isFakePhone, emailProblem, slugify } from './lib/util.js';
import { getSettings, listProducts, getProductBySlug, getProductById, getReviews, getOrder, getOrderItems, updateOrder, addOrderEvent } from './lib/db.js';
import { priceCart, bundlePct, splitParcels } from './lib/pricing.js';
import { createOrder, markPaid } from './lib/orders.js';
import { createCheckoutSession, verifyWebhook } from './lib/stripe.js';
import { sendServerPurchase } from './lib/tracking.js';
import { JUDETE } from './lib/judete.js';
import { layout } from './views/layout.js';
import { homePage, productPage, productJsonLd, checkoutPage, thankYouPage, notFoundPage } from './views/shop.js';
import { staticPage, PAGES } from './views/pages.js';
import { handleAdmin } from './admin.js';
import { handleFulfillmentApi } from './fulfillment-api.js';
import { syncTracking } from './cron.js';
import { hmac, timingSafeEqual } from './lib/auth.js';
import { getCookie } from './lib/util.js';
import { spinWheel, wheelConfig, wheelState } from './lib/coupons.js';
import { checkWheelUnlock, checkWheelUnlocks } from './lib/wheel-notify.js';
import { syncHelpship, sendToHelpship } from './lib/helpship.js';

// următorul prag de reducere la cantitate pentru un produs din coș (pentru mesajul „mai adaugă 1 și ai −10%")
function nextBundleTier(product, qty) {
  const cur = bundlePct(product, qty);
  const tiers = (product.bundles || []).map((b) => ({ qty: Number(b.qty), pct: Number(b.pct) || 0 }))
    .filter((b) => b.qty > qty && b.pct > cur && b.qty <= 50).sort((a, b) => a.qty - b.qty);
  if (!tiers.length) return null;
  const t = tiers[0];
  const total = Math.round(product.price * t.qty * (1 - t.pct / 100));
  return { qty: t.qty, add: t.qty - qty, pct: t.pct, total, unit: Math.round(total / t.qty), save: product.price * t.qty - total };
}
import { notifyOrderPlaced, notifyContact } from './lib/notify.js';
import { trackOrderPage, searchPage } from './views/shop.js';
import { currentCustomer } from './lib/customers.js';
import { handleAccount } from './account.js';

const siteUrl = (env, request) => (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');

async function page(env, request, opts, status = 200) {
  const settings = opts.settings || (await getSettings(env));
  const customer = opts.customer !== undefined ? opts.customer : await currentCustomer(request, env).catch(() => null);
  const { results: cats } = await env.DB.prepare("SELECT category AS name, COUNT(*) AS count FROM products WHERE active = 1 AND category != '' GROUP BY category ORDER BY MIN(sort), category").all();
  const categories = (cats || []).map((c) => ({ ...c, slug: slugify(c.name) }));
  const wheel = wheelConfig(settings).enabled ? await wheelState(env, settings, customer).catch(() => null) : null;
  return htmlResponse(layout({ ...opts, settings, customer, categories, wheelState: wheel, siteUrl: siteUrl(env, request) }), status, {
    'cache-control': 'no-store',
    ...(opts.noindex ? { 'x-robots-tag': 'noindex' } : {}),
  });
}

async function notFound(env, request) {
  return page(env, request, { title: 'Pagina nu există', body: notFoundPage() }, 404);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (err) {
      console.error(err?.stack || err);
      const isApi = new URL(request.url).pathname.startsWith('/api/');
      if (isApi) return json({ error: 'A apărut o eroare. Încearcă din nou.' }, 500);
      return htmlResponse('<meta charset="utf-8"><div style="font-family:system-ui;padding:40px;text-align:center"><h1>A apărut o eroare</h1><p>Reîncarcă pagina. Dacă problema persistă, contactează-ne.</p></div>', 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.allSettled([syncTracking(env), checkWheelUnlocks(env), syncHelpship(env)])
      .then(async () => { const { syncInvoices } = await import('./lib/invoices.js'); await syncInvoices(env, await getSettings(env)); }));
  },
};

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method;

  // Redirect http -> https și chimag.ro -> www.chimag.ro (după SITE_URL)
  if (env.SITE_URL && url.hostname !== 'localhost') {
    const canonicalHost = new URL(env.SITE_URL).host;
    const sameSite = url.host.replace(/^www\./, '') === canonicalHost.replace(/^www\./, '');
    const isHttp = url.protocol === 'http:' || request.headers.get('x-forwarded-proto') === 'http';
    if (sameSite && (url.host !== canonicalHost || isHttp)) {
      return Response.redirect(`https://${canonicalHost}${url.pathname}${url.search}`, 301);
    }
  }

  // ---------- Panoul de admin, ascuns ----------
  // Dacă ADMIN_PATH e setat (ex: "intrare-k7m2p9"), /admin pare o pagină inexistentă pentru oricine
  // nu a deschis întâi adresa secretă /intrare-k7m2p9 pe acel dispozitiv.
  const door = adminDoor(env);
  if (door && path === door.path) {
    return redirect('/admin/login', 303, { 'set-cookie': await door.cookie(url.protocol === 'https:'), 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  }
  if (path === '/admin' || path.startsWith('/admin/')) {
    if (door && !(await door.check(request))) return notFound(env, request);
    return handleAdmin(request, env, ctx, path);
  }
  if (path.startsWith('/api/fulfillment')) return handleFulfillmentApi(request, env, path);

  if (path === '/cont' || path.startsWith('/cont/')) {
    const r = await handleAccount(request, env, ctx, path, (opts, status) => page(env, request, opts, status));
    return r || notFound(env, request);
  }

  // ---------- Pagini magazin ----------
  if (method === 'GET' && path === '/') {
    const settings = await getSettings(env);
    const products = await listProducts(env);
    // categorii (cu poza primului produs)
    const catMap = new Map();
    for (const p of products) if (p.category) {
      const c = catMap.get(p.category) || { name: p.category, slug: slugify(p.category), count: 0, image: p.images[0] };
      c.count++; catMap.set(p.category, c);
    }
    // cele mai vândute (ultimele 90 de zile), doar dacă avem mai mult de 8 produse (altfel s-ar repeta lista)
    let bestsellers = [];
    if (products.length > 8) {
      const { results: top } = await env.DB.prepare(`SELECT i.product_id, SUM(i.qty) AS q FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE o.status != 'anulata' AND o.created_at > datetime('now','-90 days') GROUP BY i.product_id ORDER BY q DESC LIMIT 8`).all();
      const rank = new Map((top || []).map((t, i) => [t.product_id, i]));
      bestsellers = [...products].sort((a, b) => (rank.get(a.id) ?? 99 + a.sort) - (rank.get(b.id) ?? 99 + b.sort)).slice(0, 8);
    }
    const { results: reviews } = await env.DB.prepare(`SELECT r.*, p.title AS product, p.slug FROM reviews r JOIN products p ON p.id = r.product_id
      WHERE r.approved = 1 AND p.active = 1 AND r.rating >= 4 ORDER BY r.id DESC LIMIT 8`).all();
    return page(env, request, {
      settings, canonical: siteUrl(env, request) + '/', ogImage: products[0]?.images?.[0],
      body: homePage({ settings, products, categories: [...catMap.values()], bestsellers, reviews: reviews || [], wheelOn: wheelConfig(settings).enabled && settings.accounts_enabled !== '0' }),
    });
  }

  let m;
  if (method === 'GET' && (m = path.match(/^\/p\/([a-z0-9-]+)$/))) {
    const product = await getProductBySlug(env, m[1]);
    if (!product) return notFound(env, request);
    const settings = await getSettings(env);
    const reviews = await getReviews(env, product.id);
    const related = (await listProducts(env)).filter((p) => p.id !== product.id).slice(0, 4);
    const base = siteUrl(env, request);
    return page(env, request, {
      settings,
      title: product.title,
      description: product.subtitle || product.title,
      canonical: `${base}/p/${product.slug}`,
      ogImage: product.images[0],
      jsonLd: productJsonLd(product, reviews, base),
      pageData: { product: { id: product.id, price: product.price, title: product.title } },
      body: productPage({ settings, product, reviews, related, siteUrl: base }),
    });
  }

  // ---------- Căutare și categorii ----------
  if (method === 'GET' && path === '/cautare') {
    const settings = await getSettings(env);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    const all = await listProducts(env);
    const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const words = norm(q).split(/\s+/).filter(Boolean);
    const results = words.length ? all.filter((p) => {
      const hay = norm([p.title, p.subtitle, p.category, p.sku, p.description, p.benefits.join(' ')].join(' '));
      return words.every((w) => hay.includes(w));
    }) : [];
    return page(env, request, { settings, title: q ? `Caută: ${q}` : 'Caută', noindex: true, body: searchPage({ settings, q, products: results, all, mode: 'search' }) });
  }
  if (method === 'GET' && (m = path.match(/^\/categorie\/([a-z0-9-]+)$/))) {
    const settings = await getSettings(env);
    const all = await listProducts(env);
    const list = all.filter((p) => slugify(p.category) === m[1]);
    if (!list.length) return notFound(env, request);
    return page(env, request, { settings, title: list[0].category, canonical: `${siteUrl(env, request)}/categorie/${m[1]}`, body: searchPage({ settings, q: list[0].category, products: list, all, mode: 'category' }) });
  }

  // Coșul și finalizarea comenzii sunt aceeași pagină (/cos); adresa veche duce aici
  if (method === 'GET' && path === '/finalizare') return redirect('/cos' + url.search, 301);
  if (method === 'GET' && path === '/cos') {
    const settings = await getSettings(env);
    const bump = settings.bump_product_id ? await getProductById(env, Number(settings.bump_product_id)) : null;
    const me = await currentCustomer(request, env).catch(() => null);
    const prefill = me ? { name: me.name, email: me.email, phone: me.phone, county: me.county, city: me.city, address: me.address, postalCode: me.postal_code } : null;
    return page(env, request, { settings, customer: me, title: 'Coșul tău', noindex: true, pageData: prefill ? { customer: prefill } : null, body: checkoutPage({ settings, bump: bump?.active ? bump : null, loggedIn: !!me }) });
  }

  if (method === 'GET' && (m = path.match(/^\/multumim\/([a-f0-9]{32})$/))) {
    const order = await env.DB.prepare('SELECT * FROM orders WHERE token = ?').bind(m[1]).first();
    if (!order) return notFound(env, request);
    const settings = await getSettings(env);
    const items = await getOrderItems(env, order.id);
    const { results: invoices } = await env.DB.prepare('SELECT kind, full_number, issued_on, token, total FROM invoices WHERE order_id = ? ORDER BY id').bind(order.id).all().catch(() => ({ results: [] }));
    const { results: events } = await env.DB.prepare("SELECT message, created_at FROM order_events WHERE order_id = ? AND message LIKE 'Status:%' ORDER BY id").bind(order.id).all();
    const { itemImages } = await import('./emails.js');
    const products = await itemImages(env, items);
    return htmlResponse(layout({
      settings, siteUrl: siteUrl(env, request), title: `Comanda ${order.number}`,
      body: thankYouPage({ settings, order, items, payment: url.searchParams.get('plata'), invoices: invoices || [], events: events || [], products }),
    }), 200, { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
  }

  // Factura pentru client (link secret, din email și din pagina comenzii)
  if (method === 'GET' && (m = path.match(/^\/factura\/([a-f0-9]{32})$/))) {
    const { getInvoiceByToken } = await import('./lib/invoices.js');
    const inv = await getInvoiceByToken(env, m[1]);
    if (!inv) return notFound(env, request);
    const { invoicePdfResponse } = await import('./lib/invoice-pdf.js');
    return invoicePdfResponse(env, inv, url.searchParams.has('descarca'));
  }

  if (path === '/comanda' && (method === 'GET' || method === 'POST')) {
    const settings = await getSettings(env);
    let error = '';
    if (method === 'POST') {
      const form = await request.formData().catch(() => new FormData());
      const num = String(form.get('number') || '').trim().toUpperCase().replace(/\s/g, '');
      const phone = normalizePhone(form.get('phone'));
      const number = /^\d+$/.test(num) ? `CHI-${num}` : num;
      const o = phone && number ? await env.DB.prepare('SELECT token FROM orders WHERE number = ? AND phone = ?').bind(number, phone).first() : null;
      if (o) return redirect(`/multumim/${o.token}`);
      error = 'Nu am găsit nicio comandă cu acest număr și acest telefon. Verifică datele sau sună-ne.';
    }
    return page(env, request, { settings, title: 'Unde e comanda mea?', body: trackOrderPage({ settings, error }) });
  }

  if (method === 'GET' && (m = path.match(/^\/pagina\/([a-z-]+)$/))) {
    const settings = await getSettings(env);
    const p = staticPage(m[1], settings);
    if (!p) return notFound(env, request);
    return page(env, request, { settings, title: p.title, body: p.body });
  }

  // ---------- Imagini din R2 ----------
  if (method === 'GET' && path.startsWith('/media/')) {
    if (!env.MEDIA) return new Response('Not found', { status: 404 });
    const key = decodeURIComponent(path.slice('/media/'.length));
    const obj = await env.MEDIA.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(obj.body, { headers });
  }

  // ---------- SEO ----------
  if (path === '/robots.txt') {
    return new Response(`User-agent: *\nDisallow: /api/\nDisallow: /multumim/\nDisallow: /finalizare\nDisallow: /cos\nSitemap: ${siteUrl(env, request)}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
  }
  if (path === '/sitemap.xml') {
    const base = siteUrl(env, request);
    const products = await listProducts(env);
    const cats = [...new Set(products.map((p) => slugify(p.category)).filter(Boolean))];
    const urls = ['/', ...products.map((p) => `/p/${p.slug}`), ...cats.map((c) => `/categorie/${c}`), ...Object.keys(PAGES).map((k) => `/pagina/${k}`)];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join('')}</urlset>`;
    return new Response(xml, { headers: { 'content-type': 'application/xml' } });
  }

  // ---------- API magazin ----------
  if (method === 'POST' && path === '/api/cart') {
    const body = await request.json().catch(() => ({}));
    const settings = await getSettings(env);
    const me = body.coupon ? await currentCustomer(request, env).catch(() => null) : null;
    const p = await priceCart(env, settings, body.items || [], { paymentMethod: body.payment === 'card' ? 'card' : 'ramburs', bump: !!body.bump, coupon: body.coupon, customerId: me ? me.id : 0 });
    return json({
      lines: p.lines.map((l) => ({
        id: l.product.id, slug: l.product.slug, title: l.product.title, image: l.product.images[0] || '/img/placeholder.svg',
        qty: l.qty, unitPrice: l.unitPrice, pct: l.pct, lineDiscount: l.lineDiscount, total: l.total, isBump: l.isBump,
        nextTier: l.isBump ? null : nextBundleTier(l.product, l.qty),
        parcel: l.product.fulfillment === 'helpship' ? 'helpship' : 'own',
      })).filter((l) => !l.isBump || body.bump),
      subtotal: p.subtotal, discount: p.discount, couponDiscount: p.couponDiscount, coupon: p.coupon,
      shipping: p.shipping, codFee: p.codFee, total: p.total, freeShippingLeft: p.freeShippingLeft, errors: p.errors,
      split: splitParcels(p),
    });
  }

  if (method === 'POST' && path === '/api/comanda') return placeOrder(request, env, ctx);

  if (method === 'POST' && path === '/api/contact') return contactMessage(request, env, ctx);

  if (path === '/api/roata' && (method === 'GET' || method === 'POST')) {
    const settings = await getSettings(env);
    const me = await currentCustomer(request, env).catch(() => null);
    if (method === 'GET') return json(await wheelState(env, settings, me), 200, { 'cache-control': 'no-store' });
    const r = await spinWheel(env, settings, request.headers.get('cf-connecting-ip') || '', me);
    if (r.error) return json({ error: r.error, wheel: r.wheel || null }, r.status || 400);
    if (r.nothing === undefined) r.wheel = await wheelState(env, settings, me);
    return json(r);
  }

  if (method === 'POST' && (m = path.match(/^\/api\/comanda\/([a-f0-9]{32})\/(plata|ramburs)$/))) {
    const order = await env.DB.prepare('SELECT * FROM orders WHERE token = ?').bind(m[1]).first();
    if (!order || order.payment_status === 'platita' || order.status === 'anulata') return redirect(`/multumim/${m[1]}`);
    const settings = await getSettings(env);
    if (m[2] === 'ramburs') {
      const codFee = Number(settings.cod_fee) || 0;
      await updateOrder(env, order.id, { payment_method: 'ramburs', cod_fee: codFee, total: order.total - order.cod_fee + codFee });
      await addOrderEvent(env, order.id, 'Clientul a ales plata ramburs în loc de card.');
      const updated = await getOrder(env, order.id);
      ctx.waitUntil(Promise.allSettled([sendServerPurchase(env, settings, updated, await getOrderItems(env, order.id), siteUrl(env, request)), notifyOrderPlaced(env, settings, updated)]));
      return redirect(`/multumim/${m[1]}`);
    }
    const items = await getOrderItems(env, order.id);
    const lines = items.map((i) => ({ qty: i.qty, total: i.total, product: { title: i.title } }));
    const session = await createCheckoutSession(env, { order, lines, shipping: order.shipping, codFee: 0, siteUrl: siteUrl(env, request) });
    await updateOrder(env, order.id, { stripe_session_id: session.id });
    return redirect(session.url);
  }

  if (method === 'POST' && path === '/webhooks/stripe') {
    const payload = await request.text();
    if (!(await verifyWebhook(env, payload, request.headers.get('stripe-signature')))) return new Response('Semnătură invalidă', { status: 400 });
    const event = JSON.parse(payload);
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const s = event.data.object;
      if (s.payment_status === 'paid') {
        const orderId = Number(s.metadata?.order_id);
        const before = await getOrder(env, orderId);
        if (before && before.payment_status !== 'platita') {
          const order = await markPaid(env, orderId, s.id);
          const settings = await getSettings(env);
          const items = await getOrderItems(env, orderId);
          ctx.waitUntil(Promise.allSettled([
            sendServerPurchase(env, settings, order, items, siteUrl(env, request)),
            notifyOrderPlaced(env, settings, order),
          ]));
        }
      }
    }
    return json({ received: true });
  }

  // Fișierele statice sunt servite automat de Cloudflare înaintea acestui cod.
  if (env.ASSETS && method === 'GET') {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
  }
  return notFound(env, request);
}

// ---------- Plasare comandă ----------
async function placeOrder(request, env, ctx) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Date invalide.' }, 400);
  const c = body.customer || {};
  const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const customer = {
    name: clean(c.name, 100), phone: normalizePhone(c.phone), email: clean(c.email, 120).toLowerCase(),
    county: clean(c.county, 40), city: clean(c.city, 80), address: clean(c.address, 250),
    postalCode: clean(c.postalCode, 10), notes: clean(c.notes, 500),
  };
  if (customer.name.length < 3) return json({ error: 'Scrie numele complet.' }, 400);
  if (!customer.phone || isFakePhone(customer.phone)) return json({ error: 'Numărul de telefon nu este valid.' }, 400);
  if (!JUDETE.includes(customer.county)) return json({ error: 'Alege județul din listă.' }, 400);
  if (customer.city.length < 2 || customer.address.length < 5) return json({ error: 'Completează localitatea și adresa.' }, 400);
  { const ep = emailProblem(customer.email); if (ep) return json({ error: ep }, 400); }

  const settings = await getSettings(env);
  const paymentMethod = body.payment === 'card' && settings.card_enabled === '1' && env.STRIPE_SECRET_KEY ? 'card' : 'ramburs';
  const me = await currentCustomer(request, env).catch(() => null);
  const priced = await priceCart(env, settings, body.items || [], { paymentMethod, bump: !!body.bump, coupon: body.coupon, customerId: me ? me.id : 0 });
  if (priced.errors.length) return json({ error: priced.errors.join(' ') }, 409);
  if (body.coupon && priced.coupon && !priced.coupon.ok) return json({ error: `Codul ${priced.coupon.code}: ${priced.coupon.error} Scoate codul și încearcă din nou.`, couponError: true }, 409);
  if (!priced.lines.length) return json({ error: 'Coșul este gol.' }, 400);

  const ip = request.headers.get('cf-connecting-ip') || '';
  // Anti-spam: maxim 5 comenzi pe 10 minute de la același IP
  if (ip) {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE ip = ? AND created_at > datetime('now', '-10 minutes')").bind(ip).first();
    if (r.n >= 5) return json({ error: 'Prea multe comenzi într-un timp scurt. Sună-ne și te ajutăm imediat.' }, 429);
  }
  // Dublu-click / retrimitere: aceeași comandă în ultimele 2 minute
  const dup = await env.DB.prepare("SELECT token FROM orders WHERE phone = ? AND total = ? AND created_at > datetime('now', '-2 minutes') ORDER BY id DESC LIMIT 1")
    .bind(customer.phone, priced.total).first();
  if (dup && paymentMethod === 'ramburs') return json({ redirect: `/multumim/${dup.token}` });

  const a = body.attribution || {};
  const meta = {
    utm_source: clean(a.utm_source, 100), utm_medium: clean(a.utm_medium, 100), utm_campaign: clean(a.utm_campaign, 150),
    fbclid: clean(a.fbclid, 250), ttclid: clean(a.ttclid, 250), fbp: clean(a.fbp, 100), ttp: clean(a.ttp, 100),
    ip, ua: clean(request.headers.get('user-agent'), 300),
  };

  if (me && !customer.email) customer.email = me.email;
  meta.customerId = me ? me.id : 0;
  const created = await createOrder(env, { customer, priced, paymentMethod, meta });
  if (me) {
    // salvează adresa în cont dacă nu avea una
    if (!me.address) {
      await env.DB.prepare("UPDATE customers SET phone = CASE WHEN phone = '' THEN ? ELSE phone END, county = ?, city = ?, address = ?, postal_code = ? WHERE id = ?")
        .bind(customer.phone, customer.county, customer.city, customer.address, customer.postalCode, me.id).run();
    }
    await env.DB.prepare('INSERT INTO customer_events (customer_id, message) VALUES (?, ?)').bind(me.id, `Comandă plasată: ${created.number}`).run();
    ctx.waitUntil(checkWheelUnlock(env, settings, me.id).catch(() => {}));
  }
  const base = siteUrl(env, request);

  if (paymentMethod === 'card') {
    try {
      const order = await getOrder(env, created.id);
      const session = await createCheckoutSession(env, { order, lines: priced.lines, shipping: priced.shipping, codFee: 0, siteUrl: base });
      await updateOrder(env, created.id, { stripe_session_id: session.id });
      return json({ redirect: session.url });
    } catch (e) {
      await addOrderEvent(env, created.id, `Stripe: ${e.message}`);
      return json({ redirect: `/multumim/${created.token}?plata=eroare` });
    }
  }

  ctx.waitUntil((async () => {
    const order = await getOrder(env, created.id);
    const items = await getOrderItems(env, created.id);
    await Promise.allSettled([sendServerPurchase(env, settings, order, items, base), notifyOrderPlaced(env, settings, order),
      order.fulfillment_mode !== 'own' && settings.helpship_send !== 'confirmed' ? sendToHelpship(env, settings, order.id) : null]);
  })());
  return json({ redirect: `/multumim/${created.token}` });
}


// ---------- „Ușa" secretă spre admin ----------
function adminDoor(env) {
  const slug = String(env.ADMIN_PATH || '').trim().replace(/^\/+|\/+$/g, '');
  if (!slug || !env.SESSION_SECRET) return null;
  const COOKIE = 'chimag_door';
  const MAX_AGE = 60 * 60 * 24 * 365;
  const sign = () => hmac(env.SESSION_SECRET, `door:${slug}`); // schimbi ADMIN_PATH => toate cheile vechi devin invalide
  return {
    path: `/${slug}`,
    async cookie(secure) {
      return `${COOKIE}=${await sign()}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
    },
    async check(request) {
      const v = getCookie(request, COOKIE);
      return !!v && timingSafeEqual(v, await sign());
    },
  };
}

// ---------- Formular de contact ----------
async function contactMessage(request, env, ctx) {
  const isJson = (request.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await request.json().catch(() => ({})) : Object.fromEntries((await request.formData().catch(() => new FormData())).entries());
  const reply = (ok, error, status = 400) => (isJson
    ? json(ok ? { ok: true } : { error }, ok ? 200 : status)
    : redirect(ok ? '/pagina/contact?trimis=1' : `/pagina/contact?eroare=${encodeURIComponent(error)}`));
  const clean = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  if (body.website) return reply(true); // câmp capcană completat doar de roboți: ignorăm în liniște
  const msg = {
    name: clean(body.name, 80), email: clean(body.email, 120).toLowerCase(), phone: clean(body.phone, 30),
    order_number: clean(body.order_number, 20).toUpperCase(), subject: clean(body.subject, 60),
    message: String(body.message || '').trim().slice(0, 4000),
  };
  if (msg.name.length < 2) return reply(false, 'Scrie-ne numele tău.');
  if (msg.email && !isEmail(msg.email)) return reply(false, 'Adresa de email nu pare corectă.');
  const phone = msg.phone ? normalizePhone(msg.phone) : '';
  if (msg.phone && !phone) return reply(false, 'Numărul de telefon nu pare corect.');
  if (!msg.email && !phone) return reply(false, 'Lasă-ne un telefon sau un email, ca să-ți putem răspunde.');
  if (msg.message.length < 10) return reply(false, 'Mesajul e prea scurt. Spune-ne puțin mai mult.');
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (ip) {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE ip = ? AND created_at > datetime('now', '-1 hour')").bind(ip).first();
    if (r.n >= 5) return reply(false, 'Ai trimis deja mai multe mesaje. Te rugăm să ne suni.', 429);
  }
  const row = await env.DB.prepare(`INSERT INTO messages (name, email, phone, order_number, subject, message, ip) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(msg.name, msg.email, phone || '', msg.order_number, msg.subject, msg.message, ip).first();
  ctx.waitUntil((async () => {
    const settings = await getSettings(env);
    const r = await notifyContact(env, settings, { ...msg, phone: phone || '' });
    if (r.ok) await env.DB.prepare('UPDATE messages SET emailed = 1 WHERE id = ?').bind(row.id).run();
  })());
  return reply(true);
}


