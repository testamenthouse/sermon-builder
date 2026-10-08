import test from 'node:test';
import assert from 'node:assert/strict';
import { format } from '../shared/node.js';
const { parseSermon, serializeSermon, sermonWords, countWords } = format;

const SRC = `---
title: The Good Shepherd
collection: Psalms
date: 2026-10-11
passage: Psalm 23
big_idea: God's care is personal.
status: ready
tags: [comfort, trust]
length: 35
---

::: intro
Opening story.

Second paragraph.
:::

::: point The Lord is my shepherd
Body of point one.
:::

::: scripture Psalm 23:1
1 The LORD is my shepherd; I shall not want.
:::

::: note {hidden}
Slow down here.
:::

::: Me
Custom-labeled block.
:::
`;
test('round trip', () => {
  const s = parseSermon(SRC);
  assert.equal(s.meta.title, 'The Good Shepherd'); assert.deepEqual(s.meta.tags, ['comfort', 'trust']); assert.equal(s.meta.length, 35); assert.equal(s.meta.status, 'ready');
  assert.equal(s.blocks.length, 5);
  assert.equal(s.blocks[0].kind, 'intro'); assert.equal(s.blocks[0].body, 'Opening story.\n\nSecond paragraph.');
  assert.deepEqual(s.blocks[1].flags, []); assert.deepEqual(parseSermon('::: point A {slide hidden}\n:::').blocks[0].flags, ['hidden']); // unknown flags are dropped on read assert.equal(s.blocks[1].heading, 'The Lord is my shepherd');
  assert.equal(s.blocks[3].kind, 'note'); assert.deepEqual(s.blocks[3].flags, ['hidden']);
  assert.equal(s.blocks[4].kind, 'custom'); assert.equal(s.blocks[4].label, 'Me'); assert.equal(s.blocks[4].heading, '');
  const out = serializeSermon(s);
  assert.equal(out, SRC.replace('::: Me\n', '::: custom Me\n'));
  assert.deepEqual(parseSermon(out).blocks.map(b => b.body), s.blocks.map(b => b.body));
});
test('loose text and missing frontmatter', () => {
  const s = parseSermon('Just some words\n\n::: point A\nx\n:::\ntail');
  assert.equal(s.meta.title, ''); assert.equal(s.blocks.length, 3); assert.equal(s.blocks[0].kind, 'text'); assert.equal(s.blocks[2].body, 'tail');
});
test('words', () => {
  const s = parseSermon(SRC);
  assert.equal(countWords('**bold** and _it_'), 3);
  assert.equal(sermonWords(s.blocks), 24);
});
test('quoting', () => {
  const out = serializeSermon({ meta: { title: 'A: B', big_idea: '"Quoted"', tags: ['a,b'] }, blocks: [] });
  assert.match(out, /title: "A: B"/); assert.match(out, /tags: \["a,b"\]/);
  assert.equal(parseSermon(out).meta.title, 'A: B');
});
test('old preached status reads as done', () => {
  const s = parseSermon('---\ntitle: Old\nstatus: preached\n---\n');
  assert.equal(s.meta.status, 'done'); assert.match(serializeSermon(s), /\nstatus: done\n/);
});
test('old series key reads as collection', () => {
  const s = parseSermon('---\ntitle: Old\nseries: Psalms\n---\n');
  assert.equal(s.meta.collection, 'Psalms'); assert.equal('series' in s.meta, false); assert.match(serializeSermon(s), /\ncollection: Psalms\n/); assert.doesNotMatch(serializeSermon(s), /series/);
});
test('custom block: label | headline', () => {
  const s = parseSermon('::: custom Announcement | Potluck this Sunday\nBring a dish.\n:::\n\n::: Me | Hi\n:::\n\n::: custom | Only headline\n:::\n');
  assert.deepEqual(s.blocks.map(b => [b.kind, b.label, b.heading]), [['custom', 'Announcement', 'Potluck this Sunday'], ['custom', 'Me', 'Hi'], ['custom', '', 'Only headline']]);
  const out = serializeSermon(s);
  assert.match(out, /^::: custom Announcement \| Potluck this Sunday\nBring a dish\.\n:::\n/m); assert.match(out, /^::: custom Me \| Hi\n/m); assert.match(out, /^::: custom \| Only headline\n/m);
  assert.deepEqual(parseSermon(out).blocks.map(b => [b.label, b.heading]), s.blocks.map(b => [b.label, b.heading]));
  assert.equal(sermonWords(s.blocks), 9);
});
