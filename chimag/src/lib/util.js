const lei = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 14999 bani -> "149,99 lei"
export const money = (bani) => `${lei.format((Number(bani) || 0) / 100)} lei`;
// 14999 -> "149,99" (fără "lei")
export const moneyNum = (bani) => lei.format((Number(bani) || 0) / 100);
// "149,99" / "149.99" / "149" -> 14999
export function toBani(input) {
  const s = String(input ?? '').trim().replace(/\s/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function htmlResponse(body, status = 200, headers = {}) {
  return new Response('<!doctype html>' + String(body), {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

export const redirect = (location, status = 303, headers = {}) =>
  new Response(null, { status, headers: { location, ...headers } });

export function parseJSON(s, fallback) {
  try { const v = JSON.parse(s); return v ?? fallback; } catch { return fallback; }
}

export function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function randomToken(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

// Telefon românesc: acceptă 07xxxxxxxx, +407xxxxxxxx, 00407..., cu spații/puncte
export function normalizePhone(p) {
  let d = String(p || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+40')) d = '0' + d.slice(3);
  else if (d.startsWith('0040')) d = '0' + d.slice(4);
  else if (d.startsWith('40') && d.length === 11) d = '0' + d.slice(2);
  return /^0[2-7]\d{8}$/.test(d) ? d : null;
}

export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || ''));

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function formatDate(sqlDate) {
  if (!sqlDate) return '';
  const d = new Date(sqlDate.replace(' ', 'T') + 'Z');
  return d.toLocaleString('ro-RO', {
    timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
