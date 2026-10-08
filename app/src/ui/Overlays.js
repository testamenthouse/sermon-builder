(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState } = React;
const { fs } = SB.fs;
const { useStore, set, stop, closeMenus, createSermon, openSermon, commitMeta, deleteSermon, sermonOf, setSettings, logout, pickFolder, flash, setCollectionColor, renameCollection, deleteCollection, createCollection, get, DEFAULTS, stopDictation } = SB.store;
const { STATUSES } = SB.shared.format;
const { doPrint } = SB.lib.print;
const { I, KIND_ICON } = SB.ui.Icons;
const { KINDS, KIND_COLORS, DEFAULT_KIND_COLORS } = SB.shared.blocks;
const { TagsInput } = SB.ui.Tags;
const { Select } = SB.ui.Select;

const PALETTE = ['', '#d9d9d9', '#f5c2c2', '#f8d9a8', '#f6e7a1', '#c8e6c9', '#bfe0f5', '#d6ccf2', '#f5c8e2'];
const cap = s => s[0].toUpperCase() + s.slice(1);

function Scrim({ onClose, children, z }) {
  return html`<div className="scrim" style=${z ? { zIndex: z } : undefined} onClick=${onClose}><div className="dlg" onClick=${stop}>${children}</div></div>`;
}
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
  const m = useStore(s => s.sermonModal); const collections = useStore(s => s.collections); const sermons = useStore(s => s.sermons);
  if (!m) return null;
  return html`<${SermonForm} key=${m.path || 'new'} m=${m} collections=${collections} templates=${sermons.filter(s => s.meta.template)} />`;
}
// A sermon always has a collection: the field is a dropdown of the existing ones, never blank.
function SermonForm({ m, collections, templates }) {
  const existing = m.path ? sermonOf(m.path) : null;
  const meta = existing ? existing.meta : { title: '', collection: m.collection || (collections[0] ? collections[0].name : ''), date: m.date || '', passage: '', status: 'draft', tags: [], length: 0 };
  const [v, setV] = useState({ title: meta.title, collection: meta.collection, date: meta.date, passage: meta.passage, status: meta.status, tags: [...meta.tags], length: meta.length || '' });
  const [tplPath, setTplPath] = useState('');
  const nameRef = useRef(null);
  useEffect(() => { const i = nameRef.current; if (i) { i.focus(); if (existing) i.select(); } }, []);
  const upd = k => e => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    const title = v.title.trim(); if (!title) return closeMenus();
    const patch = { title, collection: v.collection.trim(), date: v.date, passage: v.passage.trim(), status: v.status, tags: v.tags, length: +v.length || 0 };
    if (existing) { closeMenus(); await commitMeta(m.path, patch); }
    else { const path = await createSermon({ ...patch, templatePath: tplPath }); closeMenus(); if (path) openSermon(path); }
  };
  const onKey = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
  const asTemplate = async () => { const path = await createSermon({ title: v.title.trim() || meta.title, passage: v.passage.trim(), tags: v.tags, template: true, templatePath: m.path }); closeMenus(); if (path) flash('Template saved'); };
  const isTpl = existing && existing.meta.template;
  return html`<${Scrim} onClose=${closeMenus}>
    <input ref=${nameRef} className="name" placeholder=${isTpl ? 'Template name' : 'Sermon title'} value=${v.title} onChange=${upd('title')} onKeyDown=${onKey} />
    ${!isTpl && html`<div className="r"><label>Collection</label><${Select} className="in" value=${v.collection} onChange=${collection => setV({ ...v, collection })} options=${collections.map(s => ({ value: s.name, label: s.name }))} /></div>`}
    ${!isTpl && html`<div className="r"><label>Date</label><input className="in" type="date" value=${v.date} onChange=${upd('date')} onKeyDown=${onKey} /></div>`}
    <div className="r"><label>Passage</label><input className="in" value=${v.passage} onChange=${upd('passage')} onKeyDown=${onKey} /></div>
    ${!isTpl && html`<div className="r"><label>Status</label><div className="seg">${STATUSES.map(s => html`<button key=${s} className=${v.status === s ? 'on' : ''} onClick=${() => setV({ ...v, status: s })}>${cap(s)}</button>`)}</div></div>`}
    <div className="r"><label>Tags</label><${TagsInput} className="in" value=${v.tags} onChange=${tags => setV({ ...v, tags })} onKeyDown=${onKey} /></div>
    ${!isTpl && html`<div className="r"><label>Length</label><input className="in num" inputMode="numeric" value=${v.length} onChange=${upd('length')} onKeyDown=${onKey} /><span className="status">min</span></div>`}
    ${!existing && html`<div className="r"><label>Template</label><${Select} className="in" up value=${tplPath} onChange=${setTplPath} options=${[{ value: '', label: 'Blank' }, ...(templates.length ? [null] : []), ...templates.map(t => ({ value: t.path, label: t.meta.title }))]} /></div>`}
    <div className="acts"><button className="cb" onClick=${closeMenus}>Cancel</button><button className="pb sm" onClick=${save}>Save</button></div>
    ${existing && html`<><div className="hair" />
      ${!isTpl && html`<button className="full" onClick=${asTemplate}>Save as template</button>`}
      ${fs.reveal && html`<button className="full" onClick=${() => { closeMenus(); fs.reveal(m.path); }}>${/Mac/.test(navigator.platform) ? 'Show in Finder' : 'Show in Explorer'}</button>`}
      <button className="full" onClick=${() => set({ confirm: { title: meta.title, onYes: () => deleteSermon(m.path) } })}>${isTpl ? 'Delete template' : 'Delete sermon'}</button></>`}
  <//>`;
}

