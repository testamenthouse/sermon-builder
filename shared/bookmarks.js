// Bookmarks: one file per passage in the library's Bookmarks/ folder — `reference` and `tags` in the frontmatter,
// a note as the body. The reference is the name; the file name is only its slug.
(function (SB) {
'use strict';
const { parseMeta, slugify } = SB.shared.format;
const { parseRef, formatRef } = SB.shared.bible;
const BOOKMARKS_DIR = 'Bookmarks';
const norm = s => String(s || '').trim().toLowerCase();

function parseBookmark(path, text) {
  const t = String(text || '').replace(/\r\n?/g, '\n'); let meta = {}, body = t;
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(t); if (fm) { meta = parseMeta(fm[1]); body = t.slice(fm[0].length); }
  const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '');
  const raw = String(meta.reference || name), p = parseRef(raw);
  return { path, meta: { reference: p ? formatRef(p) : raw, tags: Array.isArray(meta.tags) ? meta.tags.map(String) : (typeof meta.tags === 'string' && meta.tags ? meta.tags.split(',').map(s => s.trim()).filter(Boolean) : []) }, body: body.trim(), text: t };
}
function bookmarkText(bm) {
  const lines = ['---', 'reference: ' + bm.meta.reference];
  if (bm.meta.tags.length) lines.push('tags: [' + bm.meta.tags.join(', ') + ']');
  lines.push('---', '', (bm.body || '').trim(), '');
  return lines.join('\n');
}
// File name for a reference: "John 3:16–18" → "John 3-16–18.md".
const bookmarkFile = reference => slugify(reference).replace(/:/g, '-');
// Reference, tags and note all count for the find field.
function bookmarkMatches(bm, q) { const needle = norm(q); if (!needle) return true; return [bm.meta.reference, String(bm.body || ''), ...bm.meta.tags].some(x => norm(x).includes(needle)); }
// The bookmark for a reference, matched by its canonical form.
function findBookmark(bookmarks, reference) { const p = parseRef(reference); const key = norm(p ? formatRef(p) : reference); return (bookmarks || []).find(b => norm(b.meta.reference) === key) || null; }
(SB.shared ||= {}).bookmarks = { BOOKMARKS_DIR, parseBookmark, bookmarkText, bookmarkFile, bookmarkMatches, findBookmark };
})(globalThis.SB ||= {});
