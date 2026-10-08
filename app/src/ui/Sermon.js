(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState } = React;
const { useStore, set, open, closeSermon, toggleRail, toggleBible, toggleIll, commitMeta, updateOpen, touch, moveBlockTo, removeBlock, deleteSermon, saveNow, flash, toggleFold, toggleDictation } = SB.store;
const { Block, Gap } = SB.ui.Block;
const { BiblePane } = SB.ui.BiblePane;
const { IllPane } = SB.ui.IllPane;
const { MobileTop, DrawerScrim } = SB.ui.Mobile;
const { I, KIND_ICON } = SB.ui.Icons;
const { kindLabel, kindColor } = SB.shared.blocks;
const { sermonWords, serializeSermon, slugify } = SB.shared.format;
const { headingOf, metaLine } = SB.lib.print;
const { pointNumbers, outlineTree, groupRange, snapDrop } = SB.shared.outline;
const { versesPdf } = SB.lib.verses;
const { loadBible, lookupNow } = SB.lib.bible;
const { docxBlob } = SB.lib.docx;
const { download } = SB.lib.zip;

const cap = s => s[0].toUpperCase() + s.slice(1);

// The rail outline: one row per block, points as folding containers over their group.
// Dragging a point row carries its group; the drop line only lands between groups (shared/outline.js).
function Outline({ s, min }) {
  const cur = useStore(st => st.curBlock), fold = useStore(st => st.fold), colors = useStore(st => st.settings.colors); const nums = pointNumbers(s.blocks); const dragId = useRef(null);
  const kc = b => { const c = kindColor(b.kind, colors); return c ? { '--kc': c } : undefined; };
  const [dragging, setDragging] = useState(null); const [over, setOver] = useState(null); // over = the block index the dragged range would start at
  const idx = new Map(s.blocks.map((b, i) => [b.id, i]));
  const go = b => { set({ curBlock: b.id, focusReq: { id: b.id, where: 'start' }, drawer: false }); const el = document.querySelector('[data-bid="' + b.id + '"]'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  const clear = () => { dragId.current = null; setDragging(null); setOver(null); };
  const dnd = b => ({
    draggable: true,
    onDragStart: e => { dragId.current = b.id; e.dataTransfer.effectAllowed = 'move'; setDragging(b.id); },
    onDragEnd: clear,
    onDragOver: e => { e.preventDefault(); const id = dragId.current; if (!id) return; const r = e.currentTarget.getBoundingClientRect(); const i = idx.get(b.id), after = e.clientY > r.top + r.height / 2; const raw = after ? (b.kind === 'point' && fold[b.id] ? groupRange(s.blocks, b.id)[1] : i + 1) : i; const t = snapDrop(s.blocks, id, raw); if (t !== over) setOver(t); },
    onDrop: e => { e.preventDefault(); const id = dragId.current, t = over; clear(); if (id && t !== null && t !== undefined) moveBlockTo(id, t); },
  });
  // Which rows are on screen (folded groups hide their children), so the drop line can sit next to a visible row.
  const tree = outlineTree(s.blocks), visible = [];
  for (const sec of tree) {
    if (sec.type === 'point') { visible.push(sec.block); if (!fold[sec.block.id]) visible.push(...sec.blocks); }
    else if (sec.type === 'transition') visible.push(sec.block); else visible.push(...sec.blocks);
  }
  const lineBefore = over !== null && over !== undefined ? visible.find(b => idx.get(b.id) >= over) : null, lineAfter = over !== null && over !== undefined && !lineBefore ? visible[visible.length - 1] : null;
  const dropCls = b => lineBefore && lineBefore.id === b.id ? ' drop-before' : lineAfter && lineAfter.id === b.id ? ' drop-after' : '';
  const glyph = b => nums.has(b.id) ? html`<span className="n">${nums.get(b.id)}</span>` : html`<span className="k"><${I} name=${KIND_ICON[b.kind] || 'box'} size=${14} /></span>`;
  const label = b => b.heading && b.kind !== 'quote' ? b.heading : headingOf(b) || kindLabel(b);
  const del = b => set({ confirm: { title: label(b), onYes: () => removeBlock(b.id) } });
  if (min) return html`<div className="outline" style=${{ alignItems: 'center' }}>${s.blocks.map(b => html`<div key=${b.id} className=${'mini' + (b.id === cur ? ' cur' : '') + (b.id === dragging ? ' dragging' : '') + dropCls(b)} title=${b.heading || kindLabel(b)} style=${kc(b)} onClick=${() => go(b)} ...${dnd(b)}>${nums.has(b.id) ? nums.get(b.id) : html`<${I} name=${KIND_ICON[b.kind] || 'box'} size=${14} />`}</div>`)}</div>`;
  const row = (b, folds) => html`<div key=${b.id} className=${'row' + (b.id === cur ? ' cur' : '') + (!b.body.trim() && !b.heading.trim() ? ' ph' : '') + (b.id === dragging ? ' dragging' : '') + dropCls(b)} style=${kc(b)} onClick=${() => go(b)} ...${dnd(b)}>
    <span className="grip reveal"><${I} name="grip" size=${12} /></span>
    ${glyph(b)}<span className="t">${label(b)}</span>
    ${folds && html`<button className=${'ib quiet fold' + (fold[b.id] ? ' on' : '')} title=${fold[b.id] ? 'Expand' : 'Collapse'} onClick=${e => { e.stopPropagation(); toggleFold(b.id); }}><${I} name=${fold[b.id] ? 'chevron-right' : 'chevron-down'} size=${14} /></button>`}
    <button className="ib quiet del" title="Delete" onClick=${e => { e.stopPropagation(); del(b); }}><${I} name="trash" size=${14} /></button>
  </div>`;
  return html`<div className="outline">${tree.map(sec => {
    if (sec.type === 'transition') return row(sec.block);
    if (sec.type === 'free') return sec.blocks.map(b => row(b));
    const p = sec.block;
    return html`<div key=${p.id} className=${'og' + (fold[p.id] ? ' folded' : '')}>${row(p, true)}${!fold[p.id] && html`<div className="og-in">${sec.blocks.map(b => row(b))}</div>`}</div>`;
  })}</div>`;
}

// The block stack with points drawn as containers (left rule, number in the gutter) over their group. A "+" sits
// before every block and at the end of each container; the file is flat, so a gap index is drawn once, inside
// the container that reaches it.
function Groups({ s, nums, curBlock }) {
  const pc = useStore(st => kindColor('point', st.settings.colors));
  const idx = new Map(s.blocks.map((b, i) => [b.id, i])), seen = new Set(), n = s.blocks.length;
  const gap = i => { if (seen.has(i)) return null; seen.add(i); return html`<${Gap} key=${'g' + i} index=${i} end=${i === n} />`; };
  const blk = b => html`<${Block} key=${b.id} b=${b} index=${idx.get(b.id)} count=${n} num=${nums.get(b.id)} cur=${b.id === curBlock} />`;
  const out = [];
  for (const sec of outlineTree(s.blocks)) {
    if (sec.type === 'transition') { out.push(gap(idx.get(sec.block.id)), blk(sec.block)); continue; }
    if (sec.type === 'free') { for (const b of sec.blocks) out.push(gap(idx.get(b.id)), blk(b)); continue; }
    const p = sec.block, [, ge] = groupRange(s.blocks, p.id), inner = [];
    out.push(gap(idx.get(p.id)));
    for (const b of sec.blocks) inner.push(gap(idx.get(b.id)), blk(b));
    out.push(html`<div key=${p.id} className=${'pgroup' + (p.id === curBlock ? ' cur' : '')} style=${pc ? { '--kc': pc } : undefined}>${blk(p)}<div className="gin">${inner}</div></div>`, gap(ge));
  }
  out.push(gap(n));
  return out;
}

function DownloadMenu({ s, onClose }) {
  const ref = useRef(null); const settings = useStore(st => st.settings);
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); }; document.addEventListener('pointerdown', h, true); return () => document.removeEventListener('pointerdown', h, true); }, []);
  const name = slugify(s.meta.title);
  const go = fn => () => { onClose(); fn(); flash('Downloaded'); };
  return html`<div ref=${ref} className="pop" style=${{ top: '100%', right: 0 }}>
    <button onClick=${go(() => download(new Blob([serializeSermon(s)], { type: 'text/markdown' }), name + '.md'))}>Markdown</button>
    <button onClick=${go(() => download(docxBlob(s, settings.colors), name + '.docx'))}>Word</button>
    <button onClick=${go(async () => { await loadBible().catch(() => {}); download(versesPdf(s, { lookup: lookupNow, metaLine: metaLine(s.meta) }), name + ' — Verses.pdf'); })}>Verse list</button>
  </div>`;
}

