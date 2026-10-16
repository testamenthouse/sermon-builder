import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bible as B, kjv } from '../shared/node.js';
const { parseRef, formatRef, lookup, search, findRefs, bookIndex, passageText } = B;
const bible = kjv;

test('book aliases', () => {
  assert.equal(bookIndex('Gen'), 0); assert.equal(bookIndex('1 Sam.'), 8); assert.equal(bookIndex('I Kings'), 10); assert.equal(bookIndex('Ps'), 18);
  assert.equal(bookIndex('Psalm'), 18); assert.equal(bookIndex('Song of Solomon'), 21); assert.equal(bookIndex('Jn'), 42); assert.equal(bookIndex('Phil'), 49);
  assert.equal(bookIndex('Philem'), 56); assert.equal(bookIndex('Rev'), 65); assert.equal(bookIndex('1st John'), 61); assert.equal(bookIndex('Judges'), 6);
  assert.equal(bookIndex('Ju'), -1); assert.equal(bookIndex('Zzz'), -1);
});
test('parse + format', () => {
  assert.equal(formatRef(parseRef('john 3:16')), 'John 3:16');
  assert.equal(formatRef(parseRef('Jn 3:16-18')), 'John 3:16–18');
  assert.equal(formatRef(parseRef('Ps 23')), 'Psalm 23');
  assert.equal(formatRef(parseRef('Gen 1:1-2:3')), 'Genesis 1:1–2:3');
  assert.equal(formatRef(parseRef('Rom 8:28, 31')), 'Romans 8:28, 31');
  assert.equal(formatRef(parseRef('Jude 3')), 'Jude 1:3');
  assert.equal(formatRef(parseRef('1 Cor 13:4-8a')), '1 Corinthians 13:4–8');
  assert.equal(formatRef(parseRef('Matt 5; 6:1')), 'Matthew 5; 6:1');
  assert.equal(formatRef(parseRef('Psalm 1:5, 6, 5')), 'Psalm 1:5, 6');
  assert.equal(formatRef(parseRef('Psalm 1; 1:5')), 'Psalm 1');
  assert.equal(formatRef(parseRef('Rom 8:28-31, 29')), 'Romans 8:28–31');
  assert.equal(parseRef('John 99'), null); assert.equal(parseRef('Nothing 1'), null); assert.equal(parseRef(''), null);
});
test('lookup', () => {
  const r = lookup(bible, 'John 3:16');
  assert.equal(r.ref, 'John 3:16'); assert.equal(r.verses.length, 1); assert.match(r.verses[0].text, /^For God so loved/);
  assert.equal(lookup(bible, 'Psalm 23').verses.length, 6);
  assert.equal(lookup(bible, 'Jude').verses.length, 25);
  assert.equal(lookup(bible, 'Gen 1:1-2:3').verses.length, 34);
  assert.equal(lookup(bible, 'John 3:16-99').verses.length, 21);
  assert.deepEqual(lookup(bible, 'Psalm 1:5, 6, 5').verses.map(v => v.verse), [5, 6]);
  assert.deepEqual(lookup(bible, 'Psalm 2:5-7; 2:6-9').verses.map(v => v.verse), [5, 6, 7, 8, 9]);
  assert.equal(passageText(lookup(bible, 'Ps 23:1-2').verses).split('\n')[0], '1 The LORD is my shepherd; I shall not want.');
});
test('search', () => {
  const r = search(bible, 'shepherd want');
  assert.ok(r.some(x => x.ref === 'Psalm 23:1'));
  assert.equal(search(bible, '"only begotten son"').length >= 4, true);
  assert.equal(search(bible, 'love', { books: 61, limit: 5 }).length, 5);
});
test('inline refs', () => {
  const r = findRefs('See John 3:16-18 and Ps. 23, then 1 Cor 13:4 and nothing in Bob 4.');
  assert.deepEqual(r.map(x => x.text), ['John 3:16-18', 'Ps. 23', '1 Cor 13:4']);
});
test('a set of verses reads as runs', () => {
  const v = (c, n) => ({ book: 43, chapter: c, verse: n, text: '' });
  assert.equal(B.versesRef([v(1, 3), v(1, 5), v(1, 7), v(1, 1)]), 'Acts 1:1, 3, 5, 7');
  assert.equal(B.versesRef([v(1, 3), v(1, 4), v(1, 5), v(1, 8)]), 'Acts 1:3–5, 8');
  assert.equal(B.versesRef([v(1, 26), v(2, 1)]), 'Acts 1:26; 2:1');
  assert.deepEqual(B.verses(kjv, B.parseRef('Acts 1:1, 3, 5, 7')).map(x => x.verse), [1, 3, 5, 7]);
});
test('Spanish book names and abbreviations resolve in either language', () => {
  assert.equal(bookIndex('Génesis'), 0); assert.equal(bookIndex('Juan'), 42); assert.equal(bookIndex('1 Juan'), 61); assert.equal(bookIndex('Hch'), 43); assert.equal(bookIndex('Stg'), 58);
  assert.equal(bookIndex('Apocalipsis'), 65); assert.equal(bookIndex('Cantares'), 21); assert.equal(bookIndex('Sal'), 18); assert.equal(bookIndex('Primera de Juan'), 61);
  assert.equal(formatRef(parseRef('Juan 3:16-18')), 'John 3:16–18');
  assert.equal(formatRef(parseRef('Éxodo 20:1')), 'Exodus 20:1');
  assert.equal(formatRef(parseRef('1 Reyes 18')), '1 Kings 18');
  assert.deepEqual(findRefs('Lee Juan 3:16 y Salmos 23 hoy.').map(x => x.text), ['Juan 3:16', 'Salmos 23']);
});
test('a chapter with a verse the translation leaves out keeps its numbering', () => {
  const asv = { version: 'ASV', books: kjv.books.map(b => ({ name: b.name, chapters: b.chapters })) };
  asv.books[39] = { name: 'Matthew', chapters: kjv.books[39].chapters.map((ch, i) => i === 16 ? ch.map((v, k) => k === 20 ? null : v) : ch) };
  assert.deepEqual(lookup(asv, 'Matt 17:20-22').verses.map(v => v.verse), [20, 22]);
  assert.equal(search(asv, 'prayer and fasting').some(h => h.ref === 'Matthew 17:21'), false);
  assert.ok(B.TRANSLATIONS.map(t => t.id).includes('rv1909'));
});
