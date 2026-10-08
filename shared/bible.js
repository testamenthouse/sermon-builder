// KJV lookup, reference parsing and search. Pure functions over a loaded { version, books:[{name, chapters:[[...]]}] } object.
(function (SB) {
'use strict';
const { BOOKS, bookIndex } = SB.shared.books;

const DASH = /[–—-]/;

// Parse "John 3:16-18; 4:1" into { refs: [{ book, c1, v1, c2, v2 }] } — v1 = 0 means whole chapter.
// Returns null when the book is unknown. Single-chapter books treat "Jude 3" as verse 3.
function parseRef(input) {
  const s = String(input || '').trim(); if (!s) return null;
  const m = /^((?:[1-3]|i{1,3}|1st|2nd|3rd|first|second|third)?\s*[a-z]+(?:\s+(?:of\s+)?[a-z]+)*)\.?\s*(.*)$/i.exec(s);
  if (!m) return null;
  const book = bookIndex(m[1]); if (book < 0) return null;
  const def = BOOKS[book], refs = [];
  const rest = m[2].trim();
  if (!rest) { refs.push({ book, c1: 1, v1: 0, c2: def.chapters, v2: 0 }); return { refs }; }
  let chapter = null;
  for (const seg of rest.split(';')) {
    for (const part of seg.split(',')) {
      const p = part.trim(); if (!p) continue;
      const r = p.split(DASH).map(x => x.trim());
      const a = /^(\d+)(?::(\d+))?[a-z]?$/.exec(r[0]); if (!a) return null;
      let c1, v1;
      if (a[2] != null) { c1 = +a[1]; v1 = +a[2]; }
      else if (chapter != null && seg === part) { c1 = +a[1]; v1 = 0; }
      else if (chapter != null) { c1 = chapter; v1 = +a[1]; }
      else if (def.chapters === 1) { c1 = 1; v1 = +a[1]; }
      else { c1 = +a[1]; v1 = 0; }
      let c2 = c1, v2 = v1;
      if (r.length > 1) {
        const b = /^(\d+)(?::(\d+))?[a-z]?$/.exec(r[1]); if (!b) return null;
        if (b[2] != null) { c2 = +b[1]; v2 = +b[2]; }
        else if (v1 === 0) { c2 = +b[1]; v2 = 0; }
        else { c2 = c1; v2 = +b[1]; }
      }
      if (c1 < 1 || c1 > def.chapters || c2 < c1 || c2 > def.chapters) return null;
      chapter = c2;
      const ref = { book, c1, v1, c2, v2 };
      if (!refs.some(q => covers(q, ref))) refs.push(ref);
    }
  }
  return refs.length ? { refs } : null;
}

// True when range a already includes every verse of range b ("Psalm 1:5, 6, 5" names verse 5 once; "Psalm 1; 1:5" is just Psalm 1).
function covers(a, b) {
  if (a.book !== b.book) return false;
  const lo = r => [r.c1, r.v1 || 1], hi = r => [r.c2, r.v2 || Infinity];
  const le = (x, y) => x[0] < y[0] || (x[0] === y[0] && x[1] <= y[1]);
  return le(lo(a), lo(b)) && le(hi(b), hi(a));
}

// Canonical display: "John 3:16–18", "Psalm 23", "Genesis 1:1–2:3".
function formatRef(parsed) {
  if (!parsed || !parsed.refs.length) return '';
  const name = i => BOOKS[i].name === 'Psalms' ? 'Psalm' : BOOKS[i].name;
  const out = []; let lastBook = -1, lastChapter = -1;
  for (const r of parsed.refs) {
    let s = '';
    if (r.book !== lastBook) s += name(r.book) + ' ';
    if (r.v1 === 0) s += r.c1 + (r.c2 !== r.c1 ? '–' + r.c2 : '');
    else if (r.c2 !== r.c1) s += r.c1 + ':' + r.v1 + '–' + r.c2 + ':' + r.v2;
    else if (r.book === lastBook && r.c1 === lastChapter) s += r.v1 + (r.v2 !== r.v1 ? '–' + r.v2 : '');
    else s += r.c1 + ':' + r.v1 + (r.v2 !== r.v1 ? '–' + r.v2 : '');
    out.push({ s, sep: r.book === lastBook && r.c1 === lastChapter && r.v1 ? ', ' : '; ' });
    lastBook = r.book; lastChapter = r.c2;
  }
  return out.map((o, i) => (i ? o.sep : '') + o.s).join('');
}

// Resolve a parsed reference to verses: [{ book, chapter, verse, text }]. Out-of-range verses are clamped; a verse named twice comes out once.
function verses(bible, parsed) {
  const out = [], seen = new Set(); if (!bible || !parsed) return out;
  for (const r of parsed.refs) {
    const chapters = bible.books[r.book].chapters;
    for (let c = r.c1; c <= r.c2; c++) {
      const ch = chapters[c - 1]; if (!ch) continue;
      const from = c === r.c1 && r.v1 ? r.v1 : 1;
      const to = c === r.c2 && r.v2 ? Math.min(r.v2, ch.length) : ch.length;
      for (let v = from; v <= to; v++) {
        const k = r.book + ':' + c + ':' + v; if (ch[v - 1] == null || seen.has(k)) continue;
        seen.add(k); out.push({ book: r.book, chapter: c, verse: v, text: ch[v - 1] });
      }
    }
  }
  return out;
}

// Lookup by string: { ref: "John 3:16–18", verses: [...] } or null.
function lookup(bible, input) {
  const p = parseRef(input); if (!p) return null;
  const vs = verses(bible, p); if (!vs.length) return null;
  return { ref: formatRef(p), verses: vs };
}

// One verse per line, numbered — the body text written into a scripture block.
function passageText(vs) { return vs.map(v => v.verse + ' ' + v.text).join('\n'); }

// Keyword search (all words must appear, case-insensitive). Optional book index or array of indexes. Capped.
function search(bible, query, { books = null, limit = 200 } = {}) {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean); if (!terms.length || !bible) return [];
  const phrase = /^".*"$/.test(String(query).trim()) ? String(query).trim().slice(1, -1).toLowerCase() : null;
  const set = books == null ? null : new Set(Array.isArray(books) ? books : [books]);
  const out = [];
  for (let b = 0; b < bible.books.length; b++) {
    if (set && !set.has(b)) continue;
    const chapters = bible.books[b].chapters;
    for (let c = 0; c < chapters.length; c++) for (let v = 0; v < chapters[c].length; v++) {
      const t = chapters[c][v].toLowerCase();
      if (phrase ? t.includes(phrase) : terms.every(w => t.includes(w))) {
        out.push({ book: b, chapter: c + 1, verse: v + 1, text: chapters[c][v], ref: refLabel(b, c + 1, v + 1) });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}
function refLabel(book, chapter, verse) { return formatRef({ refs: [{ book, c1: chapter, v1: verse || 0, c2: chapter, v2: verse || 0 }] }); }

// Find scripture references inside prose: [{ index, length, text, parsed }]. Used to make references tappable in Podium.
const BOOK_RE = '(?:[1-3]\\s?|I{1,3}\\s)?(?:Song of Solomon|Song of Songs|[A-Z][a-z]{1,13})\\.?';
const INLINE = new RegExp('\\b(' + BOOK_RE + ')\\s(\\d{1,3}(?::\\d{1,3}[a-z]?)?(?:\\s?[-\\u2013]\\s?\\d{1,3}(?::\\d{1,3})?)?(?:,\\s?\\d{1,3}(?:\\s?[-\\u2013]\\s?\\d{1,3})?)*)\\b', 'g');
function findRefs(text) {
  const out = []; let m; INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text || ''))) {
    if (bookIndex(m[1]) < 0) continue;
    const parsed = parseRef(m[0]); if (!parsed) continue;
    out.push({ index: m.index, length: m[0].length, text: m[0], parsed });
  }
  return out;
}
(SB.shared ||= {}).bible = { BOOKS, bookIndex, parseRef, formatRef, verses, lookup, passageText, search, refLabel, findRefs };
})(globalThis.SB ||= {});
