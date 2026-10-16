(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState } = React;
const { useStore, set, stop, closeMenus, createSermon, openSermon, commitMeta, deleteSermon, duplicateSermon, sermonOf, setSettings, setPlan, logout, pickFolder, flash, setCollectionMeta, renameCollection, deleteCollection, createCollection, get, DEFAULTS, stopDictation, addPreached, addGuest, updateGuest, removeGuest, guestKey, addPillar, updatePillar, removePillar, createBookmark, updateBookmark, deleteBookmark, newSermon } = SB.store;
const { STATUSES } = SB.shared.format;
const { doPrint, doPrintCollection, fmtDate } = SB.lib.print;
const { DAYS, slotService, parsePreached, roadmapText } = SB.shared.planning;
const { findBookmark } = SB.shared.bookmarks;
const { I, KIND_ICON } = SB.ui.Icons;
const { KINDS, KIND_COLORS, DEFAULT_KIND_COLORS } = SB.shared.blocks;
const { TagsInput } = SB.ui.Tags;
const { Select } = SB.ui.Select;
const { Combo } = SB.ui.Combo;

const PALETTE = ['', '#d9d9d9', '#f5c2c2', '#f8d9a8', '#f6e7a1', '#c8e6c9', '#bfe0f5', '#d6ccf2', '#f5c8e2'];
const cap = s => s[0].toUpperCase() + s.slice(1);
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function Scrim({ onClose, children, z }) {
  return html`<div className="scrim" style=${z ? { zIndex: z } : undefined} onClick=${onClose}><div className="dlg" onClick=${stop}>${children}</div></div>`;
}
function Swatches({ value, onChange }) {
  return html`<div className="swatches">${PALETTE.map(c => html`<div key=${c || 'none'} className=${'sw' + (value === c ? ' on' : '')} style=${{ background: c || 'var(--bg)' }} onClick=${() => onChange(c)} />`)}</div>`;
}
// Service dropdown: the configured services, or nothing when none are configured.
const serviceOptions = services => services.map(s => ({ value: s.name, label: s.name }));
// A one-button card (the Chrome notice for dictation on the web build).
function Alert() {
  const a = useStore(s => s.alert); if (!a) return null;
  return html`<${Scrim} onClose=${() => set({ alert: null })} z=${22}>
    <h3>${a}</h3>
    <div className="acts"><button className="pb sm" onClick=${() => set({ alert: null })}>OK</button></div>
  <//>`;
}
// Stop, bottom right while dictating — always visible, unlike the hover-revealed mic that started it.
function DictationStop() {
  const { on, side } = useStore(s => ({ on: s.dictation, side: (s.biblePane || s.illPane) && !s.narrow }));
  if (!on) return null;
  return html`<button className="dict-stop" style=${{ right: side ? 360 : 20 }} onMouseDown=${e => e.preventDefault()} onClick=${stopDictation}><${I} name="mic" size=${14} />Stop</button>`;
}
// Live dictation: a pulsing dot and the words not yet committed, bottom center.
function DictationBar() {
  const { on, partial, level, note } = useStore(s => ({ on: s.dictation, partial: s.dictPartial, level: s.dictLevel, note: s.dictNote }));
  if (!on) return null;
  // the dot pulses while idle and swells with the microphone level, so a silent mic is visible
  return html`<div className="dict" onMouseDown=${e => e.preventDefault()}><span className=${'dot' + (level > 0.05 ? ' hot' : '')} style=${{ transform: 'scale(' + (1 + level * 1.2).toFixed(2) + ')' }} /><span className="live">${partial ? html`<span>${partial}</span>` : html`<span className="status">${note || (on === 'starting' ? 'Starting' : 'Listening')}</span>`}</span></div>`;
}
function Confirm() {
  const c = useStore(s => s.confirm); if (!c) return null;
  return html`<${Scrim} onClose=${() => set({ confirm: null })} z=${22}>
    <h3>Delete “${c.title}”?</h3>
    <div className="acts"><button className="cb" onClick=${() => set({ confirm: null })}>Cancel</button><button className="pb sm" onClick=${c.onYes}>Delete</button></div>
  <//>`;
}

