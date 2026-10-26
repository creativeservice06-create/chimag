// dimensiunile coletului (cm): cel mai lung și cel mai lat produs, înălțimile adunate; null dacă lipsesc
function parcelDims(items) {
  if (!items.length || items.some((i) => !(i.length_cm && i.width_cm && i.height_cm))) return null;
  return {
    length: Math.max(...items.map((i) => i.length_cm)),
    width: Math.max(...items.map((i) => i.width_cm)),
    height: Math.round(items.reduce((s, i) => s + i.height_cm * i.qty, 0) * 10) / 10,
  };
}

// Format neutru al unei expedieri, din care fiecare adaptor își construiește cererea.
export function buildShipment(order, items, settings) {
  const weightG = items.reduce((s, i) => s + (i.weight_g || 500) * i.qty, 0) || 500;
  return {
    reference: order.number,
    sender: {
      name: settings.sender_name || settings.store_name,
      phone: settings.sender_phone || settings.phone,
      county: settings.sender_county,
      city: settings.sender_city,
      address: settings.sender_address,
    },
    recipient: {
      name: order.customer_name,
      phone: order.phone,
      email: order.email || '',
      county: order.county,
      city: order.city,
      address: order.address,
      postalCode: order.postal_code || '',
    },
    parcels: 1,
    dimensions: parcelDims(items),
    weightKg: Math.max(0.1, Math.round(weightG / 100) / 10),
    contents: settings.parcel_contents || 'Produse',
    declaredValue: order.total / 100,
    // ramburs = suma de încasat de curier (0 dacă e plătită cu cardul)
    codAmount: order.payment_method === 'ramburs' && order.payment_status !== 'platita' ? order.total / 100 : 0,
    notes: order.notes || '',
    items: items.map((i) => ({ sku: i.sku, name: i.title, qty: i.qty })),
  };
}

const TRACKING = {
  fan: (a) => `https://www.fancourier.ro/awb-tracking/?awb=${a}`,
  fancourier: (a) => `https://www.fancourier.ro/awb-tracking/?awb=${a}`,
  sameday: (a) => `https://sameday.ro/#awb=${a}`,
  cargus: (a) => `https://www.cargus.ro/personal/urmareste-coletul/?tracking_number=${a}`,
  dpd: (a) => `https://tracking.dpd.ro/?shipmentNumber=${a}&language=ro`,
  gls: (a) => `https://gls-group.com/RO/ro/urmarire-colet?match=${a}`,
};

export function trackingUrlFor(courier, awb) {
  if (!awb) return '';
  const key = String(courier || '').toLowerCase().replace(/[^a-z]/g, '');
  for (const [k, fn] of Object.entries(TRACKING)) if (key.includes(k)) return fn(encodeURIComponent(awb));
  return '';
}

// Transformă statusul curierului într-un status de comandă (dacă se poate deduce)
export function mapShippingStatus(text) {
  const s = String(text || '').toLowerCase();
  if (/livrat|delivered/.test(s) && !/nelivrat|not delivered/.test(s)) return 'livrata';
  if (/refuz|refused|returnat|returned|retur/.test(s)) return 'refuzata';
  return null;
}
