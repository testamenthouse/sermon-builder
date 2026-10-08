(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useLayoutEffect, useRef, useState } = React;
const { useStore, set, setBlock, setKind, removeBlock, moveBlock, duplicateBlock, toggleFlag, fillScripture, setReference, insertBlock, createIllustration, flash, touch, open, toggleIll } = SB.store;
const { KINDS, KIND, kindLabel, kindColor } = SB.shared.blocks;
const { moveStep, canInsert, canSwitch } = SB.shared.outline;
const { MdEditor } = SB.ui.MdEditor;
const { caretTo, caretEdge } = SB.lib.md;
const { I } = SB.ui.Icons;

// Every empty body says what goes there: the kind's label, or Notes under a titled block.
const bodyPh = b => b.kind === 'scripture' ? '' : HAS_HEADING(b.kind) || b.kind === 'custom' ? 'Notes' : b.kind === 'quote' ? 'Quote' : KIND[b.kind].label;
const HAS_HEADING = k => !!KIND[k].heading && k !== 'scripture' && k !== 'quote';

// The "+" between blocks. Opens the kind menu in insert mode.
function Gap({ index, end }) {
  const km = useStore(s => s.kindMenu);
  const on = km && km.mode === 'insert' && km.index === index;
  const allow = k => { const s = open(); return !s || canInsert(s.blocks, index, k); }; // inside a container: no point, transition or closing kind
  return html`<div className=${'gap' + (end ? ' end' : '')}>
    <button className=${'plus' + (on ? ' on' : '')} onClick=${e => { e.stopPropagation(); set({ kindMenu: on ? null : { mode: 'insert', index } }); }}><${I} name="plus" size=${12} /></button>
    ${on && html`<${KindMenu} onPick=${k => insertBlock(index, k)} onIll=${() => { insertBlock(index, 'illustration'); toggleIll(true); }} align="center" allow=${allow} />`}
  </div>`;
}

// Floats over the page (position: fixed) anchored to its parent, so opening it never
// grows the document or scrolls the sermon; it flips above the anchor when the
// viewport has more room there and scrolls inside itself when the list is taller.
const PAD = 8, GAP = 4;
function KindMenu({ onPick, onIll, align = 'left', current, allow = () => true }) {
  const [q, setQ] = useState(''); const [pos, setPos] = useState(null); const ref = useRef(null), inp = useRef(null);
  useEffect(() => { if (pos && inp.current) inp.current.focus({ preventScroll: true }); }, [!!pos]); // only once placed: a visibility:hidden input refuses focus
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) set({ kindMenu: null }); }; document.addEventListener('pointerdown', h, true); return () => document.removeEventListener('pointerdown', h, true); }, []);
  const list = KINDS.filter(k => allow(k.kind) && (!q || k.label.toLowerCase().includes(q.toLowerCase())));
  const place = () => {
    const el = ref.current, anchor = el && el.parentElement; if (!anchor) return;
    const a = anchor.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    const below = vh - a.bottom - GAP - PAD, above = a.top - GAP - PAD, need = el.scrollHeight;
    const down = below >= need || below >= above;
    const maxHeight = Math.max(120, down ? below : above);
    const w = el.offsetWidth;
    let left = align === 'center' ? a.left + a.width / 2 - w / 2 : a.left;
    left = Math.min(Math.max(PAD, left), vw - w - PAD);
    setPos(down ? { top: a.bottom + GAP, left, maxHeight } : { bottom: vh - a.top + GAP, left, maxHeight });
  };
  useLayoutEffect(place, [list.length, align]);
  useEffect(() => { const h = e => { if (!(ref.current && e.target instanceof Node && ref.current.contains(e.target))) place(); }; window.addEventListener('scroll', h, true); window.addEventListener('resize', h); return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); }; }, [align]);
  const onKey = e => { if (e.key === 'Enter' && list[0]) { e.preventDefault(); onPick(list[0].kind); } else if (e.key === 'Escape') { e.stopPropagation(); set({ kindMenu: null }); } };
  return html`<div ref=${ref} className="pop fixed" style=${pos || { visibility: 'hidden', top: 0, left: 0 }} onClick=${e => e.stopPropagation()}>
    <input ref=${inp} placeholder="Kind" value=${q} onChange=${e => setQ(e.target.value)} onKeyDown=${onKey} />
    ${list.map(k => html`<button key=${k.kind} className=${current === k.kind ? 'on' : ''} onMouseDown=${e => e.preventDefault()} onClick=${() => onPick(k.kind)}>${k.label}</button>`)}
    ${onIll && !q && html`<><div className="hair" /><button onMouseDown=${e => e.preventDefault()} onClick=${onIll}>Illustrations…</button></>`}
  </div>`;
}