// New sermon (create) and Sermon settings (existing) share one modal — like Writer's Book modal.
function SermonModal() {
  const m = useStore(s => s.sermonModal); const collections = useStore(s => s.collections); const sermons = useStore(s => s.sermons); const services = useStore(s => s.plan.services);
  if (!m) return null;
  return html`<${SermonForm} key=${m.path || 'new'} m=${m} collections=${collections} services=${services} templates=${sermons.filter(s => s.meta.template)} />`;
}
// A sermon always has a collection: the field is a dropdown of the existing ones, never blank.
function SermonForm({ m, collections, services, templates }) {
  const existing = m.path ? sermonOf(m.path) : null;
  const meta = existing ? existing.meta : { title: '', collection: m.collection || (collections[0] ? collections[0].name : ''), date: m.date || '', service: m.service || (m.date ? slotService('', m.date, services) : ''), passage: '', status: m.status || 'draft', tags: [], length: 0, preached: [] };
  const [v, setV] = useState({ title: meta.title, collection: meta.collection, date: meta.date, service: meta.service, passage: meta.passage, status: meta.status, tags: [...meta.tags], length: meta.length || '', preached: meta.preached.map(parsePreached).filter(Boolean) });
  const [tplPath, setTplPath] = useState('');
  const nameRef = useRef(null);
  useEffect(() => { const i = nameRef.current; if (i) { i.focus(); if (existing) i.select(); } }, []);
  const upd = k => e => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    const title = v.title.trim(); if (!title) return closeMenus();
    const patch = { title, collection: v.collection.trim(), date: v.date, service: v.service, passage: v.passage.trim(), status: v.status, tags: v.tags, length: +v.length || 0, preached: v.preached.filter(p => p.date).map(p => p.date + (p.service ? ' ' + p.service : '')) };
    if (existing) { closeMenus(); await commitMeta(m.path, patch); }
    else { const path = await createSermon({ ...patch, templatePath: tplPath }); closeMenus(); if (path) openSermon(path); }
  };
  const onKey = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
  const asTemplate = async () => { const path = await createSermon({ title: v.title.trim() || meta.title, passage: v.passage.trim(), tags: v.tags, template: true, templatePath: m.path }); closeMenus(); if (path) flash('Template saved'); };
  const dup = async () => { closeMenus(); const p = await duplicateSermon(m.path); if (p) openSermon(p); };
  const isTpl = existing && existing.meta.template;
  const setP = (i, patch) => setV({ ...v, preached: v.preached.map((p, k) => k === i ? { ...p, ...patch } : p) });
  return html`<${Scrim} onClose=${closeMenus}>
    <input ref=${nameRef} className="name" placeholder=${isTpl ? 'Template name' : 'Sermon title'} value=${v.title} onChange=${upd('title')} onKeyDown=${onKey} />
    ${!isTpl && html`<div className="r"><label>Collection</label><${Select} className="in" value=${v.collection} onChange=${collection => setV({ ...v, collection })} options=${collections.map(s => ({ value: s.name, label: s.name }))} /></div>`}
    ${!isTpl && html`<div className="r"><label>Date</label><input className="in" type="date" value=${v.date} onChange=${e => setV({ ...v, date: e.target.value, service: v.service || slotService('', e.target.value, services) })} onKeyDown=${onKey} /></div>`}
    ${!isTpl && services.length > 0 && html`<div className="r"><label>Service</label><${Select} className="in" value=${v.service} onChange=${service => setV({ ...v, service })} options=${serviceOptions(services)} /></div>`}
    <div className="r"><label>Passage</label><input className="in" value=${v.passage} onChange=${upd('passage')} onKeyDown=${onKey} /></div>
    ${!isTpl && html`<div className="r"><label>Status</label><div className="seg">${STATUSES.map(s => html`<button key=${s} className=${v.status === s ? 'on' : ''} onClick=${() => setV({ ...v, status: s })}>${cap(s)}</button>`)}</div></div>`}
    <div className="r"><label>Tags</label><${TagsInput} className="in" value=${v.tags} onChange=${tags => setV({ ...v, tags })} onKeyDown=${onKey} /></div>
    ${!isTpl && html`<div className="r"><label>Length</label><input className="in num" inputMode="numeric" value=${v.length} onChange=${upd('length')} onKeyDown=${onKey} /><span className="status">min</span></div>`}
    ${existing && !isTpl && html`<div className="r top"><label>Preached again</label><div className="stack">
      ${v.preached.map((p, i) => html`<div key=${i} className="pr"><input className="in" type="date" value=${p.date} onChange=${e => setP(i, { date: e.target.value, service: p.service || slotService('', e.target.value, services) })} />
        ${services.length > 0 && html`<${Select} className="in" value=${p.service} onChange=${service => setP(i, { service })} options=${serviceOptions(services)} />`}
        <button className="ib quiet" title="Remove" onClick=${() => setV({ ...v, preached: v.preached.filter((x, k) => k !== i) })}><${I} name="x" size=${14} /></button></div>`)}
      <button className="ib quiet" title="Add" onClick=${() => setV({ ...v, preached: [...v.preached, { date: today(), service: slotService('', today(), services) }] })}><${I} name="plus" size=${14} /></button>
    </div></div>`}
    ${!existing && html`<div className="r"><label>Template</label><${Select} className="in" up value=${tplPath} onChange=${setTplPath} options=${[{ value: '', label: 'Blank' }, ...(templates.length ? [null] : []), ...templates.map(t => ({ value: t.path, label: t.meta.title }))]} /></div>`}
    <div className="acts"><button className="cb" onClick=${closeMenus}>Cancel</button><button className="pb sm" onClick=${save}>Save</button></div>
    ${existing && html`<><div className="hair" />
      <button className="full" onClick=${dup}>${isTpl ? 'Duplicate template' : 'Duplicate sermon'}</button>
      ${!isTpl && html`<button className="full" onClick=${asTemplate}>Save as template</button>`}
      <button className="full" onClick=${() => set({ confirm: { title: meta.title, onYes: () => deleteSermon(m.path) } })}>${isTpl ? 'Delete template' : 'Delete sermon'}</button></>`}
  <//>`;
}