function CollectionModal() {
  const m = useStore(s => s.collectionModal); if (!m) return null;
  return html`<${CollectionForm} key=${m.name || 'new'} name=${m.name || ''} />`;
}
// New collection (no name yet) and an existing collection share this form: name, color, and Delete for an existing one.
function CollectionForm({ name }) {
  const s = useStore(st => st.collections.find(x => x.name === name)); const [v, setV] = useState(name); const [color, setColor] = useState(s ? s.color : '');
  const ref = useRef(null); useEffect(() => { ref.current && ref.current.focus(); }, []);
  const close = () => set({ collectionModal: null });
  const save = async () => {
    if (!name) { const t = v.trim(); if (!t) return close(); if (!await createCollection(t, color)) flash('Name in use'); return close(); }
    if (color !== (s ? s.color : '')) await setCollectionColor(name, color); if (v.trim() && v.trim() !== name) { if (!await renameCollection(name, v.trim())) flash('Name in use'); } close(); };
  return html`<${Scrim} onClose=${close}>
    <input ref=${ref} className="name" placeholder="Collection name" value=${v} onChange=${e => setV(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') save(); }} />
    <div className="r"><label>Color</label><div className="swatches">${PALETTE.map(c => html`<div key=${c || 'none'} className=${'sw' + (color === c ? ' on' : '')} style=${{ background: c || 'var(--bg)' }} onClick=${() => setColor(c)} />`)}</div></div>
    <div className="acts"><button className="cb" onClick=${close}>Cancel</button><button className="pb sm" onClick=${save}>Save</button></div>
    ${name && html`<><div className="hair" /><button className="full" onClick=${() => set({ confirm: { title: name, onYes: () => { deleteCollection(name); close(); } } })}>Delete collection</button></>`}
  <//>`;
}

function PrintMenu() {
  const openP = useStore(s => s.printMenu); const settings = useStore(s => s.settings); const openPath = useStore(s => s.openPath);
  const [scope, setScope] = useState('manuscript');
  if (!openP || !openPath) return null;
  const go = sc => { const s = sermonOf(openPath); set({ printMenu: false }); if (s) doPrint(s, settings, sc, settings.pageNums); };
  return html`<${Scrim} onClose=${closeMenus}>
    <div className="status" style=${{ textAlign: 'center' }}>Print</div>
    <div className="cards">
      ${['manuscript', 'outline', 'handout'].map(sc => html`<div key=${sc} className=${'pcard' + (scope === sc ? ' on' : '')} onMouseEnter=${() => setScope(sc)} onClick=${() => go(sc)}>
        <${I} name=${sc === 'manuscript' ? 'align' : sc === 'outline' ? 'layers' : 'note'} size=${28} />${cap(sc)}</div>`)}
    </div>
    <div className="r" style=${{ justifyContent: 'flex-end' }}>
      <div className="chk" onClick=${() => setSettings({ pageNums: !settings.pageNums })}><div className=${'box' + (settings.pageNums ? ' on' : '')}>${settings.pageNums && html`<${I} name="check" size=${10} />`}</div>Page numbers</div>
    </div>
  <//>`;
}

function Settings() {
  const o = useStore(s => s.settingsOpen); const st = useStore(s => s.settings); const libName = useStore(s => s.libName); const mcp = useStore(s => s.mcpCommand);
  if (!o) return null;
  const Seg = ({ k, opts, fmt = x => x }) => html`<div className="seg">${opts.map(v => html`<button key=${v} className=${st[k] === v ? 'on' : ''} onClick=${() => setSettings({ [k]: v })}>${fmt(v)}</button>`)}</div>`;
  const copyMcp = async () => { try { await navigator.clipboard.writeText(mcp); flash('Copied'); } catch (e) { flash('Could not copy'); } };
  return html`<${Scrim} onClose=${closeMenus}>
    <div className="r"><label>Folder</label><span style=${{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${libName}</span><button className="tb" onClick=${async () => { closeMenus(); await logout(); pickFolder(); }}>Change</button></div>
    <div className="r"><label>Font</label><${Seg} k="font" opts=${['sans', 'serif', 'mono', 'courier']} /></div>
    <div className="r"><label>Text size</label><${Seg} k="size" opts=${[16, 18, 20, 22]} /><span className="status">px</span></div>
    <div className="r"><label>Theme</label><${Seg} k="theme" opts=${['system', 'light', 'dark']} fmt=${cap} /></div>
    <div className="r"><label>Podium text size</label><${Seg} k="podium" opts=${[24, 28, 32, 36]} /><span className="status">px</span></div>
    <div className="r"><label>Colors</label><div className="kc-row" style=${{ flex: 1 }}>${KINDS.filter(k => (st.colors || {})[k.kind]).map(k => html`<span key=${k.kind} className="kc-dot" style=${{ background: st.colors[k.kind] }} />`)}</div><button className="tb" onClick=${() => set({ settingsOpen: false, colorsOpen: true })}>Edit</button></div>
    ${mcp && html`<div className="r"><label>Claude</label><span className="status" style=${{ flex: 1 }}>MCP</span><button className="tb" onClick=${copyMcp}>Copy</button></div>`}
    <div className="hair" style=${{ paddingTop: 10 }}><button className="full" onClick=${() => { closeMenus(); logout(); }}>Log out</button></div>
  <//>`;
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
(SB.ui ||= {}).Overlays = { PALETTE, Scrim, Alert, DictationStop, DictationBar, Confirm, SermonModal, CollectionModal, PrintMenu, Settings, KindColors, NameDialog };
})(globalThis.SB ||= {});