function BlockMenu({ b, index, count, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); }; document.addEventListener('pointerdown', h, true); return () => document.removeEventListener('pointerdown', h, true); }, []);
  const hidden = b.flags.includes('hidden'), s = open(), blocks = s ? s.blocks : [];
  const stuck = d => moveStep(blocks, b.id, d) === blocks; // a point steps over whole groups
  const row = (label, fn, dis) => html`<button disabled=${dis} style=${dis ? { opacity: .4 } : undefined} onClick=${() => { onClose(); fn(); }}>${label}</button>`;
  return html`<div ref=${ref} className="pop" style=${{ top: '100%', right: 0 }} onClick=${e => e.stopPropagation()}>
    ${row('Move up', () => moveBlock(b.id, -1), stuck(-1))}
    ${row('Move down', () => moveBlock(b.id, 1), stuck(1))}
    ${row('Duplicate', () => duplicateBlock(b.id))}
    <div className="hair" />
    ${row(hidden ? 'Show in podium' : 'Hide in podium', () => toggleFlag(b.id, 'hidden'))}
    ${b.kind === 'illustration' && row('Save to library', async () => { const p = await createIllustration({ title: b.heading || 'Untitled', body: b.body }); if (p) flash('Saved to library'); })}
    <div className="hair" />
    ${b.kind === 'custom' && row('Kind…', () => set({ kindMenu: { mode: 'switch', id: b.id } }))}
    ${row('Delete', () => set({ confirm: { title: b.heading || kindLabel(b), onYes: () => removeBlock(b.id) } }))}
  </div>`;
}

