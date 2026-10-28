// Salvare completă a bazei de date (D1) ca fișier .sql: structura tabelelor + toate rândurile.
// Se poate reîncărca oricând într-o bază D1 (consola Cloudflare sau `wrangler d1 execute --file`).
const SKIP = /^(sqlite_|_cf_|d1_)/;

const lit = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v) || Array.isArray(v)) {
    const b = v instanceof ArrayBuffer ? new Uint8Array(v) : Array.isArray(v) ? Uint8Array.from(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    let h = ''; for (const x of b) h += x.toString(16).padStart(2, '0');
    return `X'${h}'`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
};
const qi = (n) => `"${String(n).replace(/"/g, '""')}"`;

export async function backupSql(env) {
  const { results: tables } = await env.DB.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
  const out = [
    `-- Backup complet chimag · ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
    '-- Conține toate datele magazinului: produse, comenzi, clienți, facturi, setări, coduri, mesaje.',
    '-- ATENȚIE: conține date personale ale clienților. Păstrează fișierul în siguranță.',
    '',
  ];
  const counts = [];
  for (const t of tables || []) {
    if (SKIP.test(t.name) || !t.sql) continue;
    out.push(`-- ===== ${t.name} =====`, t.sql.replace(/^CREATE TABLE (?!IF NOT EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ') + ';');
    let n = 0;
    for (let off = 0; ; off += 500) {
      const { results: rows } = await env.DB.prepare(`SELECT * FROM ${qi(t.name)} LIMIT 500 OFFSET ${off}`).all();
      if (!rows || !rows.length) break;
      const cols = Object.keys(rows[0]);
      const head = `INSERT OR REPLACE INTO ${qi(t.name)} (${cols.map(qi).join(', ')}) VALUES `;
      for (const r of rows) out.push(head + '(' + cols.map((c) => lit(r[c])).join(', ') + ');');
      n += rows.length;
      if (rows.length < 500) break;
    }
    counts.push(`${t.name}: ${n}`);
    out.push('');
  }
  out.splice(3, 0, `-- Rânduri: ${counts.join(', ')}`);
  return out.join('\n');
}
