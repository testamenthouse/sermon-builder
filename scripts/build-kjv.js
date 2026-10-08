// Builds data/kjv/kjv.json from a public-domain KJV source (thiagobodruk/bible en_kjv.json layout:
// [{abbrev, name, chapters: [[verse, ...], ...]}, ...] — 66 books in canonical order, 31,102 verses).
// Usage: node scripts/build-kjv.js <source.json>
import fs from 'node:fs';
import path from 'node:path';
import { BOOKS } from '../shared/books.js';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-kjv.js <en_kjv.json>'); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(src, 'utf8').replace(/^﻿/, ''));
if (raw.length !== 66) throw new Error('expected 66 books, got ' + raw.length);
let count = 0;
const books = raw.map((b, i) => {
  const def = BOOKS[i];
  if (b.chapters.length !== def.chapters) throw new Error(`${def.name}: expected ${def.chapters} chapters, got ${b.chapters.length}`);
  const chapters = b.chapters.map(ch => ch.map(v => { count++; return String(v).replace(/\s+/g, ' ').replace(/\s+([.,;:?!])/g, '$1').trim(); }));
  return { name: def.name, chapters };
});
if (count !== 31102) throw new Error('expected 31102 verses, got ' + count);
const out = path.resolve('data/kjv/kjv.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ version: 'KJV', books }));
console.log('wrote', out, count, 'verses');
