import test from 'node:test';
import assert from 'node:assert/strict';
import { bookmarks } from '../shared/node.js';
const { parseBookmark, bookmarkText, bookmarkFile, bookmarkMatches, findBookmark } = bookmarks;

test('bookmark round trip', () => {
  const bm = parseBookmark('Bookmarks/John 3-16–18.md', '---\nreference: John 3:16-18\ntags: [gospel, love]\n---\n\nThe whole gospel in three verses.\n');
  assert.equal(bm.meta.reference, 'John 3:16–18'); assert.deepEqual(bm.meta.tags, ['gospel', 'love']); assert.equal(bm.body, 'The whole gospel in three verses.');
  assert.equal(bookmarkText(bm), '---\nreference: John 3:16–18\ntags: [gospel, love]\n---\n\nThe whole gospel in three verses.\n');
  assert.equal(bookmarkFile('John 3:16–18'), 'John 3-16–18');
});
test('a file with no frontmatter is named by its file name', () => {
  const bm = parseBookmark('Bookmarks/Psalm 23.md', 'Comfort.');
  assert.equal(bm.meta.reference, 'Psalm 23'); assert.deepEqual(bm.meta.tags, []); assert.equal(bm.body, 'Comfort.');
});
test('find and match', () => {
  const list = [parseBookmark('Bookmarks/a.md', '---\nreference: Romans 8:28\ntags: [hope]\n---\nAll things.')];
  assert.equal(findBookmark(list, 'Rom 8:28').meta.reference, 'Romans 8:28');
  assert.equal(findBookmark(list, 'Romans 8:29'), null);
  assert.equal(bookmarkMatches(list[0], 'HOPE'), true); assert.equal(bookmarkMatches(list[0], 'things'), true); assert.equal(bookmarkMatches(list[0], 'john'), false);
});