function CollectionModal() {
  const m = useStore(s => s.collectionModal); if (!m) return null;
  return html`<${CollectionForm} key=${m.name || 'new'} name=${m.name || ''} />`;
}
// New collection (no name yet) and an existing collection share this form: name, big idea, color, and Delete for an existing one.
function CollectionForm({ name }) {
  const s = useStore(st => st.collections.find(x => x.name === name)); const [v, setV] = useState(name); const [color, setColor] = useState(s ? s.color : ''); const [idea, setIdea] = useState(s ? s.big_idea || '' : '');
  const ref = useRef(null); useEffect(() => { ref.current && ref.current.focus(); }, []);
  const close = () => set({ collectionModal: null });
  const save = async () => {
    if (!name) { const t = v.trim(); if (!t) return close(); if (!await createCollection(t, color, idea.trim())) flash('Name in use'); return close(); }
    if (color !== (s ? s.color : '') || idea.trim() !== (s ? s.big_idea || '' : '')) await setCollectionMeta(name, { color, big_idea: idea.trim() });
    if (v.trim() && v.trim() !== name) { if (!await renameCollection(name, v.trim())) flash('Name in use'); } close(); };
  const onKey = e => { if (e.key === 'Enter') save(); };
  return html`<${Scrim} onClose=${close}>
    <input ref=${ref} className="name" placeholder="Collection name" value=${v} onChange=${e => setV(e.target.value)} onKeyDown=${onKey} />
    <div className="r"><label>Big idea</label><input className="in" value=${idea} onChange=${e => setIdea(e.target.value)} onKeyDown=${onKey} /></div>
    <div className="r"><label>Color</label><${Swatches} value=${color} onChange=${setColor} /></div>
    <div className="acts"><button className="cb" onClick=${close}>Cancel</button><button className="pb sm" onClick=${save}>Save</button></div>
    ${name && html`<><div className="hair" /><button className="full" onClick=${() => set({ confirm: { title: name, onYes: () => { deleteCollection(name); close(); } } })}>Delete collection</button></>`}
  <//>`;
}

