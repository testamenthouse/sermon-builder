// The 66 books in canonical order with chapter counts, their names in English and Spanish, and the abbreviations people
// actually type in either language. `name` follows the interface language (setLang); every alias resolves whatever the language.
(function (SB) {
'use strict';
let lang = 'en';
const BOOKS = [
  ['Genesis', 'Génesis', 50, 'gen ge gn', 'gén'], ['Exodus', 'Éxodo', 40, 'ex exo exod', 'éx éxo'], ['Leviticus', 'Levítico', 27, 'lev le lv', 'lv'], ['Numbers', 'Números', 36, 'num nu nm nb', 'núm'], ['Deuteronomy', 'Deuteronomio', 34, 'deut dt de deu', 'dt'],
  ['Joshua', 'Josué', 24, 'josh jos jsh', 'jos'], ['Judges', 'Jueces', 21, 'judg jdg jg jdgs', 'jue jc'], ['Ruth', 'Rut', 4, 'rth ru', 'rt'], ['1 Samuel', '1 Samuel', 31, '1sam 1sa 1s 1sm', ''], ['2 Samuel', '2 Samuel', 24, '2sam 2sa 2s 2sm', ''],
  ['1 Kings', '1 Reyes', 22, '1kgs 1ki 1k 1kin', '1re 1r 1rey'], ['2 Kings', '2 Reyes', 25, '2kgs 2ki 2k 2kin', '2re 2r 2rey'], ['1 Chronicles', '1 Crónicas', 29, '1chr 1ch 1chron', '1cr 1cro 1crón'], ['2 Chronicles', '2 Crónicas', 36, '2chr 2ch 2chron', '2cr 2cro 2crón'], ['Ezra', 'Esdras', 10, 'ezr', 'esd'],
  ['Nehemiah', 'Nehemías', 13, 'neh ne', ''], ['Esther', 'Ester', 10, 'esth es est', ''], ['Job', 'Job', 42, 'jb', ''], ['Psalms', 'Salmos', 150, 'ps psa psm pss psalm pslm', 'sal slm salmo'], ['Proverbs', 'Proverbios', 31, 'prov pr prv pro', 'prv'],
  ['Ecclesiastes', 'Eclesiastés', 12, 'eccl ec ecc qoh eccles', 'ecl'], ['Song of Solomon', 'Cantares', 8, 'song sos so canticles cant songofsongs songs', 'cnt cantar cantardeloscantares'], ['Isaiah', 'Isaías', 66, 'isa is', ''], ['Jeremiah', 'Jeremías', 52, 'jer je jr', ''], ['Lamentations', 'Lamentaciones', 5, 'lam la', 'lm'],
  ['Ezekiel', 'Ezequiel', 48, 'ezek eze ezk', 'ez ezq'], ['Daniel', 'Daniel', 12, 'dan da dn', ''], ['Hosea', 'Oseas', 14, 'hos ho', 'os'], ['Joel', 'Joel', 3, 'jl', ''], ['Amos', 'Amós', 9, 'am', ''],
  ['Obadiah', 'Abdías', 1, 'obad ob', 'abd'], ['Jonah', 'Jonás', 4, 'jon jnh', ''], ['Micah', 'Miqueas', 7, 'mic mc', 'mi miq'], ['Nahum', 'Nahúm', 3, 'nah na', ''], ['Habakkuk', 'Habacuc', 3, 'hab hb', ''],
  ['Zephaniah', 'Sofonías', 3, 'zeph zep zp', 'sof'], ['Haggai', 'Hageo', 2, 'hag hg', ''], ['Zechariah', 'Zacarías', 14, 'zech zec zc', 'zac'], ['Malachi', 'Malaquías', 4, 'mal ml', ''],
  ['Matthew', 'Mateo', 28, 'matt mt mat', ''], ['Mark', 'Marcos', 16, 'mk mrk mr', 'mc'], ['Luke', 'Lucas', 24, 'lk luk', 'lc'], ['John', 'Juan', 21, 'jn jhn joh', ''], ['Acts', 'Hechos', 28, 'ac act', 'hch hec'],
  ['Romans', 'Romanos', 16, 'rom ro rm', ''], ['1 Corinthians', '1 Corintios', 16, '1cor 1co 1corinth', ''], ['2 Corinthians', '2 Corintios', 13, '2cor 2co 2corinth', ''], ['Galatians', 'Gálatas', 6, 'gal ga', 'gá'], ['Ephesians', 'Efesios', 6, 'eph ep', 'ef'],
  ['Philippians', 'Filipenses', 4, 'phil php pp', 'fil flp'], ['Colossians', 'Colosenses', 4, 'col co', ''], ['1 Thessalonians', '1 Tesalonicenses', 5, '1thess 1th 1thes 1thessalonians', '1ts 1tes'], ['2 Thessalonians', '2 Tesalonicenses', 3, '2thess 2th 2thes', '2ts 2tes'], ['1 Timothy', '1 Timoteo', 6, '1tim 1ti', ''],
  ['2 Timothy', '2 Timoteo', 4, '2tim 2ti', ''], ['Titus', 'Tito', 3, 'tit ti', ''], ['Philemon', 'Filemón', 1, 'phlm phm philem pm', 'flm'], ['Hebrews', 'Hebreos', 13, 'heb', 'he'], ['James', 'Santiago', 5, 'jas jm', 'stg sant'],
  ['1 Peter', '1 Pedro', 5, '1pet 1pe 1pt 1p', ''], ['2 Peter', '2 Pedro', 3, '2pet 2pe 2pt 2p', ''], ['1 John', '1 Juan', 5, '1jn 1jhn 1jo 1j', ''], ['2 John', '2 Juan', 1, '2jn 2jhn 2jo 2j', ''], ['3 John', '3 Juan', 1, '3jn 3jhn 3jo 3j', ''],
  ['Jude', 'Judas', 1, 'jud jd', ''], ['Revelation', 'Apocalipsis', 22, 'rev re revelations apocalypse apoc', 'ap apoc']
].map(([en, es, chapters, abbr, abbrEs]) => {
  const b = { names: { en, es }, chapters, abbr: (abbr + ' ' + abbrEs).split(' ').filter(Boolean) };
  Object.defineProperty(b, 'name', { enumerable: true, get() { return b.names[lang] || en; } });
  return b;
});

const ALIAS = new Map();
// Lowercase, no accents, no dots or spaces; "I Kings" / "1st Kings" / "First Kings" all read as "1kings".
function normBook(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim()
    .replace(/^(i{1,3})\s/, (m, r) => r.length + ' ').replace(/^(1st|first|primera?|1a|1ra|1º|1ª)\s/, '1 ').replace(/^(2nd|second|segunda?|2a|2da|2º|2ª)\s/, '2 ').replace(/^(3rd|third|tercera?|3a|3ra|3º|3ª)\s/, '3 ').replace(/^([1-3]) de\s/, '$1 ')
    .replace(/\s/g, '');
}
BOOKS.forEach((b, i) => { ALIAS.set(normBook(b.names.en), i); ALIAS.set(normBook(b.names.es), i); for (const a of b.abbr) ALIAS.set(normBook(a), i); });
ALIAS.set('songofsolomon', 21); ALIAS.set('psalms', 18); ALIAS.set('revelationofjohn', 65); ALIAS.set('salmo', 18); ALIAS.set('cantardeloscantares', 21);

// Resolve a typed book name to its index, or -1. Exact aliases first, then a unique prefix of a full name in either language (3+ chars).
function bookIndex(s) {
  const n = normBook(s); if (!n) return -1;
  if (ALIAS.has(n)) return ALIAS.get(n);
  if (n.length < 3) return -1;
  const hits = [...new Set(BOOKS.map((b, i) => normBook(b.names.en).startsWith(n) || normBook(b.names.es).startsWith(n) ? i : -1).filter(i => i >= 0))];
  return hits.length === 1 ? hits[0] : -1;
}
// The interface language the book names follow ('en' or 'es').
function setLang(l) { lang = l === 'es' ? 'es' : 'en'; }
const getLang = () => lang;
(SB.shared ||= {}).books = { BOOKS, normBook, bookIndex, setLang, getLang };
})(globalThis.SB ||= {});
