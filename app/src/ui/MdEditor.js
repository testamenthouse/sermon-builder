(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useLayoutEffect, useRef } = React;
const { fill, decorateAll, serialize, mdLine, lineOf, caretOffset, replaceLine, continuation } = SB.lib.md;

// Contenteditable markdown body. The DOM is rebuilt only when `value` differs from what this editor last emitted.
function MdEditor({ value, onChange, placeholder, scripture, className = '', onKeyDown, onFocus, editorRef, spell = true, style }) {
  const ref = useRef(null), last = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    if (value !== last.current) { fill(el, value || ''); decorateAll(el, scripture); last.current = value; }
    el.classList.toggle('empty', !value);
  });
  const onInput = e => {
    const el = e.currentTarget;
    if (!e.nativeEvent || !e.nativeEvent.isComposing) decorateAll(el, scripture);
    const t = serialize(el); last.current = t; el.classList.toggle('empty', !t); onChange(t);
  };
  // Enter on a list line carries the marker to the next line (numbers count on); Enter on an empty item ends the list.
  const onKey = e => {
    if (onKeyDown) onKeyDown(e);
    if (e.defaultPrevented || e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || (e.nativeEvent && e.nativeEvent.isComposing)) return;
    const el = e.currentTarget, sel = window.getSelection(); if (!sel.isCollapsed) return;
    const p = lineOf(el); if (!p) return;
    const L = mdLine(p.textContent, scripture), cont = continuation(L); if (cont === null || caretOffset(p) < L.mark.length) return;
    e.preventDefault();
    if (!L.c.trim()) { replaceLine(p, ''); return; }
    document.execCommand('insertParagraph'); document.execCommand('insertText', false, cont);
  };
  // A click on a checklist box toggles its line between `- [ ]` and `- [x]`.
  const onMouseDown = e => {
    const tk = e.target.closest && e.target.closest('.tk'); if (!tk) return;
    e.preventDefault(); const el = e.currentTarget, p = tk.parentNode; el.focus({ preventScroll: true });
    const L = mdLine(p.textContent, scripture); if (L.t !== 'task' && L.t !== 'done') return;
    replaceLine(p, (L.t === 'task' ? L.mark.replace('[ ]', '[x]') : L.mark.replace(/\[[xX]\]/, '[ ]')) + L.c);
  };
  const onPaste = e => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    if (lines.length === 1) { document.execCommand('insertText', false, text); return; }
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    document.execCommand('insertHTML', false, lines.map(l => '<p style="margin:0">' + (l ? esc(l) : '<br>') + '</p>').join(''));
  };
  return html`<div ref=${el => { ref.current = el; if (editorRef) editorRef.current = el; }} className=${'body ' + className} contentEditable suppressContentEditableWarning spellCheck=${spell} data-ph=${placeholder || ''} style=${style} onInput=${onInput} onPaste=${onPaste} onKeyDown=${onKey} onMouseDown=${onMouseDown} onFocus=${onFocus} />`;
}
(SB.ui ||= {}).MdEditor = { MdEditor };
})(globalThis.SB ||= {});