// Print: the open sermon (Manuscript · Outline · Handout) or a collection (Roadmap · Manuscript · Outline, and Copy for the roadmap text).
function PrintMenu() {
  const openP = useStore(s => s.printMenu); const settings = useStore(s => s.settings); const openPath = useStore(s => s.openPath); const sermons = useStore(s => s.sermons); const collections = useStore(s => s.collections);
  const [scope, setScope] = useState('manuscript');
  if (!openP) return null;
  const col = openP && openP.collection ? collections.find(c => c.name === openP.collection) : null;
  if (!col && !openPath) return null;
  const inCol = col ? sermons.filter(s => s.dir === col.name && !s.meta.template) : [];
  const go = sc => { set({ printMenu: false }); if (col) doPrintCollection(col, inCol, settings, sc, settings.pageNums); else { const s = sermonOf(openPath); if (s) doPrint(s, settings, sc, settings.pageNums); } };
  const copy = async () => { try { await navigator.clipboard.writeText(roadmapText(col, inCol, { fmtDate })); flash('Copied'); } catch (e) { flash('Could not copy'); } set({ printMenu: false }); };
  const cur = col ? null : sermonOf(openPath);
  const scopes = col ? ['roadmap', 'manuscript', 'outline'] : ['manuscript', 'outline', 'handout', ...(cur && (cur.notes || '').trim() ? ['notes'] : [])];
  const icon = sc => sc === 'manuscript' ? 'align' : sc === 'outline' ? 'layers' : sc === 'roadmap' ? 'calendar' : sc === 'notes' ? 'pen' : 'note';
  return html`<${Scrim} onClose=${closeMenus}>
    <div className="status" style=${{ textAlign: 'center' }}>${col ? 'Print ' + col.name : 'Print'}</div>
    <div className="cards">
      ${scopes.map(sc => html`<div key=${sc} className=${'pcard' + (scope === sc ? ' on' : '')} onMouseEnter=${() => setScope(sc)} onClick=${() => go(sc)}>
        <${I} name=${icon(sc)} size=${28} />${cap(sc)}</div>`)}
    </div>
    <div className="r" style=${{ justifyContent: 'flex-end' }}>
      ${col && html`<button className="tb" onClick=${copy}><${I} name="copy" size=${14} />Copy</button>`}
      <span className="sp" />
      <div className="chk" onClick=${() => setSettings({ pageNums: !settings.pageNums })}><div className=${'box' + (settings.pageNums ? ' on' : '')}>${settings.pageNums && html`<${I} name="check" size=${10} />`}</div>Page numbers</div>
    </div>
  <//>`;
}

function Settings() {
  const o = useStore(s => s.settingsOpen); const st = useStore(s => s.settings); const libName = useStore(s => s.libName); const services = useStore(s => s.plan.services);
  if (!o) return null;
  const Seg = ({ k, opts, fmt = x => x }) => html`<div className="seg">${opts.map(v => html`<button key=${v} className=${st[k] === v ? 'on' : ''} onClick=${() => setSettings({ [k]: v })}>${fmt(v)}</button>`)}</div>`;
  return html`<${Scrim} onClose=${closeMenus}>
    <div className="r"><label>Folder</label><span style=${{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${libName}</span><button className="tb" onClick=${async () => { closeMenus(); await logout(); pickFolder(); }}>Change</button></div>
    <div className="r"><label>Services</label><span className="status" style=${{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${services.map(s => s.name).join(' · ')}</span><button className="tb" onClick=${() => set({ settingsOpen: false, servicesOpen: true })}>Edit</button></div>
    <div className="r"><label>Font</label><${Seg} k="font" opts=${['sans', 'serif', 'mono', 'courier']} /></div>
    <div className="r"><label>Text size</label><${Seg} k="size" opts=${[16, 18, 20, 22]} /><span className="status">px</span></div>
    <div className="r"><label>Theme</label><${Seg} k="theme" opts=${['system', 'light', 'dark']} fmt=${cap} /></div>
    <div className="r"><label>Podium text size</label><${Seg} k="podium" opts=${[24, 28, 32, 36]} /><span className="status">px</span></div>
    <div className="r"><label>Colors</label><div className="kc-row" style=${{ flex: 1 }}>${KINDS.filter(k => (st.colors || {})[k.kind]).map(k => html`<span key=${k.kind} className="kc-dot" style=${{ background: st.colors[k.kind] }} />`)}</div><button className="tb" onClick=${() => set({ settingsOpen: false, colorsOpen: true })}>Edit</button></div>
    <div className="hair" style=${{ paddingTop: 10 }}><button className="full" onClick=${() => { closeMenus(); logout(); }}>Log out</button></div>
  <//>`;
}

