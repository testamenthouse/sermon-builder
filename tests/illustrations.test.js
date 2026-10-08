import test from 'node:test';
import assert from 'node:assert/strict';
import { illustrations } from '../shared/node.js';
const { illustrationBody, illustrationUses, illustrationMatches } = illustrations;

const ill = { path: 'Illustrations/Lost Sheep.md', meta: { title: 'Lost Sheep', tags: ['grace', 'Luke'], source: 'Spurgeon' }, body: 'A shepherd left ninety-nine.' };
const sermon = (title, blocks, template = false) => ({ path: title + '.md', meta: { title, template }, blocks });

test('block body is text then source line', () => {
  assert.equal(illustrationBody(ill), 'A shepherd left ninety-nine.\n\n— Spurgeon');
  assert.equal(illustrationBody({ meta: { title: 'x', source: '' }, body: 'Only text' }), 'Only text');
  assert.equal(illustrationBody({ title: 'x', source: 'Src', body: '' }), '— Src');
});

test('uses = sermons with an illustration block headed by the title, case-insensitive, templates excluded', () => {
  const a = sermon('A', [{ kind: 'illustration', heading: 'lost sheep', body: '' }]);
  const b = sermon('B', [{ kind: 'point', heading: 'Lost Sheep', body: '' }]);
  const c = sermon('C', [{ kind: 'illustration', heading: 'Lost Sheep', body: '' }], true);
  assert.deepEqual(illustrationUses(ill, [a, b, c]).map(s => s.meta.title), ['A']);
  assert.deepEqual(illustrationUses({ meta: { title: '' }, body: '' }, [a]), []);
});

test('find matches title, tags, source and body', () => {
  for (const q of ['sheep', 'LUKE', 'spurg', 'ninety', '']) assert.ok(illustrationMatches(ill, q), q);
  assert.ok(!illustrationMatches(ill, 'goat'));
  assert.ok(illustrationMatches({ title: 'Flat', tags: ['t'], source: '', body: '' }, 'flat'));
});
