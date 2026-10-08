(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState } = React;
const { I } = SB.ui.Icons;

// The app's own dropdown (no native select): a field-styled button showing the chosen label, a popover of
// options beneath it. ↑/↓ walk, Enter picks, Esc closes. options = [{ value, label }], a null entry draws a hairline.
// up = open above the field (for the last row of a dialog).
function Select({ value, onChange, options, className = '', up = false }) {
  const [open, setOpen] = useState(false); const [hi, setHi] = useState(0); const box = useRef(null);
  const rows = options.filter(Boolean), cur = rows.find(o => o.value === value) || rows[0];
  useEffect(() => { const h = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); }; document.addEventListener('pointerdown', h, true); return () => document.removeEventListener('pointerdown', h, true); }, []);
  const pick = o => { onChange(o.value); setOpen(false); };
  const toggle = () => { setHi(Math.max(0, rows.indexOf(cur))); setOpen(!open); };
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) return toggle(); setHi((hi + 1) % rows.length); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (!open) return toggle(); setHi((hi - 1 + rows.length) % rows.length); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!open) return toggle(); pick(rows[hi]); return; }
    if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
  };
  let i = -1;
  return html`<div ref=${box} className="sel" style=${{ flex: 1, position: 'relative', display: 'flex' }}>
    <button type="button" className=${className + ' sel-b' + (open ? ' on' : '')} onClick=${toggle} onKeyDown=${onKey}><span className="t">${cur ? cur.label : ''}</span><${I} name="chevron-down" size=${14} /></button>
    ${open && html`<div className="pop" style=${up ? { bottom: '100%', left: 0, right: 0, marginBottom: 4 } : { top: '100%', left: 0, right: 0, marginTop: 4 }}>${options.map((o, k) => { if (!o) return html`<div key=${'h' + k} className="hair" />`; const j = ++i; return html`<button key=${o.value} className=${j === hi ? 'on' : ''} onMouseDown=${e => e.preventDefault()} onMouseEnter=${() => setHi(j)} onClick=${() => pick(o)}>${o.label}</button>`; })}</div>`}
  </div>`;
}
(SB.ui ||= {}).Select = { Select };
})(globalThis.SB ||= {});
