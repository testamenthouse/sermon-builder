// Minimal PDF writer: Letter pages, Helvetica / Helvetica-Bold (built into every reader, nothing embedded),
// word wrapping from the real font metrics, page breaks, a footer. No library.
const W_R = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_B = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
// WinAnsi code points for the characters KJV text and headings use beyond ASCII; anything else becomes '?'.
const WIN = { '‘': 145, '’': 146, '“': 147, '”': 148, '–': 150, '—': 151, '…': 133, '•': 149, ' ': 32 };
const WIN_W = { 145: [222, 278], 146: [222, 278], 147: [333, 500], 148: [333, 500], 150: [556, 556], 151: [1000, 1000], 133: [1000, 1000], 149: [350, 350] };
export const FONT_WIDTHS = { regular: W_R, bold: W_B };

function codes(text) {
  const out = [];
  for (const ch of String(text)) { const c = ch.codePointAt(0); out.push(c < 128 ? c : WIN[ch] != null ? WIN[ch] : c >= 160 && c <= 255 ? c : 63); }
  return out;
}
function width(text, bold, size) {
  const t = bold ? W_B : W_R; let w = 0;
  for (const c of codes(text)) w += c >= 32 && c <= 126 ? t[c - 32] : WIN_W[c] ? WIN_W[c][bold ? 1 : 0] : 556;
  return w * size / 1000;
}
const pdfStr = text => '(' + codes(text).map(c => (c === 40 || c === 41 || c === 92 ? '\\' : '') + String.fromCharCode(c)).join('') + ')';
const n2 = n => (Math.round(n * 100) / 100).toString();

export class Pdf {
  constructor({ width: w = 612, height: h = 792, margin = 54, footer = '' } = {}) { this.w = w; this.h = h; this.m = margin; this.footer = footer; this.pages = []; this.newPage(); }
  newPage() { this.pages.push([]); this.y = this.h - this.m; }
  get page() { return this.pages[this.pages.length - 1]; }
  get maxW() { return this.w - 2 * this.m; }
  // Room left above the footer; ask for it before a heading so it never ends a page alone.
  need(h) { if (this.y - h < this.m + 24) this.newPage(); }
  space(h) { this.y -= h; }
  wrap(text, bold, size, firstW, restW) {
    const lines = []; let line = '', lw = firstW;
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + word : word;
      if (width(t, bold, size) <= lw || !line) line = t; else { lines.push(line); line = word; lw = restW; }
    }
    if (line) lines.push(line); return lines;
  }
  text(str, { bold = false, size = 11, color = '0 0 0', indent = 0, hanging = 0, lead = 1.35, after = 4, align = 'left' } = {}) {
    const lines = this.wrap(str, bold, size, this.maxW - indent, this.maxW - indent - hanging), lh = size * lead;
    lines.forEach((ln, i) => {
      if (this.y - lh < this.m + 24) this.newPage();
      let x = this.m + indent + (i ? hanging : 0);
      if (align === 'center') x = (this.w - width(ln, bold, size)) / 2;
      this.page.push('BT /F' + (bold ? 2 : 1) + ' ' + size + ' Tf ' + color + ' rg 1 0 0 1 ' + n2(x) + ' ' + n2(this.y - size) + ' Tm ' + pdfStr(ln) + ' Tj ET');
      this.y -= lh;
    });
    this.y -= after;
  }
  rule() { if (this.y < this.m + 24) this.newPage(); this.page.push('0.85 G 0.5 w ' + n2(this.m) + ' ' + n2(this.y) + ' m ' + n2(this.w - this.m) + ' ' + n2(this.y) + ' l S'); this.y -= 10; }
  bytes() {
    const n = this.pages.length, objs = [];
    const add = s => { objs.push(s); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add(''); // pages, filled below
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    this.pages.forEach((ops, i) => {
      const foot = this.footer ? [this.footer, (i + 1) + ' / ' + n] : [(i + 1) + ' / ' + n];
      const fx = this.m, fy = this.m - 24;
      const ft = foot.map((t, j) => 'BT /F1 9 Tf 0.45 0.45 0.45 rg 1 0 0 1 ' + n2(j ? this.w - this.m - width(t, false, 9) : fx) + ' ' + n2(fy) + ' Tm ' + pdfStr(t) + ' Tj ET');
      const stream = ops.concat(ft).join('\n');
      const c = add('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
      const p = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + this.w + ' ' + this.h + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + c + ' 0 R >>');
      kids.push(p + ' 0 R');
    });
    objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>';
    let out = '%PDF-1.4\n%âãÏÓ\n'; const offs = [];
    objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    const b = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 255; return b;
  }
}