function Block({ b, index, count, num, cur, editable = true }) {
  const focusReq = useStore(s => s.focusReq && s.focusReq.id === b.id ? s.focusReq : null);
  const kc = useStore(s => kindColor(b.kind, s.settings.colors));
  const km = useStore(s => s.kindMenu && s.kindMenu.mode === 'switch' && s.kindMenu.id === b.id);
  const [menu, setMenu] = useState(false);
  const body = useRef(null), head = useRef(null), refIn = useRef(null), lbl = useRef(null);
  useEffect(() => {
    if (!focusReq) return;
    const where = focusReq.where;
    if (where === 'label' && lbl.current) { lbl.current.focus(); caretTo(lbl.current, 'end'); }
    else if (where === 'heading' && (head.current || refIn.current)) { const el = head.current || refIn.current; el.focus(); if (head.current) caretTo(head.current, 'end'); }
    else if (body.current) { body.current.focus({ preventScroll: false }); caretTo(body.current, where === 'end' ? 'end' : 'start'); }
    set({ focusReq: null });
  }, [focusReq]);
  const focusNeighbor = (delta, where) => { const s = open(); if (!s) return; const n = s.blocks[index + delta]; if (!n) return; set({ curBlock: n.id, focusReq: { id: n.id, where } }); };
  const onBodyKey = e => {
    const el = e.currentTarget, empty = !b.body && !el.textContent;
    if (e.key === '/' && empty && !e.metaKey && !e.ctrlKey && b.kind !== 'point') { e.preventDefault(); set({ kindMenu: { mode: 'switch', id: b.id } }); return; }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); insertBlock(index + 1, 'text'); return; }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && (e.metaKey || e.ctrlKey) && e.altKey) { e.preventDefault(); moveBlock(b.id, e.key === 'ArrowUp' ? -1 : 1); return; }
    if (e.key === 'd' && (e.metaKey || e.ctrlKey) && !e.shiftKey) { e.preventDefault(); duplicateBlock(b.id); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const edge = caretEdge(el);
      if (e.key === 'ArrowUp' && edge.first) { if (HAS_HEADING(b.kind) && head.current) { e.preventDefault(); head.current.focus(); caretTo(head.current, 'end'); } else if (b.kind === 'scripture' && refIn.current) { e.preventDefault(); refIn.current.focus(); } else { e.preventDefault(); focusNeighbor(-1, 'end'); } }
      if (e.key === 'ArrowDown' && edge.last) { e.preventDefault(); focusNeighbor(1, 'start'); }
    }
  };
  const onHeadKey = e => {
    if (e.key === 'Enter') { e.preventDefault(); body.current && body.current.focus(); body.current && caretTo(body.current, 'start'); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); body.current && body.current.focus(); body.current && caretTo(body.current, 'start'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusNeighbor(-1, 'end'); }
  };
  const onRefKey = e => {
    if (e.key === 'Enter') { e.preventDefault(); if (!fillScripture(b.id)) flash('Reference not found'); body.current && body.current.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); body.current && body.current.focus(); caretTo(body.current, 'start'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusNeighbor(-1, 'end'); }
  };
  useEffect(() => { const el = head.current; if (el && document.activeElement !== el && el.textContent !== b.heading) el.textContent = b.heading; const l = lbl.current; if (l && document.activeElement !== l && l.textContent !== (b.label || '')) l.textContent = b.label || ''; });
  // A custom block's caption is its own editable label; the kind menu for it lives in the … menu (and `/` on an empty body).
  const onLabelKey = e => { if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'Tab') { e.preventDefault(); if (head.current) { head.current.focus(); caretTo(head.current, 'end'); } } else if (e.key === 'ArrowUp') { e.preventDefault(); focusNeighbor(-1, 'end'); } };
  const label = kindLabel(b), hidden = b.flags.includes('hidden'), empty = !b.body.trim() && !b.heading.trim();
  const setCur = () => { if (!cur) set({ curBlock: b.id }); };
  return html`<div className=${'blk group ' + b.kind + (cur ? ' cur' : '') + (hidden ? ' hidden' : '') + (empty ? ' ph' : '')} data-bid=${b.id} style=${kc ? { '--kc': kc } : undefined} onPointerDown=${setCur} onFocus=${setCur} onClick=${e => { if (e.target === e.currentTarget && body.current) { body.current.focus(); caretTo(body.current, 'end'); } }}>
    <div className="blk-h" style=${{ position: 'relative' }}>
      ${b.kind === 'point' ? html`<span className="kind fixed">${num && html`<span className="pn">${num}</span>`}${label}</span>`
        : b.kind === 'custom' ? html`<span ref=${lbl} className="kind lbl" contentEditable suppressContentEditableWarning spellCheck=${false} data-ph="Label" onKeyDown=${onLabelKey} onInput=${e => { touch(); setBlock(b.id, { label: e.currentTarget.textContent.replace(/\n/g, ' ') }); }} onBlur=${e => { const t = e.currentTarget.textContent.trim(); if (t !== e.currentTarget.textContent) e.currentTarget.textContent = t; if (t !== (b.label || '')) setBlock(b.id, { label: t }); }} />`
        : html`<button className="kind" onClick=${e => { e.stopPropagation(); set({ kindMenu: km ? null : { mode: 'switch', id: b.id } }); }}>${label}</button>`}
      ${hidden && html`<span className="flag" title="Hidden in podium"><${I} name="eye-off" size=${14} /></span>`}
      <span className="sp" />
      <button className=${'ib quiet reveal' + (menu ? ' show' : '')} onClick=${e => { e.stopPropagation(); setMenu(!menu); }}><${I} name="dots" /></button>
      ${menu && html`<${BlockMenu} b=${b} index=${index} count=${count} onClose=${() => setMenu(false)} />`}
      ${km && html`<${KindMenu} current=${b.kind} onPick=${k => setKind(b.id, k)} allow=${k => { const s = open(); return !s || canSwitch(s.blocks, index, k); }} />`}
    </div>
    ${HAS_HEADING(b.kind) && html`<div ref=${head} className="hd" contentEditable suppressContentEditableWarning data-ph=${KIND[b.kind].heading} onKeyDown=${onHeadKey} onInput=${e => { touch(); setBlock(b.id, { heading: e.currentTarget.textContent.replace(/\n/g, ' ') }); }} onBlur=${e => { const t = e.currentTarget.textContent.trim(); if (t !== e.currentTarget.textContent) e.currentTarget.textContent = t; if (t !== b.heading) setBlock(b.id, { heading: t }); }} />`}
    ${b.kind === 'scripture' && html`<div className="ref"><input ref=${refIn} placeholder="Reference" value=${b.heading} onChange=${e => { touch(); setReference(b.id, e.target.value); }} onKeyDown=${onRefKey} onBlur=${() => { if (b.heading.trim()) fillScripture(b.id); }} />${b.body.trim() ? html`<span className="v">KJV</span>` : null}</div>`}
    <${MdEditor} editorRef=${body} value=${b.body} scripture=${b.kind === 'scripture'} placeholder=${bodyPh(b)} onChange=${t => { touch(); setBlock(b.id, { body: t }); }} onKeyDown=${onBodyKey} />
    ${b.kind === 'quote' && html`<div className="src">— <input placeholder="Source" value=${b.heading} onChange=${e => { touch(); setBlock(b.id, { heading: e.target.value }); }} /></div>`}
  </div>`;
}
(SB.ui ||= {}).Block = { Gap, KindMenu, Block };
})(globalThis.SB ||= {});
