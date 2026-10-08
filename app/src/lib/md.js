// iA-Writer style markdown: files stay raw; the editor decorates each <p> in place (markers dimmed), so innerText round-trips.
import { findRefs, formatRef } from '../../../shared/bible.js';

export const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/ /g, '&nbsp;');
export function mdLine(s, scripture) {
  let m;
  if (scripture && (m = /^(\d{1,3})\s(.*)$/.exec(s))) return { t: 'v', mark: m[1] + ' ', c: m[2] };
  if (/^\s*(-{3,}|\*{3,})\s*$/.test(s)) return { t: 'hr', mark: s, c: '' };
  if ((m = /^(#{1,3})\s+(.*)$/.exec(s))) return { t: 'h' + m[1].length, mark: s.slice(0, s.length - m[2].length), c: m[2] };
  if ((m = /^>\s?(.*)$/.exec(s))) return { t: 'q', mark: s.slice(0, s.length - m[1].length), c: m[1] };
  if ((m = /^[-*+]\s+(.*)$/.exec(s))) return { t: 'ul', mark: s.slice(0, s.length - m[1].length), c: m[1] };
  if ((m = /^\d+[.)]\s+(.*)$/.exec(s))) return { t: 'ol', mark: s.slice(0, s.length - m[1].length), c: m[1] };
  return { t: 'p', mark: '', c: s };
}
// Plain text segment → HTML, optionally wrapping scripture references so Podium can pop them up.
function plain(s, refs) {
  if (!refs) return esc(s);
  const found = findRefs(s); if (!found.length) return esc(s);
  let out = '', i = 0;
  for (const f of found) { out += esc(s.slice(i, f.index)) + '<span class="xref" data-ref="' + esc(formatRef(f.parsed)) + '">' + esc(f.text) + '</span>'; i = f.index + f.length; }
  return out + esc(s.slice(i));
}
export function mdInline(s, edit, refs) {
  const mk = m => edit ? '<span style="color:var(--faint)">' + esc(m) + '</span>' : '';
  const re = /(`+)([^`]+?)\1|(\*\*|__)(?=\S)([\s\S]*?\S)\3|(~~)(?=\S)(.*?\S)\5|(?<!\w)(\*|_)(?=\S)([^*_]*?\S)\7(?!\w)/g;
  let out = '', i = 0, m;
  while ((m = re.exec(s))) {
    out += plain(s.slice(i, m.index), refs); i = re.lastIndex;
    if (m[1]) out += mk(m[1]) + '<code>' + esc(m[2]) + '</code>' + mk(m[1]);
    else if (m[3]) out += mk(m[3]) + '<strong>' + plain(m[4], refs) + '</strong>' + mk(m[3]);
    else if (m[5]) out += mk(m[5]) + '<s>' + plain(m[6], refs) + '</s>' + mk(m[5]);
    else out += mk(m[7]) + '<em>' + plain(m[8], refs) + '</em>' + mk(m[7]);
  }
  return out + plain(s.slice(i), refs);
}
// Rendered markdown for print / podium / docx preview. Flat: lists are <p class="li">, quotes <p class="q">.
export function mdHtml(text, { scripture = false, refs = false } = {}) {
  let out = '';
  for (const s of (text || '').split('\n')) {
    const L = mdLine(s, scripture), inl = mdInline(L.c, false, refs);
    if (L.t === 'v') out += '<p class="vl"><sup class="vn">' + esc(L.mark.trim()) + '</sup>' + inl + '</p>';
    else if (L.t === 'hr') out += '<hr>';
    else if (L.t[0] === 'h') out += '<' + L.t + '>' + inl + '</' + L.t + '>';
    else if (L.t === 'ul') out += '<p class="li">• ' + inl + '</p>';
    else if (L.t === 'ol') out += '<p class="li">' + esc(L.mark.trim()) + ' ' + inl + '</p>';
    else if (L.t === 'q') out += '<p class="q">' + inl + '</p>';
    else out += '<p>' + (inl || '<br>') + '</p>';
  }
  return out;
}
const lineStyles = {
  h1: 'font-size:1.6em;font-weight:700;line-height:1.25;margin:.6em 0 .2em;letter-spacing:-0.01em', h2: 'font-size:1.3em;font-weight:600;line-height:1.3;margin:.5em 0 .15em',
  h3: 'font-size:1.1em;font-weight:600;margin:.4em 0 .1em', q: 'padding-left:1em;border-left:2px solid var(--line);color:var(--muted)', ul: 'padding-left:1em', ol: 'padding-left:1em', hr: 'letter-spacing:.3em', p: '', v: ''
};
export function decorateAll(el, scripture) { for (const p of el.children) decorate(p, scripture); }
export function decorate(p, scripture) {
  const text = p.textContent, L = mdLine(text, scripture);
  const mk = m => m ? '<span ' + (L.t === 'v' ? 'class="vn"' : 'style="color:var(--faint)"') + '>' + esc(m) + '</span>' : '';
  const html = text ? mk(L.mark) + mdInline(L.c, true) : '<br>';
  if (p.dataset.ls !== L.t) { p.style.cssText = 'margin:0;' + lineStyles[L.t]; p.dataset.ls = L.t; }
  if (p.innerHTML === html) return;
  const sel = window.getSelection(); let off = -1;
  if (sel.rangeCount && sel.isCollapsed && p.contains(sel.anchorNode)) { const r = document.createRange(); r.selectNodeContents(p); r.setEnd(sel.anchorNode, sel.anchorOffset); off = r.toString().length; }
  p.innerHTML = html;
  if (off < 0) return;
  const r = document.createRange(), w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let n, acc = 0, hit = false;
  while ((n = w.nextNode())) { if (acc + n.length >= off) { r.setStart(n, off - acc); r.collapse(true); hit = true; break; } acc += n.length; }
  if (!hit) { r.selectNodeContents(p); r.collapse(false); }
  sel.removeAllRanges(); sel.addRange(r);
}
export function serialize(el) {
  const kids = Array.from(el.children), txt = k => k.innerText.replace(/\n+$/, '');
  if (!kids.length) return txt(el);
  return kids.map(txt).join('\n');
}
export function fill(el, text) {
  el.innerHTML = '';
  for (const line of (text || '').split('\n')) { const p = document.createElement('p'); p.style.margin = '0'; if (line) p.textContent = line; else p.appendChild(document.createElement('br')); el.appendChild(p); }
}
export function caretTo(el, where) {
  const r = document.createRange(), s = window.getSelection(), node = where === 'start' ? el.firstElementChild || el : el.lastElementChild || el;
  r.selectNodeContents(node); r.collapse(where === 'start'); s.removeAllRanges(); s.addRange(r);
}
// Is the collapsed caret in the first / last line of this editor?
export function caretEdge(el) {
  const s = window.getSelection(); if (!s.rangeCount || !el.contains(s.anchorNode)) return { first: false, last: false };
  let block = s.anchorNode; while (block && block.parentNode !== el) block = block.parentNode;
  const r = s.getRangeAt(0).cloneRange(), rect = r.getBoundingClientRect(), eb = el.getBoundingClientRect();
  const line = rect.height || 20;
  return { first: block === el.firstElementChild && (rect.top - eb.top) < line * 1.2, last: block === el.lastElementChild && (eb.bottom - rect.bottom) < line * 1.2 };
}
