// Builds data/<id>/<id>.js — a classic script setting SB.bibles.<id> to { version, books: [{ name, chapters: [[verse, …], …] }] } —
// from a public-domain source. Two source layouts are read:
//   thiagobodruk/bible   [{ abbrev, name, chapters: [[text, …], …] }, …]              (the KJV came from en_kjv.json)
//   getbible.net v2      { books: [{ nr, name, chapters: [{ chapter, verses: [{ verse, text }] }] }] }   (api.getbible.net/v2/asv.json, valera.json)
// A verse the translation leaves out (the ASV moves sixteen New Testament verses to footnotes) stays a null in its chapter array,
// so verse numbers keep their place. Usage: node scripts/build-bible.js <kjv|asv|rv1909> <source.json>
import fs from 'node:fs';
import path from 'node:path';
import { books as B, bible as BB } from '../shared/node.js';

const [id, src] = process.argv.slice(2);
const def = BB.TRANSLATIONS.find(t => t.id === id);
if (!def || !src) { console.error('usage: node scripts/build-bible.js <' + BB.TRANSLATIONS.map(t => t.id).join('|') + '> <source.json>'); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(src, 'utf8').replace(/^﻿/, ''));
const list = Array.isArray(raw) ? raw : raw.books;
if (!list || list.length !== 66) throw new Error('expected 66 books, got ' + (list ? list.length : 0));

// Text as the reader shows it: one space between words, no space before punctuation, no editorial brackets, and the
// ASV's Hebrew acrostic labels (`ב BETH.`) that its source glued onto the end of Psalm 119's verses are dropped.
// The 1909 Reina-Valera sets the first word of a chapter in capitals (`EN el principio`); the reader keeps the sentence case.
function clean(text, lang) {
  let t = String(text).replace(/[\[\]]/g, '').replace(/\s*[֐-׿]+\s+[A-Z]+\.\s*$/, '').replace(/\s+/g, ' ').replace(/\s+([.,;:?!])/g, '$1').trim();
  if (lang === 'es') t = t.replace(/^((?:[A-ZÁÉÍÓÚÑÜ]{2,}[.,;:]?\s)+)/, m => m.toLowerCase().replace(/(^|\.\s)(\p{L})/gu, (x, pre, c) => pre + c.toUpperCase()).replace(/\bjehová/g, 'Jehová').replace(/\bdios\b/g, 'Dios'));
  return t;
}
let count = 0, gaps = 0;
const books = list.map((b, i) => {
  const want = B.BOOKS[i];
  if (b.chapters.length !== want.chapters) throw new Error(`${want.name}: expected ${want.chapters} chapters, got ${b.chapters.length}`);
  const chapters = b.chapters.map(ch => {
    const verses = Array.isArray(ch) ? ch.map((text, k) => ({ verse: k + 1, text })) : ch.verses;
    const max = Math.max(...verses.map(v => +v.verse)), out = new Array(max).fill(null);
    for (const v of verses) { out[+v.verse - 1] = clean(v.text, def.lang); count++; }
    gaps += out.filter(x => x === null).length;
    return out;
  });
  return { name: want.name, chapters };
});
if (count < 31000 || count > 31102) throw new Error('expected about 31,100 verses, got ' + count);
const out = path.resolve('data', id, id + '.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, '// ' + def.name + ', public domain. Built by scripts/build-bible.js; a classic script so the page opens from a double-clicked index.html.\n((globalThis.SB ||= {}).bibles ||= {}).' + id + ' = ' + JSON.stringify({ version: def.abbr, books }) + ';\n');
console.log('wrote', out, count, 'verses', gaps ? gaps + ' left out by the translation' : '');