// The weekly teaching slots: name, weekday, time. Saved to sermon.json `plan.services`.
function ServicesDialog() {
  const o = useStore(s => s.servicesOpen); const services = useStore(s => s.plan.services);
  const [rows, setRows] = useState(null);
  useEffect(() => { if (o) setRows(services.map(s => ({ ...s }))); }, [o]);
  if (!o || !rows) return null;
  const back = () => set({ servicesOpen: false, settingsOpen: true });
  const save = async () => { await setPlan({ services: rows }); back(); };
  const upd = (i, patch) => setRows(rows.map((r, k) => k === i ? { ...r, ...patch } : r));
  return html`<${Scrim} onClose=${back}>
    ${rows.map((r, i) => html`<div key=${i} className="r svc">
      <input className="in" placeholder="Service" value=${r.name} onChange=${e => upd(i, { name: e.target.value })} />
      <${Select} className="in" value=${r.day} onChange=${day => upd(i, { day })} options=${DAYS.map((d, k) => ({ value: k, label: d }))} />
      <input className="in time" type="time" value=${r.time} onChange=${e => upd(i, { time: e.target.value })} />
      <button className="ib quiet" title="Remove" onClick=${() => setRows(rows.filter((x, k) => k !== i))}><${I} name="x" size=${14} /></button>
    </div>`)}
    <div className="r"><button className="ib quiet" title="Add" onClick=${() => setRows([...rows, { name: '', day: 0, time: '' }])}><${I} name="plus" size=${14} /></button></div>
    <div className="acts"><button className="cb" onClick=${back}>Cancel</button><button className="pb sm" onClick=${save}>Save</button></div>
  <//>`;
}

// A guest speaker is a line in the plan: name, date, service.
function GuestModal() {
  const m = useStore(s => s.guestModal); const guests = useStore(s => s.plan.guests); const services = useStore(s => s.plan.services);
  if (!m) return null;
  return html`<${GuestForm} key=${m.key || 'new'} m=${m} guests=${guests} services=${services} />`;
}
function GuestForm({ m, guests, services }) {
  const g = m.key ? guests.find(x => guestKey(x) === m.key) : null;
  const [v, setV] = useState(g ? { ...g } : { name: '', date: m.date || today(), service: m.service || slotService('', m.date || today(), services) });
  const names = [...new Set(guests.map(x => x.name))].sort();
  const close = () => set({ guestModal: null });
  const save = async () => { const name = v.name.trim(); if (!name || !v.date) return close(); close(); if (g) await updateGuest(m.key, { ...v, name }); else await addGuest({ ...v, name }); };
  const onKey = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
  return html`<${Scrim} onClose=${close}>
    <div className="r"><label>Guest</label><${Combo} className="in name-in" placeholder="Name" value=${v.name} onChange=${name => setV({ ...v, name })} options=${names} onKeyDown=${onKey} /></div>
    <div className="r"><label>Date</label><input className="in" type="date" value=${v.date} onChange=${e => setV({ ...v, date: e.target.value, service: v.service || slotService('', e.target.value, services) })} onKeyDown=${onKey} /></div>
    ${services.length > 0 && html`<div className="r"><label>Service</label><${Select} className="in" value=${v.service} onChange=${service => setV({ ...v, service })} options=${serviceOptions(services)} /></div>`}
    <div className="acts"><button className="cb" onClick=${close}>Cancel</button><button className="pb sm" onClick=${save}>Save</button></div>
    ${g && html`<><div className="hair" /><button className="full" onClick=${() => set({ confirm: { title: g.name, onYes: () => removeGuest(m.key) } })}>Delete guest</button></>`}
  <//>`;
}

