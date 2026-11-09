// Activitate pe site: înregistrarea paginilor văzute (din /assets/v.js) și calculele pentru /admin/activitate.
// Totul e izolat: orice eroare de aici e ignorată și nu poate afecta magazinul sau comenzile.
// Fără cookie-uri: vizitatorul e un cod anonim care se schimbă în fiecare zi (IP + browser + zi, criptat). IP-ul nu se salvează.
import { sha256Hex } from './util.js';
import { isAdmin } from './auth.js';
import { roToday, roMidnightUtc } from './profit.js';

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|meta-externalagent|bytespider|python|curl|wget|phantom|puppeteer|playwright|selenium|httpclient|okhttp|axios|node-fetch|go-http/i;

function kindOf(path) {
  if (path === '/') return ['acasa', ''];
  let m;
  if ((m = path.match(/^\/p\/([a-z0-9-]+)$/))) return ['produs', m[1]];
  if (path === '/cos' || path === '/finalizare') return ['cos', ''];
  if (path.startsWith('/multumim/')) return ['multumim', ''];
  if ((m = path.match(/^\/categorie\/([a-z0-9-]+)$/))) return ['categorie', m[1]];
  if ((m = path.match(/^\/pagina\/([a-z0-9-]+)$/))) return ['pagina', m[1]];
  if (path === '/cont' || path.startsWith('/cont/')) return ['cont', ''];
  if (path.startsWith('/factura/')) return ['factura', ''];
  if (path === '/cautare') return ['cautare', ''];
  if (path === '/retur' || path.startsWith('/retur/')) return ['retur', ''];
  if (path === '/comanda') return ['comanda', ''];
  return ['alta', path.slice(0, 80)];
}

function device(ua) {
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux|CrOS/.test(ua) ? 'Linux' : '';
  const dev = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tableta' : /Mobi|iPhone|iPod|Android/.test(ua) ? 'mobil' : 'desktop';
  const br = /FBAN|FBAV|FB_IAB/.test(ua) ? 'Facebook (aplicație)' : /Instagram/.test(ua) ? 'Instagram (aplicație)' : /musical_ly|BytedanceWebview|TikTok/i.test(ua) ? 'TikTok (aplicație)'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Altul';
  return { os, dev, br };
}

// de unde a venit vizitatorul (doar pentru prima pagină; navigarea pe site rămâne „intern”)
function sourceOf(q, ref, br, host) {
  const p = new URLSearchParams(q || '');
  const u = String(p.get('utm_source') || '').toLowerCase();
  const camp = String(p.get('utm_campaign') || '').slice(0, 120);
  let rh = '';
  try { rh = ref ? new URL(ref).hostname.replace(/^www\./, '') : ''; } catch { rh = ''; }
  const own = rh && host && rh.replace(/^www\./, '') === host.replace(/^www\./, '');
  let s = '';
  if (p.get('din') === 'link-vechi') s = 'link-vechi';
  else if (p.get('ttclid') || /tiktok|^tt$/.test(u) || /tiktok\.com$/.test(rh) || br.startsWith('TikTok')) s = 'tiktok';
  else if (/instagram|^ig$/.test(u) || /instagram\.com$/.test(rh) || br.startsWith('Instagram')) s = 'instagram';
  else if (p.get('fbclid') || /facebook|^fb$|^meta$/.test(u) || /facebook\.com$|fb\.me$/.test(rh) || br.startsWith('Facebook')) s = 'facebook';
  else if (p.get('gclid') || /google/.test(u) || /(^|\.)google\./.test(rh)) s = 'google';
  else if (u) s = u.slice(0, 30);
  else if (own) s = 'intern';
  else if (/olx\./.test(rh)) s = 'olx';
  else if (rh) s = rh.slice(0, 60);
  else s = 'direct';
  return { s, camp, ref: own ? '' : rh.slice(0, 100) };
}

