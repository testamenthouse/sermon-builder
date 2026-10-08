(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState } = React;
const { useStore, set, openSermon, setLibView, setLibLayout, closeLibFind, commitMeta, openTemplates, newSermon } = SB.store;
const { I } = SB.ui.Icons;
const { fmtDate } = SB.lib.print;

const cap = s => s[0].toUpperCase() + s.slice(1);
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const statusOf = s => s.meta.status !== 'draft' && !s.meta.template ? cap(s.meta.status) : '';
const openIt = s => ({ onClick: () => openSermon(s.path), onDoubleClick: e => { e.stopPropagation(); set({ sermonModal: { path: s.path } }); } });
// The months a collection covers: "Oct 2026", "Sep – Nov 2026" or "Nov 2026 – Jan 2027".
function span(items) {
  const ds = items.map(s => s.meta.date).filter(Boolean).sort(); if (!ds.length) return '';
  const a = ds[0], b = ds[ds.length - 1];
  const f = (d, year) => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, 1).toLocaleDateString([], year ? { month: 'short', year: 'numeric' } : { month: 'short' });
  if (a.slice(0, 7) === b.slice(0, 7)) return f(a, true);
  return (a.slice(0, 4) === b.slice(0, 4) ? f(a, false) : f(a, true)) + ' – ' + f(b, true);
}

function Card({ s, color }) {
  const meta = [s.meta.date ? fmtDate(s.meta.date) : '', s.meta.passage].filter(Boolean).join(' · ');
  return html`<div className="card" ...${openIt(s)}>
    <div className="sheet"><div className="pg p2" /><div className="pg p1" /><div className="face">${color && html`<div className="stripe" style=${{ background: color }} />`}${s.meta.title}</div></div>
    <div className="meta">${meta || ' '}${statusOf(s) ? html`<div>${statusOf(s)}</div>` : null}</div>
  </div>`;
}
// The list is a table: date, title, collection (Dates view), passage, status — hairline under every row, captions on top.
function Row({ s, color, collection, day }) {
  const date = s.meta.date ? (day ? fmtDate(s.meta.date).replace(/,.*$/, '') : fmtDate(s.meta.date)) : '';
  return html`<div className=${'tr' + (day ? ' day' : '')} ...${openIt(s)}>
    <span className="td d">${date}</span>
    <span className="td t">${s.meta.title}</span>
    ${collection && html`<span className="td sr">${s.meta.collection && html`<span className="tile sm" style=${color ? { background: color } : undefined} />`}${s.meta.collection}</span>`}
    <span className="td p">${s.meta.passage}</span>
    <span className="td st">${statusOf(s)}</span>
  </div>`;
}
function Table({ list, collection, colorOf }) {
  return html`<div className="tbl">
    <div className=${'tr th' + (collection ? ' day' : '')}><span className="td d">Date</span><span className="td t">Title</span>${collection && html`<span className="td sr">Collection</span>`}<span className="td p">Passage</span><span className="td st">Status</span></div>
    ${list.map(s => html`<${Row} key=${s.path} s=${s} color=${collection ? colorOf(s.dir) : undefined} collection=${collection} day=${collection} />`)}
  </div>`;
}
// A section heading: color tile, name (click → Collection modal), the months it spans, its own +.
function Head({ color, name, meta, onClick, onAdd }) {
  return html`<div className="sec-h">
    ${color !== undefined && html`<span className="tile" style=${color ? { background: color } : undefined} />`}
    <h2 className=${onClick ? 'link' : ''} onClick=${onClick}>${name}</h2>
    ${meta && html`<span className="m">${meta}</span>`}
    <span className="sp" />
    ${onAdd && html`<button className="ib quiet" title="New sermon" onClick=${onAdd}><${I} name="plus" size=${14} /></button>`}
  </div>`;
}