// A pillar spans months and shows as a bar over the Year view.
function PillarModal() {
  const m = useStore(s => s.pillarModal); const pillars = useStore(s => s.plan.pillars);
  if (!m) return null;
  return html`<${PillarForm} key=${m.index != null ? m.index : 'new'} m=${m} pillars=${pillars} />`;
}
function PillarForm({ m, pillars }) {
  const p = m.index != null ? pillars[m.index] : null;
  const [v, setV] = useState(p ? { ...p } : { name: '', color: '', from: m.from || '', to: m.to || '' });
  const ref = useRef(null); useEffect(() => { ref.current && ref.current.focus(); }, []);
  const close = () => set({ pillarModal: null });
  const save = async () => { const name = v.name.trim(); if (!name || !v.from || !v.to) return close(); const next = { ...v, name, to: v.to < v.from ? v.from : v.to }; close(); if (p) await updatePillar(m.index, next); else await addPillar(next); };
  const onKey = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
  return html`<${Scrim} onClose=${close}>
    <input ref=${ref} className="name" placeholder="Pillar" value=${v.name} onChange=${e => setV({ ...v, name: e.target.value })} onKeyDown=${onKey} />
    <div className="r"><label>From</label><input className="in" type="month" value=${v.from} onChange=${e => setV({ ...v, from: e.target.value })} onKeyDown=${onKey} /></div>
    <div className="r"><label>To</label><input className="in" type="month" value=${v.to} onChange=${e => setV({ ...v, to: e.target.value })} onKeyDown=${onKey} /></div>
    <div className="r"><label>Color</label><${Swatches} value=${v.color} onChange=${color => setV({ ...v, color })} /></div>
    <div className="acts"><button className="cb" onClick=${close}>Cancel</button><button className="pb sm" onClick=${save}>Save</button></div>
    ${p && html`<><div className="hair" /><button className="full" onClick=${() => set({ confirm: { title: p.name, onYes: () => removePillar(m.index) } })}>Delete pillar</button></>`}
  <//>`;
}

// Repeat sermon: pick an existing sermon for a slot; it gets a `preached` entry for that date and service.
function RepeatPick() {
  const m = useStore(s => s.repeatPick); const sermons = useStore(s => s.sermons);
  const [q, setQ] = useState(''); const ref = useRef(null);
  useEffect(() => { setQ(''); if (m && ref.current) ref.current.focus(); }, [m]);
  if (!m) return null;
  const needle = q.trim().toLowerCase();
  const list = sermons.filter(s => !s.meta.template && (!needle || [s.meta.title, s.meta.passage, s.meta.collection, ...s.meta.tags].join(' ').toLowerCase().includes(needle))).sort((a, b) => a.meta.title.localeCompare(b.meta.title));
  const close = () => set({ repeatPick: null });
  const pick = async s => { close(); await addPreached(s.path, m.date, m.service); flash('Added'); };
  return html`<${Scrim} onClose=${close}>
    <div className="status">${fmtDate(m.date)}${m.service ? ' · ' + m.service : ''}</div>
    <input ref=${ref} className="name" placeholder="Find" value=${q} onChange=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && list[0]) pick(list[0]); }} />
    <div className="picklist">${list.map(s => html`<div key=${s.path} className="row" onClick=${() => pick(s)}><span className="t">${s.meta.title}</span><span className="m">${[s.meta.collection, s.meta.date ? fmtDate(s.meta.date) : ''].filter(Boolean).join(' · ')}</span></div>`)}</div>
  <//>`;
}

// Bookmark a passage: the reference is the name; tags and a note are optional. Existing bookmarks edit here too.
function BookmarkModal() {
  const m = useStore(s => s.bookmarkModal); const bookmarks = useStore(s => s.bookmarks);
  if (!m) return null;
  const bm = m.path ? bookmarks.find(b => b.path === m.path) : findBookmark(bookmarks, m.reference);
  return html`<${BookmarkForm} key=${(bm && bm.path) || m.reference} m=${m} bm=${bm} />`;
}
function BookmarkForm({ m, bm }) {
  const [tags, setTags] = useState(bm ? [...bm.meta.tags] : []); const [note, setNote] = useState(bm ? bm.body : '');
  const close = () => set({ bookmarkModal: null });
  const save = async () => {
    close();
    if (bm) updateBookmark(bm.path, b => { b.meta.tags = tags; b.body = note; });
    else { const p = await createBookmark({ reference: m.reference, tags, body: note }); if (p) flash('Bookmarked'); }
  };
  return html`<${Scrim} onClose=${close}>
    <h3>${bm ? bm.meta.reference : m.reference}</h3>
    <div className="r"><label>Tags</label><${TagsInput} className="in" value=${tags} onChange=${setTags} /></div>
    <div className="r top"><label>Note</label><textarea className="in note" rows="4" value=${note} onChange=${e => setNote(e.target.value)} /></div>
    <div className="acts"><button className="cb" onClick=${close}>Cancel</button><button className="pb sm" onClick=${save}>Save</button></div>
    ${bm && html`<><div className="hair" /><button className="full" onClick=${() => set({ confirm: { title: bm.meta.reference, onYes: () => deleteBookmark(bm.path) } })}>Delete bookmark</button></>`}
  <//>`;
}

