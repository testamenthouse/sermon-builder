// Every string the interface passes to t() has a Spanish entry, and every Spanish entry is still used — so a new label
// cannot ship in English only, and a renamed one cannot leave its translation behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { i18n } from '../app/src/lib/node.js';
import { blocks, format, planning, books, bible } from '../shared/node.js';

const root = new URL('../app/src/', import.meta.url);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') && !d.endsWith('i18n') ? [path.join(d, e.name)] : []);
// Keys written literally, plus the words that reach t() through data: kind labels and heading placeholders, statuses,
// library views and calendar scopes, print scopes, themes, weekdays.
function usedKeys() {
  const keys = new Set();
  for (const f of walk(root.pathname)) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
  for (const k of blocks.KINDS) { keys.add(k.label); if (k.heading) keys.add(k.heading); }
  const cap = s => s[0].toUpperCase() + s.slice(1);
  for (const s of [...format.STATUSES, 'collections', 'dates', 'schedule', 'calendar', 'status', 'scripture', 'month', 'quarter', 'year', 'manuscript', 'outline', 'handout', 'notes', 'roadmap', 'system', 'light', 'dark']) keys.add(cap(s));
  for (const d of planning.DAYS) keys.add(d);
  for (const k of ['Expand', 'Collapse', 'Show in podium', 'Hide in podium', 'Pause', 'Play', 'Starting', 'Listening', 'Template name', 'Sermon title', 'Duplicate template', 'Duplicate sermon', 'Delete template', 'Delete sermon', 'Find', 'Reference or words']) keys.add(k);
  return keys;
}
test('every interface string has a Spanish entry', () => {
  const es = globalThis.SB.i18n.es, missing = [...usedKeys()].filter(k => es[k] == null);
  assert.deepEqual(missing, []);
});
test('every Spanish entry is still used', () => {
  const used = usedKeys(), stale = Object.keys(globalThis.SB.i18n.es).filter(k => !used.has(k));
  assert.deepEqual(stale, []);
});
test('t() falls back to English and fills placeholders', () => {
  i18n.setLang('en'); assert.equal(i18n.t('Settings'), 'Settings'); assert.equal(i18n.t('{n} words', { n: 3 }), '3 words');
  i18n.setLang('es'); assert.equal(i18n.t('Settings'), 'Ajustes'); assert.equal(i18n.t('Delete “{title}”?', { title: 'X' }), '¿Eliminar “X”?'); assert.equal(i18n.t('No such key'), 'No such key');
  assert.equal(books.BOOKS[42].name, 'Juan'); assert.equal(bible.formatRef(bible.parseRef('Juan 3:16')), 'Juan 3:16'); assert.equal(bible.formatRef(bible.parseRef('Sal 23')), 'Salmo 23');
  i18n.setLang('en'); assert.equal(books.BOOKS[42].name, 'John');
});
