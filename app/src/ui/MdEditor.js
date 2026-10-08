(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useLayoutEffect, useRef } = React;
const { fill, decorateAll, serialize } = SB.lib.md;

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
  const onPaste = e => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    if (lines.length === 1) { document.execCommand('insertText', false, text); return; }
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    document.execCommand('insertHTML', false, lines.map(l => '<p style="margin:0">' + (l ? esc(l) : '<br>') + '</p>').join(''));
  };
  return html`<div ref=${el => { ref.current = el; if (editorRef) editorRef.current = el; }} className=${'body ' + className} contentEditable suppressContentEditableWarning spellCheck=${spell} data-ph=${placeholder || ''} style=${style} onInput=${onInput} onPaste=${onPaste} onKeyDown=${onKeyDown} onFocus=${onFocus} />`;
}
(SB.ui ||= {}).MdEditor = { MdEditor };
})(globalThis.SB ||= {});
