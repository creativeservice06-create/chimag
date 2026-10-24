import { redirect, normalizePhone, isEmail, sha256Hex } from './lib/util.js';
import { raw } from './lib/html.js';
import { getSettings } from './lib/db.js';
import { sameOrigin } from './lib/auth.js';
import { JUDETE } from './lib/judete.js';
import {
  hashPassword, verifyPassword, passwordProblem, sessionCookie, clearSessionCookie, currentCustomer,
  issueToken, consumeToken, customerEvent, tooManyAttempts, recordAttempt, customerOrders,
} from './lib/customers.js';
import { sendMail, emailStatus } from './lib/email.js';
import { verifyEmail, resetEmail } from './emails.js';
import { wheelState } from './lib/coupons.js';
import { registerView, loginView, forgotView, resetView, accountView } from './views/account-views.js';

// Rutele /cont/... (conturi de client). `page` randează o pagină în aspectul magazinului.
export async function handleAccount(request, env, ctx, path, page) {
  const url = new URL(request.url);
  const method = request.method;
  const settings = await getSettings(env);
  if (settings.accounts_enabled === '0') return null; // conturile sunt oprite din admin => 404
  if (method === 'POST' && !sameOrigin(request)) return new Response('Cerere respinsă.', { status: 403 });
  const secure = url.protocol === 'https:';
  const base = (env.SITE_URL || url.origin).replace(/\/$/, '');
  const ip = request.headers.get('cf-connecting-ip') || '';
  const form = method === 'POST' ? await request.formData().catch(() => new FormData()) : null;
  const val = (k, n = 200) => String(form?.get(k) || '').trim().slice(0, n);
  const render = (title, body, status = 200) => page({ settings, title, body, noindex: true }, status);
  const me = await currentCustomer(request, env);
  // întoarcere după cont (ex: din roata norocului): doar căi interne, opțional cu ?roata
  const safeNext = (v) => (/^\/[a-z0-9/_-]*(\?roata)?$/i.test(v || '') ? v : '');
  let m;

  const sendVerify = async (c) => {
    const token = await issueToken(env, c.id, 'verify', 48);
    const mail = verifyEmail(settings, base, c, `${base}/cont/confirmare/${token}`);
    const p = sendMail(env, settings, { to: c.email, ...mail });
    ctx.waitUntil(p.then((r) => r.ok && customerEvent(env, c.id, 'Email de confirmare trimis.')).catch(() => {}));
  };

  // ---------- Înregistrare ----------
  if (path === '/cont/inregistrare') {
    const next = safeNext(url.searchParams.get('next') || val('next'));
    if (me) return redirect(next || '/cont');
    if (method === 'GET') return render('Creează cont', registerView({ next }));
    const values = { name: val('name', 80), email: val('email', 120).toLowerCase(), phone: val('phone', 30) };
    const fail = (error) => render('Creează cont', registerView({ error, values, next }), 400);
    if (values.name.length < 3) return fail('Scrie numele complet.');
    if (!isEmail(values.email)) return fail('Adresa de email nu este validă.');
    const phone = values.phone ? normalizePhone(values.phone) : '';
    if (values.phone && !phone) return fail('Numărul de telefon nu este valid.');
    const pp = passwordProblem(form.get('password'));
    if (pp) return fail(pp);
    if (!form.get('terms')) return fail('Trebuie să accepți termenii și politica de confidențialitate.');
    if (await tooManyAttempts(env, [`reg:${ip}`], 5)) return fail('Prea multe încercări. Mai încearcă peste 15 minute.');
    await recordAttempt(env, [`reg:${ip}`]);
    const exists = await env.DB.prepare('SELECT id FROM customers WHERE email = ?').bind(values.email).first();
    if (exists) return fail('Există deja un cont cu acest email. Intră în cont sau folosește „Ai uitat parola?".');
    const hash = await hashPassword(env, String(form.get('password')));
    const c = await env.DB.prepare('INSERT INTO customers (name, email, phone, password_hash) VALUES (?, ?, ?, ?) RETURNING *')
      .bind(values.name, values.email, phone || '', hash).first();
    await customerEvent(env, c.id, `Cont creat de client${ip ? ` (IP ${ip})` : ''}.`);
    await sendVerify(c);
    return redirect(next || '/cont?nou=1', 303, { 'set-cookie': await sessionCookie(env, c, secure) });
  }

  // ---------- Autentificare ----------
  if (path === '/cont/autentificare') {
    const next = safeNext(url.searchParams.get('next') || val('next')) || '/cont';
    if (me) return redirect(next);
    if (method === 'GET') {
      const notice = url.searchParams.get('parola') ? 'Parola a fost schimbată. Intră cu parola nouă.' : '';
      return render('Intră în cont', loginView({ next, notice }));
    }
    const email = val('email', 120).toLowerCase();
    const fail = (error) => render('Intră în cont', loginView({ error, values: { email }, next }), 400);
    if (await tooManyAttempts(env, [`ip:${ip}`, `em:${email}`])) return fail('Prea multe încercări greșite. Mai încearcă peste 15 minute sau resetează parola.');
    const c = isEmail(email) ? await env.DB.prepare('SELECT * FROM customers WHERE email = ?').bind(email).first() : null;
    const ok = c && c.password_hash && (await verifyPassword(env, String(form.get('password') || ''), c.password_hash));
    if (!ok) { await recordAttempt(env, [`ip:${ip}`, `em:${email}`]); return fail('Email sau parolă greșită.'); }
    if (!c.active) return fail('Contul este dezactivat. Contactează-ne dacă e o greșeală.');
    await env.DB.prepare("UPDATE customers SET last_login = datetime('now') WHERE id = ?").bind(c.id).run();
    await customerEvent(env, c.id, 'Autentificare în cont.');
    return redirect(next, 303, { 'set-cookie': await sessionCookie(env, c, secure) });
  }

  if (path === '/cont/iesire' && method === 'POST') return redirect('/', 303, { 'set-cookie': clearSessionCookie() });

  // ---------- Confirmare email ----------
  if ((m = path.match(/^\/cont\/confirmare\/([a-f0-9]{48})$/)) && method === 'GET') {
    const c = await consumeToken(env, m[1], 'verify');
    if (!c) return render('Confirmare email', html404('Linkul de confirmare a expirat sau a fost deja folosit.', me ? '/cont' : '/cont/autentificare'), 400);
    await env.DB.prepare('UPDATE customers SET email_verified = 1 WHERE id = ?').bind(c.id).run();
    await customerEvent(env, c.id, 'Email confirmat.');
    return redirect('/cont?confirmat=1', 303, me ? {} : { 'set-cookie': await sessionCookie(env, c, secure) });
  }

  // ---------- Parolă uitată / resetare ----------
  if (path === '/cont/parola-uitata') {
    if (method === 'GET') return render('Parolă uitată', forgotView());
    const email = val('email', 120).toLowerCase();
    if (await tooManyAttempts(env, [`fp:${ip}`], 5)) return render('Parolă uitată', forgotView({ error: 'Prea multe cereri. Mai încearcă peste 15 minute.' }), 429);
    await recordAttempt(env, [`fp:${ip}`]);
    const c = isEmail(email) ? await env.DB.prepare('SELECT * FROM customers WHERE email = ? AND active = 1').bind(email).first() : null;
    if (c) {
      const token = await issueToken(env, c.id, 'reset', 1);
      ctx.waitUntil(sendMail(env, settings, { to: c.email, ...resetEmail(settings, base, c, `${base}/cont/resetare/${token}`) })
        .then((r) => customerEvent(env, c.id, r.ok ? 'Link de resetare a parolei trimis.' : 'Cerere resetare parolă (emailul nu a putut fi trimis).')));
    }
    return render('Parolă uitată', forgotView({ sent: true })); // același răspuns, ca să nu dezvăluim ce emailuri există
  }

  if ((m = path.match(/^\/cont\/resetare\/([a-f0-9]{48})$/))) {
    const token = m[1];
    if (method === 'GET') {
      const exists = await env.DB.prepare("SELECT id FROM customers WHERE token_hash = ? AND token_type IN ('reset','invite') AND token_expires > datetime('now')").bind(await sha256Hex(token)).first();
      return render('Parolă nouă', resetView({ token, invalid: !exists }));
    }
    const pp = passwordProblem(form.get('password'));
    if (pp) return render('Parolă nouă', resetView({ token, error: pp }), 400);
    if (form.get('password') !== form.get('password2')) return render('Parolă nouă', resetView({ token, error: 'Parolele nu coincid.' }), 400);
    const c = (await consumeToken(env, token, 'reset')) || (await consumeToken(env, token, 'invite'));
    if (!c) return render('Parolă nouă', resetView({ token, invalid: true }), 400);
    await env.DB.prepare("UPDATE customers SET password_hash = ?, email_verified = 1, updated_at = datetime('now') WHERE id = ?")
      .bind(await hashPassword(env, String(form.get('password'))), c.id).run();
    await env.DB.prepare('DELETE FROM login_attempts WHERE k = ?').bind(`em:${c.email.toLowerCase()}`).run(); // ridică blocarea după resetare
    await customerEvent(env, c.id, 'Parolă setată prin link de email.');
    return redirect('/cont/autentificare?parola=1');
  }

  // ---------- De aici în jos: doar clienți autentificați ----------
  if (!me) return redirect(`/cont/autentificare?next=${encodeURIComponent(path)}`);

  if (path === '/cont' && method === 'GET') {
    const notice = url.searchParams.get('nou') ? 'Contul tău a fost creat. Ți-am trimis un email de confirmare.'
      : url.searchParams.get('confirmat') ? 'Adresa de email a fost confirmată. Mulțumim!'
      : url.searchParams.get('salvat') ? 'Datele au fost salvate.'
      : url.searchParams.get('parola') ? 'Parola a fost schimbată.'
      : url.searchParams.get('retrimis') ? 'Ți-am retrimis emailul de confirmare.' : '';
    const error = url.searchParams.get('eroare') || '';
    const wheel = await wheelState(env, settings, me).catch(() => null);
    return render('Contul meu', accountView({ c: me, orders: await customerOrders(env, me), notice, error, emailOk: emailStatus(env).customers, wheel }));
  }

  if (path === '/cont/profil' && method === 'POST') {
    const name = val('name', 80);
    const phone = val('phone', 30);
    const p = phone ? normalizePhone(phone) : '';
    if (name.length < 3) return redirect('/cont?eroare=' + encodeURIComponent('Scrie numele complet.'));
    if (phone && !p) return redirect('/cont?eroare=' + encodeURIComponent('Numărul de telefon nu este valid.'));
    const county = JUDETE.includes(val('county')) ? val('county') : '';
    await env.DB.prepare("UPDATE customers SET name = ?, phone = ?, county = ?, city = ?, address = ?, postal_code = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(name, p || '', county, val('city', 80), val('address', 250), val('postal_code', 10), me.id).run();
    await customerEvent(env, me.id, 'Datele contului au fost actualizate de client.');
    return redirect('/cont?salvat=1');
  }

  if (path === '/cont/parola' && method === 'POST') {
    if (!(await verifyPassword(env, String(form.get('current') || ''), me.password_hash))) return redirect('/cont?eroare=' + encodeURIComponent('Parola actuală nu este corectă.'));
    const pp = passwordProblem(form.get('password'));
    if (pp) return redirect('/cont?eroare=' + encodeURIComponent(pp));
    const hash = await hashPassword(env, String(form.get('password')));
    await env.DB.prepare("UPDATE customers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").bind(hash, me.id).run();
    await customerEvent(env, me.id, 'Parolă schimbată de client.');
    return redirect('/cont?parola=1', 303, { 'set-cookie': await sessionCookie(env, { ...me, password_hash: hash }, secure) });
  }

  if (path === '/cont/retrimite-confirmare' && method === 'POST') {
    if (!me.email_verified) await sendVerify(me);
    return redirect('/cont?retrimis=1');
  }

  return null;
}

function html404(msg, back) {
  return raw(`<div class="wrap narrow page center"><h1>Link expirat</h1><p>${msg}</p><p><a class="btn btn-primary" href="${back}">Continuă</a></p></div>`);
}
