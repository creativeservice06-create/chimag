import { htmlResponse, json, redirect, normalizePhone, isEmail } from './lib/util.js';
import { getSettings, listProducts, getProductBySlug, getProductById, getReviews, getOrder, getOrderItems, updateOrder, addOrderEvent } from './lib/db.js';
import { priceCart } from './lib/pricing.js';
import { createOrder, markPaid } from './lib/orders.js';
import { createCheckoutSession, verifyWebhook } from './lib/stripe.js';
import { sendServerPurchase } from './lib/tracking.js';
import { JUDETE } from './lib/judete.js';
import { layout } from './views/layout.js';
import { homePage, productPage, productJsonLd, cartPage, checkoutPage, thankYouPage, notFoundPage } from './views/shop.js';
import { staticPage, PAGES } from './views/pages.js';
import { handleAdmin } from './admin.js';
import { handleFulfillmentApi } from './fulfillment-api.js';
import { syncTracking } from './cron.js';
import { spinWheel } from './lib/coupons.js';

const siteUrl = (env, request) => (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');

async function page(env, request, opts, status = 200) {
  const settings = opts.settings || (await getSettings(env));
  return htmlResponse(layout({ ...opts, settings, siteUrl: siteUrl(env, request) }), status, {
    'cache-control': 'no-store',
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
    ctx.waitUntil(syncTracking(env));
  },
};

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method;

  // Redirect chimag.ro -> www.chimag.ro (sau invers, după SITE_URL)
  if (env.SITE_URL) {
    const canonicalHost = new URL(env.SITE_URL).host;
    if (url.host !== canonicalHost && url.host.replace(/^www\./, '') === canonicalHost.replace(/^www\./, '')) {
      return Response.redirect(`https://${canonicalHost}${url.pathname}${url.search}`, 301);
    }
  }

  if (path === '/admin' || path.startsWith('/admin/')) return handleAdmin(request, env, ctx, path);
  if (path.startsWith('/api/fulfillment')) return handleFulfillmentApi(request, env, path);

  // ---------- Pagini magazin ----------
  if (method === 'GET' && path === '/') {
    const settings = await getSettings(env);
    const products = await listProducts(env);
    return page(env, request, { settings, body: homePage({ settings, products }), canonical: siteUrl(env, request) + '/', ogImage: products[0]?.images?.[0] });
  }

  let m;
  if (method === 'GET' && (m = path.match(/^\/p\/([a-z0-9-]+)$/))) {
    const product = await getProductBySlug(env, m[1]);
    if (!product) return notFound(env, request);
    const settings = await getSettings(env);
    const reviews = await getReviews(env, product.id);
    const base = siteUrl(env, request);
    return page(env, request, {
      settings,
      title: product.title,
      description: product.subtitle || product.title,
      canonical: `${base}/p/${product.slug}`,
      ogImage: product.images[0],
      jsonLd: productJsonLd(product, reviews, base),
      pageData: { product: { id: product.id, price: product.price, title: product.title } },
      body: productPage({ settings, product, reviews, siteUrl: base }),
    });
  }

  if (method === 'GET' && path === '/cos') return page(env, request, { title: 'Coș', body: cartPage() });

  if (method === 'GET' && path === '/finalizare') {
    const settings = await getSettings(env);
    const bump = settings.bump_product_id ? await getProductById(env, Number(settings.bump_product_id)) : null;
    return page(env, request, { settings, title: 'Finalizare comandă', body: checkoutPage({ settings, bump: bump?.active ? bump : null }) });
  }

  if (method === 'GET' && (m = path.match(/^\/multumim\/([a-f0-9]{32})$/))) {
    const order = await env.DB.prepare('SELECT * FROM orders WHERE token = ?').bind(m[1]).first();
    if (!order) return notFound(env, request);
    const settings = await getSettings(env);
    const items = await getOrderItems(env, order.id);
    return htmlResponse(layout({
      settings, siteUrl: siteUrl(env, request), title: `Comanda ${order.number}`,
      body: thankYouPage({ settings, order, items, payment: url.searchParams.get('plata') }),
    }), 200, { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
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
    return new Response(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /multumim/\nDisallow: /finalizare\nSitemap: ${siteUrl(env, request)}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
  }
  if (path === '/sitemap.xml') {
    const base = siteUrl(env, request);
    const products = await listProducts(env);
    const urls = ['/', ...products.map((p) => `/p/${p.slug}`), ...Object.keys(PAGES).map((k) => `/pagina/${k}`)];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join('')}</urlset>`;
    return new Response(xml, { headers: { 'content-type': 'application/xml' } });
  }

  // ---------- API magazin ----------
  if (method === 'POST' && path === '/api/cart') {
    const body = await request.json().catch(() => ({}));
    const settings = await getSettings(env);
    const p = await priceCart(env, settings, body.items || [], { paymentMethod: body.payment === 'card' ? 'card' : 'ramburs', bump: !!body.bump, coupon: body.coupon });
    return json({
      lines: p.lines.map((l) => ({
        id: l.product.id, slug: l.product.slug, title: l.product.title, image: l.product.images[0] || '/img/placeholder.svg',
        qty: l.qty, unitPrice: l.unitPrice, pct: l.pct, lineDiscount: l.lineDiscount, total: l.total, isBump: l.isBump,
      })).filter((l) => !l.isBump || body.bump),
      subtotal: p.subtotal, discount: p.discount, couponDiscount: p.couponDiscount, coupon: p.coupon,
      shipping: p.shipping, codFee: p.codFee, total: p.total, freeShippingLeft: p.freeShippingLeft, errors: p.errors,
    });
  }

  if (method === 'POST' && path === '/api/comanda') return placeOrder(request, env, ctx);

  if (method === 'POST' && path === '/api/roata') {
    const settings = await getSettings(env);
    const r = await spinWheel(env, settings, request.headers.get('cf-connecting-ip') || '');
    if (r.error) return json({ error: r.error }, r.status || 400);
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
      ctx.waitUntil(sendServerPurchase(env, settings, updated, await getOrderItems(env, order.id), siteUrl(env, request)));
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
          ctx.waitUntil(sendServerPurchase(env, settings, order, await getOrderItems(env, orderId), siteUrl(env, request)));
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
  if (!customer.phone) return json({ error: 'Numărul de telefon nu este valid.' }, 400);
  if (!JUDETE.includes(customer.county)) return json({ error: 'Alege județul din listă.' }, 400);
  if (customer.city.length < 2 || customer.address.length < 5) return json({ error: 'Completează localitatea și adresa.' }, 400);
  if (customer.email && !isEmail(customer.email)) return json({ error: 'Adresa de email nu este validă.' }, 400);

  const settings = await getSettings(env);
  const paymentMethod = body.payment === 'card' && settings.card_enabled === '1' && env.STRIPE_SECRET_KEY ? 'card' : 'ramburs';
  const priced = await priceCart(env, settings, body.items || [], { paymentMethod, bump: !!body.bump, coupon: body.coupon });
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
    fbclid: clean(a.fbclid, 250), ttclid: clean(a.ttclid, 250), fbp: clean(a.fbp, 100),
    ip, ua: clean(request.headers.get('user-agent'), 300),
  };

  const created = await createOrder(env, { customer, priced, paymentMethod, meta });
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
    await sendServerPurchase(env, settings, order, await getOrderItems(env, created.id), base);
  })());
  return json({ redirect: `/multumim/${created.token}` });
}

