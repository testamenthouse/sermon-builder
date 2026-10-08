// Print pipeline (manuscript / outline / handout on Letter). Builds a clean hidden iframe, no app CSS.
import { mdHtml, esc } from './md.js';
import { kindLabel, kindColor } from '../../../shared/blocks.js';

const fonts = { sans: 'Inter, -apple-system, sans-serif', serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif", mono: "'SF Mono', Menlo, Consolas, monospace", courier: "'Courier Prime', 'Courier New', Courier, monospace" };
export const fontFamily = f => fonts[f] || fonts.sans;

import { pointNumbers, outlineTree } from '../../../shared/outline.js';
export { pointNumbers };
export function headingOf(b) { return (b.heading || '').trim() || (b.body || '').split('\n').find(l => l.trim()) || ''; }
export function metaLine(meta) { return [meta.collection, meta.date ? fmtDate(meta.date) : '', meta.passage].filter(Boolean).join(' · '); }
export function fmtDate(d) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); if (!m) return d || ''; return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); }

// scope: 'manuscript' | 'outline' | 'handout'
export function buildHtml(sermon, scope, colors) {
  const { meta, blocks } = sermon, nums = pointNumbers(blocks);
  const tint = b => { const c = kindColor(b.kind, colors); return c ? ' style="color:' + c + '"' : ''; }; // kind colors print on labels and numbers only
  // A point group prints as the editor draws it: number and title flush left as the heading line, the group's blocks indented beneath.
  const group = (p, inner, cls) => '<div class="' + cls + ' pg"><div class="ph"><span class="pn"' + tint(p) + '>' + esc(nums.get(p.id) || '') + '</span>' + esc((p.heading || '').trim() || 'Point') + '</div>' + inner + '</div>';
  const head = '<div class="head"><div class="t">' + esc(meta.title || 'Untitled') + '</div>' + (metaLine(meta) ? '<div class="ml">' + esc(metaLine(meta)) + '</div>' : '') + (meta.big_idea ? '<div class="bi">' + esc(meta.big_idea) + '</div>' : '') + '</div>';
  let body = '';
  if (scope === 'manuscript') {
    // Manuscript A: a label column on the left (kind, reference, or point number) and the text on the right.
    // Empty blocks are skipped; the kind word is dropped where the content carries it (text, transition).
    const empty = b => !(b.heading || '').trim() && !(b.body || '').trim();
    const bodyHtml = b => (b.body || '').trim() ? '<div class="bd">' + mdHtml(b.body, { scripture: b.kind === 'scripture' }) + '</div>' : '';
    const one = b => {
      if (empty(b)) return '';
      const heading = (b.heading || '').trim();
      let label = '', content = '';
      if (b.kind === 'point') { if (!(b.body || '').trim()) return ''; label = ''; content = bodyHtml(b); }
      else if (b.kind === 'scripture') { label = esc(heading); content = bodyHtml(b); }
      else if (b.kind === 'quote') { label = esc(kindLabel(b)); content = bodyHtml(b) + (heading ? '<div class="src">— ' + esc(heading) + '</div>' : ''); }
      else if (b.kind === 'text' || b.kind === 'transition') { label = ''; content = bodyHtml(b); }
      else { label = esc(kindLabel(b)); content = (heading ? '<div class="lead">' + esc(heading) + '</div>' : '') + bodyHtml(b); }
      return '<div class="b ' + b.kind + '"><div class="lb"' + tint(b) + '>' + label + '</div><div class="ct">' + content + '</div></div>';
    };
    for (const sec of outlineTree(blocks)) {
      if (sec.type === 'point') body += group(sec.block, one(sec.block) + sec.blocks.map(one).join(''), 'ms-g');
      else if (sec.type === 'transition') body += one(sec.block);
      else body += sec.blocks.map(one).join('');
    }
  } else if (scope === 'outline') {
    // Outline B: groups of label + line rows, by the shared hierarchy (shared/outline.js): whatever precedes
    // the first point is one group, each point group is closed by a hairline, transitions sit between groups
    // as an unboxed italic line, and the closing blocks form the last group. Empty blocks and notes are skipped.
    const line = b => { const heading = (b.heading || '').trim(); return b.kind === 'scripture' ? (heading || headingOf(b)) : b.kind === 'quote' ? headingOf({ body: b.body }) : headingOf(b); };
    const cls = b => b.kind === 'scripture' ? 'sc' : b.kind === 'quote' ? 'qt' : '';
    const plain = b => { const l = line(b); if (b.kind === 'note' || !l.trim()) return null; return ['<span' + tint(b) + '>' + esc(kindLabel(b)) + '</span>', '<span class="' + cls(b) + '">' + esc(l.slice(0, 160)) + '</span>']; };
    const groups = [];
    for (const sec of outlineTree(blocks)) {
      if (sec.type === 'transition') { const l = line(sec.block); if (l.trim()) groups.push({ tr: true, rows: [['', '<span class="tr">' + esc(l.slice(0, 160)) + '</span>']] }); continue; }
      const rows = [];
      for (const b of sec.blocks) { const r = plain(b); if (r) rows.push(r); }
      if (rows.length || sec.type === 'point') groups.push({ rows, point: sec.type === 'point' ? sec.block : null });
    }
    const rowsHtml = g => g.rows.map(r => '<div class="lb">' + r[0] + '</div><div class="ct">' + r[1] + '</div>').join('');
    body += groups.map(g => g.point ? group(g.point, rowsHtml(g), 'g') : '<div class="g' + (g.tr ? ' tr' : '') + '">' + rowsHtml(g) + '</div>').join('');
  } else if (scope === 'handout') {
    let lastPoint = null; const qs = [];
    for (const b of blocks) {
      if (b.kind === 'point') { body += '<div class="hp ' + b.kind + '"><span class="n"' + tint(b) + '>' + esc(nums.get(b.id) || '') + '</span> ' + esc(b.heading || headingOf(b)) + '</div>'; lastPoint = b; }
      else if (b.kind === 'scripture' && b.heading) body += '<div class="hs">' + esc(b.heading) + '</div>';
      else if (b.kind === 'question') qs.push(b.body);
    }
    if (qs.length) body += '<div class="qh">Questions</div>' + qs.map((q, i) => '<div class="hq">' + (i + 1) + '. ' + esc(q.split('\n')[0]) + '<div class="ln"></div></div>').join('');
  }
  return '<div class="' + (scope === 'manuscript' ? 'ms' : scope === 'outline' ? 'ol' : 'ho') + '">' + head + body + '</div>';
}
export function buildCss(settings, title, paged) {
  const ff = fontFamily(settings.font), pt = Math.round(settings.size * 0.67);
  const base = 'html,*{print-color-adjust:exact;-webkit-print-color-adjust:exact}body{margin:0}body{color:#000;background:#fff;font-family:' + ff + ';font-size:' + pt + 'pt;line-height:1.55;-webkit-print-color-adjust:exact}p{margin:0 0 .5em;white-space:pre-wrap;overflow-wrap:break-word}p:last-child{margin-bottom:0}' +
    // head
    '.t{font-weight:700;font-size:2.1em;letter-spacing:-.01em;line-height:1.1;margin:0 0 2mm}.ml{font-size:.8em;color:#5a5a58;margin:0 0 2mm}.bi{font-style:italic;font-size:1.05em;color:#333;margin:1mm 0 0}' +
    '.head{margin-bottom:9mm}.ms .head{padding-bottom:5mm;margin-bottom:8mm;border-bottom:2px solid #000}' +
    // point groups: number floating in a gutter left of the whole group, a rule beside it (mirrors the editor)
    '.pg{break-inside:avoid;border:1px solid #d4d4d0;border-radius:3mm;padding:4mm 5mm 4mm}.ms-g{margin:0 0 7mm}.ms-g .b:last-child{margin-bottom:0}.ms-g .b.point{padding-top:0}.g.pg{border-bottom:1px solid #d4d4d0;padding-bottom:4mm}' +
    '.ph{grid-column:1/-1;display:flex;align-items:baseline;gap:3mm;font-size:1.5em;font-weight:700;line-height:1.2;margin:0 0 3mm;break-after:avoid}.ph .pn{color:#8a8a86;min-width:1.1em;font-variant-numeric:tabular-nums}.g .ph{margin-bottom:1mm}' +
    // manuscript (A): label column + text column, air between blocks
    '.b{display:grid;grid-template-columns:22mm minmax(0,1fr);column-gap:5mm;margin:0 0 6mm;break-inside:avoid}.b.point{padding-top:4mm}' +
    '.lb{text-align:right;color:#8a8a86;font-size:.8em;padding-top:.45em;line-height:1.45}.lb .num{font-size:1.9em;font-weight:700;color:inherit;line-height:1.1}' +
    '.b .hd{font-weight:700;font-size:1.5em;line-height:1.2;margin:0 0 2.5mm;break-after:avoid}.lead{font-weight:700;margin:0 0 .5mm}' +
    '.vl{padding-left:1.5em;text-indent:-1.5em;margin-bottom:.3em}.vn{font-size:.6em;color:#8a8a86;margin-right:.35em;vertical-align:super;line-height:0}' +
    '.b.quote .bd{font-style:italic}.src{font-size:.85em;color:#555;margin-top:1mm}.b.note .bd{font-size:.85em;color:#555}.b.transition .bd{font-style:italic;color:#444}' +
    // outline (B): groups of label + line rows, a hairline closing each group
    '.g{display:grid;grid-template-columns:27mm minmax(0,1fr);column-gap:6mm;row-gap:2.6mm;padding-bottom:6mm;margin-bottom:6mm;border-bottom:1px solid #c8c8c4;break-inside:avoid}.g:last-child{border-bottom:0}.g.tr{border-bottom:0;padding-bottom:0;margin-bottom:4mm}' +
    '.g .lb{padding-top:.25em}.g .num{font-size:1.6em;font-weight:700;color:#8a8a86;line-height:1.2}.g .pt{font-size:1.35em;font-weight:700;line-height:1.25}' +
    '.g .sc{font-weight:700}.g .tr{font-style:italic;color:#444}.g .qt{font-style:italic}' +
    // handout
    '.hp{font-weight:600;margin:4mm 0 1mm}.hp .n{display:inline-block;min-width:1.2em}.hs{padding-left:1.2em;margin:0 0 1mm}.qh{font-weight:600;margin:6mm 0 2mm}.hq{margin:0 0 3mm}.ln{border-bottom:1px solid #000;height:7mm}' +
    // markdown inside bodies
    'h1,h2,h3{font-weight:600;line-height:1.3;break-after:avoid}h1{font-size:1.4em;margin:.8em 0 .3em}h2{font-size:1.2em;margin:.7em 0 .2em}h3{font-size:1.05em;margin:.6em 0 .2em}.q{padding-left:1em;border-left:1px solid #000}.li{padding-left:1.4em;text-indent:-1.4em}hr{border:0;border-top:1px solid #000;margin:.8em 0}code{font-family:ui-monospace,Menlo,monospace;font-size:.9em}strong{font-weight:700}';
  return paged
    ? base + '@page{margin:25mm;@top-center{content:"' + String(title).replace(/[\\"]/g, '\\$&') + '";font-family:' + ff + ';font-size:9pt;color:#000;vertical-align:bottom;padding-bottom:10mm}@bottom-center{content:counter(page);font-family:' + ff + ';font-size:9pt;color:#000;vertical-align:top;padding-top:10mm}}'
    : base + '@page{margin:25mm}';
}
export function doPrint(sermon, settings, scope, paged) {
  const title = sermon.meta.title || 'Untitled', docTitle = title + (scope === 'manuscript' ? '' : ' — ' + scope[0].toUpperCase() + scope.slice(1));
  const html = buildHtml(sermon, scope, settings.colors);
  const css = buildCss(settings, title, !!paged);
  const old = document.getElementById('sb-pf'); if (old) old.remove();
  const f = document.createElement('iframe'); f.id = 'sb-pf'; f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open(); d.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(docTitle) + '</title><link href="' + new URL('./app/fonts/inter.css', document.baseURI) + '" rel="stylesheet"><style>' + css + '</style></head><body>' + html + '</body></html>'); d.close();
  const go = () => {
    const prev = document.title; document.title = docTitle;
    f.contentWindow.onafterprint = () => { document.title = prev; setTimeout(() => f.remove(), 500); };
    f.contentWindow.focus(); f.contentWindow.print();
  };
  const ready = () => (d.fonts ? d.fonts.ready : Promise.resolve()).then(() => setTimeout(go, 50));
  d.readyState === 'complete' ? ready() : (f.onload = ready);
}
