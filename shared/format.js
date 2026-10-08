// The sermon file: YAML-ish frontmatter + `::: kind Heading {flags}` fenced blocks, Markdown inside. Round-trips exactly.
import { isKind, FLAGS } from './blocks.js';

export const META_KEYS = ['title', 'collection', 'date', 'passage', 'big_idea', 'status', 'tags', 'length', 'template'];
export const STATUSES = ['draft', 'ready', 'done']; // 'preached' in old files reads as 'done'

let seq = 0;
export const newId = () => 'b' + Date.now().toString(36) + (seq++).toString(36);

function parseValue(raw) {
  const v = raw.trim();
  if (v === '') return '';
  if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  if (v === 'true') return true; if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return +v;
  return v.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
}
function fmtValue(v) {
  if (Array.isArray(v)) return '[' + v.map(s => /[,\[\]"]/.test(s) ? JSON.stringify(s) : s).join(', ') + ']';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  return /^[\s]|[\s]$|^[\[{"'#&*!|>%@`]|:\s|^(true|false|null|-?\d+(\.\d+)?)$/.test(s) || s.includes('\n') ? JSON.stringify(s) : s;
}

export function parseMeta(text) {
  const meta = {};
  for (const line of text.split('\n')) {
    const m = /^([A-Za-z_][\w-]*):\s?(.*)$/.exec(line); if (!m) continue;
    meta[m[1].replace(/-/g, '_')] = parseValue(m[2]);
  }
  return meta;
}

export function parseBlockHeader(line) {
  const m = /^:::\s*([a-z][a-z-]*)\s*(.*?)\s*$/i.exec(line); if (!m) return null;
  const raw = m[1]; let kind = raw.toLowerCase(), heading = m[2], flags = [];
  const f = /\s*\{([^}]*)\}$/.exec(heading);
  if (f) { flags = f[1].split(/\s+/).filter(Boolean); heading = heading.slice(0, f.index).trim(); }
  if (kind === 'subpoint') kind = 'point'; // sub-points were retired 2026-10-08: old files read them as points
  if (!isKind(kind)) { heading = (raw + (heading ? " " + heading : "")).trim(); kind = "custom"; }
  // custom: `::: custom Label | Headline` (or `::: Label | Headline`); the label is the caption, the headline optional
  let label = '';
  if (kind === 'custom') { const i = heading.indexOf(' | '); if (i >= 0) { label = heading.slice(0, i).trim(); heading = heading.slice(i + 3).trim(); } else if (heading.startsWith('| ')) heading = heading.slice(2).trim(); else { label = heading; heading = ''; } }
  return { kind, heading, flags, label };
}

// → { meta, blocks: [{ id, kind, heading, body, flags }] }
export function parseSermon(src) {
  const text = String(src || '').replace(/\r\n?/g, '\n');
  let meta = {}, rest = text;
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (fm) { meta = parseMeta(fm[1]); rest = text.slice(fm[0].length); }
  const blocks = []; let cur = null, loose = [];
  const flushLoose = () => { const body = loose.join('\n').trim(); if (body) blocks.push(mk('text', '', body, [])); loose = []; };
  for (const line of rest.split('\n')) {
    if (!cur) {
      const h = parseBlockHeader(line);
      if (h) { flushLoose(); cur = { ...h, lines: [] }; } else loose.push(line);
    } else if (/^:::\s*$/.test(line)) { blocks.push(mk(cur.kind, cur.heading, cur.lines.join('\n').trim(), cur.flags, cur.label)); cur = null; }
    else cur.lines.push(line);
  }
  if (cur) blocks.push(mk(cur.kind, cur.heading, cur.lines.join('\n').trim(), cur.flags, cur.label));
  flushLoose();
  return { meta: normalizeMeta(meta), blocks };
}
function mk(kind, heading, body, flags, label = '') { return { id: newId(), kind, heading, body, flags: [...new Set(flags)].filter(f => FLAGS.includes(f)), label: kind === 'custom' ? label : '' }; }

export function normalizeMeta(m) {
  const out = { title: String(m.title ?? '').trim(), collection: String(m.collection ?? m.series ?? '').trim(), date: String(m.date ?? '').trim(), passage: String(m.passage ?? '').trim(),
    big_idea: String(m.big_idea ?? m.bigIdea ?? '').trim(), status: m.status === 'preached' ? 'done' : STATUSES.includes(m.status) ? m.status : 'draft',
    tags: Array.isArray(m.tags) ? m.tags.map(String) : typeof m.tags === 'string' && m.tags ? m.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
    length: Number.isFinite(+m.length) && +m.length > 0 ? Math.round(+m.length) : 0, template: m.template === true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) out.date = '';
  for (const k of Object.keys(m)) if (!(k in out) && k !== 'bigIdea' && k !== 'series') out[k] = m[k];
  return out;
}

export function serializeSermon({ meta, blocks }) {
  const m = normalizeMeta(meta || {});
  const lines = ['---'];
  for (const k of META_KEYS) {
    const v = m[k];
    if (k === 'template') { if (v) lines.push('template: true'); continue; }
    if (k === 'tags') { if (v.length) lines.push('tags: ' + fmtValue(v)); continue; }
    if (k === 'length') { if (v) lines.push('length: ' + v); continue; }
    if (k === 'status') { lines.push('status: ' + v); continue; }
    if (v !== '' && v != null) lines.push(k + ': ' + fmtValue(v));
  }
  for (const k of Object.keys(m)) if (!META_KEYS.includes(k)) lines.push(k + ': ' + fmtValue(m[k]));
  lines.push('---', '');
  for (const b of blocks || []) {
    const flags = (b.flags || []).filter(Boolean);
    let head = '::: ' + b.kind;
    const heading = String(b.heading || '').trim(), label = b.kind === 'custom' ? String(b.label || '').trim() : '';
    if (label) head += ' ' + label;
    if (heading) head += (b.kind === 'custom' ? ' | ' : ' ') + heading;
    if (flags.length) head += ' {' + flags.join(' ') + '}';
    lines.push(head);
    const body = String(b.body || '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
    if (body) lines.push(body);
    lines.push(':::', '');
  }
  return lines.join('\n');
}

export function slugify(s) { return String(s || '').trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'Untitled'; }
export function countWords(t) { return ((t || '').replace(/^(#{1,3}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '').replace(/^\s*[-*]{3,}\s*$/gm, '').replace(/[*_~`]/g, '').match(/\S+/g) || []).length; }
// Spoken words: everything except notes (and hidden blocks). Scripture verse numbers are not spoken.
export function sermonWords(blocks, { spoken = true } = {}) {
  let n = 0;
  for (const b of blocks || []) {
    if (spoken && (b.kind === 'note' || (b.flags || []).includes('hidden'))) continue;
    const body = b.kind === 'scripture' ? (b.body || '').replace(/^\d+\s/gm, '') : b.body;
    n += countWords(body);
    if (b.kind !== 'scripture' && b.kind !== 'quote') n += countWords(b.heading);
  }
  return n;
}
