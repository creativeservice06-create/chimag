// Generator PDF minimal, fără biblioteci externe: pagini A4, text cu font TrueType încorporat
// (diacritice românești corecte, text care se poate selecta și căuta), linii și dreptunghiuri.

const enc = new TextEncoder();

// ---------------- Citire font TrueType ----------------
export function parseTTF(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = {};
  for (let i = 0, n = dv.getUint16(4); i < n; i++) {
    const o = 12 + i * 16;
    const tag = String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
    tables[tag] = dv.getUint32(o + 8);
  }
  const head = tables.head, hhea = tables.hhea, hmtx = tables.hmtx, os2 = tables['OS/2'];
  const upm = dv.getUint16(head + 18);
  const bbox = [dv.getInt16(head + 36), dv.getInt16(head + 38), dv.getInt16(head + 40), dv.getInt16(head + 42)];
  const ascent = dv.getInt16(hhea + 4), descent = dv.getInt16(hhea + 6);
  const nh = dv.getUint16(hhea + 34);
  const capHeight = os2 && dv.getUint16(os2) >= 2 ? dv.getInt16(os2 + 88) : Math.round(ascent * 0.7);
  // cmap format 4 (Unicode BMP)
  const cmap = tables.cmap;
  let sub = 0;
  for (let i = 0, n = dv.getUint16(cmap + 2); i < n; i++) {
    const p = dv.getUint16(cmap + 4 + i * 8), e = dv.getUint16(cmap + 6 + i * 8), off = dv.getUint32(cmap + 8 + i * 8);
    if (dv.getUint16(cmap + off) === 4 && ((p === 3 && e === 1) || p === 0)) { sub = cmap + off; if (p === 3) break; }
  }
  const segX2 = dv.getUint16(sub + 6);
  const endP = sub + 14, startP = endP + segX2 + 2, deltaP = startP + segX2, rangeP = deltaP + segX2;
  const cache = new Map();
  const glyph = (cp) => {
    if (cache.has(cp)) return cache.get(cp);
    let g = 0;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = dv.getUint16(endP + s * 2);
      if (cp > end) continue;
      const start = dv.getUint16(startP + s * 2);
      if (cp < start) break;
      const delta = dv.getInt16(deltaP + s * 2), ro = dv.getUint16(rangeP + s * 2);
      if (!ro) g = (cp + delta) & 0xffff;
      else { g = dv.getUint16(rangeP + s * 2 + ro + 2 * (cp - start)); if (g) g = (g + delta) & 0xffff; }
      break;
    }
    cache.set(cp, g);
    return g;
  };
  const advance = (g) => dv.getUint16(hmtx + (g < nh ? g : nh - 1) * 4);
  return { bytes, upm, bbox, ascent, descent, capHeight, glyph, advance };
}

// ș/ț cu sedilă → cu virgulă; ghilimele etc. rămân; caracterele lipsă din font sunt omise
const FIX = { 'ş': 'ș', 'Ş': 'Ș', 'ţ': 'ț', 'Ţ': 'Ț' };
const clean = (s) => String(s ?? '').replace(/[şŞţŢ]/g, (c) => FIX[c]).replace(/\s+/g, ' ');

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const hex = (rgb) => {
  const h = rgb.replace('#', '');
  return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
};
const f2 = (n) => (Math.round(n * 100) / 100).toString();

// ---------------- Document ----------------
export class PdfDoc {
  constructor(fonts, { width = 595.28, height = 841.89 } = {}) {
    this.W = width; this.H = height;
    this.fonts = Object.entries(fonts).map(([key, ttf], i) => ({ key, ttf, name: `F${i + 1}`, used: new Map() }));
    this.byKey = Object.fromEntries(this.fonts.map((f) => [f.key, f]));
    this.pages = [];
    this.addPage();
  }
  addPage() { this.page = []; this.pages.push(this.page); return this; }
  font(key) { return this.byKey[key] || this.fonts[0]; }

  width(str, key, size) {
    const f = this.font(key);
    let w = 0;
    for (const ch of clean(str)) { const g = f.ttf.glyph(ch.codePointAt(0)); if (g) w += f.ttf.advance(g); }
    return (w / f.ttf.upm) * size;
  }

