import { htmlResponse, redirect, toBani, slugify, randomToken, normalizePhone } from './lib/util.js';
import { isAdmin, checkPassword, createSessionCookie, clearSessionCookie, sameOrigin } from './lib/auth.js';
import {
  getSettings, saveSettings, listProducts, getProductById, getOrder, getOrderItems, updateOrder, addOrderEvent,
  ORDER_STATUSES,
} from './lib/db.js';
import { setStatus, generateAwb, cancelAwb, setManualAwb } from './lib/orders.js';
import { getProvider } from './shipping/providers.js';
import { JUDETE } from './lib/judete.js';
import {
  adminLayout, loginView, dashboardView, ordersView, orderView, labelView, productsView, productFormView, settingsView,
} from './views/admin-views.js';

// Formular gol sau fără content-type nu trebuie să dea eroare
const readForm = (request) => request.formData().catch(() => new FormData());
const flashFrom = (url) => ({ ok: url.searchParams.get('ok'), err: url.searchParams.get('err') });
const withFlash = (path, type, msg) => `${path}${path.includes('?') ? '&' : '?'}${type}=${encodeURIComponent(msg)}`;

async function render(env, url, { title, active, body }) {
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'noua'").first();
  return htmlResponse(adminLayout({ title, active, body, flash: flashFrom(url), newCount: n?.n || 0 }), 200, {
    'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'x-frame-options': 'DENY',
  });
}