// POST /api/v — apelat de v.js; răspunsul pleacă imediat, scrierea se face în fundal
export async function recordVisit(request, env, text) {
  let d;
  try { d = JSON.parse(String(text || '').slice(0, 3000)); } catch { return; }
  if (!d || typeof d.pv !== 'string' || !/^[a-z0-9]{6,40}$/.test(d.pv)) return;
  const secs = Math.max(0, Math.min(3600, Math.round(Number(d.s) || 0)));
  const sc = Math.max(0, Math.min(100, Math.round(Number(d.sc) || 0)));
  if (d.t === 'p') {
    await env.DB.prepare("UPDATE visits SET secs = MAX(secs, ?), scrolled = MAX(scrolled, ?), last_at = datetime('now') WHERE pv = ? AND created_at > datetime('now', '-3 hours')")
      .bind(secs, sc, d.pv).run();
    return;
  }
  if (d.t !== 'v') return;
  const path = String(d.p || '').slice(0, 200);
  if (!path.startsWith('/') || path.startsWith('/admin') || path.startsWith('/api/')) return;
  const ua = String(request.headers.get('user-agent') || '').slice(0, 400);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const day = roToday();
  const vid = (await sha256Hex(`${day}|${ip}|${ua}|${env.SESSION_SECRET || 'chimag'}`)).slice(0, 20);
  const [kind, slug] = kindOf(path.replace(/\/+$/, '') || '/');
  const { os, dev, br } = device(ua);
  const host = (() => { try { return new URL(request.url).hostname; } catch { return ''; } })();
  const src = sourceOf(d.q, d.r, br, host);
  // pagina de mulțumire: comandă nouă dacă acea comandă a fost plasată în ultimele 15 minute;
  // altfel e un client care își verifică o comandă mai veche (de ex. din linkul din email)
  let kindFinal = kind, slugFinal = slug;
  if (kind === 'multumim') {
    const tok = (path.match(/^\/multumim\/([a-f0-9]{32})/) || [])[1] || '';
    const o = tok ? await env.DB.prepare("SELECT number, created_at > datetime('now', '-15 minutes') AS fresh FROM orders WHERE token = ?").bind(tok).first().catch(() => null) : null;
    slugFinal = o?.number || '';
    if (!o?.fresh) kindFinal = 'status';
    else {
      // o comandă se numără o singură dată: doar primul vizitator care ajunge pe confirmarea ei
      const first = await env.DB.prepare("SELECT vid FROM visits WHERE kind = 'multumim' AND slug = ? ORDER BY id LIMIT 1").bind(o.number).first().catch(() => null);
      if (first && first.vid !== vid) kindFinal = 'status';
    }
  }
  const bot = !ua || BOT.test(ua) || d.wd === 1 ? 1 : 0;
  const admin = (await isAdmin(request, env).catch(() => false)) ? 1 : 0;
  const cf = request.cf || {};
  await env.DB.prepare(`INSERT OR IGNORE INTO visits (pv, vid, path, kind, slug, source, campaign, referrer, device, os, browser, country, city, is_bot, is_admin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(d.pv, vid, path, kindFinal, slugFinal, src.s, src.camp, src.ref, dev, os, br, String(cf.country || '').slice(0, 2), String(cf.city || '').slice(0, 60), bot, admin).run();
}

// păstrăm istoricul 400 de zile (rulează din cron)
export async function cleanupVisits(env) {
  await env.DB.prepare("DELETE FROM visits WHERE created_at < datetime('now', '-400 days')").run();
}

// ---------------- calcule pentru admin ----------------
const REAL = 'is_bot = 0 AND is_admin = 0';
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const ACT_PERIODS = [['azi', 'Azi'], ['ieri', 'Ieri'], ['7z', '7 zile'], ['30z', '30 de zile'], ['12s', '12 săptămâni'], ['12l', '12 luni']];

function range(period) {
  const today = roToday();
  const first = { azi: today, ieri: addDays(today, -1), '7z': addDays(today, -6), '30z': addDays(today, -29), '12s': addDays(today, -83), '12l': addDays(today.slice(0, 8) + '01', 0) }[period];
  let from = first;
  if (period === '12l') { const d = new Date(today.slice(0, 8) + '01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 11); from = d.toISOString().slice(0, 10); }
  const to = period === 'ieri' ? today : addDays(today, 1);
  const unit = period === 'azi' || period === 'ieri' ? 'ora' : period === '12s' ? 'sapt' : period === '12l' ? 'luna' : 'zi';
  return { from, toDay: period === 'ieri' ? addDays(today, -1) : today, start: roMidnightUtc(from), end: roMidnightUtc(to), unit, today };
}

// ora din România pentru un moment UTC „YYYY-MM-DD HH:MM:SS”
const roParts = (utc) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(utc.replace(' ', 'T') + 'Z')).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};
const mondayOf = (day) => { const d = new Date(day + 'T12:00:00Z'); const w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); };

export async function activityData(env, period) {
  const r = range(period);
  const W = `created_at >= ? AND created_at < ? AND ${REAL}`;
  const b = [r.start, r.end];
  const all = (sql, ...p) => env.DB.prepare(sql).bind(...p).all().then((x) => x.results || []);
  const one = (sql, ...p) => env.DB.prepare(sql).bind(...p).first();
  const validOrders = "created_at >= ? AND created_at < ? AND status NOT IN ('anulata', 'refuzata', 'retur') AND NOT (payment_method = 'card' AND payment_status != 'platita')";

  // per vizitator (pe zi): prima pagină = sursa, total pagini, timp, cât a derulat
  const perVisitor = `SELECT vid, MIN(id) AS fid, MIN(created_at) AS first_at, MAX(last_at) AS last_at, COUNT(*) AS pages, SUM(secs) AS secs, MAX(scrolled) AS sc,
      MAX(kind = 'produs') AS saw_prod, MAX(kind = 'cos') AS saw_cart, MAX(kind = 'multumim') AS bought FROM visits WHERE ${W} GROUP BY vid`;
  const [kpi, buckets, sources, devices, countries, cities, products, pages, bots, orders, prodOrders, titles, recentIds] = await Promise.all([
    one(`SELECT COUNT(*) AS visitors, COALESCE(SUM(pages), 0) AS pages, COALESCE(SUM(secs), 0) AS secs,
        SUM(CASE WHEN secs >= 10 OR pages > 1 THEN 1 ELSE 0 END) AS engaged, SUM(CASE WHEN pages = 1 AND secs < 10 THEN 1 ELSE 0 END) AS bounced,
        SUM(saw_prod) AS saw_prod, SUM(saw_cart) AS saw_cart, SUM(bought) AS bought, SUM(CASE WHEN sc >= 50 THEN 1 ELSE 0 END) AS scrolled
      FROM (${perVisitor})`, ...b),
    r.unit === 'ora' || r.unit === 'zi'
      ? all(`SELECT f.first_at AS t, 1 AS n, f.pages, f.pages > 1 OR f.secs >= 10 AS engaged FROM (${perVisitor}) f`, ...b)
      // perioade lungi: grupat direct pe zile (ora României aproximată: +3h vara, +2h iarna)
      : all(`SELECT date(f.first_at, CASE WHEN substr(f.first_at, 6, 2) BETWEEN '04' AND '10' THEN '+3 hours' ELSE '+2 hours' END) || ' 10:00:00' AS t,
          COUNT(*) AS n, SUM(f.pages) AS pages, SUM(f.pages > 1 OR f.secs >= 10) AS engaged FROM (${perVisitor}) f GROUP BY 1`, ...b),
    all(`SELECT v.source AS k, v.campaign AS camp, COUNT(*) AS n, SUM(f.secs) AS secs, SUM(f.pages) AS pages, SUM(f.bought) AS bought, SUM(f.secs >= 10 OR f.pages > 1) AS engaged
      FROM (${perVisitor}) f JOIN visits v ON v.id = f.fid GROUP BY v.source, v.campaign ORDER BY n DESC`, ...b),
    all(`SELECT v.device AS k, v.os AS os, v.browser AS br, COUNT(*) AS n, SUM(f.bought) AS b, SUM(f.secs) AS s FROM (${perVisitor}) f JOIN visits v ON v.id = f.fid GROUP BY v.device, v.os, v.browser ORDER BY n DESC`, ...b),
    all(`SELECT v.country AS k, COUNT(*) AS n, SUM(f.bought) AS b FROM (${perVisitor}) f JOIN visits v ON v.id = f.fid GROUP BY v.country ORDER BY n DESC`, ...b),
    all(`SELECT v.city AS k, v.country AS c, COUNT(*) AS n, SUM(f.bought) AS b FROM (${perVisitor}) f JOIN visits v ON v.id = f.fid WHERE v.city != '' GROUP BY v.city, v.country ORDER BY n DESC LIMIT 60`, ...b),
    all(`SELECT slug, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors, AVG(secs) AS avg_secs, AVG(scrolled) AS avg_sc FROM visits WHERE ${W} AND kind = 'produs' GROUP BY slug ORDER BY visitors DESC LIMIT 20`, ...b),
    all(`SELECT kind, slug, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors, AVG(secs) AS avg_secs FROM visits WHERE ${W} GROUP BY kind, slug ORDER BY views DESC LIMIT 15`, ...b),
    one(`SELECT COUNT(DISTINCT vid) AS n FROM visits WHERE created_at >= ? AND created_at < ? AND is_bot = 1`, ...b),
    all(`SELECT created_at, total FROM orders WHERE ${validOrders}`, ...b),
    all(`SELECT p.slug, SUM(i.qty) AS qty, COUNT(DISTINCT o.id) AS n FROM order_items i JOIN orders o ON o.id = i.order_id JOIN products p ON p.id = i.product_id
      WHERE o.created_at >= ? AND o.created_at < ? AND o.status NOT IN ('anulata', 'refuzata', 'retur') AND NOT (o.payment_method = 'card' AND o.payment_status != 'platita') GROUP BY p.slug`, ...b),
    all('SELECT slug, title, images FROM products'),
    all(`SELECT vid FROM visits WHERE ${W} GROUP BY vid ORDER BY MAX(last_at) DESC LIMIT 40`, ...b),
  ]);

  // grafic: vizitatori pe oră / zi / săptămână / lună (ora României)
  const keyOf = (t) => { const p = roParts(t); return r.unit === 'ora' ? String(p.hour) : r.unit === 'zi' ? p.day : r.unit === 'sapt' ? mondayOf(p.day) : p.day.slice(0, 7); };
  const series = [];
  if (r.unit === 'ora') for (let h = 0; h < 24; h++) series.push({ key: String(h), label: `${String(h).padStart(2, '0')}:00` });
  else if (r.unit === 'zi') for (let d = r.from; d <= r.toDay; d = addDays(d, 1)) series.push({ key: d, label: `${d.slice(8, 10)}.${d.slice(5, 7)}` });
  else if (r.unit === 'sapt') for (let d = mondayOf(r.from); d <= r.toDay; d = addDays(d, 7)) series.push({ key: d, label: `${d.slice(8, 10)}.${d.slice(5, 7)}`, long: `Săptămâna ${d.slice(8, 10)}.${d.slice(5, 7)} – ${addDays(d, 6).slice(8, 10)}.${addDays(d, 6).slice(5, 7)}` });
  else { const M = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec']; for (let d = r.from.slice(0, 7); d <= r.toDay.slice(0, 7);) { series.push({ key: d, label: `${M[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}` }); const n = new Date(d + '-15T12:00:00Z'); n.setUTCMonth(n.getUTCMonth() + 1); d = n.toISOString().slice(0, 7); } }
  const idx = new Map(series.map((s, i) => [s.key, i]));
  for (const s of series) Object.assign(s, { visitors: 0, engaged: 0, pages: 0, orders: 0 });
  for (const x of buckets) { const i = idx.get(r.unit === 'ora' || r.unit === 'zi' ? keyOf(x.t) : (r.unit === 'sapt' ? mondayOf(x.t.slice(0, 10)) : x.t.slice(0, 7))); if (i === undefined) continue; const s = series[i]; s.visitors += x.n; s.pages += x.pages; s.engaged += x.engaged ? (r.unit === 'ora' || r.unit === 'zi' ? 1 : x.engaged) : 0; }
  for (const o of orders) { const i = idx.get(keyOf(o.created_at)); if (i !== undefined) series[i].orders++; }

  // produse: titluri + comenzi
  const T = new Map(titles.map((p) => { let img = ''; try { img = JSON.parse(p.images || '[]')[0] || ''; } catch { img = ''; } return [p.slug, { title: p.title, img }]; }));
  const PO = new Map(prodOrders.map((x) => [x.slug, x]));
  const prods = products.map((p) => ({ ...p, title: T.get(p.slug)?.title || p.slug, img: T.get(p.slug)?.img || '', orders: PO.get(p.slug)?.n || 0, qty: PO.get(p.slug)?.qty || 0 }));
  const pageList = pages.map((p) => ({ ...p, label: pageLabel(p.kind, p.slug, T) }));

  // ultimii vizitatori, cu traseul pe site
  const recent = await journeys(env, recentIds.map((x) => x.vid), T);
  return {
    period, range: r, kpi: { ...kpi, orders: orders.length, revenue: orders.reduce((s, o) => s + o.total, 0), bots: bots?.n || 0 },
    series, sources, devices, countries, cities, products: prods, pages: pageList, recent,
  };
}

export function pageLabel(kind, slug, T) {
  if (kind === 'multumim') return `Comandă trimisă ✓${slug ? ` ${slug}` : ''}`;
  if (kind === 'status') return `A verificat comanda${slug ? ` ${slug}` : ''} (din email / cont)`;
  return { acasa: 'Pagina principală', cos: 'Coș / finalizare comandă', cont: 'Contul clientului', factura: 'Factură', cautare: 'Căutare', comanda: 'Verifică o comandă', retur: 'Pagina de retur' }[kind]
    || (kind === 'produs' ? T.get(slug)?.title || slug : kind === 'categorie' ? `Categorie: ${slug}` : kind === 'pagina' ? `Pagina: ${slug}` : `Altă pagină${slug ? `: ${slug}` : ''}`);
}

async function journeys(env, vids, T) {
  if (!vids.length) return [];
  const { results } = await env.DB.prepare(`SELECT * FROM visits WHERE vid IN (${vids.map(() => '?').join(',')}) AND ${REAL} ORDER BY id`).bind(...vids).all();
  const by = new Map(vids.map((v) => [v, []]));
  for (const row of results || []) by.get(row.vid)?.push(row);
  return vids.map((v) => {
    const rows = by.get(v) || [];
    if (!rows.length) return null;
    const f = rows[0];
    return {
      vid: v, first_at: f.created_at, last_at: rows.reduce((m, x) => (x.last_at > m ? x.last_at : m), f.last_at),
      source: f.source, campaign: f.campaign, referrer: f.referrer, device: f.device, os: f.os, browser: f.browser, country: f.country, city: f.city,
      secs: rows.reduce((s, x) => s + x.secs, 0), sc: Math.max(...rows.map((x) => x.scrolled)), bought: rows.some((x) => x.kind === 'multumim'),
      steps: rows.map((x) => ({ kind: x.kind, label: pageLabel(x.kind, x.slug, T), secs: x.secs, at: x.created_at })),
    };
  }).filter(Boolean);
}

// cine e pe site acum (activ în ultimele 90 de secunde)
export async function liveData(env) {
  const { results: ids } = await env.DB.prepare(`SELECT vid FROM visits WHERE last_at > datetime('now', '-90 seconds') AND ${REAL} GROUP BY vid ORDER BY MAX(last_at) DESC LIMIT 50`).all();
  const { results: titles } = await env.DB.prepare('SELECT slug, title, images FROM products').all();
  const T = new Map((titles || []).map((p) => [p.slug, { title: p.title }]));
  const list = await journeys(env, (ids || []).map((x) => x.vid), T);
  const today = await env.DB.prepare(`SELECT COUNT(DISTINCT vid) AS n FROM visits WHERE created_at >= ? AND ${REAL}`).bind(roMidnightUtc(roToday())).first();
  const hour = await env.DB.prepare(`SELECT COUNT(DISTINCT vid) AS n FROM visits WHERE last_at > datetime('now', '-60 minutes') AND ${REAL}`).first();
  return { now: list.length, list, today: today?.n || 0, hour: hour?.n || 0, at: new Date().toISOString() };
}
