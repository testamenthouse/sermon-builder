import test from 'node:test';
import assert from 'node:assert/strict';
import { md } from '../app/src/lib/node.js';
const { mdLine, mdHtml, continuation } = md;

test('checklist lines', () => {
  assert.deepEqual(mdLine('- [ ] call Tom'), { t: 'task', mark: '- [ ] ', c: 'call Tom' });
  assert.deepEqual(mdLine('- [x] done'), { t: 'done', mark: '- [x] ', c: 'done' });
  assert.equal(mdLine('- [ ]').t, 'task'); assert.equal(mdLine('- [ ]').c, '');
  assert.equal(mdLine('- [y] no').t, 'ul');
  assert.equal(mdLine('- plain').t, 'ul');
});
test('checklist renders as boxes in print', () => {
  assert.equal(mdHtml('- [ ] a\n- [x] b'), '<p class="li">&#9744; a</p><p class="li">&#9745; b</p>');
});
test('Enter carries list markers on', () => {
  assert.equal(continuation(mdLine('- a')), '- ');
  assert.equal(continuation(mdLine('* a')), '* ');
  assert.equal(continuation(mdLine('3. a')), '4. ');
  assert.equal(continuation(mdLine('3) a')), '4) ');
  assert.equal(continuation(mdLine('- [x] a')), '- [ ] ');
  assert.equal(continuation(mdLine('plain')), null);
  assert.equal(continuation(mdLine('# head')), null);
});
