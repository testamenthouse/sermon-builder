// Loads the bundled KJV once (data/kjv/kjv.json, next to index.html).
import * as B from '../../../shared/bible.js';
export * from '../../../shared/bible.js';
let data = null, pending = null;
export function loadBible() {
  if (data) return Promise.resolve(data);
  if (!pending) pending = fetch(new URL('./data/kjv/kjv.json', document.baseURI)).then(r => r.json()).then(j => (data = j)).catch(e => { pending = null; throw e; });
  return pending;
}
export const bible = () => data;
export function lookupNow(ref) { return data ? B.lookup(data, ref) : null; }