// Month grid of preaching dates. Chips open the sermon and drag to another day to move it; + on a day starts a sermon dated there.
function Calendar({ sermons, colorOf }) {
  const t = ymd(new Date()); const [ym, setYm] = useState(t.slice(0, 7)); const [over, setOver] = useState(null); const drag = useRef(null);
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
  const shift = d => { const n = new Date(y, m + d, 1); setYm(n.getFullYear() + '-' + pad(n.getMonth() + 1)); };
  useEffect(() => {
    const h = e => { if (e.metaKey || e.ctrlKey || e.altKey) return; const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return; if (e.key === 'ArrowLeft') shift(-1); else if (e.key === 'ArrowRight') shift(1); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  });
  const byDay = {}; for (const s of sermons) if (s.meta.date) (byDay[s.meta.date] = byDay[s.meta.date] || []).push(s);
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), n = Math.ceil((first.getDay() + days) / 7) * 7, cells = [];
  for (let i = 0; i < n; i++) cells.push(new Date(y, m, 1 - first.getDay() + i));
  const wd = []; for (let i = 0; i < 7; i++) wd.push(new Date(2024, 0, 7 + i).toLocaleDateString([], { weekday: 'short' }));
  const create = k => newSermon({ date: k });
  const drop = k => { const p = drag.current; drag.current = null; setOver(null); if (!p) return; const s = sermons.find(x => x.path === p); if (s && s.meta.date !== k) commitMeta(p, { date: k }); };
  return html`<div className="cal">
    <div className="cal-h">
      <h2>${first.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
      <button className="ib quiet" title="Previous month" onClick=${() => shift(-1)}><${I} name="chevron-left" /></button>
      <button className="ib quiet" title="Next month" onClick=${() => shift(1)}><${I} name="chevron-right" /></button>
      ${ym !== t.slice(0, 7) && html`<button className="tb" onClick=${() => setYm(t.slice(0, 7))}>Today</button>`}
    </div>
    <div className="cal-wd">${wd.map(w => html`<span key=${w} className="cap">${w}</span>`)}</div>
    <div className="cal-g">${cells.map(d => { const k = ymd(d), items = byDay[k] || [];
      return html`<div key=${k} className=${'cal-d group' + (d.getMonth() !== m ? ' out' : '') + (k === t ? ' today' : '') + (over === k ? ' over' : '')} onDragOver=${e => { if (!drag.current) return; e.preventDefault(); if (over !== k) setOver(k); }} onDragLeave=${e => { if (over === k && !e.currentTarget.contains(e.relatedTarget)) setOver(null); }} onDrop=${e => { e.preventDefault(); drop(k); }}>
        <div className="cal-n"><span>${d.getDate()}</span><button className="ib quiet reveal" title="New sermon" onClick=${() => create(k)}><${I} name="plus" size=${12} /></button></div>
        ${items.map(s => html`<div key=${s.path} className="cal-e" draggable ...${openIt(s)} onDragStart=${e => { drag.current = s.path; e.dataTransfer.effectAllowed = 'move'; }} onDragEnd=${() => { drag.current = null; setOver(null); }}>
          <span className="tile sm" style=${colorOf(s.dir) ? { background: colorOf(s.dir) } : undefined} /><span className="t">${s.meta.title}</span></div>`)}
      </div>`; })}</div>
  </div>`;
}