// The + on a schedule slot or calendar day: New sermon · Repeat sermon · Guest speaker.
function SlotMenu() {
  const m = useStore(s => s.slotMenu); const ref = useRef(null);
  useEffect(() => { if (!m) return; const h = e => { if (ref.current && !ref.current.contains(e.target)) set({ slotMenu: null }); }; document.addEventListener('pointerdown', h, true); return () => document.removeEventListener('pointerdown', h, true); }, [m]);
  if (!m) return null;
  const row = (label, fn) => html`<button onMouseDown=${e => e.preventDefault()} onClick=${() => { set({ slotMenu: null }); fn(); }}>${label}</button>`;
  const left = Math.min(m.x, window.innerWidth - 200);
  return html`<div ref=${ref} className="pop fixed" style=${{ top: m.y, left }}>
    ${row('New sermon', () => newSermon({ date: m.date, service: m.service }))}
    ${row('Repeat sermon', () => set({ repeatPick: { date: m.date, service: m.service } }))}
    ${row('Guest speaker', () => set({ guestModal: { create: true, date: m.date, service: m.service } }))}
  </div>`;
}

// One ink color per block kind: caption, rail glyph, number and a point's rule wear it. '' = the faint token.
function KindColors() {
  const o = useStore(s => s.colorsOpen); const colors = useStore(s => s.settings.colors || {});
  if (!o) return null;
  const pick = (kind, c) => setSettings({ colors: { ...colors, [kind]: c } });
  return html`<${Scrim} onClose=${() => set({ colorsOpen: false, settingsOpen: true })}>
    ${KINDS.map(k => html`<div key=${k.kind} className="r"><label style=${{ display: 'flex', alignItems: 'center', gap: 8, color: colors[k.kind] || 'var(--muted)' }}><${I} name=${KIND_ICON[k.kind] || 'box'} size=${14} />${k.label}</label>
      <div className="swatches">${KIND_COLORS.map(c => html`<div key=${c || 'none'} className=${'sw' + ((colors[k.kind] || '') === c ? ' on' : '')} style=${{ background: c || 'var(--bg)' }} onClick=${() => pick(k.kind, c)} />`)}</div></div>`)}
    <div className="hair" style=${{ paddingTop: 10 }}><button className="full" onClick=${() => setSettings({ colors: { ...DEFAULT_KIND_COLORS } })}>Reset</button></div>
  <//>`;
}

function NameDialog() {
  const d = useStore(s => s.nameDialog); const [v, setV] = useState(''); const ref = useRef(null);
  useEffect(() => { setV(''); if (d && ref.current) ref.current.focus(); }, [d]);
  if (!d) return null;
  const close = () => set({ nameDialog: null });
  const save = () => { const t = v.trim(); close(); if (t) d.onSave(t); };
  return html`<${Scrim} onClose=${close}>
    <input ref=${ref} className="name" placeholder=${d.placeholder} value=${v} onChange=${e => setV(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') save(); }} />
    <div className="acts"><button className="cb" onClick=${close}>Cancel</button><button className="pb sm" onClick=${save}>Save</button></div>
  <//>`;
}
(SB.ui ||= {}).Overlays = { PALETTE, Scrim, Alert, DictationStop, DictationBar, Confirm, SermonModal, CollectionModal, PrintMenu, Settings, ServicesDialog, GuestModal, PillarModal, RepeatPick, BookmarkModal, SlotMenu, KindColors, NameDialog };
})(globalThis.SB ||= {});
