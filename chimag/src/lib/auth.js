import { getCookie } from './util.js';

const COOKIE = 'chimag_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 zile

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function secret(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET lipsește sau e prea scurt (min. 32 caractere).');
  return env.SESSION_SECRET;
}

export async function createSessionCookie(env, secure = true) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `admin.${exp}`;
  const sig = await hmac(secret(env), payload);
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
}

export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export async function isAdmin(request, env) {
  const v = getCookie(request, COOKIE);
  if (!v) return false;
  const parts = v.split('.');
  if (parts.length !== 3) return false;
  const [who, exp, sig] = parts;
  if (who !== 'admin' || Number(exp) < Date.now() / 1000) return false;
  try {
    return timingSafeEqual(sig, await hmac(secret(env), `${who}.${exp}`));
  } catch {
    return false;
  }
}

export function checkPassword(env, password) {
  if (!env.ADMIN_PASSWORD) return false;
  return timingSafeEqual(password || '', env.ADMIN_PASSWORD);
}

// Protecție CSRF simplă: formularele de admin trebuie să vină de pe același domeniu.
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // unele browsere nu trimit Origin la GET/navigări; cookie-ul e SameSite=Lax
  return origin === new URL(request.url).origin;
}

export { hmac };
