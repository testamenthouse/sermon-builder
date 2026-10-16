// iA-Writer style markdown: files stay raw; the editor decorates each <p> in place (markers dimmed), so innerText round-trips.
(function (SB) {
'use strict';
const { findRefs, formatRef } = SB.shared.bible;

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/ /g, '&nbsp;');
function mdLine(s, scripture) {
  let m;
  if (scripture && (m = /^(\d{1,3})\s(.*)$/.exec(s))) return { t: 'v', mark: m[1] + ' ', c: m[2] };
  if (/^\s*(-{3,}|\*{3,})\s*$/.test(s)) return { t: 'hr', mark: s, c: '' };
  if ((m = /^(#{1,3})\s+(.*)$/.exec(s))) return { t: 'h' + m[1].length, mark: s.slice(0, s.length - m[2].length), c: m[2] };
  if ((m = /^>\s?(.*)$/.exec(s))) return { t: 'q', mark: s.slice(0, s.length - m[1].length), c: m[1] };
  if ((m = /^([-*+] \[([ xX])\] ?)(.*)$/.exec(s))) return { t: m[2] === ' ' ? 'task' : 'done', mark: m[1], c: m[3] };
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
function mdInline(s, edit, refs) {
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
function mdHtml(text, { scripture = false, refs = false } = {}) {
  let out = '';
  for (const s of (text || '').split('\n')) {
    const L = mdLine(s, scripture), inl = mdInline(L.c, false, refs);
    if (L.t === 'v') out += '<p class="vl"><sup class="vn">' + esc(L.mark.trim()) + '</sup>' + inl + '</p>';
    else if (L.t === 'hr') out += '<hr>';
    else if (L.t[0] === 'h') out += '<' + L.t + '>' + inl + '</' + L.t + '>';
    else if (L.t === 'ul') out += '<p class="li">• ' + inl + '</p>';
    else if (L.t === 'task' || L.t === 'done') out += '<p class="li">' + (L.t === 'done' ? '&#9745; ' : '&#9744; ') + inl + '</p>';
    else if (L.t === 'ol') out += '<p class="li">' + esc(L.mark.trim()) + ' ' + inl + '</p>';
    else if (L.t === 'q') out += '<p class="q">' + inl + '</p>';
    else out += '<p>' + (inl || '<br>') + '</p>';
  }
  return out;
}
const lineStyles = {
  h1: 'font-size:1.6em;font-weight:700;line-height:1.25;margin:.6em 0 .2em;letter-spacing:-0.01em', h2: 'font-size:1.3em;font-weight:600;line-height:1.3;margin:.5em 0 .15em',
  h3: 'font-size:1.1em;font-weight:600;margin:.4em 0 .1em', q: 'padding-left:1em;border-left:2px solid var(--line);color:var(--muted)', ul: 'padding-left:1em', ol: 'padding-left:1em', task: 'padding-left:1em', done: 'padding-left:1em;color:var(--muted)', hr: 'letter-spacing:.3em', p: '', v: ''
};
function decorateAll(el, scripture) { for (const p of el.children) decorate(p, scripture); }
// Text offset of (node, offset) inside line p, counting every text node (the checkbox atom's text included).
function offsetIn(p, node, offset) { const r = document.createRange(); r.selectNodeContents(p); r.setEnd(node, offset); return r.toString().length; }
// Put the collapsed caret at a text offset in line p. An offset that lands inside the checkbox atom goes after it.
function setCaret(p, off) {
  const sel = window.getSelection(), r = document.createRange(), w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let n, acc = 0, hit = false;
  while ((n = w.nextNode())) { if (acc + n.length >= off) { const tk = n.parentNode.closest('.tk'); if (tk) r.setStartAfter(tk); else r.setStart(n, off - acc); r.collapse(true); hit = true; break; } acc += n.length; }
  if (!hit) { r.selectNodeContents(p); r.collapse(false); }
  sel.removeAllRanges(); sel.addRange(r);
}
function decorate(p, scripture) {
  const text = p.textContent, L = mdLine(text, scripture);
  const mk = m => m ? '<span ' + (L.t === 'v' ? 'class="vn"' : 'style="color:var(--faint)"') + '>' + esc(m) + '</span>' : '';
  // A checklist marker is one non-editable atom drawn as a box; the marker text stays inside it so innerText round-trips.
  const html = !text ? '<br>' : L.t === 'task' || L.t === 'done'
    ? '<span class="tk' + (L.t === 'done' ? ' on' : '') + '" contenteditable="false">' + esc(L.mark) + '</span>' + (L.t === 'done' ? '<span class="dn">' + mdInline(L.c, true) + '</span>' : mdInline(L.c, true))
    : mk(L.mark) + mdInline(L.c, true);
  if (p.dataset.ls !== L.t) { p.style.cssText = 'margin:0;' + lineStyles[L.t]; p.dataset.ls = L.t; }
  if (p.innerHTML === html) return;
  const sel = window.getSelection(); let off = -1;
  if (sel.rangeCount && sel.isCollapsed && p.contains(sel.anchorNode)) off = offsetIn(p, sel.anchorNode, sel.anchorOffset);
  p.innerHTML = html;
  if (off >= 0) setCaret(p, off);
}
// The line (<p>) holding a node (default: the selection focus), and every line the selection touches, in document order.
function lineOf(el, node) { let n = node || (window.getSelection().rangeCount ? window.getSelection().focusNode : null); while (n && n.parentNode !== el) n = n.parentNode; return n && n.parentNode === el ? n : null; }
function linesOf(el) {
  const sel = window.getSelection(); if (!sel.rangeCount || !el.contains(sel.anchorNode)) return [];
  const a = lineOf(el, sel.anchorNode), b = lineOf(el, sel.focusNode); if (!a || !b) return [];
  const kids = Array.from(el.children), i = kids.indexOf(a), j = kids.indexOf(b);
  return kids.slice(Math.min(i, j), Math.max(i, j) + 1);
}
// Caret offset in line p, or -1 when the caret is elsewhere.
function caretOffset(p) { const sel = window.getSelection(); return sel.rangeCount && p.contains(sel.focusNode) ? offsetIn(p, sel.focusNode, sel.focusOffset) : -1; }
// Replace a line's text through the editing commands so undo and the input handler both see it; falls back to a direct write + input event.
function replaceLine(p, text) {
  const el = p.parentNode, sel = window.getSelection(), r = document.createRange();
  for (const tk of p.querySelectorAll('.tk')) tk.removeAttribute('contenteditable'); // editable again, so the commands treat the marker as text
  r.selectNodeContents(p); sel.removeAllRanges(); sel.addRange(r);
  // Clearing a line goes through a one-character stand-in: deleting a whole selection that holds the checkbox atom makes Chrome merge the line away.
  if (text) document.execCommand('insertText', false, text); else { document.execCommand('insertText', false, ' '); document.execCommand('delete'); }
  if (!el.contains(p) || p.textContent !== text) { if (!el.contains(p)) return; p.innerHTML = text ? '' : '<br>'; if (text) p.textContent = text; setCaret(p, text.length); el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' })); }
}
// What Enter puts at the start of the next line after a list line; null for an ordinary line.
function continuation(L) {
  if (L.t === 'ul') return L.mark;
  if (L.t === 'task' || L.t === 'done') return L.mark[0] + ' [ ] ';
  if (L.t === 'ol') { const m = /^(\d+)([.)]\s+)$/.exec(L.mark); return m ? (Number(m[1]) + 1) + m[2] : L.mark; }
  return null;
}
function serialize(el) {
  const kids = Array.from(el.children), txt = k => k.innerText.replace(/\n+$/, '');
  if (!kids.length) return txt(el);
  return kids.map(txt).join('\n');
}
function fill(el, text) {
  el.innerHTML = '';
  for (const line of (text || '').split('\n')) { const p = document.createElement('p'); p.style.margin = '0'; if (line) p.textContent = line; else p.appendChild(document.createElement('br')); el.appendChild(p); }
}
function caretTo(el, where) {
  const r = document.createRange(), s = window.getSelection(), node = where === 'start' ? el.firstElementChild || el : el.lastElementChild || el;
  r.selectNodeContents(node); r.collapse(where === 'start'); s.removeAllRanges(); s.addRange(r);
}
// Is the collapsed caret in the first / last line of this editor?
function caretEdge(el) {
  const s = window.getSelection(); if (!s.rangeCount || !el.contains(s.anchorNode)) return { first: false, last: false };
  let block = s.anchorNode; while (block && block.parentNode !== el) block = block.parentNode;
  const r = s.getRangeAt(0).cloneRange(), rect = r.getBoundingClientRect(), eb = el.getBoundingClientRect();
  const line = rect.height || 20;
  return { first: block === el.firstElementChild && (rect.top - eb.top) < line * 1.2, last: block === el.lastElementChild && (eb.bottom - rect.bottom) < line * 1.2 };
}
(SB.lib ||= {}).md = { esc, mdLine, mdInline, mdHtml, decorateAll, decorate, serialize, fill, caretTo, caretEdge, setCaret, lineOf, linesOf, caretOffset, replaceLine, continuation };
})(globalThis.SB ||= {});
