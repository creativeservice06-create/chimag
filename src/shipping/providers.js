import { buildShipment, trackingUrlFor } from './common.js';

/*
  Fiecare furnizor de livrare are aceeași formă:
    create(env, settings, order, items) -> { awb, courier, trackingUrl, labelUrl, pending, message }
    getLabel(env, settings, order)      -> Response (PDF) sau null (=> folosim eticheta noastră printabilă)
    cancel(env, settings, order)        -> void
    status(env, settings, order)        -> { text } sau null
  Ca să adaugi alt curier (ex. Sameday direct, FAN, Cargus), copiezi un adaptor și îl adaugi în PROVIDERS.
*/

// ---------- TEST: AWB fals, ca să probezi fluxul fără cont la curier ----------
const test = {
  id: 'test',
  label: 'Test (AWB fictiv, pentru probă)',
  async create() {
    const awb = 'TEST' + Math.floor(1e9 + Math.random() * 9e9);
    return { awb, courier: 'Test', trackingUrl: '', labelUrl: '' };
  },
  async getLabel() { return null; },
  async cancel() {},
  async status() { return null; },
};

// ---------- MANUAL: generezi AWB-ul în altă platformă și îl scrii în comandă ----------
const manual = {
  id: 'manual',
  label: 'Manual (introduc eu AWB-ul)',
  async create() {
    return { pending: true, message: 'Furnizorul este „Manual": introdu AWB-ul în câmpul din comandă.' };
  },
  async getLabel() { return null; },
  async cancel() {},
  async status() { return null; },
};

// ---------- Client REST generic (folosit de SmartShip și Helpship) ----------
async function call(baseUrl, apiKey, method, path, body) {
  if (!baseUrl || !apiKey) throw new Error('Lipsesc datele de conectare la API (URL și cheie) în setările Cloudflare.');
  const res = await fetch(baseUrl.replace(/\/$/, '') + path, {
    method,
    headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  }
  return ct.includes('application/json') ? res.json() : res;
}

/* ---------- SMARTSHIP ----------
   SmartShip are API de AWB, dar documentația se primește după semnarea contractului (office@smartship.ro).
   Când o ai, ajustezi DOAR funcția toSmartShip() și căile de mai jos (/awb...). Restul magazinului nu se schimbă.
   Setări necesare (Cloudflare → Variables and Secrets): SMARTSHIP_API_URL, SMARTSHIP_API_KEY. */
function toSmartShip(s) {
  return {
    reference: s.reference,
    sender: s.sender,
    receiver: {
      name: s.recipient.name, phone: s.recipient.phone, email: s.recipient.email,
      county: s.recipient.county, city: s.recipient.city, address: s.recipient.address, zip: s.recipient.postalCode,
    },
    parcels: s.parcels,
    weight: s.weightKg,
    content: s.contents,
    declared_value: s.declaredValue,
    cod_amount: s.codAmount,
    observations: s.notes,
  };
}

const smartship = {
  id: 'smartship',
  label: 'SmartShip (multi-curier)',
  async create(env, settings, order, items) {
    const data = await call(env.SMARTSHIP_API_URL, env.SMARTSHIP_API_KEY, 'POST', '/awb', toSmartShip(buildShipment(order, items, settings)));
    const awb = data.awb || data.awb_number || data.tracking_number;
    if (!awb) throw new Error('SmartShip nu a returnat un număr de AWB: ' + JSON.stringify(data).slice(0, 200));
    const courier = data.courier || data.carrier || 'SmartShip';
    return { awb: String(awb), courier, trackingUrl: data.tracking_url || trackingUrlFor(courier, awb), labelUrl: data.label_url || '' };
  },
  async getLabel(env, settings, order) {
    const res = await call(env.SMARTSHIP_API_URL, env.SMARTSHIP_API_KEY, 'GET', `/awb/${encodeURIComponent(order.awb)}/label`);
    return res instanceof Response ? res : null;
  },
  async cancel(env, settings, order) {
    await call(env.SMARTSHIP_API_URL, env.SMARTSHIP_API_KEY, 'DELETE', `/awb/${encodeURIComponent(order.awb)}`);
  },
  async status(env, settings, order) {
    const data = await call(env.SMARTSHIP_API_URL, env.SMARTSHIP_API_KEY, 'GET', `/awb/${encodeURIComponent(order.awb)}/status`);
    return { text: data.status || data.last_status || '' };
  },
};

/* ---------- HELPSHIP (fulfillment: ei țin stocul, ambalează și generează AWB-ul) ----------
   Două moduri de lucru:
   1) PULL (recomandat, nu cere nimic de la ei în afară de integrare): depozitul citește comenzile confirmate
      din API-ul magazinului (/api/fulfillment/...) cu cheia WAREHOUSE_API_KEY și trimite înapoi AWB-ul.
      Vezi README → „Conectarea cu un depozit (Helpship)".
   2) PUSH: dacă Helpship îți dă un API în care să trimitem noi comenzile, setezi HELPSHIP_API_URL + HELPSHIP_API_KEY
      și ajustezi toHelpship() după documentația lor. */
function toHelpship(s) {
  return {
    external_id: s.reference,
    customer: s.recipient,
    cod_amount: s.codAmount,
    items: s.items,
    notes: s.notes,
  };
}

const helpship = {
  id: 'helpship',
  label: 'Helpship (fulfillment din depozitul lor)',
  async create(env, settings, order, items) {
    if (!env.HELPSHIP_API_URL) {
      return { pending: true, message: 'Comanda e confirmată și apare în API-ul pentru depozit. Helpship va completa AWB-ul.' };
    }
    const data = await call(env.HELPSHIP_API_URL, env.HELPSHIP_API_KEY, 'POST', '/orders', toHelpship(buildShipment(order, items, settings)));
    if (data.awb) {
      return { awb: String(data.awb), courier: data.courier || 'Helpship', trackingUrl: data.tracking_url || trackingUrlFor(data.courier, data.awb), labelUrl: '' };
    }
    return { pending: true, message: 'Comanda a fost trimisă la Helpship. AWB-ul apare când o procesează depozitul.' };
  },
  async getLabel() { return null; },
  async cancel(env, settings, order) {
    if (env.HELPSHIP_API_URL) await call(env.HELPSHIP_API_URL, env.HELPSHIP_API_KEY, 'DELETE', `/orders/${encodeURIComponent(order.number)}`);
  },
  async status(env, settings, order) {
    if (!env.HELPSHIP_API_URL) return null;
    const data = await call(env.HELPSHIP_API_URL, env.HELPSHIP_API_KEY, 'GET', `/orders/${encodeURIComponent(order.number)}`);
    return { text: data.status || '' };
  },
};

export const PROVIDERS = { test, manual, smartship, helpship };

export function getProvider(id) {
  return PROVIDERS[id] || PROVIDERS.test;
}
