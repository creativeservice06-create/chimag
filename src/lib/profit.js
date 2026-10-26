// Profitul pe o perioadă: venitul din produse (după reduceri) minus costul de achiziție,
// plus transportul încasat minus costul estimat al livrării (din Setări).

// miezul nopții în ora României (cu ora de vară/iarnă), exprimat ca „YYYY-MM-DD HH:MM:SS" UTC, ca în baza de date
export function roMidnightUtc(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
  const hourThere = Number(parts.find((p) => p.type === 'hour').value); // 2 sau 3
  return new Date(guess - hourThere * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
}
export const roToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function resolveRange(q) {
  const today = roToday();
  const preset = q.get('perioada') || '';
  let from = q.get('de_la') || '', to = q.get('pana_la') || '';
  const month0 = today.slice(0, 8) + '01';
  const presets = {
    azi: [today, today], ieri: [addDays(today, -1), addDays(today, -1)],
    '7z': [addDays(today, -6), today], '30z': [addDays(today, -29), today],
    luna: [month0, today], 'luna-trecuta': [addDays(month0, -1).slice(0, 8) + '01', addDays(month0, -1)],
  };
  if (presets[preset]) [from, to] = presets[preset];
  const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!ok(from) || !ok(to)) [from, to] = presets['30z'];
  if (from > to) [from, to] = [to, from];
  return { from, to, preset: presets[preset] ? preset : (q.get('de_la') ? '' : '30z'), scope: q.get('comenzi') === 'livrate' ? 'livrate' : 'toate' };
}

export async function profitData(env, settings, range) {
  const start = roMidnightUtc(range.from), end = roMidnightUtc(addDays(range.to, 1));
  const statusCond = range.scope === 'livrate' ? "o.status = 'livrata'" : "o.status NOT IN ('anulata', 'refuzata', 'retur')";
  const where = `o.created_at >= ? AND o.created_at < ? AND ${statusCond} AND NOT (o.payment_method = 'card' AND o.payment_status != 'platita')`;
  const { results: orders } = await env.DB.prepare(`SELECT o.id, o.total, o.shipping, o.cod_fee, o.coupon_discount, o.fulfillment_mode, o.created_at FROM orders o WHERE ${where}`).bind(start, end).all();
  const { results: items } = await env.DB.prepare(`SELECT oi.order_id, oi.product_id, oi.title, oi.qty, oi.total, oi.fulfillment,
      CASE WHEN oi.unit_cost > 0 THEN oi.unit_cost ELSE COALESCE(p.cost_price, 0) END AS unit_cost, p.title AS ptitle
    FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.id = oi.product_id WHERE ${where}`).bind(start, end).all();

  const byOrder = new Map();
  for (const i of items || []) { if (!byOrder.has(i.order_id)) byOrder.set(i.order_id, []); byOrder.get(i.order_id).push(i); }
  const courier = Number(settings.cost_courier) || 0, hsCost = Number(settings.cost_helpship) || 0;
  const t = { orders: 0, collected: 0, productRevenue: 0, cost: 0, shippingIn: 0, shippingCost: 0, missingCost: new Set(), parcels: 0 };
  const products = new Map();
  const days = new Map();
  for (const o of orders || []) {
    const list = byOrder.get(o.id) || [];
    const net = list.reduce((s, i) => s + i.total, 0);
    const coupon = Math.min(o.coupon_discount || 0, net);
    const own = list.some((i) => i.fulfillment !== 'helpship'), hs = list.some((i) => i.fulfillment === 'helpship');
    const shipCost = (own ? courier : 0) + (hs ? hsCost : 0);
    let orderRev = 0, orderCost = 0;
    for (const i of list) {
      const rev = i.total - (net ? Math.round(coupon * i.total / net) : 0);
      const cost = (i.unit_cost || 0) * i.qty;
      if (!i.unit_cost) t.missingCost.add(i.ptitle || i.title);
      orderRev += rev; orderCost += cost;
      const key = i.product_id || i.title;
      const p = products.get(key) || { title: i.ptitle || i.title, qty: 0, revenue: 0, cost: 0 };
      p.qty += i.qty; p.revenue += rev; p.cost += cost; products.set(key, p);
    }
    t.orders++; t.collected += o.total; t.productRevenue += orderRev; t.cost += orderCost;
    t.shippingIn += (o.shipping || 0) + (o.cod_fee || 0); t.shippingCost += shipCost; t.parcels += (own ? 1 : 0) + (hs ? 1 : 0);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date(o.created_at.replace(' ', 'T') + 'Z'));
    const dd = days.get(day) || { orders: 0, profit: 0 };
    dd.orders++; dd.profit += orderRev - orderCost + (o.shipping || 0) + (o.cod_fee || 0) - shipCost; days.set(day, dd);
  }
  const gross = t.productRevenue - t.cost;
  const net = gross + t.shippingIn - t.shippingCost;
  const series = [];
  for (let d = range.from, n = 0; d <= range.to && n < 93; d = addDays(d, 1), n++) series.push({ day: d, ...(days.get(d) || { orders: 0, profit: 0 }) });
  return {
    ...t, gross, net, margin: t.productRevenue ? Math.round((gross / t.productRevenue) * 1000) / 10 : 0,
    costsSet: { courier: courier > 0, helpship: hsCost > 0 },
    missingCost: [...t.missingCost], series,
    products: [...products.values()].sort((a, b) => (b.revenue - b.cost) - (a.revenue - a.cost)),
  };
}
