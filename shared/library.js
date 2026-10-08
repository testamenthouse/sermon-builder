// Telling a Writer library (the book-writing app) apart from ours, from a folder listing alone: writer.json in the root,
// a book.json or a .notes.md sidecar inside a subfolder. Such a folder is refused untouched and handed to Writer.
export const WRITER_URL = 'https://testamenthouse.github.io/minimalist-writer/';
export function isWriterLibrary(list) {
  return list.some(e => e.kind === 'file' && (/^writer\.json$/i.test(e.path) || /^[^/]+\/book\.json$/i.test(e.path) || /^[^/]+\/[^/]+\.notes\.md$/i.test(e.path)));
}