export async function handleAdmin(request, env, ctx, path) {
  const url = new URL(request.url);
  const method = request.method;
  const secure = url.protocol === 'https:';

  // ---------- Autentificare ----------
  if (path === '/admin/login') {
    if (method === 'POST') {
      const form = await readForm(request);
      if (checkPassword(env, form.get('password'))) {
        if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
          return htmlResponse(loginView(`Parola e corectă, dar SESSION_SECRET ${env.SESSION_SECRET ? `are doar ${env.SESSION_SECRET.length} caractere (minim 32)` : 'nu este setat'} în Cloudflare → Settings → Variables and Secrets.`), 500);
        }
        return redirect('/admin', 303, { 'set-cookie': await createSessionCookie(env, secure) });
      }
      await new Promise((r) => setTimeout(r, 800)); // încetinește încercările de ghicire
      return htmlResponse(loginView(env.ADMIN_PASSWORD ? 'Parolă greșită.' : 'ADMIN_PASSWORD nu este setată în Cloudflare.'), 401);
    }
    return htmlResponse(loginView(), 200, { 'x-robots-tag': 'noindex' });
  }
  if (!(await isAdmin(request, env))) return redirect('/admin/login', 303);
  if (method === 'POST' && !sameOrigin(request)) return new Response('Cerere respinsă (origine diferită).', { status: 403 });
  if (path === '/admin/logout' && method === 'POST') return redirect('/admin/login', 303, { 'set-cookie': clearSessionCookie() });

  const settings = await getSettings(env);
  let m;

  // ---------- Panou ----------
  if (path === '/admin' && method === 'GET') return render(env, url, { title: 'Panou', active: 'panou', body: dashboardView(await dashboardData(env)) });

  // ---------- Comenzi ----------
  if (path === '/admin/comenzi' && method === 'GET') {
    const status = ORDER_STATUSES[url.searchParams.get('status')] ? url.searchParams.get('status') : '';
    const q = (url.searchParams.get('q') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const per = 50;
    const { where, params } = orderFilter(status, q);
    const { results } = await env.DB.prepare(`SELECT * FROM orders ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .bind(...params, per + 1, (page - 1) * per).all();
    const counts = { _all: 0 };
    const { results: cr } = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all();
    for (const r of cr || []) { counts[r.status] = r.n; counts._all += r.n; }
    return render(env, url, {
      title: 'Comenzi', active: 'comenzi',
      body: ordersView({ orders: (results || []).slice(0, per), status, q, counts, page, hasMore: (results || []).length > per }),
    });
  }

  if (path === '/admin/comenzi/export.csv' && method === 'GET') {
    const status = ORDER_STATUSES[url.searchParams.get('status')] ? url.searchParams.get('status') : '';
    const { where, params } = orderFilter(status, (url.searchParams.get('q') || '').trim());
    const { results } = await env.DB.prepare(`SELECT * FROM orders ${where} ORDER BY id DESC LIMIT 5000`).bind(...params).all();
    const cols = ['number', 'created_at', 'status', 'payment_method', 'payment_status', 'customer_name', 'phone', 'email', 'county', 'city', 'address', 'total', 'awb', 'courier', 'utm_source', 'utm_campaign'];
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.join(';'), ...(results || []).map((o) => cols.map((c) => cell(c === 'total' ? (o.total / 100).toFixed(2).replace('.', ',') : o[c])).join(';'))];
    return new Response('﻿' + lines.join('\r\n'), {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="comenzi-${new Date().toISOString().slice(0, 10)}.csv"` },
    });
  }

  if (path === '/admin/comenzi/bulk' && method === 'POST') {
    const form = await readForm(request);
    const action = form.get('action');
    const ids = form.getAll('ids').map(Number).filter(Boolean).slice(0, 100);
    if (!ids.length) return redirect(withFlash('/admin/comenzi', 'err', 'Nu ai selectat nicio comandă.'));
    let ok = 0; const errors = [];
    for (const id of ids) {
      if (action === 'awb') {
        const r = await generateAwb(env, settings, id);
        if (r.ok) ok++; else errors.push(`#${id}: ${r.error}`);
      } else if (ORDER_STATUSES[action]) {
        await setStatus(env, settings, id, action); ok++;
      }
    }
    const back = request.headers.get('referer')?.includes('/admin/comenzi') ? new URL(request.headers.get('referer')).pathname + new URL(request.headers.get('referer')).search.replace(/[&?](ok|err)=[^&]*/g, '') : '/admin/comenzi';
    return redirect(withFlash(back, errors.length ? 'err' : 'ok', errors.length ? `${ok} reușite. Erori: ${errors.slice(0, 5).join(' · ')}` : `Gata: ${ok} comenzi actualizate.`));
  }

  if ((m = path.match(/^\/admin\/comenzi\/(\d+)$/)) && method === 'GET') {
    const order = await getOrder(env, Number(m[1]));
    if (!order) return redirect(withFlash('/admin/comenzi', 'err', 'Comanda nu există.'));
    const items = await getOrderItems(env, order.id);
    const { results: events } = await env.DB.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id DESC').bind(order.id).all();
    return render(env, url, { title: order.number, active: 'comenzi', body: orderView({ order, items, events: events || [], settings }) });
  }

  if ((m = path.match(/^\/admin\/comenzi\/(\d+)\/(status|client|awb|awb-anulare|awb-manual|incasat)$/)) && method === 'POST') {
    const id = Number(m[1]);
    const back = `/admin/comenzi/${id}`;
    const form = await readForm(request);
    switch (m[2]) {
      case 'status': {
        const s = form.get('status');
        if (!ORDER_STATUSES[s]) return redirect(withFlash(back, 'err', 'Status invalid.'));
        const { awbResult } = await setStatus(env, settings, id, s);
        if (awbResult && !awbResult.ok) return redirect(withFlash(back, 'err', `Status salvat, dar AWB-ul nu s-a generat: ${awbResult.error}`));
        return redirect(withFlash(back, 'ok', `Status: ${ORDER_STATUSES[s]}${awbResult?.awb ? ` · AWB ${awbResult.awb}` : ''}`));
      }
      case 'client': {
        const phone = normalizePhone(form.get('phone'));
        if (!phone) return redirect(withFlash(back, 'err', 'Telefon invalid.'));
        const county = JUDETE.includes(form.get('county')) ? form.get('county') : undefined;
        const fields = {
          customer_name: String(form.get('customer_name') || '').trim(), phone, email: String(form.get('email') || '').trim(),
          city: String(form.get('city') || '').trim(), address: String(form.get('address') || '').trim(),
          postal_code: String(form.get('postal_code') || '').trim(), notes: String(form.get('notes') || ''),
          admin_notes: String(form.get('admin_notes') || ''),
        };
        if (county) fields.county = county;
        await updateOrder(env, id, fields);
        await addOrderEvent(env, id, 'Datele clientului au fost editate.');
        return redirect(withFlash(back, 'ok', 'Datele au fost salvate.'));
      }
      case 'awb': {
        const r = await generateAwb(env, settings, id);
        return redirect(withFlash(back, r.ok ? 'ok' : 'err', r.ok ? (r.awb ? `AWB generat: ${r.awb}` : r.message) : r.error));
      }
      case 'awb-anulare': {
        const r = await cancelAwb(env, settings, id);
        return redirect(withFlash(back, r.ok ? 'ok' : 'err', r.ok ? 'AWB anulat.' : r.error));
      }
      case 'awb-manual':
        await setManualAwb(env, id, form.get('awb'), form.get('courier'));
        return redirect(withFlash(back, 'ok', 'AWB salvat.'));
      case 'incasat':
        await updateOrder(env, id, { payment_status: 'platita' });
        await addOrderEvent(env, id, 'Ramburs încasat.');
        return redirect(withFlash(back, 'ok', 'Marcat ca încasat.'));
    }
  }

  if ((m = path.match(/^\/admin\/comenzi\/(\d+)\/eticheta$/)) && method === 'GET') {
    const order = await getOrder(env, Number(m[1]));
    if (!order) return redirect('/admin/comenzi');
    // dacă furnizorul are etichetă PDF proprie, o folosim pe aceea
    if (order.awb) {
      if (order.label_url) return redirect(order.label_url, 302);
      try {
        const pdf = await getProvider(order.shipping_provider || settings.shipping_provider).getLabel(env, settings, order);
        if (pdf) return new Response(pdf.body, { headers: { 'content-type': pdf.headers.get('content-type') || 'application/pdf' } });
      } catch (e) {
        await addOrderEvent(env, order.id, `Eticheta de la curier nu s-a putut descărca: ${e.message}. S-a folosit eticheta internă.`);
      }
    }
    return htmlResponse(labelView({ order, items: await getOrderItems(env, order.id), settings }));
  }

  // ---------- Produse ----------
  if (path === '/admin/produse' && method === 'GET') {
    return render(env, url, { title: 'Produse', active: 'produse', body: productsView(await listProducts(env, { activeOnly: false })) });
  }
  if (path === '/admin/produse/nou' && method === 'GET') {
    return render(env, url, { title: 'Produs nou', active: 'produse', body: productFormView({ product: { active: 1, track_stock: 1, stock: 0, weight_g: 500, sort: 0, bundles: [{ qty: 1, pct: 0, label: '' }, { qty: 2, pct: 10, label: 'Cel mai ales' }] }, hasR2: !!env.MEDIA }) });
  }
  if ((m = path.match(/^\/admin\/produse\/(\d+)$/)) && method === 'GET') {
    const product = await getProductById(env, Number(m[1]));
    if (!product) return redirect(withFlash('/admin/produse', 'err', 'Produsul nu există.'));
    const { results: reviews } = await env.DB.prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC').bind(product.id).all();
    return render(env, url, { title: product.title, active: 'produse', body: productFormView({ product, reviews: reviews || [], hasR2: !!env.MEDIA }) });
  }
  if ((m = path.match(/^\/admin\/produse\/(nou|\d+)$/)) && method === 'POST') {
    return saveProduct(request, env, m[1] === 'nou' ? null : Number(m[1]));
  }
  if ((m = path.match(/^\/admin\/produse\/(\d+)\/sterge$/)) && method === 'POST') {
    await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(Number(m[1])).run();
    return redirect(withFlash('/admin/produse', 'ok', 'Produs șters.'));
  }
  if ((m = path.match(/^\/admin\/produse\/(\d+)\/recenzii$/)) && method === 'POST') {
    const form = await readForm(request);
    const text = String(form.get('text') || '').trim();
    const name = String(form.get('name') || '').trim();
    if (text && name) {
      await env.DB.prepare('INSERT INTO reviews(product_id, name, city, rating, text) VALUES (?, ?, ?, ?, ?)')
        .bind(Number(m[1]), name.slice(0, 60), String(form.get('city') || '').slice(0, 60), Math.min(5, Math.max(1, Number(form.get('rating')) || 5)), text.slice(0, 2000)).run();
    }
    return redirect(withFlash(`/admin/produse/${m[1]}`, 'ok', 'Recenzie adăugată.'));
  }
  if ((m = path.match(/^\/admin\/produse\/(\d+)\/recenzii\/(\d+)\/sterge$/)) && method === 'POST') {
    await env.DB.prepare('DELETE FROM reviews WHERE id = ? AND product_id = ?').bind(Number(m[2]), Number(m[1])).run();
    return redirect(withFlash(`/admin/produse/${m[1]}`, 'ok', 'Recenzie ștearsă.'));
  }

  // ---------- Setări ----------
  if (path === '/admin/setari' && method === 'GET') {
    const products = await listProducts(env, { activeOnly: false });
    const secrets = {
      smartship: !!(env.SMARTSHIP_API_URL && env.SMARTSHIP_API_KEY), helpship: !!(env.HELPSHIP_API_URL && env.HELPSHIP_API_KEY),
      warehouse: !!env.WAREHOUSE_API_KEY, stripe: !!env.STRIPE_SECRET_KEY, stripeWebhook: !!env.STRIPE_WEBHOOK_SECRET,
      fbCapi: !!env.FB_CAPI_TOKEN, ttEvents: !!env.TIKTOK_EVENTS_TOKEN,
    };
    return render(env, url, { title: 'Setări', active: 'setari', body: settingsView({ settings, products, secrets, siteUrl: (env.SITE_URL || url.origin).replace(/\/$/, '') }) });
  }
  if (path === '/admin/setari' && method === 'POST') {
    const form = await readForm(request);
    const text = ['store_name', 'tagline', 'announcement', 'phone', 'email', 'hours', 'company_name', 'company_cui', 'company_reg', 'company_address',
      'delivery_text', 'bump_product_id', 'fb_pixel_id', 'tiktok_pixel_id', 'shipping_provider', 'sender_name', 'sender_phone', 'sender_county',
      'sender_city', 'sender_address', 'parcel_contents'];
    const values = {};
    for (const k of text) values[k] = String(form.get(k) ?? '').trim().slice(0, 500);
    for (const k of ['shipping_cost', 'free_shipping_threshold', 'cod_fee']) values[k] = String(Math.max(0, toBani(form.get(k))));
    values.return_days = String(Math.max(14, Number(form.get('return_days')) || 14));
    values.bump_discount_pct = String(Math.min(90, Math.max(0, Number(form.get('bump_discount_pct')) || 0)));
    values.auto_awb_on_confirm = form.get('auto_awb_on_confirm') ? '1' : '0';
    values.card_enabled = form.get('card_enabled') ? '1' : '0';
    values.fb_pixel_id = values.fb_pixel_id.replace(/\D/g, '');
    values.tiktok_pixel_id = values.tiktok_pixel_id.replace(/[^A-Za-z0-9]/g, '');
    await saveSettings(env, values);
    const warn = values.card_enabled === '1' && !env.STRIPE_SECRET_KEY ? ' Atenție: plata cu cardul nu apare până nu setezi STRIPE_SECRET_KEY.' : '';
    return redirect(withFlash('/admin/setari', 'ok', 'Setările au fost salvate.' + warn));
  }

  return render(env, url, { title: 'Negăsit', active: '', body: '<h1>Pagina nu există</h1>' });
}

