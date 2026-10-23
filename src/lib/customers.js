import { hmac, timingSafeEqual } from './auth.js';
import { getCookie, randomToken, sha256Hex } from './util.js';

// ---------------- Parole ----------------
// PBKDF2-SHA256 cu sare unică + „piper" (cheie secretă a serverului, SESSION_SECRET).
// 20.000 de iterații încap în limita de procesor a planului gratuit Cloudflare.
const ITER = 20000;
const enc = new TextEncoder();
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(env, password, salt, iter) {
  const peppered = await hmac(env.SESSION_SECRET, `pw:${password}`);
  const key = await crypto.subtle.importKey('raw', enc.encode(peppered), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}

export async function hashPassword(env, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${toB64(salt)}$${toB64(await derive(env, password, salt, ITER))}`;
}

export async function verifyPassword(env, password, stored) {
  const [alg, iter, salt, hash] = String(stored || '').split('$');
  if (alg !== 'pbkdf2' || !hash) return false;
  const got = toB64(await derive(env, password, fromB64(salt), Number(iter)));
  return timingSafeEqual(got, hash);
}

export const passwordProblem = (p) => (String(p || '').length < 8 ? 'Parola trebuie să aibă cel puțin 8 caractere.' : null);

// ---------------- Sesiune client ----------------
const COOKIE = 'chimag_user';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 de zile
// semnătura include o bucată din parola criptată: dacă schimbi parola, sesiunile vechi se închid
const sig = (env, id, exp, pw) => hmac(env.SESSION_SECRET, `user:${id}.${exp}.${String(pw || '').slice(-12)}`);

export async function sessionCookie(env, customer, secure = true) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  return `${COOKIE}=${customer.id}.${exp}.${await sig(env, customer.id, exp, customer.password_hash)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
}
export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export async function currentCustomer(request, env) {
  const v = getCookie(request, COOKIE);
  if (!v || !env.SESSION_SECRET) return null;
  const [id, exp, s] = v.split('.');
  if (!id || !exp || !s || Number(exp) < Date.now() / 1000) return null;
  const c = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(Number(id)).first();
  if (!c || !c.active) return null;
  return timingSafeEqual(s, await sig(env, c.id, exp, c.password_hash)) ? c : null;
}

// ---------------- Linkuri de confirmare / resetare ----------------
// în baza de date păstrăm doar amprenta (hash) tokenului, nu tokenul în sine
export async function issueToken(env, customerId, type, hours) {
  const token = randomToken(24);
  const expires = new Date(Date.now() + hours * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  await env.DB.prepare('UPDATE customers SET token_hash = ?, token_type = ?, token_expires = ? WHERE id = ?')
    .bind(await sha256Hex(token), type, expires, customerId).run();
  return token;
}

export async function consumeToken(env, token, type) {
  if (!/^[a-f0-9]{48}$/.test(String(token || ''))) return null;
  const c = await env.DB.prepare("SELECT * FROM customers WHERE token_hash = ? AND token_type = ? AND token_expires > datetime('now')")
    .bind(await sha256Hex(token), type).first();
  if (!c) return null;
  await env.DB.prepare("UPDATE customers SET token_hash = '', token_type = '', token_expires = '' WHERE id = ?").bind(c.id).run();
  return c;
}

// ---------------- Istoric + protecție la ghicirea parolei ----------------
export async function customerEvent(env, customerId, message) {
  await env.DB.prepare('INSERT INTO customer_events (customer_id, message) VALUES (?, ?)').bind(customerId, message).run();
}

export async function tooManyAttempts(env, keys, limit = 8) {
  for (const k of keys.filter(Boolean)) {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE k = ? AND created_at > datetime('now', '-15 minutes')").bind(k).first();
    if (r.n >= limit) return true;
  }
  return false;
}
export async function recordAttempt(env, keys) {
  const stmts = keys.filter(Boolean).map((k) => env.DB.prepare('INSERT INTO login_attempts (k) VALUES (?)').bind(k));
  if (stmts.length) await env.DB.batch(stmts);
  // curățenie ocazională
  if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM login_attempts WHERE created_at < datetime('now', '-1 day')").run();
}

// comenzile unui client: cele plasate din cont + (dacă emailul e confirmat) cele plasate cu același email
export async function customerOrders(env, c, limit = 100) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM orders WHERE customer_id = ? OR (? = 1 AND email = ? COLLATE NOCASE) ORDER BY id DESC LIMIT ?`)
    .bind(c.id, c.email_verified ? 1 : 0, c.email, limit).all();
  return results || [];
}
