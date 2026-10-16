(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { t, cap, locale } = SB.lib.i18n;
const { useEffect, useRef, useState, Fragment } = React;
const { useStore, set, openSermon, setLibView, setLibLayout, setCalScope, closeLibFind, commitMeta, movePreached, updateGuest, guestKey, openTemplates, newSermon, openBookmarks, openBible } = SB.store;
const { I } = SB.ui.Icons;
const { fmtDate } = SB.lib.print;
const { STATUSES } = SB.shared.format;
const { DAYS, ymd, addDays, weekStart, weeksBetween, serviceColumns, slotService, slotDate, fmtTime, sermonDates, sermonBooks, pillarSpan, collectionSpan, pillarsIn, BOOKS, entriesByDate, scheduleSlots, scheduleSpan, scheduleCsv } = SB.shared.planning;
const { doPrintSchedule } = SB.lib.print;
const { download } = SB.lib.zip;

const VIEWS = ['collections', 'dates', 'schedule', 'calendar', 'status', 'scripture'];
const pad = n => String(n).padStart(2, '0');
const statusOf = s => !s.meta.template ? t(cap(s.meta.status)) : '';
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
  const f = (d, year) => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, 1).toLocaleDateString(locale(), year ? { month: 'short', year: 'numeric' } : { month: 'short' });
  if (a.slice(0, 7) === b.slice(0, 7)) return f(a, true);
  return (a.slice(0, 4) === b.slice(0, 4) ? f(a, false) : f(a, true)) + ' – ' + f(b, true);
}
const shortDate = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(locale(), { month: 'short', day: 'numeric' }) : ''; };

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
    <div className=${'tr th' + (collection ? ' day' : '')}><span className="td d">${t('Date')}</span><span className="td t">${t('Title')}</span>${collection && html`<span className="td sr">${t('Collection')}</span>`}<span className="td p">${t('Passage')}</span><span className="td st">${t('Status')}</span></div>
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
    ${onPrint && html`<button className="ib quiet reveal" title=${t('Print')} onClick=${onPrint}><${I} name="printer" size=${14} /></button>`}
    ${onAdd && html`<button className="ib quiet" title=${t('New sermon')} onClick=${onAdd}><${I} name="plus" size=${14} /></button>`}
  </div>`;
}
// A sermon, repeat or guest on the Schedule or a calendar day.
function Chip({ e, colorOf, date }) {
  if (e.guest) return html`<div className="cal-e guest" ...${dragIt('guest', { key: guestKey(e.guest), service: e.guest.service })} onClick=${() => set({ guestModal: { key: guestKey(e.guest) } })}><span className="k"><${I} name="mic" size=${12} /></span><span className="t">${e.guest.name}</span></div>`;
  const s = e.sermon, color = colorOf(s.dir);
  return html`<div className=${'cal-e' + (s.meta.status === 'idea' ? ' idea' : '')} title=${s.meta.title} ...${openIt(s)} ...${e.repeat ? dragIt('repeat', { path: s.path, entry: e.entry, service: e.service }) : dragIt('sermon', { path: s.path })}>
    <span className="tile sm" style=${color ? { background: color } : undefined} />
    <span className="t">${s.meta.title}</span>
    ${e.repeat && html`<span className="k" title=${t('Repeat')}><${I} name="refresh" size=${11} /></span>`}
    ${date && html`<span className="dt">${date}</span>`}
  </div>`;
}
// The slot + opens a small menu: New sermon · Repeat sermon · Guest speaker.
const slotPlus = (date, service) => e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); set({ slotMenu: { date, service, x: r.left, y: r.bottom + 4 } }); };

// Weeks from this one forward, one column per service, the open slots showing a +. Chips drag between slots.
function Schedule({ sermons, guests, services, colorOf }) {
  const [over, setOver] = useState(null);
  const cols = serviceColumns(services), today = ymd(new Date());
  const weeks = new Map();
  for (const sl of scheduleSlots(sermons, guests, services, today, (new Date().getFullYear() + 1) + '-12-31')) { if (!weeks.has(sl.week)) weeks.set(sl.week, []); weeks.get(sl.week).push(sl); }
  let lastMonth = '';
  const rows = [];
  for (const [w, wk] of weeks) {
    const m = w.slice(0, 7);
    if (m !== lastMonth) { lastMonth = m; rows.push(html`<div key=${'m' + m} className="sched-m">${new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</div>`); }
    rows.push(html`<div key=${w} className=${'sched-r' + (w === weekStart(today) ? ' now' : '')}>
      <div className="sched-d">${shortDate(w)}</div>
      ${wk.map(sl => { const sv = sl.service, k = w + '|' + sv.name, d = sl.date;
        return html`<div key=${sv.name || 'x'} className=${'slot group' + (over === k ? ' over' : '')} ...${dropZone(over, setOver, k, () => dropOn(d, sv.name))}>
          ${sl.entries.map((e, i) => html`<${Chip} key=${i} e=${e} colorOf=${colorOf} date=${e.date !== d ? shortDate(e.date) : ''} />`)}
          <button className=${'ib quiet' + (sl.entries.length ? ' reveal' : ' open')} title=${t('Add')} onClick=${slotPlus(d, sv.name)}><${I} name="plus" size=${12} /></button>
        </div>`; })}
    </div>`);
  }
  return html`<div className="sched" style=${{ '--cols': cols.length }}>
    <div className="sched-h"><div className="sched-d" />${cols.map(sv => html`<div key=${sv.name || 'x'} className="sched-c"><span>${sv.name || t(DAYS[sv.day])}</span><span className="m">${[t(DAYS[sv.day]).slice(0, 3), fmtTime(sv.time)].filter(Boolean).join(' · ')}</span></div>`)}</div>
    ${rows}
  </div>`;
}

// ←/→ step the calendar while nothing editable has focus.
function useArrows(shift) {
  useEffect(() => {
    const h = e => { if (e.metaKey || e.ctrlKey || e.altKey) return; const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return; if (e.key === 'ArrowLeft') shift(-1); else if (e.key === 'ArrowRight') shift(1); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  });
}
// A pillar beside a month or quarter name: the pillar glyph in its color, then the name; click opens the Pillar modal.
const pillarChip = (p, pillars) => html`<span key=${p.name + p.from} className="pill" onClick=${() => set({ pillarModal: { index: pillars.indexOf(p) } })}><${I} name="pillar" size=${12} style=${p.color ? { color: p.color } : undefined} />${p.name}</span>`;
const monthName = (ym, year) => new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1).toLocaleDateString(locale(), year ? { month: 'long', year: 'numeric' } : { month: 'long' });
// One month's grid of days: weekday captions, every entry a chip, a hover + on each day. Chips open the sermon and drag
// to another day to move it. compact = the Quarter's small cells, tiles only (the chip's title is its tooltip).
function MonthGrid({ ym, sermons, guests, services, colorOf, compact }) {
  const today = ymd(new Date()); const [over, setOver] = useState(null);
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
  const by = entriesByDate(sermons, guests);
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), n = Math.ceil((first.getDay() + days) / 7) * 7, cells = [];
  for (let i = 0; i < n; i++) cells.push(new Date(y, m, 1 - first.getDay() + i));
  const wd = []; for (let i = 0; i < 7; i++) wd.push(new Date(2024, 0, 7 + i).toLocaleDateString(locale(), { weekday: compact ? 'narrow' : 'short' }));
  return html`<>
    <div className="cal-wd">${wd.map((w, i) => html`<span key=${i} className="cap">${w}</span>`)}</div>
    <div className=${'cal-g' + (compact ? ' compact' : '')}>${cells.map(d => { const k = ymd(d), items = by[k] || [];
      return html`<div key=${k} className=${'cal-d group' + (d.getMonth() !== m ? ' out' : '') + (k === today ? ' today' : '') + (over === k ? ' over' : '')} ...${dropZone(over, setOver, k, () => dropOn(k))}>
        <div className="cal-n"><span>${d.getDate()}</span><button className="ib quiet reveal" title=${t('Add')} onClick=${slotPlus(k, slotService('', k, services))}><${I} name="plus" size=${12} /></button></div>
        ${items.map((e, i) => html`<${Chip} key=${i} e=${e} colorOf=${colorOf} />`)}
      </div>`; })}</div>
  </>`;
}
// One month: ‹ › or ←/→ step months, Today returns, the pillars covering the month as chips beside its name.
function Month({ sermons, guests, services, pillars, colorOf, ym, setYm }) {
  const today = ymd(new Date());
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
  const shift = d => { const n = new Date(y, m + d, 1); setYm(n.getFullYear() + '-' + pad(n.getMonth() + 1)); };
  useArrows(shift);
  return html`<div className="cal">
    <div className="cal-h">
      <h2>${monthName(ym, true)}</h2>
      <button className="ib quiet" title=${t('Previous month')} onClick=${() => shift(-1)}><${I} name="chevron-left" /></button>
      <button className="ib quiet" title=${t('Next month')} onClick=${() => shift(1)}><${I} name="chevron-right" /></button>
      ${ym !== today.slice(0, 7) && html`<button className="tb" onClick=${() => setYm(today.slice(0, 7))}>${t('Today')}</button>`}
      ${pillarsIn(pillars, ym).map(p => pillarChip(p, pillars))}
    </div>
    <${MonthGrid} ym=${ym} sermons=${sermons} guests=${guests} services=${services} colorOf=${colorOf} />
  </div>`;
}
// A quarter: the three months around the Month view's month side by side as compact grids. ‹ › or ←/→ step a quarter,
// Today returns, a month's name opens it in Month; the pillars touching any of the three months sit beside the name.
function Quarter({ sermons, guests, services, pillars, colorOf, ym, setYm, onMonth }) {
  const today = ymd(new Date());
  const y = +ym.slice(0, 4), q = Math.floor((+ym.slice(5, 7) - 1) / 3);
  const months = [0, 1, 2].map(i => y + '-' + pad(q * 3 + i + 1));
  const shift = d => { const n = new Date(y, q * 3 + d * 3, 1); setYm(n.getFullYear() + '-' + pad(n.getMonth() + 1)); };
  useArrows(shift);
  const seen = new Set(), active = months.flatMap(mo => pillarsIn(pillars, mo)).filter(p => !seen.has(p) && seen.add(p));
  return html`<div className="cal">
    <div className="cal-h">
      <h2>${t('Q{n} {year}', { n: q + 1, year: y })}</h2>
      <button className="ib quiet" title=${t('Previous quarter')} onClick=${() => shift(-1)}><${I} name="chevron-left" /></button>
      <button className="ib quiet" title=${t('Next quarter')} onClick=${() => shift(1)}><${I} name="chevron-right" /></button>
      ${!months.includes(today.slice(0, 7)) && html`<button className="tb" onClick=${() => setYm(today.slice(0, 7))}>${t('Today')}</button>`}
      ${active.map(p => pillarChip(p, pillars))}
    </div>
    <div className="qtr">${months.map(mo => html`<div key=${mo} className="qtr-m">
      <button className="cap" onClick=${() => onMonth(mo)}>${monthName(mo)}</button>
      <${MonthGrid} ym=${mo} sermons=${sermons} guests=${guests} services=${services} colorOf=${colorOf} compact />
    </div>`)}</div>
  </div>`;
}

// The year as twelve columns. Pillars are the higher construct: a band of their own above the months, each a bar
// carrying its name across the months it spans (overlapping pillars stack into lanes). Beneath the month strip, one
// row per collection as a bar from its first sermon to its last with a tick per date. Today is a hairline.
function Year({ sermons, collections, pillars, colorOf, year, setYear, onMonth }) {
  const today = ymd(new Date()), months = []; for (let i = 0; i < 12; i++) months.push(new Date(year, i, 1).toLocaleDateString(locale(), { month: 'short' }));
  const pct = f => (f * 100).toFixed(2) + '%';
  const todayFrac = +today.slice(0, 4) === year ? (new Date(year, +today.slice(5, 7) - 1, +today.slice(8, 10)) - new Date(year, 0, 1)) / (new Date(year + 1, 0, 1) - new Date(year, 0, 1)) : null;
  const lanes = [], prow = [];
  for (const [i, p] of pillars.entries()) { const sp = pillarSpan(p, year); if (!sp) continue; let lane = lanes.findIndex(end => end <= sp[0]); if (lane < 0) { lane = lanes.length; lanes.push(0); } lanes[lane] = sp[1]; prow.push({ p, i, sp, lane }); }
  const crow = collections.map(c => ({ c, sp: collectionSpan(sermons.filter(s => s.dir === c.name), year) })).filter(x => x.sp);
  const now = todayFrac !== null && html`<span className="yr-now" style=${{ left: pct(todayFrac) }} />`;
  const track = (children, k) => html`<div key=${k} className="yr-track">${now}${children}</div>`;
  return html`<div className="yr">
    <div className="cal-h">
      <h2>${year}</h2>
      <button className="ib quiet" title=${t('Previous year')} onClick=${() => setYear(year - 1)}><${I} name="chevron-left" /></button>
      <button className="ib quiet" title=${t('Next year')} onClick=${() => setYear(year + 1)}><${I} name="chevron-right" /></button>
      ${year !== +today.slice(0, 4) && html`<button className="tb" onClick=${() => setYear(+today.slice(0, 4))}>${t('Today')}</button>`}
      <span className="sp" />
      <button className="ib quiet" title=${t('New pillar')} onClick=${() => set({ pillarModal: { create: true, from: year + '-' + pad(+today.slice(5, 7)), to: year + '-' + pad(+today.slice(5, 7)) } })}><${I} name="plus" size=${14} /></button>
    </div>
    <div className="yr-g">
      ${prow.length > 0 && html`<><div className="yr-l cap"><${I} name="pillar" size=${13} />${t('Pillars')}</div>
        <div className="yr-pillars" style=${{ height: lanes.length * 30 - 6 }}>${now}${prow.map(({ p, i, sp, lane }) => html`<div key=${i} className="yr-pbar" style=${{ left: pct(sp[0]), width: pct(sp[1] - sp[0]), top: lane * 30, background: p.color || 'var(--fill)' }} title=${p.name} onClick=${() => set({ pillarModal: { index: i } })}><${I} name="pillar" size=${12} /><span className="t">${p.name}</span></div>`)}</div></>`}
      <div className="yr-l" />
      <div className="yr-months">${months.map((mn, i) => html`<button key=${i} className=${'cap' + (year + '-' + pad(i + 1) === today.slice(0, 7) ? ' now' : '')} onClick=${() => onMonth(year + '-' + pad(i + 1))}>${mn}</button>`)}</div>
      ${crow.map(({ c, sp }) => html`<${Fragment} key=${'c' + c.name}>
        <div className="yr-l" onClick=${() => set({ collectionModal: { name: c.name } })}><span className="tile sm" style=${c.color ? { background: c.color } : undefined} />${c.name}</div>
        ${track(html`<><div className="yr-bar" style=${{ left: pct(sp.from), width: 'max(3px,' + pct(Math.max(0, sp.to - sp.from)) + ')', background: c.color || 'var(--faint)' }} onClick=${() => set({ collectionModal: { name: c.name } })} />${sp.ticks.map((f, k) => html`<span key=${k} className="yr-tick" style=${{ left: pct(f) }} />`)}</>`, 'c' + c.name)}
      <//>`)}
      ${!crow.length && html`<><div className="yr-l" /><div className="yr-track" /></>`}
    </div>
  </div>`;
}

function Library() {
  const { libName, sermons, collections, plan, libView, libLayout, libQuery, libFindOpen, calScope, status, settings } = useStore(s => ({ libName: s.libName, sermons: s.sermons, collections: s.collections, plan: s.plan, libView: s.libView, libLayout: s.libLayout, libQuery: s.libQuery, libFindOpen: s.libFindOpen, calScope: s.calScope, status: s.status, settings: s.settings }));
  const findRef = useRef(null); const findOpen = libFindOpen || !!libQuery;
  const today = ymd(new Date()); const [ym, setYm] = useState(today.slice(0, 7)); const [year, setYear] = useState(+today.slice(0, 4)); const [over, setOver] = useState(null);
  useEffect(() => { if (libFindOpen && findRef.current) findRef.current.focus(); }, [libFindOpen]);
  const q = libQuery.trim().toLowerCase();
  const match = s => !q || [s.meta.title, s.meta.passage, s.meta.collection, s.meta.big_idea, s.meta.service, ...s.meta.tags].join(' ').toLowerCase().includes(q);
  const list = sermons.filter(match), real = list.filter(s => !s.meta.template);
  const root = real.filter(s => !s.dir), colorOf = name => (collections.find(x => x.name === name) || {}).color || '';
  const months = {}; for (const s of real) { const k = s.meta.date ? s.meta.date.slice(0, 7) : ''; (months[k] = months[k] || []).push(s); }
  const monthLabel = k => k ? new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) : t('Undated');
  const listMode = libLayout === 'list', hasLayout = libView !== 'calendar' && libView !== 'schedule';
  // Rows under a collection heading need neither the tile nor the collection name; month rows carry both.
  const items = (list, color, byCol) => listMode
    ? html`<${Table} list=${list} collection=${!!byCol} colorOf=${colorOf} />`
    : html`<div className="grid">${list.map(s => html`<${Card} key=${s.path} s=${s} color=${color !== undefined ? color : colorOf(s.dir)} />`)}</div>`;
  const guests = q ? plan.guests.filter(g => g.name.toLowerCase().includes(q)) : plan.guests;
  // Print and CSV cover what the Schedule shows, from this week through the last planned entry (scheduleSpan).
  const sched = () => { const { from, to } = scheduleSpan(real, guests, ymd(new Date())); return { from, to, slots: scheduleSlots(real, guests, plan.services, from, to) }; };
  const printSchedule = () => { const x = sched(); doPrintSchedule(libName, x.slots, x.from, x.to, settings, settings.pageNums); };
  const exportSchedule = () => download(new Blob(['\uFEFF' + scheduleCsv(sched().slots)], { type: 'text/csv' }), (libName ? libName + ' — ' : '') + t('Schedule') + '.csv');
  const sec = (k, head, body, drop) => html`<div key=${k} className=${'sec' + (listMode ? ' list' : '') + (over === k ? ' over' : '')} ...${drop ? dropZone(over, setOver, k, drop) : {}}>${head}${body}</div>`;
  return html`<div className="lib">
    <div className="lib-top">
      <h1>${libName}</h1>
      ${findOpen && html`<div className="find"><input ref=${findRef} placeholder=${t('Find')} value=${libQuery} onChange=${e => set({ libQuery: e.target.value })} onKeyDown=${e => { if (e.key === 'Escape') { e.stopPropagation(); closeLibFind(); } }} />
        <button className="ib quiet" title=${t('Close')} onClick=${closeLibFind}><${I} name="x" size=${14} /></button></div>`}
      <button className=${'ib' + (findOpen ? ' on' : '')} title=${t('Find')} onClick=${() => findOpen ? closeLibFind() : set({ libFindOpen: true })}><${I} name="search" /></button>
      <button className="ib" title=${t('New collection')} onClick=${() => set({ collectionModal: { create: true } })}><${I} name="plus" /></button>
      <button className="ib" title=${t('Templates')} onClick=${openTemplates}><${I} name="layers" /></button>
      <button className="ib" title=${t('Illustrations')} onClick=${() => set({ screen: 'illustrations' })}><${I} name="bulb" /></button>
      <button className="ib" title=${t('Bible')} onClick=${() => openBible()}><${I} name="book" /></button>
      <button className="ib" title=${t('Bookmarks')} onClick=${() => openBookmarks()}><${I} name="bookmark" /></button>
      <button className="ib" title=${t('Settings')} onClick=${() => set({ settingsOpen: true })}><${I} name="settings" /></button>
    </div>
    <div className="lib-bar">
      <div className="views">${VIEWS.map(v => html`<button key=${v} className=${libView === v ? 'on' : ''} onClick=${() => setLibView(v)}>${t(cap(v))}</button>`)}</div>
      <span className="sp" />
      ${libView === 'calendar' && html`<div className="seg">${['month', 'quarter', 'year'].map(v => html`<button key=${v} className=${calScope === v ? 'on' : ''} onClick=${() => setCalScope(v)}>${t(cap(v))}</button>`)}</div>`}
      ${libView === 'schedule' && html`<>
        <button className="ib" title=${t('Print')} onClick=${printSchedule}><${I} name="printer" /></button>
        <button className="ib" title=${t('CSV')} onClick=${exportSchedule}><${I} name="download" /></button>
      </>`}
      ${hasLayout && html`<div className="seg">
        <button className=${!listMode ? 'on' : ''} title=${t('Thumbnails')} onClick=${() => setLibLayout('cards')}><${I} name="grid" size=${14} /></button>
        <button className=${listMode ? 'on' : ''} title=${t('List')} onClick=${() => setLibLayout('list')}><${I} name="list" size=${14} /></button>
      </div>`}
    </div>
    ${!collections.length && !sermons.some(s => !s.meta.template) && html`<div className="none"><button className="pb" onClick=${() => set({ collectionModal: { create: true } })}>${t('New collection')}</button></div>`}
    ${libView === 'schedule' ? html`<${Schedule} sermons=${real} guests=${guests} services=${plan.services} colorOf=${colorOf} />`
    : libView === 'calendar' ? (calScope === 'year'
      ? html`<${Year} sermons=${real} collections=${collections} pillars=${plan.pillars} colorOf=${colorOf} year=${year} setYear=${setYear} onMonth=${m => { setYm(m); setCalScope('month'); }} />`
      : calScope === 'quarter' ? html`<${Quarter} sermons=${real} guests=${guests} services=${plan.services} pillars=${plan.pillars} colorOf=${colorOf} ym=${ym} setYm=${setYm} onMonth=${m => { setYm(m); setCalScope('month'); }} />`
      : html`<${Month} sermons=${real} guests=${guests} services=${plan.services} pillars=${plan.pillars} colorOf=${colorOf} ym=${ym} setYm=${setYm} />`)
    : libView === 'collections' ? html`<>
      ${root.length > 0 && sec('root', html`<${Head} name=${t('Unfiled')} />`, items(root, ''))}
      ${collections.map(sr => { const inCol = real.filter(s => s.dir === sr.name); if (!inCol.length && q) return null;
        return sec(sr.name, html`<${Head} color=${sr.color} name=${sr.name} meta=${[span(inCol), sr.big_idea].filter(Boolean).join(' · ')} onClick=${() => set({ collectionModal: { name: sr.name } })} onAdd=${() => newSermon({ collection: sr.name })} onPrint=${inCol.length ? () => set({ printMenu: { collection: sr.name } }) : null} />`, items(inCol, sr.color), () => { const d = dragging; if (d && d.type === 'sermon') { dragging = null; commitMeta(d.path, { collection: sr.name }); } }); })}
    </>` : libView === 'status' ? html`<>
      ${STATUSES.map(st => { const inSt = real.filter(s => s.meta.status === st); if (!inSt.length && q) return null;
        return sec(st, html`<${Head} name=${t(cap(st))} onAdd=${() => newSermon({ status: st })} />`, items(inSt, undefined, true), () => { const d = dragging; if (d && d.type === 'sermon') { dragging = null; commitMeta(d.path, { status: st }); } }); })}
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