function Library() {
  const { libName, sermons, collections, libView, libLayout, libQuery, libFindOpen, status } = useStore(s => ({ libName: s.libName, sermons: s.sermons, collections: s.collections, libView: s.libView, libLayout: s.libLayout, libQuery: s.libQuery, libFindOpen: s.libFindOpen, status: s.status }));
  const findRef = useRef(null); const findOpen = libFindOpen || !!libQuery;
  useEffect(() => { if (libFindOpen && findRef.current) findRef.current.focus(); }, [libFindOpen]);
  const q = libQuery.trim().toLowerCase();
  const match = s => !q || [s.meta.title, s.meta.passage, s.meta.collection, s.meta.big_idea, ...s.meta.tags].join(' ').toLowerCase().includes(q);
  const list = sermons.filter(match), real = list.filter(s => !s.meta.template);
  const root = real.filter(s => !s.dir), colorOf = name => (collections.find(x => x.name === name) || {}).color || '';
  const months = {}; for (const s of real) { const k = s.meta.date ? s.meta.date.slice(0, 7) : ''; (months[k] = months[k] || []).push(s); }
  const monthLabel = k => k ? new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' }) : 'Undated';
  const listMode = libLayout === 'list';
  // Rows under a collection heading need neither the tile nor the collection name; month rows carry both.
  const items = (list, color, byCol) => listMode
    ? html`<${Table} list=${list} collection=${!!byCol} colorOf=${colorOf} />`
    : html`<div className="grid">${list.map(s => html`<${Card} key=${s.path} s=${s} color=${color !== undefined ? color : colorOf(s.dir)} />`)}</div>`;
  return html`<div className="lib">
    <div className="lib-top">
      <h1>${libName}</h1>
      ${findOpen && html`<div className="find"><input ref=${findRef} placeholder="Find" value=${libQuery} onChange=${e => set({ libQuery: e.target.value })} onKeyDown=${e => { if (e.key === 'Escape') { e.stopPropagation(); closeLibFind(); } }} />
        <button className="ib quiet" title="Close" onClick=${closeLibFind}><${I} name="x" size=${14} /></button></div>`}
      <button className=${'ib' + (findOpen ? ' on' : '')} title="Find" onClick=${() => findOpen ? closeLibFind() : set({ libFindOpen: true })}><${I} name="search" /></button>
      <button className="ib" title="New collection" onClick=${() => set({ collectionModal: { create: true } })}><${I} name="plus" /></button>
      <button className="ib" title="Templates" onClick=${openTemplates}><${I} name="layers" /></button>
      <button className="ib" title="Illustrations" onClick=${() => set({ screen: 'illustrations' })}><${I} name="bulb" /></button>
      <button className="ib" title="Settings" onClick=${() => set({ settingsOpen: true })}><${I} name="settings" /></button>
    </div>
    <div className="lib-bar">
      <div className="seg">${['collections', 'dates', 'calendar'].map(v => html`<button key=${v} className=${libView === v ? 'on' : ''} onClick=${() => setLibView(v)}>${cap(v)}</button>`)}</div>
      <span className="sp" />
      ${libView !== 'calendar' && html`<div className="seg">
        <button className=${!listMode ? 'on' : ''} title="Thumbnails" onClick=${() => setLibLayout('cards')}><${I} name="grid" size=${14} /></button>
        <button className=${listMode ? 'on' : ''} title="List" onClick=${() => setLibLayout('list')}><${I} name="list" size=${14} /></button>
      </div>`}
    </div>
    ${!collections.length && !sermons.some(s => !s.meta.template) && html`<div className="none"><button className="pb" onClick=${() => set({ collectionModal: { create: true } })}>New collection</button></div>`}
    ${libView === 'calendar' ? html`<${Calendar} sermons=${real} colorOf=${colorOf} />` : libView === 'collections' ? html`<>
      ${root.length > 0 && html`<div className=${'sec' + (listMode ? ' list' : '')}><${Head} name="Unfiled" />${items(root, '')}</div>`}
      ${collections.map(sr => { const inCol = real.filter(s => s.dir === sr.name); if (!inCol.length && q) return null; return html`<div className=${'sec' + (listMode ? ' list' : '')} key=${sr.name}>
        <${Head} color=${sr.color} name=${sr.name} meta=${span(inCol)} onClick=${() => set({ collectionModal: { name: sr.name } })} onAdd=${() => newSermon({ collection: sr.name })} />
        ${items(inCol, sr.color)}</div>`; })}
    </>` : html`<div>
      ${Object.keys(months).sort((a, b) => (b || '0000').localeCompare(a || '0000')).map(k => html`<div className=${'sec' + (listMode ? ' list' : '')} key=${k || 'none'}>
        <${Head} name=${monthLabel(k)} onAdd=${() => newSermon()} />
        ${items(months[k], undefined, true)}
      </div>`)}
    </div>`}
    <div className="status" style=${{ position: 'fixed', left: 20, bottom: 16 }}>${status}</div>
  </div>`;
}
(SB.ui ||= {}).Library = { openIt, Card, Library };
})(globalThis.SB ||= {});
