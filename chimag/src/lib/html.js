// Șabloane HTML sigure: tot ce intră prin ${...} e escapat automat,
// în afară de ce e marcat explicit cu raw() sau e rezultatul altui html``.

export class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export const raw = (s) => new Raw(s == null ? '' : String(s));

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => MAP[c]);

function render(v) {
  if (v == null || v === false || v === true) return '';
  if (Array.isArray(v)) return v.map(render).join('');
  if (v instanceof Raw) return v.s;
  return esc(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new Raw(out);
}

// Paragrafe din text simplu (rând gol = paragraf nou, rând simplu = <br>)
export function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => html`<p>${raw(esc(p).replace(/\n/g, '<br>'))}</p>`);
}

// JSON sigur pentru <script type="application/ld+json"> sau inline
export const jsonScript = (obj) => raw(JSON.stringify(obj).replace(/</g, '\\u003c'));
