import { hmac, timingSafeEqual } from './auth.js';

// Stripe Checkout fără SDK – doar fetch, compatibil 100% cu Cloudflare Workers.

function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v == null) continue;
    if (typeof v === 'object') form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function createCheckoutSession(env, { order, lines, shipping, codFee, siteUrl, embedded = false }) {
  const line_items = {};
  let i = 0;
  if (order.coupon_discount > 0) {
    // cu reducere de cupon: un singur rând cu totalul exact al comenzii
    line_items[0] = { quantity: 1, price_data: { currency: 'ron', unit_amount: order.total, product_data: { name: `Comanda ${order.number}` } } };
    lines = [];
    shipping = 0; codFee = 0; i = 1;
  }
  for (const l of lines) {
    // Stripe nu acceptă reduceri negative pe linie; punem prețul final per bucată (rotunjit în jos).
    const unit = Math.floor(l.total / l.qty);
    line_items[i++] = {
      quantity: l.qty,
      price_data: { currency: 'ron', unit_amount: unit, product_data: { name: l.product.title } },
    };
  }
  // corecție de rotunjire (dacă total/qty nu e întreg)
  const sumLines = lines.reduce((s, l) => s + Math.floor(l.total / l.qty) * l.qty, 0);
  const expectedLines = lines.reduce((s, l) => s + l.total, 0);
  const extra = (shipping || 0) + (codFee || 0) + (expectedLines - sumLines);
  if (extra > 0) {
    line_items[i++] = {
      quantity: 1,
      price_data: { currency: 'ron', unit_amount: extra, product_data: { name: shipping ? 'Transport' : 'Ajustare rotunjire' } },
    };
  }

  const body = form({
    mode: 'payment',
    locale: 'ro',
    ...(embedded
      ? { ui_mode: 'embedded', return_url: `${siteUrl}/multumim/${order.token}?plata=ok` } // formularul stă pe chimag.ro
      : { success_url: `${siteUrl}/multumim/${order.token}?plata=ok`, cancel_url: `${siteUrl}/multumim/${order.token}?plata=anulata` }),
    client_reference_id: order.number,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60 + 30, // minimul permis de Stripe (30 min); comanda neplătită se anulează după 1 oră
    customer_email: order.email || undefined,
    'metadata': { order_id: order.id, order_number: order.number },
    'payment_intent_data': { metadata: { order_number: order.number } },
    line_items,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded',
      // formularul încorporat folosește Stripe.js v3, compatibil cu versiunile API „acacia”; contul nou e pe o versiune mai nouă
      ...(embedded ? { 'stripe-version': '2025-02-24.acacia' } : {}),
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Eroare Stripe');
  return data; // { id, url } sau, la embedded, { id, client_secret }
}

// Verifică semnătura webhook-ului: header "Stripe-Signature: t=...,v1=..."
export async function verifyWebhook(env, payload, header) {
  if (!env.STRIPE_WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')).map(([k, ...v]) => [k, v.join('=')]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 600) return false;
  const expected = await hmac(env.STRIPE_WEBHOOK_SECRET, `${t}.${payload}`);
  const signatures = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  return signatures.some((s) => timingSafeEqual(s, expected));
}

// Închide o pagină de plată Stripe încă deschisă (după ce clientul a anulat comanda), ca să nu mai poată fi plătită.
// Întoarce { paid: true } dacă între timp plata chiar s-a făcut (atunci comanda NU se anulează).
export async function expireCheckoutSession(env, sessionId) {
  if (!sessionId || !env.STRIPE_SECRET_KEY) return { paid: false };
  const auth = { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, { method: 'POST', headers: auth });
    if (res.ok) return { paid: false };
    const s = await (await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: auth })).json();
    return { paid: s?.payment_status === 'paid' };
  } catch { return { paid: false }; }
}
