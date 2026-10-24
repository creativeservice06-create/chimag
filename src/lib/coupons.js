import { parseJSON, money, clamp } from './util.js';

// Tipuri de reducere (pentru roată și pentru codurile create din admin)
export const COUPON_TYPES = {
  transport: 'Transport gratuit',
  procent: 'Reducere %',
  lei: 'Reducere în lei',
  '1plus1': '1+1 gratis',
  nimic: 'Fără premiu (doar pe roată)',
};
export const CODE_TYPES = ['transport', 'procent', 'lei', '1plus1']; // tipurile care se pot folosi la coduri

export function describeCoupon(c) {
  switch (c.type) {
    case 'transport': return 'Transport gratuit';
    case 'procent': return `${c.value}% reducere`;
    case 'lei': return `${money(c.value)} reducere`;
    case '1plus1': return '1+1 gratis (a doua bucată din fiecare produs e gratuită)';
    case 'nimic': return 'Fără premiu';
    default: return c.label || c.code;
  }
}

export const normalizeCode = (code) => String(code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 30);
const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export async function findCoupon(env, code) {
  code = normalizeCode(code);
  if (!code) return null;
  return env.DB.prepare('SELECT * FROM coupons WHERE code = ?').bind(code).first();
}

// Verifică dacă un cod se poate folosi acum. Returnează un mesaj de eroare sau null.
export function couponProblem(c, base, customerId = 0) {
  if (!c || !c.active || c.type === 'nimic') return 'Codul nu există sau nu mai este activ.';
  if (c.customer_id && c.customer_id !== customerId) return customerId ? 'Codul e valabil doar în contul în care a fost câștigat.' : 'Intră în contul tău ca să folosești codul câștigat la roată.';
  if (c.expires_at && c.expires_at < nowSql()) return 'Codul a expirat.';
  if (c.max_uses > 0 && c.used_count >= c.max_uses) return 'Codul a fost deja folosit.';
  if (c.min_order > 0 && base < c.min_order) return `Codul se aplică la comenzi de minim ${money(c.min_order)}. Mai adaugă ${money(c.min_order - base)}.`;
  return null;
}

// ---------------- Roata norocului ----------------
export function wheelConfig(settings) {
  const prizes = parseJSON(settings.wheel_prizes, [])
    .map((p) => ({
      label: String(p.label || '').slice(0, 24),
      type: COUPON_TYPES[p.type] ? p.type : 'procent',
      value: Math.max(0, Math.floor(Number(p.value) || 0)),
      weight: Math.max(0, Number(p.weight) || 0),
      min: Math.max(0, Math.floor(Number(p.min) || 0)),
    }))
    // doar premiile care se pot câștiga apar pe roată (fără premii „de decor")
    .filter((p) => p.label && p.weight > 0);
  return {
    enabled: settings.wheel_enabled === '1' && prizes.length >= 2,
    autoOpen: settings.wheel_auto_open === '1',
    delay: clamp(Number(settings.wheel_delay) || 5, 0, 120),
    hours: clamp(Number(settings.wheel_hours) || 2, 1, 24 * 30),
    minThird: Math.max(0, Math.floor(Number(settings.wheel_min_third) || 25000)),
    title: settings.wheel_title || 'Învârte roata și câștigă o reducere',
    prizes,
    hasNothing: prizes.some((p) => p.type === 'nimic'),
  };
}

// Șansa fiecărui premiu, în procente (pentru regulament și admin)
export function prizeOdds(prizes) {
  const total = prizes.reduce((s, p) => s + p.weight, 0) || 1;
  return prizes.map((p) => Math.round((p.weight / total) * 1000) / 10);
}

function pickWeighted(prizes) {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  let x = (r[0] / 2 ** 32) * total;
  for (let i = 0; i < prizes.length; i++) {
    x -= prizes[i].weight;
    if (x < 0) return i;
  }
  return prizes.length - 1;
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // fără 0/O, 1/I
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return 'ROATA-' + [...a].map((b) => chars[b % chars.length]).join('');
}

// ---------- Rotirile clientului (doar cu cont) ----------
// 1: la contul nou · 2: după prima comandă · 3: după o comandă de peste pragul setat.
// O rotire nouă se deblochează doar după ce premiul anterior a fost folosit sau a expirat,
// iar comanda care o deblochează trebuie plasată după rotirea anterioară.
export const WHEEL_STAGES = 3;