  wrap(str, key, size, maxW) {
    const words = clean(str).trim().split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (this.width(t, key, size) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
      // cuvânt prea lung: îl tăiem
      while (this.width(cur, key, size) > maxW && cur.length > 1) {
        let k = cur.length - 1;
        while (k > 1 && this.width(cur.slice(0, k), key, size) > maxW) k--;
        lines.push(cur.slice(0, k)); cur = cur.slice(k);
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  // y = linia de bază a textului, măsurată de sus în jos
  text(str, x, y, { font = 'R', size = 10, color = '#101d30', align = 'left' } = {}) {
    const f = this.font(font);
    let hexs = '';
    for (const ch of clean(str)) {
      const cp = ch.codePointAt(0), g = f.ttf.glyph(cp);
      if (!g) continue;
      if (!f.used.has(g)) f.used.set(g, cp);
      hexs += g.toString(16).padStart(4, '0');
    }
    if (!hexs) return;
    const w = this.width(str, font, size);
    const px = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    this.page.push(`BT /${f.name} ${f2(size)} Tf ${hex(color)} rg ${f2(px)} ${f2(this.H - y)} Td <${hexs}> Tj ET`);
  }

  rect(x, y, w, h, { fill = null, stroke = null, lw = 0.6 } = {}) {
    const ops = [];
    if (fill) ops.push(`${hex(fill)} rg`);
    if (stroke) ops.push(`${hex(stroke)} RG ${f2(lw)} w`);
    ops.push(`${f2(x)} ${f2(this.H - y - h)} ${f2(w)} ${f2(h)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
    this.page.push(ops.join(' '));
  }

  line(x1, y1, x2, y2, { color = '#dfe5ed', lw = 0.6 } = {}) {
    this.page.push(`${hex(color)} RG ${f2(lw)} w ${f2(x1)} ${f2(this.H - y1)} m ${f2(x2)} ${f2(this.H - y2)} l S`);
  }

  async output({ title = '', author = '' } = {}) {
    const objs = []; // fiecare: Uint8Array
    const add = (content) => { objs.push(content); return objs.length; };
    const reserve = () => { objs.push(null); return objs.length; };
    const str = (s) => enc.encode(s);
    const stream = async (dict, data, compress = true) => {
      const body = compress ? await deflate(data) : data;
      const headStr = `<< ${dict} /Length ${body.length}${compress ? ' /Filter /FlateDecode' : ''} >>\nstream\n`;
      return concat([str(headStr), body, str('\nendstream')]);
    };
    const pdfStr = (s) => '(' + String(s).replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7e]/g, '') + ')';

    const catalogId = reserve(), pagesId = reserve();
    // fonturi
    const fontRefs = [];
    for (const f of this.fonts) {
      const t = f.ttf, k = 1000 / t.upm;
      const tag = 'CHIMAG'.slice(0, 6) + '+';
      const baseName = `${tag}PJS-${f.key}`;
      const fileId = add(await stream(`/Length1 ${t.bytes.length}`, t.bytes));
      const descId = add(str(`<< /Type /FontDescriptor /FontName /${baseName} /Flags 32 /FontBBox [${t.bbox.map((v) => Math.round(v * k)).join(' ')}] /ItalicAngle 0 /Ascent ${Math.round(t.ascent * k)} /Descent ${Math.round(t.descent * k)} /CapHeight ${Math.round(t.capHeight * k)} /StemV ${f.key === 'B' ? 140 : 80} /FontFile2 ${fileId} 0 R >>`));
      const gids = [...f.used.keys()].sort((a, b) => a - b);
      const W = gids.map((g) => `${g} [${Math.round(t.advance(g) * k)}]`).join(' ');
      const cidId = add(str(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descId} 0 R /W [${W}] /CIDToGIDMap /Identity >>`));
      const chunks = [];
      for (let i = 0; i < gids.length; i += 100) {
        const part = gids.slice(i, i + 100);
        chunks.push(`${part.length} beginbfchar\n${part.map((g) => `<${g.toString(16).padStart(4, '0')}> <${f.used.get(g).toString(16).padStart(4, '0')}>`).join('\n')}\nendbfchar`);
      }
      const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chunks.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
      const toUniId = add(await stream('', str(cmap)));
      const fontId = add(str(`<< /Type /Font /Subtype /Type0 /BaseFont /${baseName} /Encoding /Identity-H /DescendantFonts [${cidId} 0 R] /ToUnicode ${toUniId} 0 R >>`));
      fontRefs.push(`/${f.name} ${fontId} 0 R`);
    }
    const pageIds = [];
    for (const ops of this.pages) {
      const contentId = add(await stream('', str(ops.join('\n'))));
      pageIds.push(add(str(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f2(this.W)} ${f2(this.H)}] /Resources << /Font << ${fontRefs.join(' ')} >> >> /Contents ${contentId} 0 R >>`)));
    }
    objs[pagesId - 1] = str(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    objs[catalogId - 1] = str(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    const infoId = add(str(`<< /Title ${pdfStr(title)} /Author ${pdfStr(author)} /Producer (chimag.ro) >>`));

    const parts = [str('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n')];
    let offset = parts[0].length;
    const offsets = [];
    objs.forEach((o, i) => {
      offsets.push(offset);
      const chunk = concat([str(`${i + 1} 0 obj\n`), o, str('\nendobj\n')]);
      parts.push(chunk); offset += chunk.length;
    });
    const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
    parts.push(str(xref));
    return concat(parts);
  }
}

function concat(arrs) {
  const out = new Uint8Array(arrs.reduce((s, a) => s + a.length, 0));
  let p = 0; for (const a of arrs) { out.set(a, p); p += a.length; }
  return out;
}
