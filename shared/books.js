// The 66 books in canonical order with chapter counts and the abbreviations people actually type.
(function (SB) {
'use strict';
const BOOKS = [
  ['Genesis', 50, 'gen ge gn'], ['Exodus', 40, 'ex exo exod'], ['Leviticus', 27, 'lev le lv'], ['Numbers', 36, 'num nu nm nb'], ['Deuteronomy', 34, 'deut dt de deu'],
  ['Joshua', 24, 'josh jos jsh'], ['Judges', 21, 'judg jdg jg jdgs'], ['Ruth', 4, 'rth ru'], ['1 Samuel', 31, '1sam 1sa 1s 1sm'], ['2 Samuel', 24, '2sam 2sa 2s 2sm'],
  ['1 Kings', 22, '1kgs 1ki 1k 1kin'], ['2 Kings', 25, '2kgs 2ki 2k 2kin'], ['1 Chronicles', 29, '1chr 1ch 1chron'], ['2 Chronicles', 36, '2chr 2ch 2chron'], ['Ezra', 10, 'ezr'],
  ['Nehemiah', 13, 'neh ne'], ['Esther', 10, 'esth es est'], ['Job', 42, 'jb'], ['Psalms', 150, 'ps psa psm pss psalm pslm'], ['Proverbs', 31, 'prov pr prv pro'],
  ['Ecclesiastes', 12, 'eccl ec ecc qoh eccles'], ['Song of Solomon', 8, 'song sos so canticles cant songofsongs songs'], ['Isaiah', 66, 'isa is'], ['Jeremiah', 52, 'jer je jr'], ['Lamentations', 5, 'lam la'],
  ['Ezekiel', 48, 'ezek eze ezk'], ['Daniel', 12, 'dan da dn'], ['Hosea', 14, 'hos ho'], ['Joel', 3, 'jl'], ['Amos', 9, 'am'],
  ['Obadiah', 1, 'obad ob'], ['Jonah', 4, 'jon jnh'], ['Micah', 7, 'mic mc'], ['Nahum', 3, 'nah na'], ['Habakkuk', 3, 'hab hb'],
  ['Zephaniah', 3, 'zeph zep zp'], ['Haggai', 2, 'hag hg'], ['Zechariah', 14, 'zech zec zc'], ['Malachi', 4, 'mal ml'],
  ['Matthew', 28, 'matt mt mat'], ['Mark', 16, 'mk mrk mr'], ['Luke', 24, 'lk luk'], ['John', 21, 'jn jhn joh'], ['Acts', 28, 'ac act'],
  ['Romans', 16, 'rom ro rm'], ['1 Corinthians', 16, '1cor 1co 1corinth'], ['2 Corinthians', 13, '2cor 2co 2corinth'], ['Galatians', 6, 'gal ga'], ['Ephesians', 6, 'eph ep'],
  ['Philippians', 4, 'phil php pp'], ['Colossians', 4, 'col co'], ['1 Thessalonians', 5, '1thess 1th 1thes 1thessalonians'], ['2 Thessalonians', 3, '2thess 2th 2thes'], ['1 Timothy', 6, '1tim 1ti'],
  ['2 Timothy', 4, '2tim 2ti'], ['Titus', 3, 'tit ti'], ['Philemon', 1, 'phlm phm philem pm'], ['Hebrews', 13, 'heb'], ['James', 5, 'jas jm'],
  ['1 Peter', 5, '1pet 1pe 1pt 1p'], ['2 Peter', 3, '2pet 2pe 2pt 2p'], ['1 John', 5, '1jn 1jhn 1jo 1j'], ['2 John', 1, '2jn 2jhn 2jo 2j'], ['3 John', 1, '3jn 3jhn 3jo 3j'],
  ['Jude', 1, 'jud jd'], ['Revelation', 22, 'rev re revelations apocalypse apoc']
].map(([name, chapters, abbr]) => ({ name, chapters, abbr: abbr.split(' ') }));

const ALIAS = new Map();
function normBook(s) {
  return String(s).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
    .replace(/^(i{1,3})\s/, (m, r) => r.length + ' ').replace(/^(1st|first)\s/, '1 ').replace(/^(2nd|second)\s/, '2 ').replace(/^(3rd|third)\s/, '3 ')
    .replace(/\s/g, '');
}
BOOKS.forEach((b, i) => { ALIAS.set(normBook(b.name), i); for (const a of b.abbr) ALIAS.set(a, i); });
ALIAS.set('songofsolomon', 21); ALIAS.set('psalms', 18); ALIAS.set('revelationofjohn', 65);

// Resolve a typed book name to its index, or -1. Exact aliases first, then a unique prefix of a full name (3+ chars).
function bookIndex(s) {
  const n = normBook(s); if (!n) return -1;
  if (ALIAS.has(n)) return ALIAS.get(n);
  if (n.length < 3) return -1;
  const hits = BOOKS.map((b, i) => normBook(b.name).startsWith(n) ? i : -1).filter(i => i >= 0);
  return hits.length === 1 ? hits[0] : -1;
}
(SB.shared ||= {}).books = { BOOKS, normBook, bookIndex };
})(globalThis.SB ||= {});
