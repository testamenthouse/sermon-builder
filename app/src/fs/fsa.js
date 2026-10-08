// Browser adapter: File System Access API. The folder handle is remembered in IndexedDB; nothing else is stored.
// Paths are relative, forward-slashed.
(function (SB) {
'use strict';
const DB = 'sermon', STORE = 'kv', KEY = 'lib';
let root = null;

function idb() {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function kv(op, val) {
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE); const r = op === 'get' ? st.get(KEY) : op === 'put' ? st.put(val, KEY) : st.delete(KEY); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function dir(path, create) {
  let h = root; if (!path) return h;
  for (const part of path.split('/').filter(Boolean)) h = await h.getDirectoryHandle(part, { create: !!create });
  return h;
}
function split(path) { const i = path.lastIndexOf('/'); return i < 0 ? ['', path] : [path.slice(0, i), path.slice(i + 1)]; }
async function ensureWrite() {
  if (!root) return false;
  try { if (await root.queryPermission({ mode: 'readwrite' }) === 'granted') return true; return await root.requestPermission({ mode: 'readwrite' }) === 'granted'; } catch (e) { return false; }
}
async function walk(h, prefix, out) {
  for await (const [name, entry] of h.entries()) {
    if (name.startsWith('.')) continue;
    const path = prefix ? prefix + '/' + name : name;
    if (entry.kind === 'directory') { out.push({ path, kind: 'dir', mtime: 0, size: 0 }); await walk(entry, path, out); }
    else { const f = await entry.getFile(); out.push({ path, kind: 'file', mtime: f.lastModified, size: f.size }); }
  }
}
async function copyDir(from, to) {
  for await (const [name, entry] of from.entries()) {
    if (entry.kind === 'directory') await copyDir(entry, await to.getDirectoryHandle(name, { create: true }));
    else { const f = await entry.getFile(), fh = await to.getFileHandle(name, { create: true }), w = await fh.createWritable(); await w.write(await f.arrayBuffer()); await w.close(); }
  }
}

const fsa = {
  kind: 'fsa',
  supported: typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function',
  async pick() { try { root = await window.showDirectoryPicker({ mode: 'readwrite' }); } catch (e) { return null; } await kv('put', root); return { name: root.name }; },
  async resume() {
    let h; try { h = await kv('get'); } catch (e) { h = null; }
    if (!h) return null;
    try { const p = await h.queryPermission({ mode: 'readwrite' }); if (p === 'granted') { root = h; try { await h.entries().next(); } catch (e) { await kv('del'); root = null; return { error: 'Folder not found' }; } return { name: h.name }; } if (p === 'prompt') return 'prompt'; } catch (e) {}
    return null;
  },
  async resumeClick() { const h = await kv('get'); if (!h) return null; try { if (await h.requestPermission({ mode: 'readwrite' }) === 'granted') { root = h; return { name: h.name }; } } catch (e) {} return null; },
  async forget() { root = null; try { await kv('del'); } catch (e) {} },
  async list() { const out = []; await walk(root, '', out); return out; },
  async read(path) { const [d, n] = split(path); const fh = await (await dir(d)).getFileHandle(n); return (await fh.getFile()).text(); },
  async write(path, text) { if (!await ensureWrite()) throw new Error('permission'); const [d, n] = split(path); const fh = await (await dir(d, true)).getFileHandle(n, { create: true }), w = await fh.createWritable(); await w.write(text); await w.close(); },
  async remove(path) { if (!await ensureWrite()) throw new Error('permission'); const [d, n] = split(path); await (await dir(d)).removeEntry(n, { recursive: true }); },
  async rename(from, to) {
    if (!await ensureWrite()) throw new Error('permission');
    const [fd, fn] = split(from), [td, tn] = split(to), src = await dir(fd);
    let entry; try { entry = await src.getFileHandle(fn); } catch (e) { entry = await src.getDirectoryHandle(fn); }
    if (entry.kind === 'file') { const f = await entry.getFile(); const fh = await (await dir(td, true)).getFileHandle(tn, { create: true }), w = await fh.createWritable(); await w.write(await f.arrayBuffer()); await w.close(); }
    else await copyDir(entry, await (await dir(td, true)).getDirectoryHandle(tn, { create: true }));
    await src.removeEntry(fn, { recursive: true });
  },
  async mkdir(path) { if (!await ensureWrite()) throw new Error('permission'); await dir(path, true); },
  // Polls while the tab is visible: a signature per path from name + mtime + size, no reads.
  watch(cb) {
    let prev = null, timer = null, stopped = false;
    const tick = async () => {
      if (stopped || !root || document.visibilityState !== 'visible') return arm(3000);
      try {
        const list = await fsa.list(), sig = new Map(list.map(e => [e.path, e.kind + ':' + e.mtime + ':' + e.size]));
        if (prev) { const changed = []; for (const [p, s] of sig) if (prev.get(p) !== s) changed.push(p); for (const p of prev.keys()) if (!sig.has(p)) changed.push(p); if (changed.length) cb(changed); }
        prev = sig;
      } catch (e) {}
      arm(3000);
    };
    const arm = ms => { clearTimeout(timer); if (!stopped) timer = setTimeout(tick, ms); };
    const vis = () => { if (document.visibilityState === 'visible') arm(300); };
    document.addEventListener('visibilitychange', vis);
    arm(300);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', vis); };
  },
  // Headless QA: hand the adapter a directory handle (e.g. OPFS root) without the picker.
  __setLibrary(h) { root = h; }
};
SB.fsa = { fsa };
})(globalThis.SB ||= {});
