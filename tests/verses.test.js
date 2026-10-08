import test from 'node:test';
import assert from 'node:assert/strict';
import { verses, pdf } from '../app/src/lib/node.js';
const { verseEntries } = verses, { Pdf, FONT_WIDTHS } = pdf;

const sermon = { meta: { title: 'Grace Walk' }, blocks: [
  { kind: 'intro', heading: '', body: 'Remember John 3:16 and Romans 8:28.' },
  { kind: 'scripture', heading: 'Psalm 23:1-2', body: '1 The LORD is my shepherd; I shall not want.\n2 He maketh me to lie down in green pastures.' },
  { kind: 'scripture', heading: 'John 3:16', body: '' },
  { kind: 'point', heading: 'Trust', body: 'See Psalm 23:1-2 again.' },
] };
const lookup = ref => ref === 'John 3:16' ? { ref: 'John 3:16', verses: [{ verse: 16, text: 'For God so loved the world…' }] } : null;

test('entries keep order, parse verse lines, fill empty bodies from the lookup, and list passing references once', () => {
  const { entries, mentioned } = verseEntries(sermon, { lookup });
  assert.deepEqual(entries.map(e => e.ref), ['Psalm 23:1-2', 'John 3:16']);
  assert.deepEqual(entries[0].verses, [{ n: '1', text: 'The LORD is my shepherd; I shall not want.' }, { n: '2', text: 'He maketh me to lie down in green pastures.' }]);
  assert.deepEqual(entries[1].verses, [{ n: '16', text: 'For God so loved the world…' }]);
  assert.deepEqual(mentioned, ['Romans 8:28']);
});

test('pdf writer: metrics tables are complete, wrapping breaks pages, output is a well-formed PDF', () => {
  assert.equal(FONT_WIDTHS.regular.length, 95); assert.equal(FONT_WIDTHS.bold.length, 95);
  const doc = new Pdf({ footer: 'Test' });
  for (let i = 0; i < 80; i++) doc.text('Line ' + i + ' ' + 'word '.repeat(30), { size: 11 });
  const bytes = doc.bytes(), s = String.fromCharCode(...bytes);
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(doc.pages.length > 1, 'wrapped onto more than one page');
  assert.equal((s.match(/\/Type \/Page\b/g) || []).length, doc.pages.length);
  assert.ok(s.includes('/Count ' + doc.pages.length));
  const start = +/startxref\n(\d+)/.exec(s)[1]; assert.equal(s.slice(start, start + 4), 'xref');
  assert.equal(doc.wrap('a (b) \\ c', false, 11, 500, 500).length, 1);
});
