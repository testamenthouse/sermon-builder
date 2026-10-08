import test from 'node:test';
import assert from 'node:assert/strict';
import { outline, format } from '../shared/node.js';
const { outlineTree, pointNumbers, depths, groupRange, moveRange, moveStep, snapDrop } = outline, { parseSermon } = format;

const B = (kind, id) => ({ id, kind, heading: id, body: '', flags: [] });
// intro, P1 [scr, ill], transition, P2 [app], conclusion
const blocks = [B('intro', 'in'), B('point', 'p1'), B('scripture', 'sc'), B('illustration', 'il'), B('transition', 'tr'), B('point', 'p2'), B('application', 'ap'), B('conclusion', 'co')];
const ids = bs => bs.map(b => b.id).join(' ');

test('tree: points own their group, transitions sit between, closers are free', () => {
  const t = outlineTree(blocks);
  assert.deepEqual(t.map(s => s.type), ['free', 'point', 'transition', 'point', 'free']);
  assert.equal(t[1].block.id, 'p1'); assert.deepEqual(t[1].blocks.map(b => b.id), ['sc', 'il']);
  assert.deepEqual(t[4].blocks.map(b => b.id), ['co']);
  assert.deepEqual([...depths(blocks)].map(([k, v]) => k + v).join(' '), 'in0 p10 sc1 il1 tr0 p20 ap1 co0');
});
test('numbers', () => {
  const n = pointNumbers(blocks);
  assert.equal(n.get('p1'), '1'); assert.equal(n.get('p2'), '2'); assert.equal(n.has('sc'), false);
});
test('old subpoint fences read as points', () => {
  const s = parseSermon('::: point B\n:::\n::: subpoint C\nx\n:::');
  assert.deepEqual(s.blocks.map(b => b.kind), ['point', 'point']); assert.equal(s.blocks[1].heading, 'C');
});
test('ranges', () => {
  assert.deepEqual(groupRange(blocks, 'p1'), [1, 4]); assert.deepEqual(groupRange(blocks, 'sc'), [2, 3]); assert.deepEqual(groupRange(blocks, 'p2'), [5, 7]);
});
test('moving a point carries its group', () => {
  assert.equal(ids(moveRange(blocks, 'p1', 7)), 'in tr p2 ap p1 sc il co');
  assert.equal(ids(moveRange(blocks, 'p2', 1)), 'in p2 ap p1 sc il tr co');
  assert.equal(moveRange(blocks, 'p1', 3), blocks); // inside itself: nothing moves
  assert.equal(ids(moveRange(blocks, 'il', 7)), 'in p1 sc tr p2 ap il co');
});
test('step moves jump whole segments', () => {
  assert.equal(ids(moveStep(blocks, 'p2', -1)), 'in p1 sc il p2 ap tr co'); // over the transition
  assert.equal(ids(moveStep(moveStep(blocks, 'p2', -1), 'p2', -1)), 'in p2 ap p1 sc il tr co'); // over the whole of point 1
  assert.equal(ids(moveStep(blocks, 'p1', -1)), 'p1 sc il in tr p2 ap co');
  assert.equal(moveStep(blocks, 'in', -1), blocks);
  assert.equal(ids(moveStep(blocks, 'sc', 1)), 'in p1 il sc tr p2 ap co'); // plain blocks still step one block
});
test('drop snapping', () => {
  assert.equal(snapDrop(blocks, 'p2', 2), 1); assert.equal(snapDrop(blocks, 'p2', 3), 4); assert.equal(snapDrop(blocks, 'p2', 0), 0); assert.equal(snapDrop(blocks, 'p1', 8), 8);
  assert.equal(snapDrop(blocks, 'il', 0), 0);
});
test('group-ending kinds are never created inside a container; points never change kind', async () => {
  const { canInsert, canSwitch } = outline;
  assert.equal(canInsert(blocks, 2, 'point'), false); assert.equal(canInsert(blocks, 3, 'transition'), false); assert.equal(canInsert(blocks, 3, 'conclusion'), false);
  assert.equal(canInsert(blocks, 4, 'point'), true); // the end of point 1's group
  assert.equal(canInsert(blocks, 1, 'point'), true); assert.equal(canInsert(blocks, 2, 'scripture'), true); assert.equal(canInsert(blocks, 8, 'point'), true);
  assert.equal(canSwitch(blocks, 1, 'text'), false); assert.equal(canSwitch(blocks, 2, 'point'), false); assert.equal(canSwitch(blocks, 0, 'point'), false);
  assert.equal(canSwitch(blocks, 2, 'transition'), false); assert.equal(canSwitch(blocks, 3, 'transition'), true); assert.equal(canSwitch(blocks, 2, 'quote'), true);
  assert.equal(snapDrop(blocks, 'tr', 2), 1); assert.equal(ids(moveStep(blocks, 'tr', -1)), 'in tr p1 sc il p2 ap co');
});
