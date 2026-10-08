(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useState } = React;
const { I } = SB.ui.Icons;

// Chip input: comma or Enter commits a tag, Backspace on an empty field takes the last one back, × removes one.
function TagsInput({ value, onChange, placeholder = 'Tags', className = '', onKeyDown }) {
  const [draft, setDraft] = useState('');
  const commit = raw => { const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean); if (!parts.length) return; const next = [...value]; for (const p of parts) if (!next.some(t => t.toLowerCase() === p.toLowerCase())) next.push(p); setDraft(''); if (next.length !== value.length) onChange(next); };
  const remove = i => onChange(value.filter((_, j) => j !== i));
  const onKey = e => {
    if (e.key === ',' || (e.key === 'Enter' && draft.trim())) { e.preventDefault(); commit(draft); return; }
    if (e.key === 'Backspace' && !draft && value.length) { e.preventDefault(); const last = value[value.length - 1]; onChange(value.slice(0, -1)); setDraft(last); return; }
    onKeyDown && onKeyDown(e);
  };
  return html`<div className=${'tags ' + className} onClick=${e => { const el = e.currentTarget.querySelector('input'); el && el.focus(); }}>
    ${value.map((t, i) => html`<span key=${t + i} className="tag">${t}<button className="x" title="Remove" onClick=${e => { e.stopPropagation(); remove(i); }}><${I} name="x" size=${10} /></button></span>`)}
    <input value=${draft} placeholder=${value.length ? '' : placeholder} onChange=${e => { const v = e.target.value; if (v.includes(',')) commit(v); else setDraft(v); }} onKeyDown=${onKey} onBlur=${() => commit(draft)} />
  </div>`;
}
(SB.ui ||= {}).Tags = { TagsInput };
})(globalThis.SB ||= {});
