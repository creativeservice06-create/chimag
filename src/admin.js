import { htmlResponse, redirect, toBani, slugify, randomToken, normalizePhone } from './lib/util.js';
import { isAdmin, checkPassword, createSessionCookie, clearSessionCookie, sameOrigin } from './lib/auth.js';
import {
  getSettings, saveSettings, listProducts, getProductById, getOrder, getOrderItems, updateOrder, addOrderEvent,
  ORDER_STATUSES,
} from './lib/db.js';
import { setStatus, generateAwb, cancelAwb, setManualAwb, deleteOrder } from './lib/orders.js';
import { getProvider } from './shipping/providers.js';
import { JUDETE } from './lib/judete.js';
import {
  adminLayout, loginView, dashboardView, ordersView, orderView, labelView, productsView, productFormView, settingsView, couponsView, messagesView,
  customersView, customerFormView, customerView, invoicesView,
} from './views/admin-views.js';
import { COUPON_TYPES, CODE_TYPES, normalizeCode } from './lib/coupons.js';
import { emailStatus, sendEmail } from './lib/email.js';
import { testEmail, resetEmail } from './emails.js';
import { hashPassword, passwordProblem, issueToken, customerEvent, customerOrders } from './lib/customers.js';
import { sendMail } from './lib/email.js';

// Formular gol sau fără content-type nu trebuie să dea eroare
const readForm = (request) => request.formData().catch(() => new FormData());
const flashFrom = (url) => ({ ok: url.searchParams.get('ok'), err: url.searchParams.get('err') });
const withFlash = (path, type, msg) => `${path}${path.includes('?') ? '&' : '?'}${type}=${encodeURIComponent(msg)}`;

