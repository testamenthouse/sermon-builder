// The translations. The KJV ships in the page (data/kjv/kjv.js, loaded before this file); the others are classic scripts
// too, added to the page the first time they are chosen (a <script> tag works from a double-clicked file where fetch
// does not). `bible()` is the chosen translation's data and `translation()` its entry in TRANSLATIONS; both fall back to
// the KJV until the chosen one has loaded, so lookups never fail for want of a file.
(function (SB) {
'use strict';
const B = SB.shared.bible;
const bibles = SB.bibles || (SB.bibles = {});
let current = 'kjv';
const loading = new Map();
function loadBible(id = current) {
  const def = B.translationOf(id);
  if (bibles[def.id]) return Promise.resolve(bibles[def.id]);
  if (!loading.has(def.id)) loading.set(def.id, new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = new URL('./' + def.file, document.baseURI).href;
    s.onload = () => { loading.delete(def.id); bibles[def.id] ? resolve(bibles[def.id]) : reject(new Error(def.abbr + ' not loaded')); };
    s.onerror = () => { loading.delete(def.id); s.remove(); reject(new Error(def.abbr + ' not loaded')); };
    document.head.appendChild(s);
  }));
  return loading.get(def.id);
}
// Choose a translation: resolves once its text is in the page (rejects, leaving the previous choice, when the file cannot load).
function setTranslation(id) { const def = B.translationOf(id); return loadBible(def.id).then(d => { current = def.id; return d; }); }
const bible = () => bibles[current] || bibles.kjv || null;
const translation = () => B.translationOf(current);
function lookupNow(ref) { const d = bible(); return d ? B.lookup(d, ref) : null; }
(SB.lib ||= {}).bible = { ...SB.shared.bible, loadBible, setTranslation, bible, translation, lookupNow };
})(globalThis.SB ||= {});
