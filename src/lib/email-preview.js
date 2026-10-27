// Previzualizare emailuri (cu date de exemplu) + trimitere de test către adresa ta din Setări.
import { adminNewOrderEmail, customerOrderEmail, customerStatusEmail, invoiceEmail, parcelShippedEmail, itemImages } from '../emails.js';
import { trackingUrlFor } from '../shipping/common.js';
import { buildLines, CNP_GENERIC } from './invoices.js';

export const PREVIEWS = {
  primita: { label: '1. Comanda a fost primită', who: 'client', when: 'imediat după plasare' },
  expediata: { label: '2. Comanda e confirmată și a plecat (cu AWB)', who: 'client', when: 'când vine AWB-ul' },
  livrata: { label: '3. Comanda a fost livrată · factura ta', who: 'client', when: 'la livrare, cu PDF atașat' },
  colet: { label: 'Comandă în 2 colete: coletul Helpship a plecat', who: 'client', when: 'doar la comenzi mixte' },
  factura: { label: 'Factura (emisă manual din admin)', who: 'client', when: 'la „Emite factura acum”' },
  anulata: { label: 'Comanda a fost anulată', who: 'client', when: 'când anulezi comanda' },
  admin: { label: 'Comandă nouă (pentru tine)', who: 'tu', when: 'la fiecare comandă nouă' },
};

async function sample(env, s) {
  const { results } = await env.DB.prepare("SELECT id, title, price, sku, fulfillment FROM products WHERE active = 1 ORDER BY CASE WHEN fulfillment = 'helpship' THEN 0 ELSE 1 END, sort, id LIMIT 2").all();
  const prods = results || [];
  const items = prods.slice(0, 1).map((p, i) => ({ id: i + 1, product_id: p.id, title: p.title, sku: p.sku || '', qty: 1, unit_price: p.price, line_discount: 0, total: p.price, fulfillment: p.fulfillment || '' }));
  const subtotal = items.reduce((a, i) => a + i.total, 0);
  const free = Number(s.free_shipping_threshold) || 0;
  const shipping = free && subtotal >= free ? 0 : Number(s.shipping_cost) || 0;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const awb = '1234567890';
  const order = {
    id: 0, number: 'CHI-TEST', token: '0'.repeat(32), status: 'noua', payment_method: 'ramburs', payment_status: 'neplatita',
    customer_name: 'Ion Popescu', phone: '0722123456', email: 'ion.popescu@exemplu.ro', county: 'Brașov', city: 'Brașov',
    address: 'Str. Lungă nr. 10, bl. A, ap. 3', postal_code: '500035', notes: '', subtotal, discount: 0, shipping, cod_fee: 0,
    coupon_discount: 0, coupon_code: '', total: subtotal + shipping, created_at: now, fulfillment_mode: items[0]?.fulfillment === 'helpship' ? 'helpship' : 'own',
    awb, courier: 'Sameday', tracking_url: trackingUrlFor('Sameday', awb), own_total: subtotal + shipping, hs_total: subtotal + shipping,
    hs_awb: awb, hs_courier: 'Sameday', hs_tracking_url: trackingUrlFor('Sameday', awb),
  };
  const lines = buildLines(order, items, s.inv_vat_payer === '1', s.inv_vat_payer === '1' ? Number(s.inv_vat_rate) || 21 : 0);
  const sum = (k) => lines.reduce((a, l) => a + l[k], 0);
  const series = String(s.inv_series || 'CHF').toUpperCase();
  const invoice = {
    id: 0, order_id: 0, kind: 'factura', series, number: 0, full_number: `${series}0000`, token: '0'.repeat(32), issued_on: now.slice(0, 10),
    buyer_json: JSON.stringify({ name: order.customer_name, cif: CNP_GENERIC, address: order.address, city: order.city, county: order.county, zip: order.postal_code, country: 'România' }),
    supplier_json: JSON.stringify({ name: s.company_name, cui: s.company_cui, reg: s.company_reg || '', capital: s.company_capital || '', address: s.company_address || '', bank: s.company_bank || '', iban: s.company_iban || '', email: s.email || '' }),
    lines_json: JSON.stringify(lines), total: sum('gross'), base_total: sum('base'), vat_total: sum('vat'), vat_payer: s.inv_vat_payer === '1' ? 1 : 0,
    vat_rate: s.inv_vat_payer === '1' ? Number(s.inv_vat_rate) || 21 : 0, payment_method: 'ramburs', note: `Comanda ${order.number} (EXEMPLU)`,
  };
  return { order, items, invoice, images: await itemImages(env, items) };
}

export async function buildPreview(env, s, base, tip) {
  const { order, items, invoice, images } = await sample(env, s);
  const o = (status) => ({ ...order, status });
  switch (tip) {
    case 'primita': return { mail: customerOrderEmail(s, base, order, items, images) };
    case 'expediata': return { mail: customerStatusEmail(s, base, o('expediata'), items, images) };
    case 'livrata': return { mail: customerStatusEmail(s, base, o('livrata'), items, images, invoice), invoice };
    case 'anulata': return { mail: customerStatusEmail(s, base, o('anulata'), items, images) };
    case 'colet': return { mail: parcelShippedEmail(s, base, { ...o('confirmata'), fulfillment_mode: 'mixt' }, items, images) };
    case 'factura': return { mail: invoiceEmail(s, base, o('livrata'), invoice), invoice };
    case 'admin': return { mail: adminNewOrderEmail(s, base, order, items, images) };
    default: return null;
  }
}