function Sermon() {
  const s = useStore(st => st.openPath ? st.sermons.find(x => x.path === st.openPath) : null);
  const { railMin: railPref, biblePane, illPane, status, curBlock, settings, findOpen, find, findIdx, findCount, dictation, narrow, drawer } = useStore(st => ({ railMin: st.railMin, biblePane: st.biblePane, illPane: st.illPane, status: st.status, curBlock: st.curBlock, settings: st.settings, findOpen: st.findOpen, find: st.find, findIdx: st.findIdx, findCount: st.findCount, dictation: st.dictation, narrow: st.narrow, drawer: st.drawer }));
  const railMin = railPref && !narrow, side = biblePane || illPane; // a phone never shows the mini rail: the full rail is the drawer
  const [dl, setDl] = useState(false); const [dlT, setDlT] = useState(false); const titleRef = useRef(null), ideaRef = useRef(null), findRef = useRef(null), blocksRef = useRef(null), ranges = useRef([]);
  useEffect(() => { const el = titleRef.current; if (el && s && document.activeElement !== el && el.textContent !== s.meta.title) el.textContent = s.meta.title; const b = ideaRef.current; if (b && s && document.activeElement !== b && b.textContent !== s.meta.big_idea) b.textContent = s.meta.big_idea; });
  // find across all block bodies with the CSS Custom Highlight API — no DOM mutation
  const runFind = () => {
    if (!window.CSS || !CSS.highlights) return; CSS.highlights.delete('sb-find'); CSS.highlights.delete('sb-cur');
    const q = (find || '').toLowerCase(), el = blocksRef.current, rs = [];
    if (el && q && findOpen) { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.data.toLowerCase(); let i = t.indexOf(q); while (i >= 0) { const r = new Range(); r.setStart(n, i); r.setEnd(n, i + q.length); rs.push(r); i = t.indexOf(q, i + q.length); } } }
    ranges.current = rs;
    if (!rs.length) { if (findCount) set({ findCount: 0 }); return; }
    const idx = ((findIdx % rs.length) + rs.length) % rs.length;
    CSS.highlights.set('sb-find', new Highlight(...rs)); CSS.highlights.set('sb-cur', new Highlight(rs[idx]));
    if (findCount !== rs.length || findIdx !== idx) set({ findCount: rs.length, findIdx: idx });
  };
  useEffect(runFind);
  useEffect(() => { if (findOpen && findRef.current) { findRef.current.focus(); findRef.current.select(); } }, [findOpen]);
  const step = d => { const n = ranges.current.length; if (!n) return; const idx = (((findIdx + d) % n) + n) % n; set({ findIdx: idx }); requestAnimationFrame(() => { const r = ranges.current[idx]; if (!r) return; const rect = r.getBoundingClientRect(); window.scrollBy({ top: rect.top + rect.height / 2 - window.innerHeight / 2, behavior: 'smooth' }); }); };
  if (!s) return null;
  const nums = pointNumbers(s.blocks), words = sermonWords(s.blocks);
  const commitTitle = e => { const t = e.currentTarget.textContent.trim(); e.currentTarget.textContent = t; if (t && t !== s.meta.title) commitMeta(s.path, { title: t }); else if (!t) e.currentTarget.textContent = s.meta.title; };
  const ml = metaLine(s.meta);
  return html`<div className=${'doc' + (railMin ? ' min' : '') + (side ? ' side' : '') + (narrow ? ' narrow' : '') + (drawer ? ' drawer' : '')}>
    ${narrow && html`<${MobileTop} onBack=${closeSermon} />`}
    ${narrow && drawer && html`<${DrawerScrim} />`}
    <div className="rail group">
      ${railMin ? html`<>
        <button className="ib" onClick=${closeSermon}><${I} name="arrow-left" /></button>
        <div className="cap" style=${{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${s.meta.title}</div>
        <${Outline} s=${s} min />
        <div className="mini" onClick=${() => set({ kindMenu: { mode: 'insert', index: s.blocks.length } })} title="Add"><${I} name="plus" size=${14} /></div>
        <div style=${{ flex: 1 }} />
        <div className="mini" onClick=${() => set({ settingsOpen: true })}><${I} name="settings" size=${14} /></div>
        <button className="ib quiet" onClick=${toggleRail}><${I} name="chevron-right" /></button>
      </>` : html`<>
        <div className="rail-top">
          <button className="ib" onClick=${closeSermon}><${I} name="arrow-left" /></button><span style=${{ flex: 1 }} />
          <button className="ib reveal" title="Podium" onClick=${() => set({ podium: true, drawer: false })}><${I} name="play" /></button>
          <button className="ib reveal" title="Print" onClick=${() => set({ printMenu: true, drawer: false })}><${I} name="printer" /></button>
          <span style=${{ position: 'relative' }}><button className="ib reveal" title="Download" onClick=${() => setDl(!dl)}><${I} name="download" /></button>${dl && html`<${DownloadMenu} s=${s} onClose=${() => setDl(false)} />`}</span>
          <button className="ib reveal" title="Sermon" onClick=${() => set({ sermonModal: { path: s.path }, drawer: false })}><${I} name="settings" /></button>
        </div>
        <h2>${s.meta.title}</h2>
        <${Outline} s=${s} />
        <div className="rail-bot">
          <button className="tb" onClick=${() => set({ settingsOpen: true, drawer: false })}><${I} name="settings" />Settings</button>
          <span className="status">${status}</span>
          ${!narrow && html`<button className="ib quiet" onClick=${toggleRail}><${I} name="chevron-left" /></button>`}
        </div>
      </>`}
    </div>
    <div className="main">
      <div className=${'tools group' + (findOpen ? ' show' : '')} style=${{ left: narrow ? 0 : railMin ? 56 : 280, right: narrow || !side ? 0 : 340 }}>
        ${findOpen && html`<div className="find"><input ref=${findRef} placeholder="Find" value=${find} onChange=${e => set({ find: e.target.value, findIdx: 0 })} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.stopPropagation(); set({ findOpen: false }); } }} />
          <span className="c">${find ? (findCount ? (findIdx + 1) + '/' + findCount : '0') : ''}</span><button className="ib quiet" onClick=${() => step(-1)}><${I} name="chevron-left" size=${14} /></button><button className="ib quiet" onClick=${() => step(1)}><${I} name="chevron-right" size=${14} /></button></div>`}
        <button className=${'ib reveal' + (findOpen ? ' show on' : '')} title="Find" onClick=${() => set({ findOpen: !findOpen, findIdx: 0 })}><${I} name="search" /></button>
        <button className=${'ib reveal' + (biblePane ? ' show on' : '')} title="Bible" onClick=${toggleBible}><${I} name="book" /></button>
        <button className=${'ib reveal' + (illPane ? ' show on' : '')} title="Illustrations" onClick=${() => toggleIll()}><${I} name="bulb" /></button>
        <button className=${'ib reveal' + (dictation ? ' show on' : '')} title="Dictate" onMouseDown=${e => e.preventDefault()} onClick=${toggleDictation}><${I} name="mic" /></button>
        <button className="ib reveal" title="Podium" onClick=${() => set({ podium: true })}><${I} name="play" /></button>
        ${!narrow && html`<>
        <button className="ib reveal" title="Print" onClick=${() => set({ printMenu: true })}><${I} name="printer" /></button>
        <span style=${{ position: 'relative' }}><button className=${'ib reveal' + (dlT ? ' show on' : '')} title="Download" onClick=${() => setDlT(!dlT)}><${I} name="download" /></button>${dlT && html`<${DownloadMenu} s=${s} onClose=${() => setDlT(false)} />`}</span>
        <button className="ib reveal" title="Delete" onClick=${() => set({ confirm: { title: s.meta.title, onYes: () => deleteSermon(s.path) } })}><${I} name="trash" /></button>
        </>`}
      </div>
      <div className="page">
        ${(railMin || narrow) && html`<div className="caption">${s.meta.collection || (s.meta.template ? 'Template' : '')}</div>`}
        <h1 ref=${titleRef} className="title" contentEditable suppressContentEditableWarning data-ph=${s.meta.template ? 'Template name' : 'Sermon title'} onBlur=${commitTitle} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); ideaRef.current && ideaRef.current.focus(); } }} />
        <div className="metaline" onClick=${() => set({ sermonModal: { path: s.path } })}>${ml ? ml.split(' · ').map((x, i) => html`<span key=${i}>${i ? '· ' : ''}${x}</span>`) : html`<span>${s.meta.template ? 'Template' : cap(s.meta.status)}</span>`}${ml && s.meta.status !== 'draft' && !s.meta.template ? html`<span>· ${cap(s.meta.status)}</span>` : null}</div>
        <div ref=${ideaRef} className="bigidea" contentEditable suppressContentEditableWarning data-ph="Big idea" onInput=${e => { touch(); const v = e.currentTarget.textContent.replace(/\n/g, ' '); updateOpen(x => { x.meta.big_idea = v; }); }} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); const f = s.blocks[0]; if (f) set({ curBlock: f.id, focusReq: { id: f.id, where: 'start' } }); } }} />
        <div className="blocks" ref=${blocksRef}><${Groups} s=${s} nums=${nums} curBlock=${curBlock} /></div>
      </div>
      <div className="counts" style=${{ right: (side && !narrow ? 360 : 20) + (dictation ? 88 : 0) }}>${words} words</div>
    </div>
    ${biblePane && html`<${BiblePane} />`}
    ${illPane && html`<${IllPane} />`}
  </div>`;
}
(SB.ui ||= {}).Sermon = { Sermon };
})(globalThis.SB ||= {});
