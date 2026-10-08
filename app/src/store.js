// One external store (useSyncExternalStore). The folder is the only source of truth: sermons are never cached,
// settings live in sermon.json in the library root (localStorage holds a fallback copy for the first paint).
(function (SB) {
'use strict';
const { useRef, useSyncExternalStore } = React;
const { fs } = SB.fs;
const { parseSermon, serializeSermon, normalizeMeta, slugify, newId, parseMeta } = SB.shared.format;
const { illustrationBody } = SB.shared.illustrations;
const { seedTemplates, TEMPLATES_DIR } = SB.shared.templates;
const { isWriterLibrary, WRITER_URL, onPages } = SB.shared.library;
const { KIND, DEFAULT_KIND_COLORS } = SB.shared.blocks;
const { groupRange, moveRange, moveStep, canInsert, canSwitch } = SB.shared.outline;
const { loadBible, lookupNow, passageText } = SB.lib.bible;
const { createDictation, createInserter, backend: dictationBackend } = SB.lib.dictation;

const RESERVED = { templates: TEMPLATES_DIR, illustrations: 'Illustrations' };
const DEFAULTS = { font: 'sans', size: 18, theme: 'system', podium: 28, colors: DEFAULT_KIND_COLORS };
const ls = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

// Narrow screens (phones): the rail and side panes become overlays over a single column.
const NARROW = window.matchMedia('(max-width: 760px)');
let state = {
  booting: true, folderOpen: false, resumable: false, gateStatus: '', gateLink: '', libName: '',
  sermons: [], collections: [], illustrations: [], settings: { ...DEFAULTS, ...safeJson(ls('sermon.settings', 'null')) },
  screen: 'library', openPath: null, curBlock: null, illPath: null, focusReq: null,
  status: '', libView: { series: 'collections', collection: 'collections' }[ls('sermon.libview', 'collections')] || ls('sermon.libview', 'collections'), libLayout: ls('sermon.liblayout', 'cards'), libQuery: '', libFindOpen: false,
  railMin: ls('sermon.rail', 'max') === 'min', biblePane: ls('sermon.bible', 'closed') === 'open', illPane: ls('sermon.ill', 'closed') === 'open', illReturn: null, podium: false,
  findOpen: false, find: '', findIdx: 0, findCount: 0,
  sermonModal: null, newDialog: false, printMenu: false, settingsOpen: false, confirm: null, kindMenu: null, fold: {}, colorsOpen: false,
  alert: null, dictation: null, dictPartial: '', dictLevel: 0, dictNote: '',
  narrow: NARROW.matches, drawer: false
};
function safeJson(s) { try { return JSON.parse(s) || {}; } catch (e) { return {}; } }
const subs = new Set();
const get = () => state;
function set(patch) { const p = typeof patch === 'function' ? patch(state) : patch; if (!p) return; state = { ...state, ...p }; for (const s of subs) s(); }
const subscribe = cb => { subs.add(cb); return () => subs.delete(cb); };
const shallowEq = (a, b) => { if (a === b) return true; if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false; const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => a[k] === b[k]); };
// Selectors may return fresh objects; the snapshot is kept stable while its values are shallow-equal.
function useStore(sel = s => s) {
  const ref = useRef(null);
  const snap = () => { const v = sel(state); if (ref.current !== null && shallowEq(ref.current, v)) return ref.current; ref.current = v; return v; };
  return useSyncExternalStore(subscribe, snap, snap);
}

// ---- theme + content font
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const FONTS = { sans: 'Inter, -apple-system, sans-serif', serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif", mono: "'SF Mono', Menlo, Consolas, monospace", courier: "'Courier Prime', 'Courier New', Courier, monospace" };
function applyTheme() {
  const t = state.settings.theme, v = t === 'dark' || (t !== 'light' && mq.matches) ? 'dark' : 'light';
  const el = document.documentElement;
  if (el.dataset.theme !== v) el.dataset.theme = v;
  el.style.setProperty('--content', FONTS[state.settings.font] || FONTS.sans);
  el.style.setProperty('--size', state.settings.size + 'px');
  el.style.setProperty('--podium', state.settings.podium + 'px');
}
mq.addEventListener('change', applyTheme);
NARROW.addEventListener('change', e => set({ narrow: e.matches, drawer: false }));

// ---- status
let flashTimer = null;
function flash(msg) { set({ status: msg }); clearTimeout(flashTimer); flashTimer = setTimeout(() => set({ status: '' }), 4000); }

// ---- library
const dirty = new Set(); let saveTimer = null, writing = 0, lastInput = 0, unwatch = null, lastCfg = null, sigs = new Map();
const sermonOf = path => state.sermons.find(s => s.path === path) || null;
const open = () => state.openPath ? sermonOf(state.openPath) : null;
const touch = () => { lastInput = Date.now(); };
const isMd = p => /\.md$/i.test(p);
const splitPath = p => { const i = p.lastIndexOf('/'); return i < 0 ? ['', p] : [p.slice(0, i), p.slice(i + 1)]; };
const isTemplatesDir = d => d.toLowerCase() === 'templates';
const isIllDir = d => d.toLowerCase() === 'illustrations';

function parseIllustration(path, text) {
  const t = String(text || '').replace(/\r\n?/g, '\n'); let meta = {}, body = t;
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(t); if (fm) { meta = parseMeta(fm[1]); body = t.slice(fm[0].length); }
  const name = splitPath(path)[1].replace(/\.md$/i, '');
  return { path, meta: { title: String(meta.title || name), tags: Array.isArray(meta.tags) ? meta.tags.map(String) : (typeof meta.tags === 'string' && meta.tags ? meta.tags.split(',').map(s => s.trim()).filter(Boolean) : []), source: String(meta.source || '') }, body: body.trim(), text: t };
}
function illustrationText(ill) {
  const lines = ['---', 'title: ' + ill.meta.title];
  if (ill.meta.tags.length) lines.push('tags: [' + ill.meta.tags.join(', ') + ']');
  if (ill.meta.source) lines.push('source: ' + ill.meta.source);
  lines.push('---', '', (ill.body || '').trim(), '');
  return lines.join('\n');
}
function mkSermon(path, text) {
  const [dir] = splitPath(path), s = parseSermon(text);
  if (!s.meta.title) s.meta.title = splitPath(path)[1].replace(/\.md$/i, '');
  if (isTemplatesDir(dir)) s.meta.template = true;
  return { path, dir, meta: s.meta, blocks: s.blocks, text };
}
async function readSettings() {
  try { const cfg = JSON.parse(await fs.read('sermon.json')); if (cfg && cfg.settings) { lastCfg = JSON.stringify(cfg.settings); set({ settings: { ...DEFAULTS, ...cfg.settings } }); lsSet('sermon.settings', JSON.stringify(state.settings)); applyTheme(); } } catch (e) { lastCfg = null; }
}
async function writeSettings() {
  const json = JSON.stringify(state.settings); if (json === lastCfg) return; lastCfg = json;
  writing++; try { await fs.write('sermon.json', JSON.stringify({ settings: state.settings }, null, 2) + '\n'); } catch (e) { lastCfg = null; } finally { writing--; }
}
async function loadLibrary(name) {
  const list = await fs.list();
  // A Writer library is refused before anything is read, seeded or written, and the folder is forgotten; the gate links to Writer.
  // On the GitHub Pages host the sister app is one hop away, so go straight there; a local copy shows the gate with the link.
  if (isWriterLibrary(list)) { await fs.forget(); if (onPages()) { location.href = WRITER_URL; return; } set({ booting: false, folderOpen: false, resumable: false, gateStatus: 'This is a Writer library', gateLink: WRITER_URL }); return; }
  const sermons = [], illustrations = [], seriesMap = new Map(); sigs = new Map();
  for (const e of list) {
    sigs.set(e.path, e.kind + ':' + e.mtime + ':' + e.size);
    const parts = e.path.split('/');
    if (e.kind === 'dir') { if (parts.length === 1 && !isTemplatesDir(e.path) && !isIllDir(e.path)) seriesMap.set(e.path, { name: e.path, color: '' }); continue; }
    if (parts.length > 2 || !isMd(e.path)) continue;
    const [dir] = splitPath(e.path);
    try {
      const text = await fs.read(e.path);
      if (isIllDir(dir)) illustrations.push(parseIllustration(e.path, text)); else sermons.push(mkSermon(e.path, text));
    } catch (err) { console.error(err); }
  }
  // First open of a library without a Templates/ folder: write the starter templates. After that the folder is the only source.
  if (!list.some(e => e.kind === 'dir' && isTemplatesDir(e.path))) for (const t of seedTemplates()) { try { await fs.write(t.path, t.text); sermons.push({ path: t.path, dir: TEMPLATES_DIR, meta: t.meta, blocks: t.blocks, text: t.text }); } catch (err) { console.error(err); } }
  for (const e of list) if (e.kind === 'file' && /^[^/]+\/(collection|series)\.json$/.test(e.path) && seriesMap.has(e.path.split('/')[0])) { try { const j = JSON.parse(await fs.read(e.path)); seriesMap.get(e.path.split('/')[0]).color = /^#[0-9a-f]{6}$/i.test(j.color || '') ? j.color : ''; } catch (err) {} }
  await readSettings();
  if (!lastCfg) writeSettings();
  const collections = [...seriesMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  set({ libName: name, sermons: sortSermons(sermons), collections, illustrations: illustrations.sort((a, b) => a.meta.title.localeCompare(b.meta.title)), folderOpen: true, booting: false, resumable: false, gateStatus: '', gateLink: '', screen: 'library', openPath: null, settingsOpen: false });
  startWatch();
  loadBible().catch(() => flash('Bible not loaded'));
}
const sortSermons = list => [...list].sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || '') || a.meta.title.localeCompare(b.meta.title));

async function boot() {
  applyTheme();
  if (!fs.supported) return set({ booting: false, gateStatus: 'Desktop Google Chrome required' });
  try {
    const r = await fs.resume();
    if (r === 'prompt') return set({ booting: false, resumable: true });
    if (r && r.error) return set({ booting: false, gateStatus: r.error });
    if (r) return loadLibrary(r.name);
  } catch (e) { console.error(e); }
  set({ booting: false });
}
async function pickFolder() { const r = await fs.pick(); if (!r) return set({ gateStatus: 'Could not open', gateLink: '' }); if (r.error) return set({ gateStatus: r.error, gateLink: '' }); await loadLibrary(r.name); }
async function resumeFolder() { const r = fs.resumeClick ? await fs.resumeClick() : await fs.resume(); if (!r || r === 'prompt' || r.error) return set({ gateStatus: (r && r.error) || 'Could not open', gateLink: '' }); await loadLibrary(r.name); }
async function logout() {
  stopDictation(); clearTimeout(saveTimer); await flushDisk(); stopWatch(); await fs.forget(); dirty.clear(); lastCfg = null;
  set({ folderOpen: false, libName: '', sermons: [], collections: [], illustrations: [], openPath: null, screen: 'library', settingsOpen: false, printMenu: false, sermonModal: null, podium: false, biblePane: false, illPane: false, illReturn: null, resumable: false, gateStatus: '', gateLink: '' });
}

// ---- watcher: disk wins for anything with nothing pending here
function startWatch() { stopWatch(); unwatch = fs.watch(() => reconcile()); }
function stopWatch() { if (unwatch) unwatch(); unwatch = null; }
let reconciling = false, reconcileAgain = false;
async function reconcile() {
  if (!state.folderOpen) return;
  if (reconciling) { reconcileAgain = true; return; }
  reconciling = true;
  try {
    const list = await fs.list(), seen = new Set(), next = new Map();
    let sermons = state.sermons.slice(), illustrations = state.illustrations.slice(), collections = state.collections.slice(), changed = false, retry = false;
    for (const e of list) {
      next.set(e.path, e.kind + ':' + e.mtime + ':' + e.size); seen.add(e.path);
      const parts = e.path.split('/');
      if (e.kind === 'dir') { if (parts.length === 1 && !isTemplatesDir(e.path) && !isIllDir(e.path) && !collections.some(s => s.name === e.path)) { collections.push({ name: e.path, color: '' }); changed = true; } continue; }
      if (sigs.get(e.path) === next.get(e.path)) continue;
      if (e.path === 'sermon.json') { await readSettings(); continue; }
      if (/^[^/]+\/(collection|series)\.json$/.test(e.path)) { try { const j = JSON.parse(await fs.read(e.path)); collections = collections.map(s => s.name === parts[0] ? { ...s, color: /^#[0-9a-f]{6}$/i.test(j.color || '') ? j.color : '' } : s); changed = true; } catch (err) {} continue; }
      if (parts.length > 2 || !isMd(e.path)) continue;
      if (dirty.has(e.path) || (state.openPath === e.path && Date.now() - lastInput < 2000) || (state.illPath === e.path && Date.now() - lastInput < 2000)) { retry = true; next.set(e.path, sigs.get(e.path)); continue; }
      let text; try { text = await fs.read(e.path); } catch (err) { continue; }
      const [dir] = splitPath(e.path);
      if (isIllDir(dir)) { const i = illustrations.findIndex(x => x.path === e.path); if (i >= 0 && illustrations[i].text === text) continue; const ill = parseIllustration(e.path, text); if (i >= 0) illustrations[i] = ill; else illustrations.push(ill); changed = true; }
      else { const i = sermons.findIndex(x => x.path === e.path); if (i >= 0 && sermons[i].text === text) continue; const s = mkSermon(e.path, text); if (i >= 0) sermons[i] = s; else sermons.push(s); changed = true; if (state.openPath === e.path) keepBlockByIndex(sermons[i >= 0 ? i : sermons.length - 1]); }
    }
    for (const p of sigs.keys()) if (!seen.has(p)) {
      if (dirty.has(p)) { next.set(p, sigs.get(p)); retry = true; continue; }
      const parts = p.split('/');
      if (sermons.some(s => s.path === p)) { sermons = sermons.filter(s => s.path !== p); changed = true; if (state.openPath === p) closeSermon(); }
      if (illustrations.some(s => s.path === p)) { illustrations = illustrations.filter(s => s.path !== p); changed = true; if (state.illPath === p) set({ illPath: null }); }
      if (parts.length === 1 && collections.some(s => s.name === p)) { collections = collections.filter(s => s.name !== p); changed = true; }
    }
    sigs = next;
    if (changed) set({ sermons: sortSermons(sermons), illustrations: illustrations.sort((a, b) => a.meta.title.localeCompare(b.meta.title)), collections: collections.sort((a, b) => a.name.localeCompare(b.name)) });
    if (retry) setTimeout(reconcile, 2500);
  } catch (e) { console.error(e); }
  finally { reconciling = false; if (reconcileAgain) { reconcileAgain = false; reconcile(); } }
}
function keepBlockByIndex(s) {
  const cur = open(); if (!cur) return;
  const idx = cur.blocks.findIndex(b => b.id === state.curBlock);
  set({ curBlock: idx >= 0 && s.blocks[idx] ? s.blocks[idx].id : null });
}

// ---- saving
function markDirty(path) { dirty.add(path); clearTimeout(saveTimer); saveTimer = setTimeout(flushDisk, 800); }
async function flushDisk() {
  if (!state.folderOpen || !dirty.size) return;
  const paths = [...dirty]; dirty.clear(); writing++;
  try {
    for (const p of paths) {
      const s = sermonOf(p);
      if (s) { const text = serializeSermon(s); if (text !== s.text) { await fs.write(p, text); s.text = text; } continue; }
      const ill = state.illustrations.find(x => x.path === p);
      if (ill) { const text = illustrationText(ill); if (text !== ill.text) { await fs.write(p, text); ill.text = text; } }
    }
    flash('Saved ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  } catch (e) { console.error(e); for (const p of paths) dirty.add(p); flash('Save failed'); }
  finally { writing--; }
}
function saveNow() { if (state.openPath) dirty.add(state.openPath); if (state.illPath) dirty.add(state.illPath); clearTimeout(saveTimer); flushDisk(); }
async function setSettings(patch) {
  set({ settings: { ...state.settings, ...patch } }); lsSet('sermon.settings', JSON.stringify(state.settings)); applyTheme(); await writeSettings();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(saveTimer); flushDisk(); } });
window.addEventListener('pagehide', () => { clearTimeout(saveTimer); flushDisk(); });
window.addEventListener('beforeunload', e => { if (dirty.size) { clearTimeout(saveTimer); flushDisk(); e.preventDefault(); e.returnValue = ''; } });

// ---- sermons
function uniquePath(dir, title, except) {
  const base = slugify(title); let name = base, n = 2;
  const taken = p => state.sermons.some(s => s.path === p && s.path !== except) || state.illustrations.some(s => s.path === p);
  while (taken((dir ? dir + '/' : '') + name + '.md')) name = base + ' ' + n++;
  return (dir ? dir + '/' : '') + name + '.md';
}
function openSermon(path) { const s = sermonOf(path); if (!s) return; set({ screen: 'sermon', openPath: path, illReturn: null, drawer: false, curBlock: s.blocks[0] ? s.blocks[0].id : null, findOpen: false, find: '', podium: false, kindMenu: null }); window.scrollTo(0, 0); }
// Closing a template lands on the Templates screen, a sermon on the library.
function closeSermon() { stopDictation(); const was = open(); clearTimeout(saveTimer); flushDisk(); set({ screen: was && was.meta.template ? 'templates' : 'library', openPath: null, curBlock: null, podium: false, drawer: false, findOpen: false, kindMenu: null, biblePaneWasOpen: undefined }); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
function updateSermon(path, fn) {
  const i = state.sermons.findIndex(s => s.path === path); if (i < 0) return;
  const s = { ...state.sermons[i], meta: { ...state.sermons[i].meta }, blocks: state.sermons[i].blocks.map(b => ({ ...b, flags: [...(b.flags || [])] })) };
  fn(s);
  const sermons = state.sermons.slice(); sermons[i] = s;
  set({ sermons }); markDirty(path);
}
const updateOpen = fn => { if (state.openPath) { touch(); updateSermon(state.openPath, fn); } };

// templatePath = the Templates/ file to copy blocks from ('' = blank); template = make a template rather than a sermon.
async function createSermon({ title, collection = '', date = '', passage = '', status = 'draft', tags = [], length = 0, templatePath = '', template = false }) {
  const t = String(title || '').trim(); if (!t || (!template && !String(collection || '').trim())) return null; // every sermon lives in a collection
  let blocks = [];
  if (templatePath) { const src = sermonOf(templatePath); if (src) blocks = src.blocks.map(b => ({ ...b, id: newId(), flags: [...(b.flags || [])] })); }
  const dir = template ? RESERVED.templates : slugify(collection || '').replace(/^Untitled$/, '');
  const path = uniquePath(dir === 'Untitled' ? '' : dir, t);
  const meta = normalizeMeta({ title: t, collection: template ? '' : collection, date: template ? '' : date, passage, status: template ? 'draft' : status, tags, length: template ? 0 : length, template });
  const s = { path, dir, meta, blocks, text: '' };
  writing++;
  try { if (dir && !template && !state.collections.some(x => x.name === dir)) { await fs.mkdir(dir); } s.text = serializeSermon(s); await fs.write(path, s.text); }
  catch (e) { console.error(e); flash('Save failed'); writing--; return null; }
  writing--;
  const collections2 = dir && !template && !state.collections.some(x => x.name === dir) ? [...state.collections, { name: dir, color: '' }].sort((a, b) => a.name.localeCompare(b.name)) : state.collections;
  set({ sermons: sortSermons([...state.sermons, s]), collections: collections2 });
  await reconcileSoon();
  return path;
}
const reconcileSoon = () => new Promise(r => setTimeout(() => { reconcile(); r(); }, 50));

// Title / collection / date / passage / status / tags / length from the Sermon modal. Title or collection changes move the file.
async function commitMeta(path, patch) {
  const s = sermonOf(path); if (!s) return;
  const meta = normalizeMeta({ ...s.meta, ...patch });
  if (!meta.template && !meta.collection) meta.collection = s.meta.collection; // never out of a collection
  const dir = s.meta.template ? RESERVED.templates : slugify(meta.collection).replace(/^Untitled$/, '');
  const target = uniquePath(dir === 'Untitled' ? '' : dir, meta.title, path);
  const sameFile = target === path || target.toLowerCase() === path.toLowerCase() && splitPath(target)[0] === splitPath(path)[0] && slugify(meta.title) === slugify(s.meta.title);
  clearTimeout(saveTimer); await flushDisk();
  const next = { ...s, meta, path: sameFile ? path : target, dir };
  next.text = serializeSermon(next);
  writing++;
  try {
    if (dir && !state.collections.some(x => x.name === dir)) await fs.mkdir(dir);
    await fs.write(next.path, next.text);
    if (!sameFile) await fs.remove(path);
  } catch (e) { console.error(e); flash('Save failed'); writing--; return; }
  writing--;
  const collections = dir && !state.collections.some(x => x.name === dir) ? [...state.collections, { name: dir, color: '' }].sort((a, b) => a.name.localeCompare(b.name)) : state.collections;
  set({ sermons: sortSermons(state.sermons.map(x => x.path === path ? next : x)), collections, openPath: state.openPath === path ? next.path : state.openPath });
  await reconcileSoon();
}
async function deleteSermon(path) {
  dirty.delete(path); writing++;
  try { await fs.remove(path); } catch (e) { console.error(e); flash('Save failed'); writing--; return; }
  writing--;
  const wasOpen = state.openPath === path;
  set({ sermons: state.sermons.filter(s => s.path !== path), confirm: null, sermonModal: null });
  if (wasOpen) closeSermon();
  reconcileSoon();
}
async function setCollectionColor(name, color) {
  const collections = state.collections.map(s => s.name === name ? { ...s, color } : s); set({ collections });
  writing++; try { if (color) await fs.write(name + '/collection.json', JSON.stringify({ color }, null, 2) + '\n'); else await fs.remove(name + '/collection.json').catch(() => {}); await fs.remove(name + '/series.json').catch(() => {}); } catch (e) {} finally { writing--; }
}
// A collection is a folder (every sermon lives in one): make it empty, it shows at once with its own + for the first sermon.
async function createCollection(name, color = '') {
  const t = slugify(name); if (!t || t === 'Untitled' || state.collections.some(s => s.name === t) || isTemplatesDir(t) || isIllDir(t)) return false;
  writing++; try { await fs.mkdir(t); if (color) await fs.write(t + '/collection.json', JSON.stringify({ color }, null, 2) + '\n'); } catch (e) { writing--; flash('Save failed'); return false; } writing--;
  set({ collections: [...state.collections, { name: t, color }].sort((a, b) => a.name.localeCompare(b.name)) });
  reconcileSoon(); return true;
}
async function renameCollection(from, to) {
  const t = slugify(to); if (!t || t === from || t === 'Untitled' || state.collections.some(s => s.name === t) || isTemplatesDir(t) || isIllDir(t)) return false;
  clearTimeout(saveTimer); await flushDisk(); writing++;
  try { await fs.rename(from, t); } catch (e) { writing--; flash('Save failed'); return false; }
  writing--;
  const sermons = state.sermons.map(s => s.dir === from ? { ...s, dir: t, path: t + s.path.slice(from.length), meta: { ...s.meta, collection: t } } : s);
  for (const s of sermons) if (s.dir === t && s.meta.collection === t) { s.text = ''; dirty.add(s.path); }
  set({ sermons, collections: state.collections.map(s => s.name === from ? { ...s, name: t } : s).sort((a, b) => a.name.localeCompare(b.name)), openPath: state.openPath && state.openPath.startsWith(from + '/') ? t + state.openPath.slice(from.length) : state.openPath });
  clearTimeout(saveTimer); await flushDisk(); await reconcileSoon(); return true;
}
async function deleteCollection(name) {
  clearTimeout(saveTimer); await flushDisk(); writing++;
  try { await fs.remove(name); } catch (e) { writing--; flash('Save failed'); return; }
  writing--;
  const wasOpen = state.openPath && state.openPath.startsWith(name + '/');
  set({ sermons: state.sermons.filter(s => s.dir !== name), collections: state.collections.filter(s => s.name !== name), confirm: null });
  if (wasOpen) closeSermon();
  reconcileSoon();
}

// ---- blocks
const blank = (kind, heading = '') => ({ id: newId(), kind, heading, body: '', flags: [], label: '' });
function insertBlock(index, kind, extra = {}) {
  const cur = open(); if (cur && !canInsert(cur.blocks, index, kind)) { set({ kindMenu: null }); return null; }
  const b = { ...blank(kind), ...extra, id: newId() };
  updateOpen(s => { s.blocks.splice(Math.max(0, Math.min(index, s.blocks.length)), 0, b); });
  set({ curBlock: b.id, focusReq: { id: b.id, where: KIND[kind] && KIND[kind].heading && kind !== 'quote' ? 'heading' : 'start' }, kindMenu: null });
  return b.id;
}
// Points are containers: delete, move and duplicate carry their group (shared/outline.js).
function removeBlock(id) {
  const s = open(); if (!s) return; const r = groupRange(s.blocks, id); if (!r) return;
  const [i, e] = r, prev = s.blocks[i - 1] || s.blocks[e] || null;
  updateOpen(x => { x.blocks.splice(i, e - i); });
  set({ curBlock: prev ? prev.id : null, focusReq: prev ? { id: prev.id, where: 'end' } : null, confirm: null });
}
function moveBlock(id, delta) {
  updateOpen(s => { s.blocks = moveStep(s.blocks, id, delta); });
}
function moveBlockTo(id, index) {
  updateOpen(s => { s.blocks = moveRange(s.blocks, id, index); });
}
function duplicateBlock(id) {
  let nid = null;
  updateOpen(s => { const r = groupRange(s.blocks, id); if (!r) return; const [i, e] = r; const copies = s.blocks.slice(i, e).map(b => ({ ...b, id: newId(), flags: [...b.flags] })); nid = copies[0].id; s.blocks.splice(e, 0, ...copies); });
  if (nid) set({ curBlock: nid, focusReq: { id: nid, where: 'end' } });
}
function setKind(id, kind) {
  const cur = open(); if (!cur) return; const i = cur.blocks.findIndex(b => b.id === id); if (i < 0) return;
  if (!canSwitch(cur.blocks, i, kind)) { set({ kindMenu: null }); return; }
  updateOpen(s => { const b = s.blocks.find(x => x.id === id); if (!b) return; if (kind !== 'custom' && !KIND[kind].heading) b.heading = ''; if (kind === 'custom') b.label = b.label || ''; b.kind = kind; });
  set({ kindMenu: null, focusReq: { id, where: kind === 'custom' ? 'label' : KIND[kind].heading && kind !== 'quote' ? 'heading' : 'start' } });
}
function toggleFold(id) { set(st => ({ fold: { ...st.fold, [id]: !st.fold[id] } })); }
function toggleFlag(id, flag) {
  updateOpen(s => { const b = s.blocks.find(x => x.id === id); if (!b) return; b.flags = b.flags.includes(flag) ? b.flags.filter(f => f !== flag) : [...b.flags, flag]; });
}
function setBlock(id, patch) { updateOpen(s => { const b = s.blocks.find(x => x.id === id); if (b) Object.assign(b, patch); }); }
// Scripture: resolve the reference and, when the body is empty, fill it with KJV text.
function fillScripture(id) {
  const s = open(); if (!s) return false; const b = s.blocks.find(x => x.id === id); if (!b) return false;
  const r = lookupNow(b.heading); if (!r) return false;
  updateOpen(x => { const y = x.blocks.find(z => z.id === id); y.heading = r.ref; if (!y.body.trim()) y.body = passageText(r.verses); });
  return true;
}
// Reference edited in place: keep the raw text while typing, and whenever it resolves to a different passage than before, replace the body with that KJV text.
function setReference(id, heading) {
  const s = open(); if (!s) return; const b = s.blocks.find(x => x.id === id); if (!b) return;
  const prev = lookupNow(b.heading), next = lookupNow(heading);
  const refill = !!next && (!prev || prev.ref !== next.ref || !b.body.trim());
  updateOpen(x => { const y = x.blocks.find(z => z.id === id); y.heading = heading; if (refill) y.body = passageText(next.verses); });
}
function insertScripture(ref, vs, afterId) {
  const s = open(); if (!s) return;
  const i = afterId ? s.blocks.findIndex(b => b.id === afterId) : s.blocks.length - 1;
  return insertBlock(i + 1, 'scripture', { heading: ref, body: passageText(vs) });
}

// ---- illustrations library
async function createIllustration({ title, tags = [], source = '', body = '' }) {
  const t = String(title || '').trim(); if (!t) return null;
  const path = uniquePath(RESERVED.illustrations, t);
  const ill = { path, meta: { title: t, tags, source }, body, text: '' }; ill.text = illustrationText(ill);
  writing++; try { await fs.write(path, ill.text); } catch (e) { writing--; flash('Save failed'); return null; } writing--;
  set({ illustrations: [...state.illustrations, ill].sort((a, b) => a.meta.title.localeCompare(b.meta.title)) });
  reconcileSoon(); return path;
}
function updateIllustration(path, fn) {
  const i = state.illustrations.findIndex(x => x.path === path); if (i < 0) return;
  const ill = { ...state.illustrations[i], meta: { ...state.illustrations[i].meta, tags: [...state.illustrations[i].meta.tags] } }; fn(ill);
  const illustrations = state.illustrations.slice(); illustrations[i] = ill; touch(); set({ illustrations }); markDirty(path);
}
async function renameIllustration(path, title) {
  const ill = state.illustrations.find(x => x.path === path); const t = String(title || '').trim(); if (!ill || !t || t === ill.meta.title) return;
  clearTimeout(saveTimer); await flushDisk();
  const target = uniquePath(RESERVED.illustrations, t, path); const next = { ...ill, path: target, meta: { ...ill.meta, title: t } }; next.text = illustrationText(next);
  writing++; try { await fs.write(target, next.text); if (target !== path) await fs.remove(path); } catch (e) { writing--; flash('Save failed'); return; } writing--;
  set({ illustrations: state.illustrations.map(x => x.path === path ? next : x).sort((a, b) => a.meta.title.localeCompare(b.meta.title)), illPath: state.illPath === path ? target : state.illPath });
  reconcileSoon();
}
async function deleteIllustration(path) {
  dirty.delete(path); writing++; try { await fs.remove(path); } catch (e) { writing--; flash('Save failed'); return; } writing--;
  set({ illustrations: state.illustrations.filter(x => x.path !== path), illPath: state.illPath === path ? null : state.illPath, confirm: null });
  reconcileSoon();
}

// ---- dictation: words land in the block that has focus (else the current block) through lib/dictation.js
let dict = null, noteTimer = null;
const inserter = createInserter(() => (state.curBlock && document.querySelector('[data-bid="' + state.curBlock + '"] .body')) || document.querySelector('.blocks .body'));
function startDictation() {
  if (state.dictation || state.screen !== 'sermon' || !state.openPath || state.podium) return false;
  if (!dictationBackend()) { set({ alert: 'Dictation requires Google Chrome.' }); return false; }
  if (!inserter.begin()) return false;
  dict = createDictation({
    onState: st => { if (st === 'off') { inserter.end(); dict = null; clearTimeout(noteTimer); set({ dictation: null, dictPartial: '', dictLevel: 0, dictNote: '' }); } else set({ dictation: st }); },
    onPartial: t => set({ dictPartial: t }),
    onFinal: t => { touch(); inserter.insert(t); },
    onLevel: v => { if (Math.abs(v - state.dictLevel) > 0.04) set({ dictLevel: v }); },
    onError: msg => { flash(msg); set({ dictNote: msg }); clearTimeout(noteTimer); noteTimer = setTimeout(() => set({ dictNote: '' }), 3000); }
  });
  set({ dictation: 'starting', dictPartial: '' });
  dict.start(navigator.language);
  return true;
}
function stopDictation() { if (dict) dict.stop(); }
function toggleDictation() { if (state.dictation) stopDictation(); else startDictation(); }

// ---- ui bits
function toggleRail() { const v = !state.railMin; lsSet('sermon.rail', v ? 'min' : 'max'); set({ railMin: v }); }
// On a narrow screen the rail is a drawer over the page: opened from the top-left list button, closed by its scrim or by choosing a row.
function toggleDrawer(v) { set({ drawer: v === undefined ? !state.drawer : !!v }); }
// One side pane at a time: opening Bible closes Illustrations and the other way round.
function toggleBible() { const v = !state.biblePane; lsSet('sermon.bible', v ? 'open' : 'closed'); if (v) lsSet('sermon.ill', 'closed'); set({ biblePane: v, illPane: v ? false : state.illPane }); }
function toggleIll(force) { const v = force === undefined ? !state.illPane : !!force; lsSet('sermon.ill', v ? 'open' : 'closed'); if (v) lsSet('sermon.bible', 'closed'); set({ illPane: v, biblePane: v ? false : state.biblePane }); }
// Put a library illustration into the sermon: fill the current block when it is an empty illustration block
// (templates leave those), otherwise add an illustration block after the current one.
function useIllustration(ill) {
  const s = open(); if (!s) return null;
  const cur = s.blocks.find(b => b.id === state.curBlock), body = illustrationBody(ill), title = ill.meta.title;
  if (cur && cur.kind === 'illustration' && !cur.body.trim()) { touch(); setBlock(cur.id, { heading: cur.heading.trim() || title, body }); set({ focusReq: { id: cur.id, where: 'end' } }); return cur.id; }
  const i = cur ? s.blocks.indexOf(cur) : s.blocks.length - 1;
  const id = insertBlock(i + 1, 'illustration', { heading: title, body }); set({ focusReq: { id, where: 'end' } }); return id;
}
// The Illustrations screen from inside a sermon remembers the way back.
function openIllustrations(path) { clearTimeout(saveTimer); flushDisk(); set({ screen: 'illustrations', illPath: path || state.illPath, illReturn: state.openPath, drawer: false, kindMenu: null, findOpen: false, podium: false }); window.scrollTo(0, 0); }
function leaveIllustrations() { const back = state.illReturn; set({ illReturn: null, illPath: null, drawer: false }); if (back && sermonOf(back)) openSermon(back); else set({ screen: 'library', openPath: null }); }
function setLibView(v) { lsSet('sermon.libview', v); set({ libView: v }); }
function setLibLayout(v) { lsSet('sermon.liblayout', v); set({ libLayout: v }); }
function closeLibFind() { set({ libFindOpen: false, libQuery: '' }); }
// A new sermon needs a collection to land in: with none yet, the Collection modal comes first.
function newSermon(extra = {}) { if (!state.collections.length) return set({ collectionModal: { create: true } }); set({ sermonModal: { create: true, ...extra } }); }
function openTemplates() { set({ screen: 'templates', openPath: null, settingsOpen: false }); window.scrollTo(0, 0); }
function newTemplate() { set({ nameDialog: { placeholder: 'Template name', onSave: async t => { const p = await createSermon({ title: t, template: true }); if (p) openSermon(p); } } }); }
function closeMenus() { set({ printMenu: false, settingsOpen: false, colorsOpen: false, confirm: null, sermonModal: null, collectionModal: null, nameDialog: null, newDialog: false, kindMenu: null, alert: null }); }
const stop = e => e.stopPropagation();
// Headless QA hook: window.__sb.setLibrary(handle) then window.__sb.loadLibrary(name).
if (typeof window !== 'undefined') window.__sb = Object.assign(window.__sb || {}, { loadLibrary, get, set, reconcile, flushDisk, startDictation, stopDictation });
SB.store = { DEFAULTS, get, set, useStore, applyTheme, flash, sermonOf, open, touch, illustrationText, loadLibrary, sortSermons, boot, pickFolder, resumeFolder, logout, reconcile, markDirty, flushDisk, saveNow, setSettings, openSermon, closeSermon, updateSermon, updateOpen, createSermon, commitMeta, deleteSermon, setCollectionColor, createCollection, renameCollection, deleteCollection, insertBlock, removeBlock, moveBlock, moveBlockTo, duplicateBlock, setKind, toggleFold, toggleFlag, setBlock, fillScripture, setReference, insertScripture, createIllustration, updateIllustration, renameIllustration, deleteIllustration, startDictation, stopDictation, toggleDictation, toggleRail, toggleDrawer, toggleBible, toggleIll, useIllustration, openIllustrations, leaveIllustrations, setLibView, setLibLayout, closeLibFind, newSermon, openTemplates, newTemplate, closeMenus, stop };
})(globalThis.SB ||= {});
