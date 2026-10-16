(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState, Fragment } = React;
const { useStore, set, openSermon, setLibView, setLibLayout, setCalScope, closeLibFind, commitMeta, movePreached, updateGuest, guestKey, openTemplates, newSermon, openBookmarks, openBible } = SB.store;
const { I } = SB.ui.Icons;
const { fmtDate } = SB.lib.print;
const { STATUSES } = SB.shared.format;
const { DAYS, ymd, addDays, weekStart, weeksBetween, serviceColumns, slotService, slotDate, fmtTime, sermonDates, sermonBooks, pillarSpan, collectionSpan, pillarsIn, BOOKS } = SB.shared.planning;

const cap = s => s[0].toUpperCase() + s.slice(1);
const pad = n => String(n).padStart(2, '0');
const statusOf = s => s.meta.status !== 'draft' && !s.meta.template ? cap(s.meta.status) : '';
// What is being dragged across the library: a sermon (its date), a repeat (one preached entry), or a guest line.
let dragging = null;
const dragIt = (type, extra) => ({ draggable: true, onDragStart: e => { dragging = { type, ...extra }; e.dataTransfer.effectAllowed = 'move'; }, onDragEnd: () => { dragging = null; } });
const openIt = s => ({ onClick: () => openSermon(s.path), onDoubleClick: e => { e.stopPropagation(); set({ sermonModal: { path: s.path } }); } });
// Drop a dragged entry onto a date (and service): a sermon moves its date, a repeat moves that entry, a guest moves.
function dropOn(date, service) {
  const d = dragging; dragging = null; if (!d) return;
  if (d.type === 'sermon') commitMeta(d.path, { date, service: service !== undefined ? service : undefined });
  else if (d.type === 'repeat') movePreached(d.path, d.entry, date, service !== undefined ? service : d.service);
  else if (d.type === 'guest') updateGuest(d.key, { date, service: service !== undefined ? service : d.service });
}
const dropZone = (over, setOver, k, onDrop) => ({
  onDragOver: e => { if (!dragging) return; e.preventDefault(); if (over !== k) setOver(k); },
  onDragLeave: e => { if (over === k && !e.currentTarget.contains(e.relatedTarget)) setOver(null); },
  onDrop: e => { e.preventDefault(); setOver(null); onDrop(); }
});
// The months a collection covers: "Oct 2026", "Sep – Nov 2026" or "Nov 2026 – Jan 2027".
function span(items) {
  const ds = items.map(s => s.meta.date).filter(Boolean).sort(); if (!ds.length) return '';
  const a = ds[0], b = ds[ds.length - 1];
  const f = (d, year) => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, 1).toLocaleDateString([], year ? { month: 'short', year: 'numeric' } : { month: 'short' });
  if (a.slice(0, 7) === b.slice(0, 7)) return f(a, true);
  return (a.slice(0, 4) === b.slice(0, 4) ? f(a, false) : f(a, true)) + ' – ' + f(b, true);
}
const shortDate = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''; };

