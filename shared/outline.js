// The point hierarchy, derived from the flat block list. The file stays flat; this is the one rule every
// surface (editor, rail, Podium outline, print, Word) reads the hierarchy by:
//   a point opens a group that runs until the next point, a closing kind or a transition;
//   transitions sit between groups, never inside one;
//   whatever precedes the first point, and the closing blocks, are free.
(function (SB) {
'use strict';
const CLOSERS = new Set(['intro', 'conclusion', 'prayer', 'invitation']);
// Kinds that end a point's group. They are top-level things: they move between groups and are never created inside one.
const endsGroup = k => k === 'point' || k === 'transition' || CLOSERS.has(k);

// → [ { type: 'free', blocks }, { type: 'transition', block }, { type: 'point', block, blocks } ]
function outlineTree(blocks) {
  const out = []; let free = null, pt = null;
  for (const b of blocks || []) {
    if (b.kind === 'point') { free = null; pt = { type: 'point', block: b, blocks: [] }; out.push(pt); continue; }
    if (b.kind === 'transition') { free = null; pt = null; out.push({ type: 'transition', block: b }); continue; }
    if (CLOSERS.has(b.kind)) { free = null; pt = null; }
    if (pt) { pt.blocks.push(b); continue; }
    if (!free) { free = { type: 'free', blocks: [] }; out.push(free); }
    free.blocks.push(b);
  }
  return out;
}

// Numbers for points ("1"), by id.
function pointNumbers(blocks) {
  const out = new Map(); let p = 0;
  for (const b of blocks || []) if (b.kind === 'point') out.set(b.id, String(++p));
  return out;
}

// Depth of each block for indentation: 0 top level, 1 inside a point. Points are 0.
function depths(blocks) {
  const out = new Map();
  for (const sec of outlineTree(blocks)) {
    if (sec.type === 'point') { out.set(sec.block.id, 0); for (const b of sec.blocks) out.set(b.id, 1); }
    else if (sec.type === 'transition') out.set(sec.block.id, 0);
    else for (const b of sec.blocks) out.set(b.id, 0);
  }
  return out;
}

// [start, end) of the range a block carries with it: a point drags its group, anything else itself.
function groupRange(blocks, id) {
  const i = blocks.findIndex(b => b.id === id); if (i < 0) return null;
  let end = i + 1;
  if (blocks[i].kind === 'point') while (end < blocks.length && !endsGroup(blocks[end].kind)) end++;
  return [i, end];
}

// Top-level segments ([start, end) ranges): each point group as one, every other top-level block as its own.
function topSegments(blocks) {
  const segs = []; let j = 0;
  while (j < blocks.length) { const r = blocks[j].kind === 'point' ? groupRange(blocks, blocks[j].id) : [j, j + 1]; segs.push(r); j = r[1]; }
  return segs;
}
// What "move up / move down" steps over: a group-ending kind steps over whole top-level segments, anything else one block.
function segments(blocks, id) {
  const i = blocks.findIndex(b => b.id === id); if (i < 0) return [];
  return endsGroup(blocks[i].kind) ? topSegments(blocks) : blocks.map((_, j) => [j, j + 1]);
}
// The point group an index falls strictly inside (after the point, before the group end), or null.
function insideGroup(blocks, index) {
  for (const [s, e] of topSegments(blocks)) if (blocks[s] && blocks[s].kind === 'point' && index > s && index < e) return [s, e];
  return null;
}
// May a block of this kind be inserted at this index? Group-ending kinds only between groups or at a group's end.
function canInsert(blocks, index, kind) { return !endsGroup(kind) || !insideGroup(blocks, index); }
// May the block at this index become this kind? A point is a first-class construct: it never changes kind and nothing
// becomes one (points enter only through "+"). Other group-ending kinds follow the insert rule, except that the last
// block of a group may become one (it then sits after the group).
function canSwitch(blocks, index, kind) {
  const b = blocks[index]; if (!b || b.kind === 'point' || kind === 'point') return false;
  if (!endsGroup(kind)) return true; const g = insideGroup(blocks, index); return !g || index + 1 === g[1];
}

// Move a block (with its range) so that it starts at `index` (an index into the original list). Returns the new list, or the same list when nothing moves.
function moveRange(blocks, id, index) {
  const r = groupRange(blocks, id); if (!r) return blocks;
  const [s, e] = r; if (index >= s && index <= e) return blocks;
  const taken = blocks.slice(s, e), rest = blocks.slice(0, s).concat(blocks.slice(e));
  const at = index > e ? index - (e - s) : index;
  return rest.slice(0, at).concat(taken, rest.slice(at));
}

// Move a block one segment up or down among its peers.
function moveStep(blocks, id, delta) {
  const segs = segments(blocks, id), i = blocks.findIndex(b => b.id === id);
  const n = segs.findIndex(([s]) => s === i); if (n < 0) return blocks;
  const t = segs[n + delta]; if (!t) return blocks;
  return moveRange(blocks, id, delta < 0 ? t[0] : t[1]);
}

// Snap a drop index to the boundaries a dragged block may land on: a group-ending kind lands between top-level segments, anything else anywhere.
function snapDrop(blocks, id, index) {
  const i = blocks.findIndex(b => b.id === id); if (i < 0) return null;
  if (!endsGroup(blocks[i].kind)) return index;
  let best = null;
  for (const [s, e] of topSegments(blocks)) for (const b of [s, e]) if (best === null || Math.abs(b - index) < Math.abs(best - index)) best = b;
  return best;
}
(SB.shared ||= {}).outline = { CLOSERS, endsGroup, outlineTree, pointNumbers, depths, groupRange, topSegments, segments, insideGroup, canInsert, canSwitch, moveRange, moveStep, snapDrop };
})(globalThis.SB ||= {});