export async function wheelState(env, settings, customer) {
  const cfg = wheelConfig(settings);
  if (!cfg.enabled) return { state: 'off' };
  if (!customer) return { state: 'guest', minThird: cfg.minThird, hours: cfg.hours };
  const { results } = await env.DB.prepare("SELECT * FROM coupons WHERE source = 'roata' AND customer_id = ? ORDER BY id").bind(customer.id).all();
  const spins = results || [];
  const used = spins.length;
  const last = spins[used - 1];
  const base = { used, total: WHEEL_STAGES, minThird: cfg.minThird, hours: cfg.hours };
  if (last && last.type !== 'nimic' && last.used_count < (last.max_uses || 1) && last.expires_at > nowSql()) {
    return { ...base, state: 'voucher', stage: used, code: last.code, label: last.label, type: last.type, value: last.value, min: last.min_order,
      description: describeCoupon(last), expiresAt: last.expires_at.replace(' ', 'T') + 'Z' };
  }
  if (used >= WHEEL_STAGES) return { ...base, state: 'done' };
  const next = used + 1;
  if (next === 1) return { ...base, state: 'ready', stage: 1 };
  const since = last.created_at;
  const min = next === 3 ? cfg.minThird : 0;
  const ord = await env.DB.prepare("SELECT id FROM orders WHERE customer_id = ? AND status != 'anulata' AND created_at >= ? AND total >= ? LIMIT 1")
    .bind(customer.id, since, min).first();
  if (ord) return { ...base, state: 'ready', stage: next };
  return { ...base, state: next === 2 ? 'wait-order' : 'wait-amount', stage: next };
}

// Învârtirea se decide pe server; browserul doar animează roata spre premiul primit.
export async function spinWheel(env, settings, ip, customer) {
  const cfg = wheelConfig(settings);
  if (!cfg.enabled) return { error: 'Roata nu este activă momentan.', status: 404 };
  if (!customer) return { error: 'Intră în cont sau creează-ți un cont ca să învârți roata.', status: 401 };
  const st = await wheelState(env, settings, customer);
  if (st.state !== 'ready') return { error: 'Nu ai nicio învârtire disponibilă acum.', status: 409, wheel: st };
  if (ip) {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM coupons WHERE source = 'roata' AND ip = ? AND created_at > datetime('now', '-1 day')").bind(ip).first();
    if (r.n >= 6) return { error: 'Prea multe învârtiri de pe acest dispozitiv azi. Revino mâine!', status: 429 };
  }
  const stage = st.stage;
  const index = pickWeighted(cfg.prizes);
  const prize = cfg.prizes[index];
  if (prize.type === 'nimic') {
    // nu se creează niciun cod; păstrăm doar evidența învârtirii (pentru limită și statistici)
    await env.DB.prepare(`INSERT INTO coupons (code, label, type, value, active, source, ip, customer_id, stage) VALUES (?, ?, 'nimic', 0, 0, 'roata', ?, ?, ?)`)
      .bind('NIMIC-' + randomCode().slice(6) + Date.now().toString(36).toUpperCase(), prize.label, ip || '', customer.id, stage).run();
    return { index, nothing: true, label: prize.label, stage, wheel: await wheelState(env, settings, customer) };
  }
  const expires = new Date(Date.now() + cfg.hours * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  let code;
  for (let i = 0; i < 5; i++) {
    code = randomCode();
    try {
      await env.DB.prepare(`INSERT INTO coupons (code, label, type, value, min_order, max_uses, expires_at, source, ip, customer_id, stage)
        VALUES (?, ?, ?, ?, ?, 1, ?, 'roata', ?, ?, ?)`).bind(code, prize.label, prize.type, prize.value, prize.min, expires, ip || '', customer.id, stage).run();
      break;
    } catch (e) {
      if (i === 4) throw e; // coliziune de cod extrem de rară: mai încercăm
    }
  }
  return {
    index, code, label: prize.label, type: prize.type, value: prize.value, min: prize.min, stage,
    description: describeCoupon(prize), expiresAt: expires.replace(' ', 'T') + 'Z',
  };
}
