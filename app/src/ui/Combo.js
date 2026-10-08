(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState } = React;

// Text field with the app's own suggestion list beneath it (no native datalist): filters as you type,
// ↑/↓ walk the list, Enter takes the highlighted row, Esc closes. Free text stays allowed.
function Combo({ value, onChange, options, className = '', onKeyDown, placeholder }) {
  const [open, setOpen] = useState(false); const [hi, setHi] = useState(0); const box = useRef(null);
  const q = value.trim().toLowerCase();
  const list = options.filter(o => !q || o.toLowerCase().includes(q)).filter(o => o.toLowerCase() !== q);
  useEffect(() => { const h = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); }; document.addEventListener('pointerdown', h, true); return () => document.removeEventListener('pointerdown', h, true); }, []);
  const pick = o => { onChange(o); setOpen(false); };
  const show = open && list.length > 0;
  const onKey = e => {
    if (show && e.key === 'ArrowDown') { e.preventDefault(); setHi((hi + 1) % list.length); return; }
    if (show && e.key === 'ArrowUp') { e.preventDefault(); setHi((hi - 1 + list.length) % list.length); return; }
    if (show && e.key === 'Enter') { e.preventDefault(); pick(list[Math.min(hi, list.length - 1)]); return; }
    if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); return; }
    onKeyDown && onKeyDown(e);
  };
  return html`<div ref=${box} className="combo" style=${{ flex: 1, position: 'relative', display: 'flex' }}>
    <input className=${className} placeholder=${placeholder} value=${value} autoComplete="off" onChange=${e => { onChange(e.target.value); setOpen(true); setHi(0); }} onFocus=${() => setOpen(true)} onKeyDown=${onKey} />
    ${show && html`<div className="pop" style=${{ top: '100%', left: 0, right: 0, marginTop: 4 }}>${list.map((o, i) => html`<button key=${o} className=${i === hi ? 'on' : ''} onMouseDown=${e => e.preventDefault()} onMouseEnter=${() => setHi(i)} onClick=${() => pick(o)}>${o}</button>`)}</div>`}
  </div>`;
}
(SB.ui ||= {}).Combo = { Combo };
})(globalThis.SB ||= {});