async function render(env, url, { title, active, body }) {
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'noua'").first();
  const msg = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE is_read = 0').first().catch(() => ({ n: 0 }));
  return htmlResponse(adminLayout({ title, active, body, flash: flashFrom(url), newCount: n?.n || 0, msgCount: msg?.n || 0 }), 200, {
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
  if (path === '/admin' && method === 'GET') {
    const { resolveRange, profitData, prevRange, periodStats } = await import('./lib/profit.js');
    const range = resolveRange(url.searchParams);
    const [profit, prev, stats, base] = await Promise.all([
      profitData(env, settings, range), profitData(env, settings, prevRange(range)), periodStats(env, range), dashboardData(env),
    ]);
    return render(env, url, { title: 'Panou', active: 'panou', body: dashboardView({ ...base, profit, prev, stats, range }) });
  }

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
        const r = await generateAwb(env, settings, id, { ctx });
        if (r.ok) ok++; else errors.push(`#${id}: ${r.error}`);
      } else if (action === 'sterge') {
        const r = await deleteOrder(env, settings, id);
        if (r.ok) ok++; else errors.push(`#${id}: ${r.error}`);
      } else if (ORDER_STATUSES[action]) {
        await setStatus(env, settings, id, action, { ctx }); ok++;
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
    const { getOrderInvoices, invoicingProblem } = await import('./lib/invoices.js');
    const invoices = await getOrderInvoices(env, order.id);
    return render(env, url, { title: order.number, active: 'comenzi', body: orderView({ order, items, events: events || [], settings, invoices, invProblem: invoicingProblem(settings), hsOn: !!(env.HELPSHIP_CLIENT_ID && env.HELPSHIP_CLIENT_SECRET && env.HELPSHIP_ACCOUNT_ID) }) });
  }

  if ((m = path.match(/^\/admin\/comenzi\/(\d+)\/sterge$/)) && method === 'POST') {
    const r = await deleteOrder(env, settings, Number(m[1]));
    return redirect(withFlash(r.ok ? '/admin/comenzi' : `/admin/comenzi/${m[1]}`, r.ok ? 'ok' : 'err', r.ok ? `Comanda ${r.number} a fost ștearsă definitiv.` : r.error));
  }

  // ---------- Facturi ----------
  if (path === '/admin/facturi/sterge' && method === 'POST') {
    const inv = await import('./lib/invoices.js');
    const form = await readForm(request);
    const ids = form.getAll('ids').map(Number).filter(Boolean).slice(0, 500);
    const n = await inv.deleteInvoices(env, settings, ids);
    const back = String(form.get('back') || '/admin/facturi');
    return redirect(withFlash(back.startsWith('/admin/') ? back : '/admin/facturi', n ? 'ok' : 'err', n ? `${n === 1 ? 'O factură a fost ștearsă' : `${n} facturi au fost șterse`}. Următorul număr: ${(await inv.nextInvoiceNumber(env, settings)).next}.` : 'Nu ai selectat nicio factură.'));
  }
  if ((m = path.match(/^\/admin\/comenzi\/(\d+)\/(factura|storno)$/)) && method === 'POST') {
    const inv = await import('./lib/invoices.js');
    const id = Number(m[1]);
    if (m[2] === 'factura') {
      const r = await inv.issueInvoice(env, settings, id);
      if (!r.ok) return redirect(withFlash(`/admin/comenzi/${id}`, 'err', r.error));
      let mailed = false;
      if (!r.existed && (await readForm(request)).get('email') === '1') {
        const { notifyInvoice } = await import('./lib/notify.js');
        mailed = await notifyInvoice(env, settings, await getOrder(env, id), r.invoice);
      }
      return redirect(withFlash(`/admin/comenzi/${id}`, 'ok', r.existed ? `Comanda are deja factura ${r.invoice.full_number}.` : `Factura ${r.invoice.full_number} a fost emisă${mailed ? ' și trimisă clientului pe email' : ''}.`));
    }
    const r = await inv.issueStorno(env, settings, id);
    return redirect(withFlash(`/admin/comenzi/${id}`, r.ok ? 'ok' : 'err', r.ok ? `Factura storno ${r.invoice.full_number} a fost emisă.` : r.error));
  }
  if (path.startsWith('/admin/facturi') && method === 'GET') {
    const inv = await import('./lib/invoices.js');
    const { resolveRange } = await import('./lib/profit.js');
    if ((m = path.match(/^\/admin\/facturi\/(\d+)$/))) {
      const one = await inv.getInvoiceById(env, Number(m[1]));
      if (!one) return redirect(withFlash('/admin/facturi', 'err', 'Factura nu există.'));
      const { invoicePdfResponse } = await import('./lib/invoice-pdf.js');
      return invoicePdfResponse(env, one, url.searchParams.has('descarca'));
    }
    const range = resolveRange(url.searchParams);
    const list = await inv.listInvoices(env, range.from, range.to);
    const cui = String(settings.company_cui || '').replace(/\s/g, '');
    const tag = `${range.from}_${range.to}`;
    if (path === '/admin/facturi/saga.xml') {
      if (!list.length) return redirect(withFlash(`/admin/facturi?de_la=${range.from}&pana_la=${range.to}`, 'err', 'Nicio factură în perioada aleasă.'));
      return new Response(inv.sagaXml(list), { headers: { 'content-type': 'application/xml; charset=utf-8', 'content-disposition': `attachment; filename="F_${cui}_facturi_${tag}.xml"`, 'cache-control': 'no-store' } });
    }
    if (path === '/admin/facturi/saga.zip') {
      if (!list.length) return redirect(withFlash(`/admin/facturi?de_la=${range.from}&pana_la=${range.to}`, 'err', 'Nicio factură în perioada aleasă.'));
      const zip = inv.zipFiles(list.map((f) => ({ name: inv.sagaFileName(f), content: inv.sagaXml([f]) })));
      return new Response(zip, { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="facturi-saga_${tag}.zip"`, 'cache-control': 'no-store' } });
    }
    if (path === '/admin/facturi') {
      return render(env, url, { title: 'Facturi', active: 'facturi', body: invoicesView({ list, range, settings, problem: inv.invoicingProblem(settings), next: await inv.nextInvoiceNumber(env, settings) }) });
    }
  }

  if ((m = path.match(/^\/admin\/comenzi\/(\d+)\/helpship$/)) && method === 'POST') {
    const { sendToHelpship } = await import('./lib/helpship.js');
    const r = await sendToHelpship(env, await getSettings(env), Number(m[1]), { force: true });
    return redirect(withFlash(`/admin/comenzi/${m[1]}`, r.ok ? 'ok' : 'err', r.ok ? 'Comanda a fost trimisă la Helpship.' : r.error));
  }
  if ((m = path.match(/^\/admin\/comenzi\/(\d+)\/(status|client|awb|awb-anulare|awb-manual|incasat)$/)) && method === 'POST') {
    const id = Number(m[1]);
    const back = `/admin/comenzi/${id}`;
    const form = await readForm(request);
    switch (m[2]) {
      case 'status': {
        const s = form.get('status');
        if (!ORDER_STATUSES[s]) return redirect(withFlash(back, 'err', 'Status invalid.'));
        const { awbResult } = await setStatus(env, settings, id, s, { ctx });
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
        const r = await generateAwb(env, settings, id, { ctx });
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

  // ---------- Clienți ----------
  if (path === '/admin/clienti' && method === 'GET') {
    const filter = ['activi', 'neconfirmati', 'dezactivati'].includes(url.searchParams.get('f')) ? url.searchParams.get('f') : '';
    const q = (url.searchParams.get('q') || '').trim();
    const cond = []; const params = [];
    if (filter === 'activi') cond.push('c.active = 1 AND c.email_verified = 1');
    if (filter === 'neconfirmati') cond.push('c.active = 1 AND c.email_verified = 0');
    if (filter === 'dezactivati') cond.push('c.active = 0');
    if (q) { cond.push('(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q.replace(/\D/g, '') || q}%`); }
    const { results } = await env.DB.prepare(`SELECT c.*,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id OR (c.email_verified = 1 AND o.email = c.email COLLATE NOCASE)) AS orders,
        (SELECT COALESCE(SUM(total),0) FROM orders o WHERE (o.customer_id = c.id OR (c.email_verified = 1 AND o.email = c.email COLLATE NOCASE)) AND o.status != 'anulata') AS spent
      FROM customers c ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY c.id DESC LIMIT 300`).bind(...params).all();
    const cnt = await env.DB.prepare(`SELECT COUNT(*) AS allc, SUM(active = 1 AND email_verified = 1) AS a, SUM(active = 1 AND email_verified = 0) AS n, SUM(active = 0) AS d FROM customers`).first();
    return render(env, url, { title: 'Clienți', active: 'clienti', body: customersView({ customers: results || [], q, filter, counts: { all: cnt.allc, activi: cnt.a || 0, neconfirmati: cnt.n || 0, dezactivati: cnt.d || 0 } }) });
  }
  if (path === '/admin/clienti/nou') {
    const emailOk = emailStatus(env).customers;
    if (method === 'GET') return render(env, url, { title: 'Client nou', active: 'clienti', body: customerFormView({ emailOk }) });
    const form = await readForm(request);
    const values = { name: String(form.get('name') || '').trim().slice(0, 80), email: String(form.get('email') || '').trim().toLowerCase().slice(0, 120), phone: String(form.get('phone') || '').trim() };
    const fail = (error) => render(env, url, { title: 'Client nou', active: 'clienti', body: customerFormView({ error, values, emailOk }) });
    if (values.name.length < 3) return fail('Scrie numele complet.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) return fail('Email invalid.');
    const phone = values.phone ? normalizePhone(values.phone) : '';
    if (values.phone && !phone) return fail('Telefon invalid.');
    const pw = String(form.get('password') || '');
    if (pw && passwordProblem(pw)) return fail(passwordProblem(pw));
    if (!pw && !emailOk) return fail('Setează o parolă: emailurile nu sunt configurate, deci clientul nu poate primi link.');
    if (await env.DB.prepare('SELECT id FROM customers WHERE email = ?').bind(values.email).first()) return fail('Există deja un client cu acest email.');
    const c = await env.DB.prepare('INSERT INTO customers (name, email, phone, password_hash, email_verified) VALUES (?, ?, ?, ?, ?) RETURNING *')
      .bind(values.name, values.email, phone || '', pw ? await hashPassword(env, pw) : '', pw ? 1 : 0).first();
    await customerEvent(env, c.id, 'Cont creat din panoul de administrare.');
    if (!pw) {
      const token = await issueToken(env, c.id, 'invite', 24 * 7);
      const base = (env.SITE_URL || url.origin).replace(/\/$/, '');
      const r = await sendMail(env, settings, { to: c.email, ...resetEmail(settings, base, c, `${base}/cont/resetare/${token}`, true) });
      await customerEvent(env, c.id, r.ok ? 'Invitație de setare a parolei trimisă pe email.' : `Invitația nu a putut fi trimisă: ${r.error}`);
      return redirect(withFlash(`/admin/clienti/${c.id}`, r.ok ? 'ok' : 'err', r.ok ? `Client creat. I-am trimis pe email un link ca să-și aleagă parola.` : `Client creat, dar emailul nu a plecat: ${r.error}`));
    }
    return redirect(withFlash(`/admin/clienti/${c.id}`, 'ok', 'Client creat.'));
  }
  if ((m = path.match(/^\/admin\/clienti\/(\d+)$/))) {
    const c = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(Number(m[1])).first();
    if (!c) return redirect(withFlash('/admin/clienti', 'err', 'Clientul nu există.'));
    if (method === 'GET') {
      const orders = await customerOrders(env, c);
      const { results: events } = await env.DB.prepare('SELECT * FROM customer_events WHERE customer_id = ? ORDER BY id DESC LIMIT 200').bind(c.id).all();
      const ok = orders.filter((o) => o.status !== 'anulata');
      const stats = { orders: orders.length, spent: ok.reduce((t, o) => t + o.total, 0), delivered: orders.filter((o) => o.status === 'livrata').length, refused: orders.filter((o) => o.status === 'refuzata' || o.status === 'retur').length };
      return render(env, url, { title: c.name, active: 'clienti', body: customerView({ c, orders, events: events || [], stats, emailOk: emailStatus(env).customers }) });
    }
    const form = await readForm(request);
    const back = `/admin/clienti/${c.id}`;
    const email = String(form.get('email') || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return redirect(withFlash(back, 'err', 'Email invalid.'));
    if (email !== c.email.toLowerCase() && (await env.DB.prepare('SELECT id FROM customers WHERE email = ? AND id != ?').bind(email, c.id).first())) return redirect(withFlash(back, 'err', 'Alt client are deja acest email.'));
    const phoneRaw = String(form.get('phone') || '').trim();
    const phone = phoneRaw ? normalizePhone(phoneRaw) : '';
    if (phoneRaw && !phone) return redirect(withFlash(back, 'err', 'Telefon invalid.'));
    const county = JUDETE.includes(form.get('county')) ? form.get('county') : '';
    await env.DB.prepare(`UPDATE customers SET name = ?, email = ?, phone = ?, county = ?, city = ?, address = ?, postal_code = ?, admin_notes = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(String(form.get('name') || c.name).trim().slice(0, 80), email, phone || '', county, String(form.get('city') || '').trim(), String(form.get('address') || '').trim(), String(form.get('postal_code') || '').trim(), String(form.get('admin_notes') || ''), c.id).run();
    const pw = String(form.get('password') || '');
    if (pw) {
      if (passwordProblem(pw)) return redirect(withFlash(back, 'err', passwordProblem(pw)));
      await env.DB.prepare('UPDATE customers SET password_hash = ? WHERE id = ?').bind(await hashPassword(env, pw), c.id).run();
      await customerEvent(env, c.id, 'Parolă schimbată de administrator.');
    }
    await customerEvent(env, c.id, 'Date modificate de administrator.');
    return redirect(withFlash(back, 'ok', 'Salvat.'));
  }
  if ((m = path.match(/^\/admin\/clienti\/(\d+)\/(dezactiveaza|activeaza|reseteaza|confirma|sterge)$/)) && method === 'POST') {
    const c = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(Number(m[1])).first();
    if (!c) return redirect('/admin/clienti');
    const back = `/admin/clienti/${c.id}`;
    switch (m[2]) {
      case 'dezactiveaza':
        await env.DB.prepare('UPDATE customers SET active = 0 WHERE id = ?').bind(c.id).run();
        await customerEvent(env, c.id, 'Cont dezactivat de administrator.');
        return redirect(withFlash(back, 'ok', 'Contul a fost dezactivat. Clientul nu se mai poate autentifica.'));
      case 'activeaza':
        await env.DB.prepare('UPDATE customers SET active = 1 WHERE id = ?').bind(c.id).run();
        await customerEvent(env, c.id, 'Cont reactivat de administrator.');
        return redirect(withFlash(back, 'ok', 'Contul a fost reactivat.'));
      case 'confirma':
        await env.DB.prepare('UPDATE customers SET email_verified = 1 WHERE id = ?').bind(c.id).run();
        await customerEvent(env, c.id, 'Email marcat ca confirmat de administrator.');
        return redirect(withFlash(back, 'ok', 'Email marcat ca confirmat.'));
      case 'reseteaza': {
        const token = await issueToken(env, c.id, 'reset', 24);
        const base = (env.SITE_URL || url.origin).replace(/\/$/, '');
        const r = await sendMail(env, settings, { to: c.email, ...resetEmail(settings, base, c, `${base}/cont/resetare/${token}`) });
        await customerEvent(env, c.id, r.ok ? 'Link de resetare a parolei trimis de administrator.' : `Linkul de resetare nu a putut fi trimis: ${r.error}`);
        return redirect(withFlash(back, r.ok ? 'ok' : 'err', r.ok ? `Link trimis la ${c.email}.` : `Emailul nu a plecat: ${r.error}`));
      }
      case 'sterge':
        await env.DB.batch([
          env.DB.prepare('UPDATE orders SET customer_id = 0 WHERE customer_id = ?').bind(c.id),
          env.DB.prepare('DELETE FROM customer_events WHERE customer_id = ?').bind(c.id),
          env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(c.id),
        ]);
        return redirect(withFlash('/admin/clienti', 'ok', `Contul ${c.email} a fost șters.`));
    }
  }

  // ---------- Mesaje ----------
  if (path === '/admin/mesaje' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 200').all();
    return render(env, url, { title: 'Mesaje', active: 'mesaje', body: messagesView({ messages: results || [], email: emailStatus(env), settings }) });
  }
  if ((m = path.match(/^\/admin\/mesaje\/(\d+)\/(citit|necitit|sterge)$/)) && method === 'POST') {
    const id = Number(m[1]);
    if (m[2] === 'sterge') await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();
    else await env.DB.prepare('UPDATE messages SET is_read = ? WHERE id = ?').bind(m[2] === 'citit' ? 1 : 0, id).run();
    return redirect('/admin/mesaje');
  }
  if (path === '/admin/mesaje/test-email' && method === 'POST') {
    const r = await sendEmail(env, settings, testEmail(settings, (env.SITE_URL || url.origin).replace(/\/$/, '')));
    return redirect(withFlash('/admin/mesaje', r.ok ? 'ok' : 'err', r.ok ? `Email de test trimis la ${settings.contact_email}. Verifică și folderul Spam.` : `Emailul nu a plecat: ${r.error}`));
  }

  // ---------- Roată și coduri ----------
  if (path === '/admin/coduri' && method === 'GET') {
    const filter = ['manual', 'roata', 'folosite'].includes(url.searchParams.get('f')) ? url.searchParams.get('f') : 'manual';
    const where = filter === 'folosite' ? "WHERE used_count > 0 AND type != 'nimic'" : "WHERE source = ? AND type != 'nimic'";
    const stmt = env.DB.prepare(`SELECT * FROM coupons ${where} ORDER BY id DESC LIMIT 200`);
    const { results: coupons } = await (filter === 'folosite' ? stmt : stmt.bind(filter)).all();
    const spins = await env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN used_count > 0 THEN 1 ELSE 0 END),0) AS used FROM coupons WHERE source = 'roata' AND created_at > datetime('now','-30 days')").first();
    const ord = await env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(coupon_discount),0) AS discount FROM orders WHERE coupon_code != '' AND status != 'anulata' AND created_at > datetime('now','-30 days')").first();
    return render(env, url, {
      title: 'Roată și coduri', active: 'coduri',
      body: couponsView({ settings, coupons: coupons || [], filter, stats: { spins: spins.n, wheelUsed: spins.used, orders: ord.n, revenue: ord.revenue, discount: ord.discount } }),
    });
  }
  if (path === '/admin/coduri/roata' && method === 'POST') {
    const form = await readForm(request);
    const labels = form.getAll('p_label'), types = form.getAll('p_type'), vals = form.getAll('p_value'), weights = form.getAll('p_weight'), mins = form.getAll('p_min');
    const prizes = [];
    for (let i = 0; i < labels.length; i++) {
      const label = String(labels[i] || '').trim().slice(0, 24);
      if (!label) continue;
      const type = COUPON_TYPES[types[i]] ? types[i] : 'procent';
      let value = 0;
      if (type === 'procent') value = Math.min(90, Math.max(0, Math.round(Number(String(vals[i]).replace(',', '.')) || 0)));
      if (type === 'lei') value = Math.max(0, toBani(vals[i]));
      if ((type === 'procent' || type === 'lei') && !value) return redirect(withFlash('/admin/coduri', 'err', `Premiul „${label}" nu are valoare.`));
      prizes.push({ label, type, value, weight: Math.max(0, Number(String(weights[i]).replace(',', '.')) || 0), min: Math.max(0, toBani(mins[i])) });
    }
    const active = prizes.filter((p) => p.weight > 0);
    if (form.get('wheel_enabled') && active.length < 2) return redirect(withFlash('/admin/coduri', 'err', 'Roata are nevoie de cel puțin 2 premii cu pondere mai mare ca 0.'));
    await saveSettings(env, {
      wheel_enabled: form.get('wheel_enabled') ? '1' : '0',
      wheel_auto_open: form.get('wheel_auto_open') ? '1' : '0',
      wheel_delay: String(Math.min(120, Math.max(0, Number(form.get('wheel_delay')) || 0))),
      wheel_hours: String(Math.min(720, Math.max(1, Number(form.get('wheel_hours')) || 2))),
      wheel_min_third: String(Math.max(0, toBani(form.get('wheel_min_third'))) || 25000),
      wheel_title: String(form.get('wheel_title') || '').trim().slice(0, 80),
      wheel_prizes: JSON.stringify(prizes),
    });
    return redirect(withFlash('/admin/coduri', 'ok', 'Roata a fost salvată.'));
  }
  if (path === '/admin/coduri/nou' && method === 'POST') {
    const form = await readForm(request);
    const code = normalizeCode(form.get('code'));
    const type = CODE_TYPES.includes(form.get('type')) ? form.get('type') : 'procent';
    if (code.length < 3) return redirect(withFlash('/admin/coduri', 'err', 'Codul trebuie să aibă cel puțin 3 caractere (litere, cifre sau cratimă).'));
    let value = 0;
    if (type === 'procent') value = Math.min(90, Math.max(0, Math.round(Number(String(form.get('value') || '').replace(',', '.')) || 0)));
    if (type === 'lei') value = Math.max(0, toBani(form.get('value')));
    if ((type === 'procent' || type === 'lei') && !value) return redirect(withFlash('/admin/coduri', 'err', 'Completează valoarea reducerii.'));
    const exp = String(form.get('expires') || '');
    const expires = /^\d{4}-\d{2}-\d{2}$/.test(exp) ? `${exp} 20:59:59` : ''; // sfârșitul zilei, ora României
    try {
      await env.DB.prepare(`INSERT INTO coupons (code, label, type, value, min_order, max_uses, expires_at, source) VALUES (?, '', ?, ?, ?, ?, ?, 'manual')`)
        .bind(code, type, value, Math.max(0, toBani(form.get('min_order'))), Math.max(0, Math.floor(Number(form.get('max_uses')) || 0)), expires).run();
    } catch {
      return redirect(withFlash('/admin/coduri', 'err', `Codul ${code} există deja.`));
    }
    return redirect(withFlash('/admin/coduri', 'ok', `Codul ${code} a fost creat.`));
  }
  if ((m = path.match(/^\/admin\/coduri\/(\d+)\/(comuta|sterge)$/)) && method === 'POST') {
    const id = Number(m[1]);
    if (m[2] === 'comuta') await env.DB.prepare('UPDATE coupons SET active = 1 - active WHERE id = ?').bind(id).run();
    else await env.DB.prepare('DELETE FROM coupons WHERE id = ? AND used_count = 0').bind(id).run();
    const back = request.headers.get('referer') ? new URL(request.headers.get('referer')).pathname + new URL(request.headers.get('referer')).search.replace(/[&?](ok|err)=[^&]*/g, '') : '/admin/coduri';
    return redirect(withFlash(back, 'ok', m[2] === 'comuta' ? 'Cod actualizat.' : 'Cod șters.'));
  }

  // ---------- Setări ----------
  if (path === '/admin/setari' && method === 'GET') {
    const products = await listProducts(env, { activeOnly: false });
    const secrets = {
      smartship: !!(env.SMARTSHIP_API_URL && env.SMARTSHIP_API_KEY), helpship: !!(env.HELPSHIP_API_URL && env.HELPSHIP_API_KEY), helpshipApi: !!(env.HELPSHIP_CLIENT_ID && env.HELPSHIP_CLIENT_SECRET && env.HELPSHIP_ACCOUNT_ID),
      warehouse: !!env.WAREHOUSE_API_KEY, stripe: !!env.STRIPE_SECRET_KEY, stripeWebhook: !!env.STRIPE_WEBHOOK_SECRET,
      fbCapi: !!env.FB_CAPI_TOKEN, ttEvents: !!env.TIKTOK_EVENTS_TOKEN,
    };
    secrets.email = emailStatus(env);
    const { nextInvoiceNumber } = await import('./lib/invoices.js');
    const invNext = await nextInvoiceNumber(env, settings).catch(() => ({ series: settings.inv_series || 'CHI', next: 1 }));
    return render(env, url, { title: 'Setări', active: 'setari', body: settingsView({ settings, products, secrets, invNext, siteUrl: (env.SITE_URL || url.origin).replace(/\/$/, '') }) });
  }
  if (path === '/admin/setari' && method === 'POST') {
    const form = await readForm(request);
    const text = ['store_name', 'tagline', 'announcement', 'phone', 'email', 'hours', 'company_name', 'company_cui', 'company_reg', 'company_address',
      'contact_email', 'whatsapp', 'facebook_url', 'instagram_url', 'tiktok_url',
      'delivery_text', 'bump_product_id', 'fb_pixel_id', 'tiktok_pixel_id', 'shipping_provider', 'sender_name', 'sender_phone', 'sender_county',
      'sender_city', 'sender_address', 'parcel_contents', 'company_bank', 'company_iban', 'company_capital'];
    const values = {};
    for (const k of text) values[k] = String(form.get(k) ?? '').trim().slice(0, 500);
    for (const k of ['shipping_cost', 'free_shipping_threshold', 'cod_fee', 'cost_courier', 'cost_helpship']) values[k] = String(Math.max(0, toBani(form.get(k))));
    values.return_days = String(Math.max(14, Number(form.get('return_days')) || 14));
    values.bump_discount_pct = String(Math.min(90, Math.max(0, Number(form.get('bump_discount_pct')) || 0)));
    values.auto_awb_on_confirm = form.get('auto_awb_on_confirm') ? '1' : '0';
    values.helpship_send = form.get('helpship_send') === 'confirmed' ? 'confirmed' : 'placed';
    values.card_enabled = form.get('card_enabled') ? '1' : '0';
    // facturare
    values.inv_enabled = form.get('inv_enabled') ? '1' : '0';
    values.inv_series = String(form.get('inv_series') || 'CHI').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CHI';
    values.inv_trigger = ['expediata', 'livrata', 'manual'].includes(form.get('inv_trigger')) ? form.get('inv_trigger') : 'expediata';
    values.inv_vat_payer = form.get('inv_vat_payer') === '1' ? '1' : '0';
    values.inv_vat_rate = String(Math.min(30, Math.max(0, Number(String(form.get('inv_vat_rate') || '21').replace(',', '.')) || 0)));
    const since = String(form.get('inv_since') || '');
    values.inv_since = /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : (values.inv_enabled === '1' && !settings.inv_since ? (await import('./lib/profit.js')).roToday() : settings.inv_since || '');
    const nextNo = Math.floor(Number(form.get('inv_next')) || 0);
    let invWarn = '';
    if (nextNo > 0 && String(nextNo) !== String(form.get('inv_next_orig') || '')) {
      const used = await env.DB.prepare('SELECT COALESCE(MAX(number), 0) AS n FROM invoices WHERE series = ?').bind(values.inv_series).first().catch(() => ({ n: 0 }));
      if (nextNo <= (used?.n || 0)) invWarn = ` Numărul ${nextNo} e deja folosit în seria ${values.inv_series}; următorul rămâne ${(used?.n || 0) + 1}.`;
      else {
        values.inv_start = String(nextNo);
        await env.DB.prepare('INSERT INTO counters(name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value').bind('inv_' + values.inv_series, nextNo - 1).run();
      }
    }
    values.notify_orders = form.get('notify_orders') ? '1' : '0';
    values.customer_emails = form.get('customer_emails') ? '1' : '0';
    values.accounts_enabled = form.get('accounts_enabled') ? '1' : '0';
    for (const k of ['facebook_url', 'instagram_url', 'tiktok_url']) if (values[k] && !/^https:\/\//.test(values[k])) values[k] = '';
    values.fb_pixel_id = values.fb_pixel_id.replace(/\D/g, '');
    values.tiktok_pixel_id = values.tiktok_pixel_id.replace(/[^A-Za-z0-9]/g, '');
    await saveSettings(env, values);
    const warn = values.card_enabled === '1' && !env.STRIPE_SECRET_KEY ? ' Atenție: plata cu cardul nu apare până nu setezi STRIPE_SECRET_KEY.' : '';
    const { invoicingProblem } = await import('./lib/invoices.js');
    if (values.inv_enabled === '1') { const pb = invoicingProblem({ ...settings, ...values }); if (pb) invWarn += ` Facturile nu se pot emite încă: ${pb}`; }
    return redirect(withFlash('/admin/setari', invWarn ? 'err' : 'ok', 'Setările au fost salvate.' + warn + invWarn));
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

function parseSections(text) {
  return String(text || '').replace(/\r/g, '').split(/\n\s*---\s*\n/).map((block) => {
    const lines = block.split('\n');
    const title = (lines.shift() || '').trim().slice(0, 150);
    let image = '';
    if (/^(https?:\/\/|\/)\S+$/.test((lines[0] || '').trim())) image = lines.shift().trim().slice(0, 500);
    const t = lines.join('\n').trim().slice(0, 4000);
    return title || image || t ? { title, image, text: t } : null;
  }).filter(Boolean).slice(0, 12);
}

const dim = (v) => Math.min(500, Math.max(0, Math.round((Number(String(v || '').replace(',', '.')) || 0) * 10) / 10));

function parseSpecs(text) {
  return parseLines(text).map((l) => { const i = l.indexOf(':'); return i > 0 ? { k: l.slice(0, i).trim().slice(0, 60), v: l.slice(i + 1).trim().slice(0, 300) } : null; })
    .filter((x) => x && x.k && x.v).slice(0, 30);
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
    length_cm: dim(form.get('length_cm')), width_cm: dim(form.get('width_cm')), height_cm: dim(form.get('height_cm')),
    images: JSON.stringify(images.slice(0, 20)), benefits: JSON.stringify(parseLines(form.get('benefits')).slice(0, 20)),
    faq: JSON.stringify(parseFaq(form.get('faq')).slice(0, 30)), bundles: JSON.stringify(parseBundles(form.get('bundles'))),
    sections: JSON.stringify(parseSections(form.get('sections'))),
    specs: JSON.stringify(parseSpecs(form.get('specs'))),
    fulfillment: form.get('fulfillment') === 'helpship' ? 'helpship' : '',
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

