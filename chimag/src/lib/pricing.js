import { getProductsByIds } from './db.js';
import { clamp } from './util.js';

// Reducerea de pachet pentru o cantitate: cel mai mare prag atins.
export function bundlePct(product, qty) {
  let pct = 0;
  for (const b of product.bundles || []) {
    if (qty >= Number(b.qty) && Number(b.pct) > pct) pct = Number(b.pct);
  }
  return clamp(pct, 0, 90);
}

/**
 * Recalculează coșul DOAR din prețurile din baza de date (clientul nu poate trimite prețuri).
 * @param items [{id, qty}]
 * @param opts { paymentMethod: 'ramburs'|'card', bump: boolean }
 */
export async function priceCart(env, settings, items, opts = {}) {
  const merged = new Map();
  for (const it of items || []) {
    const id = Number(it.id);
    const qty = clamp(Math.floor(Number(it.qty) || 0), 0, 50);
    if (!id || !qty) continue;
    merged.set(id, (merged.get(id) || 0) + qty);
  }

  const bumpId = Number(settings.bump_product_id) || 0;
  const wantBump = opts.bump && bumpId && !merged.has(bumpId);
  const ids = [...merged.keys()];
  if (wantBump) ids.push(bumpId);

  const products = await getProductsByIds(env, ids);
  const byId = new Map(products.filter((p) => p.active).map((p) => [p.id, p]));

  const lines = [];
  const errors = [];
  for (const [id, qty] of merged) {
    const p = byId.get(id);
    if (!p) { errors.push('Un produs din coș nu mai este disponibil.'); continue; }
    if (p.track_stock && p.stock < qty) {
      errors.push(p.stock > 0 ? `Mai avem doar ${p.stock} buc. din „${p.title}".` : `„${p.title}" nu mai este în stoc.`);
      continue;
    }
    const pct = bundlePct(p, qty);
    const gross = p.price * qty;
    const lineDiscount = Math.round(gross * pct / 100);
    lines.push({ product: p, qty, unitPrice: p.price, pct, lineDiscount, total: gross - lineDiscount, isBump: false });
  }

  if (wantBump) {
    const p = byId.get(bumpId);
    if (p && (!p.track_stock || p.stock >= 1)) {
      const pct = clamp(Number(settings.bump_discount_pct) || 0, 0, 90);
      const lineDiscount = Math.round(p.price * pct / 100);
      lines.push({ product: p, qty: 1, unitPrice: p.price, pct, lineDiscount, total: p.price - lineDiscount, isBump: true });
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discount = lines.reduce((s, l) => s + l.lineDiscount, 0);
  const afterDiscount = subtotal - discount;
  const threshold = Number(settings.free_shipping_threshold) || 0;
  const shipping = lines.length === 0 ? 0 : (threshold > 0 && afterDiscount >= threshold ? 0 : Number(settings.shipping_cost) || 0);
  const codFee = opts.paymentMethod === 'ramburs' && lines.length ? Number(settings.cod_fee) || 0 : 0;
  const total = afterDiscount + shipping + codFee;

  return { lines, subtotal, discount, shipping, codFee, total, errors, freeShippingLeft: threshold > afterDiscount ? threshold - afterDiscount : 0 };
}
