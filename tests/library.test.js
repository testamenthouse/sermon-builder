import test from 'node:test';
import assert from 'node:assert/strict';
import { isWriterLibrary } from '../shared/library.js';

const f = (path, kind = 'file') => ({ path, kind, mtime: 0, size: 0 });
test('a sermon library is not a Writer library', () => {
  assert.equal(isWriterLibrary([f('sermon.json'), f('Psalms', 'dir'), f('Psalms/collection.json'), f('Psalms/The Good Shepherd.md'), f('Templates', 'dir'), f('Templates/Three Point.md'), f('Illustrations', 'dir')]), false);
  assert.equal(isWriterLibrary([]), false);
});
test('Writer markers are recognised anywhere they can appear', () => {
  assert.equal(isWriterLibrary([f('writer.json')]), true);
  assert.equal(isWriterLibrary([f('The Long Field', 'dir'), f('The Long Field/book.json')]), true);
  assert.equal(isWriterLibrary([f('The Long Field', 'dir'), f('The Long Field/01-the-river.md'), f('The Long Field/01-the-river.notes.md')]), true);
  assert.equal(isWriterLibrary([f('Deep/Nested/book.json')]), false);
});
