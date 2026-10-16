// Telling a Writer library (the book-writing app) apart from ours, from a folder listing alone: writer.json in the root or
// a book.json inside a subfolder. (Both apps keep `.notes.md` sidecars, so those say nothing.) Such a folder is refused
// untouched and handed to Writer.
(function (SB) {
'use strict';
const WRITER_URL = 'https://testamenthouse.github.io/minimalist-writer/';
// True on the GitHub Pages host, where the sister app is one hop away.
const onPages = () => typeof location !== 'undefined' && /\.github\.io$/i.test(location.hostname);
function isWriterLibrary(list) {
  return list.some(e => e.kind === 'file' && (/^writer\.json$/i.test(e.path) || /^[^/]+\/book\.json$/i.test(e.path)));
}
(SB.shared ||= {}).library = { WRITER_URL, onPages, isWriterLibrary };
})(globalThis.SB ||= {});