function orderFilter(status, q) {
  const cond = []; const params = [];
  if (status) { cond.push('status = ?'); params.push(status); }
  if (q) {
    const like = `%${q}%`;
    const digits = q.replace(/\D/g, '');
    cond.push('(number LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR awb LIKE ? OR email LIKE ?)');
    params.push(like, like, digits ? `%${digits}%` : like, like, like);
  }
  return { where: cond.length ? 'WHERE ' + cond.join(' AND ') : '', params };
}

async function dashboardData(env) {
  const sum = async (cond) => env.DB.prepare(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders
     WHERE status NOT IN ('anulata') AND NOT (payment_method='card' AND payment_status!='platita') AND ${cond}`).first();
  // "azi" în ora României
  const todayCond = "date(created_at, '+3 hours') = date('now', '+3 hours')";
  const [today, week, month] = await Promise.all([
    sum(todayCond), sum("created_at > datetime('now','-7 days')"), sum("created_at > datetime('now','-30 days')"),
  ]);
  const { results: dayRows } = await env.DB.prepare(
    `SELECT date(created_at, '+3 hours') AS d, COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue FROM orders
     WHERE status != 'anulata' AND NOT (payment_method='card' AND payment_status!='platita') AND created_at > datetime('now','-14 days')
     GROUP BY d`).all();
  const byDay = new Map((dayRows || []).map((r) => [r.d, r]));
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() + 3 * 3600e3 - i * 86400e3);
    const key = d.toISOString().slice(0, 10);
    const r = byDay.get(key) || { orders: 0, revenue: 0 };
    days.push({ label: key, short: `${d.getUTCDate()}`, orders: r.orders, revenue: r.revenue });
  }
  const { results: sc } = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all();
  const statusCounts = Object.fromEntries((sc || []).map((r) => [r.status, r.n]));
  const { results: dl } = await env.DB.prepare("SELECT status, COUNT(*) AS n FROM orders WHERE status IN ('livrata','refuzata','retur') AND created_at > datetime('now','-30 days') GROUP BY status").all();
  const delivery = Object.fromEntries((dl || []).map((r) => [r.status, r.n]));
  delivery.refuzata = (delivery.refuzata || 0) + (delivery.retur || 0);
  const { results: sources } = await env.DB.prepare(
    `SELECT CASE WHEN utm_source != '' THEN utm_source WHEN fbclid != '' THEN 'facebook' WHEN ttclid != '' THEN 'tiktok' ELSE 'direct' END AS source,
     COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE status != 'anulata' AND created_at > datetime('now','-30 days')
     GROUP BY source ORDER BY revenue DESC LIMIT 10`).all();
  const { results: top } = await env.DB.prepare(
    `SELECT i.title, SUM(i.qty) AS qty, SUM(i.total) AS revenue FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.status != 'anulata' AND o.created_at > datetime('now','-30 days') GROUP BY i.product_id, i.title ORDER BY revenue DESC LIMIT 8`).all();
  const { results: latest } = await env.DB.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 8').all();
  return { today, week, month, days, statusCounts, delivery, sources: sources || [], top: top || [], latest: latest || [] };
}

function parseLines(s) { return String(s || '').split('\n').map((x) => x.trim()).filter(Boolean); }
function parseFaq(s) {
  return String(s || '').split(/\n\s*\n/).map((block) => {
    const [q, ...a] = block.split('\n').map((x) => x.trim()).filter(Boolean);
    return q && a.length ? { q, a: a.join('\n') } : null;
  }).filter(Boolean);
}
function parseBundles(s) {
  const out = [];
  for (const line of parseLines(s)) {
    const [qty, pct, label] = line.split('|').map((x) => (x || '').trim());
    const q = Math.floor(Number(qty));
    if (q >= 1 && q <= 50) out.push({ qty: q, pct: Math.min(90, Math.max(0, Number(pct) || 0)), label: (label || '').slice(0, 40) });
  }
  return out.sort((a, b) => a.qty - b.qty);
}

async function saveProduct(request, env, id) {
  const form = await readForm(request);
  const title = String(form.get('title') || '').trim();
  const price = toBani(form.get('price'));
  const back = id ? `/admin/produse/${id}` : '/admin/produse/nou';
  if (!title || price <= 0) return redirect(withFlash(back, 'err', 'Numele și prețul sunt obligatorii.'));

  let images = parseLines(form.get('images')).filter((u) => /^(https?:\/\/|\/)/.test(u));
  // încărcare poze în R2
  if (env.MEDIA) {
    for (const file of form.getAll('upload')) {
      if (!file || typeof file === 'string' || !file.size) continue;
      if (file.size > 5 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) continue;
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
      const key = `produse/${slugify(title)}-${randomToken(4)}.${ext}`;
      await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      images.push(`/media/${key}`);
    }
  }

  let slug = slugify(form.get('slug') || title) || `produs-${Date.now()}`;
  const clash = await env.DB.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').bind(slug, id || 0).first();
  if (clash) slug = `${slug}-${randomToken(2)}`;

  const v = {
    slug, title: title.slice(0, 200), subtitle: String(form.get('subtitle') || '').trim().slice(0, 300),
    description: String(form.get('description') || '').slice(0, 20000), price,
    compare_at_price: toBani(form.get('compare_at_price')), cost_price: toBani(form.get('cost_price')),
    sku: String(form.get('sku') || '').trim().slice(0, 60), stock: Math.max(0, Math.floor(Number(form.get('stock')) || 0)),
    track_stock: form.get('track_stock') ? 1 : 0, weight_g: Math.max(1, Math.floor(Number(form.get('weight_g')) || 500)),
    images: JSON.stringify(images.slice(0, 20)), benefits: JSON.stringify(parseLines(form.get('benefits')).slice(0, 20)),
    faq: JSON.stringify(parseFaq(form.get('faq')).slice(0, 30)), bundles: JSON.stringify(parseBundles(form.get('bundles'))),
    badge: String(form.get('badge') || '').trim().slice(0, 30), category: String(form.get('category') || '').trim().slice(0, 60),
    active: form.get('active') ? 1 : 0, featured: form.get('featured') ? 1 : 0, sort: Math.floor(Number(form.get('sort')) || 0),
  };
  if (v.compare_at_price && v.compare_at_price <= v.price) v.compare_at_price = 0;

  const keys = Object.keys(v);
  if (id) {
    await env.DB.prepare(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...keys.map((k) => v[k]), id).run();
    return redirect(withFlash(`/admin/produse/${id}`, 'ok', 'Produs salvat.'));
  }
  const row = await env.DB.prepare(`INSERT INTO products (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) RETURNING id`)
    .bind(...keys.map((k) => v[k])).first();
  return redirect(withFlash(`/admin/produse/${row.id}`, 'ok', 'Produs creat.'));
}

