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

export async function createCheckoutSession(env, { order, lines, shipping, codFee, siteUrl }) {
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
    success_url: `${siteUrl}/multumim/${order.token}?plata=ok`,
    cancel_url: `${siteUrl}/multumim/${order.token}?plata=anulata`,
    client_reference_id: order.number,
    customer_email: order.email || undefined,
    'metadata': { order_id: order.id, order_number: order.number },
    'payment_intent_data': { metadata: { order_number: order.number } },
    line_items,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Eroare Stripe');
  return data; // { id, url }
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