function Card({ s, color }) {
  const meta = [s.meta.date ? fmtDate(s.meta.date) : '', s.meta.passage].filter(Boolean).join(' · ');
  return html`<div className="card" ...${openIt(s)} ...${dragIt('sermon', { path: s.path })}>
    <div className="sheet"><div className="pg p2" /><div className="pg p1" /><div className="face">${color && html`<div className="stripe" style=${{ background: color }} />`}${s.meta.title}</div></div>
    <div className="meta">${meta || ' '}${statusOf(s) ? html`<div>${statusOf(s)}</div>` : null}</div>
  </div>`;
}
// The list is a table: date, title, collection (Dates view), passage, status — hairline under every row, captions on top.
function Row({ s, color, collection, day }) {
  const date = s.meta.date ? (day ? fmtDate(s.meta.date).replace(/,.*$/, '') : fmtDate(s.meta.date)) : '';
  return html`<div className=${'tr' + (day ? ' day' : '')} ...${openIt(s)} ...${dragIt('sermon', { path: s.path })}>
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
// A section heading: color tile, name (click → Collection modal), the months it spans, its own + (and a print icon for a collection).
function Head({ color, name, meta, onClick, onAdd, onPrint, dim }) {
  return html`<div className=${'sec-h group' + (dim ? ' dim' : '')}>
    ${color !== undefined && html`<span className="tile" style=${color ? { background: color } : undefined} />`}
    <h2 className=${onClick ? 'link' : ''} onClick=${onClick}>${name}</h2>
    ${meta && html`<span className="m">${meta}</span>`}
    <span className="sp" />
    ${onPrint && html`<button className="ib quiet reveal" title="Print" onClick=${onPrint}><${I} name="printer" size=${14} /></button>`}
    ${onAdd && html`<button className="ib quiet" title="New sermon" onClick=${onAdd}><${I} name="plus" size=${14} /></button>`}
  </div>`;
}
// A sermon, repeat or guest on the Schedule or a calendar day.
function Chip({ e, colorOf, date }) {
  if (e.guest) return html`<div className="cal-e guest" ...${dragIt('guest', { key: guestKey(e.guest), service: e.guest.service })} onClick=${() => set({ guestModal: { key: guestKey(e.guest) } })}><span className="k"><${I} name="mic" size=${12} /></span><span className="t">${e.guest.name}</span></div>`;
  const s = e.sermon, color = colorOf(s.dir);
  return html`<div className=${'cal-e' + (s.meta.status === 'idea' ? ' idea' : '')} ...${openIt(s)} ...${e.repeat ? dragIt('repeat', { path: s.path, entry: e.entry, service: e.service }) : dragIt('sermon', { path: s.path })}>
    <span className="tile sm" style=${color ? { background: color } : undefined} />
    <span className="t">${s.meta.title}</span>
    ${e.repeat && html`<span className="k" title="Repeat"><${I} name="refresh" size=${11} /></span>`}
    ${date && html`<span className="dt">${date}</span>`}
  </div>`;
}
// Every entry that stands on a date: sermons at their date and each repeat, guests from the plan.
function entriesByDate(sermons, guests) {
  const by = {};
  const put = (d, e) => (by[d] = by[d] || []).push(e);
  for (const s of sermons) for (const e of sermonDates(s)) put(e.date, { sermon: s, repeat: e.repeat, entry: e.entry, service: e.service });
  for (const g of guests) put(g.date, { guest: g, service: g.service });
  return by;
}
// The slot + opens a small menu: New sermon · Repeat sermon · Guest speaker.
const slotPlus = (date, service) => e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); set({ slotMenu: { date, service, x: r.left, y: r.bottom + 4 } }); };

// Weeks from this one forward, one column per service, the open slots showing a +. Chips drag between slots.
function Schedule({ sermons, guests, services, colorOf }) {
  const [over, setOver] = useState(null);
  const cols = serviceColumns(services), t = ymd(new Date());
  const weeks = weeksBetween(t, (new Date().getFullYear() + 1) + '-12-31');
  const by = entriesByDate(sermons, guests), slots = {};
  for (const d of Object.keys(by)) for (const e of by[d]) { const k = weekStart(d) + '|' + slotService(e.service, d, services); (slots[k] = slots[k] || []).push({ ...e, date: d }); }
  let lastMonth = '';
  const rows = [];
  for (const w of weeks) {
    const m = w.slice(0, 7);
    if (m !== lastMonth) { lastMonth = m; rows.push(html`<div key=${'m' + m} className="sched-m">${new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>`); }
    rows.push(html`<div key=${w} className=${'sched-r' + (w === weekStart(t) ? ' now' : '')}>
      <div className="sched-d">${shortDate(w)}</div>
      ${cols.map(sv => { const k = w + '|' + sv.name, items = slots[k] || [], d = slotDate(w, sv);
        return html`<div key=${sv.name || 'x'} className=${'slot group' + (over === k ? ' over' : '')} ...${dropZone(over, setOver, k, () => dropOn(d, sv.name))}>
          ${items.map((e, i) => html`<${Chip} key=${i} e=${e} colorOf=${colorOf} date=${e.date !== d ? shortDate(e.date) : ''} />`)}
          <button className=${'ib quiet' + (items.length ? ' reveal' : ' open')} title="Add" onClick=${slotPlus(d, sv.name)}><${I} name="plus" size=${12} /></button>
        </div>`; })}
    </div>`);
  }
  return html`<div className="sched" style=${{ '--cols': cols.length }}>
    <div className="sched-h"><div className="sched-d" />${cols.map(sv => html`<div key=${sv.name || 'x'} className="sched-c"><span>${sv.name || DAYS[sv.day]}</span><span className="m">${[DAYS[sv.day].slice(0, 3), fmtTime(sv.time)].filter(Boolean).join(' · ')}</span></div>`)}</div>
    ${rows}
  </div>`;
}

// Month grid of preaching dates. Chips open the sermon and drag to another day to move it; + on a day starts a sermon dated there.
function Month({ sermons, guests, services, pillars, colorOf, ym, setYm }) {
  const t = ymd(new Date()); const [over, setOver] = useState(null);
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
  const shift = d => { const n = new Date(y, m + d, 1); setYm(n.getFullYear() + '-' + pad(n.getMonth() + 1)); };
  useEffect(() => {
    const h = e => { if (e.metaKey || e.ctrlKey || e.altKey) return; const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return; if (e.key === 'ArrowLeft') shift(-1); else if (e.key === 'ArrowRight') shift(1); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  });
  const by = entriesByDate(sermons, guests);
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), n = Math.ceil((first.getDay() + days) / 7) * 7, cells = [];
  for (let i = 0; i < n; i++) cells.push(new Date(y, m, 1 - first.getDay() + i));
  const wd = []; for (let i = 0; i < 7; i++) wd.push(new Date(2024, 0, 7 + i).toLocaleDateString([], { weekday: 'short' }));
  const active = pillarsIn(pillars, ym);
  return html`<div className="cal">
    <div className="cal-h">
      <h2>${first.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
      <button className="ib quiet" title="Previous month" onClick=${() => shift(-1)}><${I} name="chevron-left" /></button>
      <button className="ib quiet" title="Next month" onClick=${() => shift(1)}><${I} name="chevron-right" /></button>
      ${ym !== t.slice(0, 7) && html`<button className="tb" onClick=${() => setYm(t.slice(0, 7))}>Today</button>`}
      ${active.map((p, i) => html`<span key=${i} className="pill" onClick=${() => set({ pillarModal: { index: pillars.indexOf(p) } })}><span className="tile sm" style=${p.color ? { background: p.color } : undefined} />${p.name}</span>`)}
    </div>
    <div className="cal-wd">${wd.map(w => html`<span key=${w} className="cap">${w}</span>`)}</div>
    <div className="cal-g">${cells.map(d => { const k = ymd(d), items = by[k] || [];
      return html`<div key=${k} className=${'cal-d group' + (d.getMonth() !== m ? ' out' : '') + (k === t ? ' today' : '') + (over === k ? ' over' : '')} ...${dropZone(over, setOver, k, () => dropOn(k))}>
        <div className="cal-n"><span>${d.getDate()}</span><button className="ib quiet reveal" title="Add" onClick=${slotPlus(k, slotService('', k, services))}><${I} name="plus" size=${12} /></button></div>
        ${items.map((e, i) => html`<${Chip} key=${i} e=${e} colorOf=${colorOf} />`)}
      </div>`; })}</div>
  </div>`;
}

// The year as twelve columns. Pillars are the higher construct: a band of their own above the months, each a bar
// carrying its name across the months it spans (overlapping pillars stack into lanes). Beneath the month strip, one
// row per collection as a bar from its first sermon to its last with a tick per date. Today is a hairline.
function Year({ sermons, collections, pillars, colorOf, year, setYear, onMonth }) {
  const t = ymd(new Date()), months = []; for (let i = 0; i < 12; i++) months.push(new Date(year, i, 1).toLocaleDateString([], { month: 'short' }));
  const pct = f => (f * 100).toFixed(2) + '%';
  const todayFrac = +t.slice(0, 4) === year ? (new Date(year, +t.slice(5, 7) - 1, +t.slice(8, 10)) - new Date(year, 0, 1)) / (new Date(year + 1, 0, 1) - new Date(year, 0, 1)) : null;
  const lanes = [], prow = [];
  for (const [i, p] of pillars.entries()) { const sp = pillarSpan(p, year); if (!sp) continue; let lane = lanes.findIndex(end => end <= sp[0]); if (lane < 0) { lane = lanes.length; lanes.push(0); } lanes[lane] = sp[1]; prow.push({ p, i, sp, lane }); }
  const crow = collections.map(c => ({ c, sp: collectionSpan(sermons.filter(s => s.dir === c.name), year) })).filter(x => x.sp);
  const now = todayFrac !== null && html`<span className="yr-now" style=${{ left: pct(todayFrac) }} />`;
  const track = (children, k) => html`<div key=${k} className="yr-track">${now}${children}</div>`;
  return html`<div className="yr">
    <div className="cal-h">
      <h2>${year}</h2>
      <button className="ib quiet" title="Previous year" onClick=${() => setYear(year - 1)}><${I} name="chevron-left" /></button>
      <button className="ib quiet" title="Next year" onClick=${() => setYear(year + 1)}><${I} name="chevron-right" /></button>
      ${year !== +t.slice(0, 4) && html`<button className="tb" onClick=${() => setYear(+t.slice(0, 4))}>Today</button>`}
      <span className="sp" />
      <button className="ib quiet" title="New pillar" onClick=${() => set({ pillarModal: { create: true, from: year + '-' + pad(+t.slice(5, 7)), to: year + '-' + pad(+t.slice(5, 7)) } })}><${I} name="plus" size=${14} /></button>
    </div>
    <div className="yr-g">
      ${prow.length > 0 && html`<><div className="yr-l cap">Pillars</div>
        <div className="yr-pillars" style=${{ height: lanes.length * 30 - 6 }}>${now}${prow.map(({ p, i, sp, lane }) => html`<div key=${i} className="yr-pbar" style=${{ left: pct(sp[0]), width: pct(sp[1] - sp[0]), top: lane * 30, background: p.color || 'var(--fill)' }} title=${p.name} onClick=${() => set({ pillarModal: { index: i } })}>${p.name}</div>`)}</div></>`}
      <div className="yr-l" />
      <div className="yr-months">${months.map((mn, i) => html`<button key=${i} className=${'cap' + (year + '-' + pad(i + 1) === t.slice(0, 7) ? ' now' : '')} onClick=${() => onMonth(year + '-' + pad(i + 1))}>${mn}</button>`)}</div>
      ${crow.map(({ c, sp }) => html`<${Fragment} key=${'c' + c.name}>
        <div className="yr-l" onClick=${() => set({ collectionModal: { name: c.name } })}><span className="tile sm" style=${c.color ? { background: c.color } : undefined} />${c.name}</div>
        ${track(html`<><div className="yr-bar" style=${{ left: pct(sp.from), width: 'max(3px,' + pct(Math.max(0, sp.to - sp.from)) + ')', background: c.color || 'var(--faint)' }} onClick=${() => set({ collectionModal: { name: c.name } })} />${sp.ticks.map((f, k) => html`<span key=${k} className="yr-tick" style=${{ left: pct(f) }} />`)}</>`, 'c' + c.name)}
      <//>`)}
      ${!crow.length && html`<><div className="yr-l" /><div className="yr-track" /></>`}
    </div>
  </div>`;
}

function Library() {
  const { libName, sermons, collections, plan, libView, libLayout, libQuery, libFindOpen, calScope, status } = useStore(s => ({ libName: s.libName, sermons: s.sermons, collections: s.collections, plan: s.plan, libView: s.libView, libLayout: s.libLayout, libQuery: s.libQuery, libFindOpen: s.libFindOpen, calScope: s.calScope, status: s.status }));
  const findRef = useRef(null); const findOpen = libFindOpen || !!libQuery;
  const t = ymd(new Date()); const [ym, setYm] = useState(t.slice(0, 7)); const [year, setYear] = useState(+t.slice(0, 4)); const [over, setOver] = useState(null);
  useEffect(() => { if (libFindOpen && findRef.current) findRef.current.focus(); }, [libFindOpen]);
  const q = libQuery.trim().toLowerCase();
  const match = s => !q || [s.meta.title, s.meta.passage, s.meta.collection, s.meta.big_idea, s.meta.service, ...s.meta.tags].join(' ').toLowerCase().includes(q);
  const list = sermons.filter(match), real = list.filter(s => !s.meta.template);
  const root = real.filter(s => !s.dir), colorOf = name => (collections.find(x => x.name === name) || {}).color || '';
  const months = {}; for (const s of real) { const k = s.meta.date ? s.meta.date.slice(0, 7) : ''; (months[k] = months[k] || []).push(s); }
  const monthLabel = k => k ? new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' }) : 'Undated';
  const listMode = libLayout === 'list', hasLayout = libView !== 'calendar' && libView !== 'schedule';
  // Rows under a collection heading need neither the tile nor the collection name; month rows carry both.
  const items = (list, color, byCol) => listMode
    ? html`<${Table} list=${list} collection=${!!byCol} colorOf=${colorOf} />`
    : html`<div className="grid">${list.map(s => html`<${Card} key=${s.path} s=${s} color=${color !== undefined ? color : colorOf(s.dir)} />`)}</div>`;
  const guests = q ? plan.guests.filter(g => g.name.toLowerCase().includes(q)) : plan.guests;
  const sec = (k, head, body, drop) => html`<div key=${k} className=${'sec' + (listMode ? ' list' : '') + (over === k ? ' over' : '')} ...${drop ? dropZone(over, setOver, k, drop) : {}}>${head}${body}</div>`;
  return html`<div className="lib">
    <div className="lib-top">
      <h1>${libName}</h1>
      ${findOpen && html`<div className="find"><input ref=${findRef} placeholder="Find" value=${libQuery} onChange=${e => set({ libQuery: e.target.value })} onKeyDown=${e => { if (e.key === 'Escape') { e.stopPropagation(); closeLibFind(); } }} />
        <button className="ib quiet" title="Close" onClick=${closeLibFind}><${I} name="x" size=${14} /></button></div>`}
      <button className=${'ib' + (findOpen ? ' on' : '')} title="Find" onClick=${() => findOpen ? closeLibFind() : set({ libFindOpen: true })}><${I} name="search" /></button>
      <button className="ib" title="New collection" onClick=${() => set({ collectionModal: { create: true } })}><${I} name="plus" /></button>
      <button className="ib" title="Templates" onClick=${openTemplates}><${I} name="layers" /></button>
      <button className="ib" title="Illustrations" onClick=${() => set({ screen: 'illustrations' })}><${I} name="bulb" /></button>
      <button className="ib" title="Bible" onClick=${() => openBible()}><${I} name="book" /></button>
      <button className="ib" title="Bookmarks" onClick=${() => openBookmarks()}><${I} name="bookmark" /></button>
      <button className="ib" title="Settings" onClick=${() => set({ settingsOpen: true })}><${I} name="settings" /></button>
    </div>
    <div className="lib-bar">
      <div className="seg">${['collections', 'dates', 'schedule', 'calendar', 'status', 'scripture'].map(v => html`<button key=${v} className=${libView === v ? 'on' : ''} onClick=${() => setLibView(v)}>${cap(v)}</button>`)}</div>
      <span className="sp" />
      ${hasLayout && html`<div className="seg">
        <button className=${!listMode ? 'on' : ''} title="Thumbnails" onClick=${() => setLibLayout('cards')}><${I} name="grid" size=${14} /></button>
        <button className=${listMode ? 'on' : ''} title="List" onClick=${() => setLibLayout('list')}><${I} name="list" size=${14} /></button>
      </div>`}
      ${libView === 'calendar' && html`<div className="seg">${['month', 'year'].map(v => html`<button key=${v} className=${calScope === v ? 'on' : ''} onClick=${() => setCalScope(v)}>${cap(v)}</button>`)}</div>`}
    </div>
    ${!collections.length && !sermons.some(s => !s.meta.template) && html`<div className="none"><button className="pb" onClick=${() => set({ collectionModal: { create: true } })}>New collection</button></div>`}
    ${libView === 'schedule' ? html`<${Schedule} sermons=${real} guests=${guests} services=${plan.services} colorOf=${colorOf} />`
    : libView === 'calendar' ? (calScope === 'year'
      ? html`<${Year} sermons=${real} collections=${collections} pillars=${plan.pillars} colorOf=${colorOf} year=${year} setYear=${setYear} onMonth=${m => { setYm(m); setCalScope('month'); }} />`
      : html`<${Month} sermons=${real} guests=${guests} services=${plan.services} pillars=${plan.pillars} colorOf=${colorOf} ym=${ym} setYm=${setYm} />`)
    : libView === 'collections' ? html`<>
      ${root.length > 0 && sec('root', html`<${Head} name="Unfiled" />`, items(root, ''))}
      ${collections.map(sr => { const inCol = real.filter(s => s.dir === sr.name); if (!inCol.length && q) return null;
        return sec(sr.name, html`<${Head} color=${sr.color} name=${sr.name} meta=${[span(inCol), sr.big_idea].filter(Boolean).join(' · ')} onClick=${() => set({ collectionModal: { name: sr.name } })} onAdd=${() => newSermon({ collection: sr.name })} onPrint=${inCol.length ? () => set({ printMenu: { collection: sr.name } }) : null} />`, items(inCol, sr.color), () => { const d = dragging; if (d && d.type === 'sermon') { dragging = null; commitMeta(d.path, { collection: sr.name }); } }); })}
    </>` : libView === 'status' ? html`<>
      ${STATUSES.map(st => { const inSt = real.filter(s => s.meta.status === st); if (!inSt.length && q) return null;
        return sec(st, html`<${Head} name=${cap(st)} onAdd=${() => newSermon({ status: st })} />`, items(inSt, undefined, true), () => { const d = dragging; if (d && d.type === 'sermon') { dragging = null; commitMeta(d.path, { status: st }); } }); })}
    </>` : libView === 'scripture' ? html`<>
      ${BOOKS.map((b, i) => { const inBook = real.filter(s => sermonBooks(s).has(i)); if (!inBook.length && q) return null;
        return sec(b.name, html`<${Head} name=${b.name} dim=${!inBook.length} />`, inBook.length ? items(inBook, undefined, true) : null); })}
    </>` : html`<div>
      ${Object.keys(months).sort((a, b) => (b || '0000').localeCompare(a || '0000')).map(k => sec(k || 'none', html`<${Head} name=${monthLabel(k)} onAdd=${() => newSermon()} />`, items(months[k], undefined, true)))}
    </div>`}
    <div className="status" style=${{ position: 'fixed', left: 20, bottom: 16 }}>${status}</div>
  </div>`;
}
(SB.ui ||= {}).Library = { openIt, Card, Library };
})(globalThis.SB ||= {});
