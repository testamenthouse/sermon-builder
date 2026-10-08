// Verse list for the media team: every scripture block's reference in order, then references mentioned in passing.
// Verse text is only parsed so an empty scripture block can still be named from the KJV lookup. Pure: the KJV lookup and the meta line come from the caller.
import { mdLine } from './md.js';
import { findRefs, formatRef, parseRef } from '../../../shared/bible.js';

// "Psalm 23:1-2" and "Psalm 23:1–2" are the same reference.
const key = r => { const p = parseRef(r); return (p ? formatRef(p) : String(r)).toLowerCase(); };
import { Pdf } from './pdf.js';

export function verseEntries(sermon, { lookup } = {}) {
  const entries = [], seen = new Set();
  for (const b of sermon.blocks) {
    if (b.kind !== 'scripture') continue;
    const ref = String(b.heading || '').trim(); const verses = [];
    for (const line of String(b.body || '').split('\n')) { if (!line.trim()) continue; const L = mdLine(line, true); verses.push(L.t === 'v' ? { n: L.mark.trim(), text: L.c } : { n: '', text: L.c }); }
    let label = ref;
    if (!verses.length && ref && lookup) { const r = lookup(ref); if (r) { label = r.ref; for (const v of r.verses) verses.push({ n: String(v.verse), text: v.text }); } }
    if (!label && !verses.length) continue;
    entries.push({ ref: label || 'Scripture', verses }); if (label) seen.add(key(label));
  }
  const mentioned = [];
  for (const b of sermon.blocks) {
    if (b.kind === 'scripture') continue;
    for (const f of findRefs(String(b.body || '') + '\n' + String(b.heading || ''))) { const r = formatRef(f.parsed); const k = key(r); if (!seen.has(k)) { seen.add(k); mentioned.push(r); } }
  }
  return { entries, mentioned };
}

export function versesPdf(sermon, { lookup, metaLine = '' } = {}) {
  const { entries, mentioned } = verseEntries(sermon, { lookup });
  const title = sermon.meta.title || 'Untitled';
  const doc = new Pdf({ footer: title + ' · Verses' });
  doc.text(title, { bold: true, size: 20, after: 2 });
  if (metaLine) doc.text(metaLine, { size: 10, color: '0.45 0.45 0.45', after: 2 });
  doc.text('Verses · KJV', { size: 10, color: '0.45 0.45 0.45', after: 10 });
  doc.rule(); doc.space(6);
  entries.forEach((e, i) => doc.text(String(i + 1).padStart(2, ' ') + '.  ' + e.ref, { bold: true, size: 15, lead: 1.5, after: 6 }));
  if (!entries.length) doc.text('No scripture blocks.', { size: 11, color: '0.45 0.45 0.45' });
  if (mentioned.length) { doc.space(10); doc.rule(); doc.space(4); doc.text('Also referenced', { size: 10, color: '0.45 0.45 0.45', after: 4 }); mentioned.forEach(r => doc.text(r, { size: 12, color: '0.3 0.3 0.3', after: 3 })); }
  return new Blob([doc.bytes()], { type: 'application/pdf' });
}
