#!/usr/bin/env node
// Sermon Builder MCP server (stdio). Local Claude reads and writes the same folder the app has open:
// the app's watcher picks up every change live. Library path: $SERMON_LIBRARY, else the app's config.json.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { parseSermon, serializeSermon, normalizeMeta, slugify, newId, sermonWords, STATUSES, parseMeta } from '../shared/format.js';
import { illustrationMatches, illustrationUses } from '../shared/illustrations.js';
import { KINDS, isKind } from '../shared/blocks.js';
import { seedTemplates, TEMPLATES_DIR } from '../shared/templates.js';
import { lookup, search, passageText, BOOKS, bookIndex } from '../shared/bible.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const bible = JSON.parse(fs.readFileSync(path.join(here, '..', 'data', 'kjv', 'kjv.json'), 'utf8'));
const CONFIG = path.join(os.homedir(), 'Library', 'Application Support', 'Sermon Builder', 'config.json');
const KIND_LIST = KINDS.map(k => k.kind);

function libraryPath() {
  if (process.env.SERMON_LIBRARY) return path.resolve(process.env.SERMON_LIBRARY);
  try { const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); if (cfg.library) return cfg.library; } catch (e) {}
  return null;
}
function lib() { const p = libraryPath(); if (!p || !fs.existsSync(p)) throw new Error('No library open. Open a folder in Sermon Builder first (or set SERMON_LIBRARY).'); return p; }
function abs(rel) { const root = lib(), a = path.resolve(root, rel); if (a !== root && !a.startsWith(root + path.sep)) throw new Error('Path outside library'); return a; }
const rel = (root, a) => path.relative(root, a).split(path.sep).join('/');
const isTpl = d => d.toLowerCase() === 'templates', isIll = d => d.toLowerCase() === 'illustrations';
async function atomicWrite(a, text) { await fsp.mkdir(path.dirname(a), { recursive: true }); const tmp = a + '.tmp-mcp'; await fsp.writeFile(tmp, text, 'utf8'); await fsp.rename(tmp, a); }

// A library without a Templates/ folder gets the starter templates written once; after that the folder is the only source.
async function seedIfMissing(root) {
  if (fs.existsSync(path.join(root, TEMPLATES_DIR))) return;
  for (const t of seedTemplates()) await atomicWrite(path.join(root, t.path), t.text);
}
async function readAll() {
  const root = lib(), sermons = [], illustrations = [], collections = new Set();
  await seedIfMissing(root);
  for (const e of await fsp.readdir(root, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) {
      if (!isTpl(e.name) && !isIll(e.name)) collections.add(e.name);
      for (const f of await fsp.readdir(path.join(root, e.name), { withFileTypes: true })) {
        if (!f.isFile() || !/\.md$/i.test(f.name) || f.name.startsWith('.')) continue;
        const p = e.name + '/' + f.name, text = await fsp.readFile(path.join(root, p), 'utf8');
        if (isIll(e.name)) illustrations.push(illustration(p, text)); else sermons.push(sermon(p, text));
      }
    } else if (e.isFile() && /\.md$/i.test(e.name)) sermons.push(sermon(e.name, await fsp.readFile(path.join(root, e.name), 'utf8')));
  }
  return { root, sermons, illustrations, collections: [...collections].sort() };
}
function sermon(p, text) {
  const s = parseSermon(text), dir = p.includes('/') ? p.slice(0, p.indexOf('/')) : '';
  if (!s.meta.title) s.meta.title = path.basename(p, '.md');
  if (isTpl(dir)) s.meta.template = true;
  return { path: p, dir, meta: s.meta, blocks: s.blocks };
}
function illustration(p, text) {
  let meta = {}, body = text.replace(/\r\n?/g, '\n'); const fm = /^---\n([\s\S]*?)\n---\n?/.exec(body); if (fm) { meta = parseMeta(fm[1]); body = body.slice(fm[0].length); }
  return { path: p, title: String(meta.title || path.basename(p, '.md')), tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [], source: String(meta.source || ''), body: body.trim() };
}
const summary = s => ({ path: s.path, title: s.meta.title, collection: s.meta.collection, date: s.meta.date, passage: s.meta.passage, status: s.meta.status, big_idea: s.meta.big_idea, tags: s.meta.tags, template: s.meta.template, words: sermonWords(s.blocks) });
const detail = s => ({ ...summary(s), blocks: s.blocks.map((b, i) => ({ index: i, kind: b.kind, label: b.label || '', heading: b.heading, body: b.body, flags: b.flags })) });
function cleanBlock(b) {
  const kind = isKind(b.kind) ? b.kind : 'custom';
  const heading = String(b.heading || '').trim(), flags = (b.flags || []).filter(f => f === 'hidden');
  let body = String(b.body || '').replace(/\r\n?/g, '\n').trim();
  if (kind === 'scripture' && heading && !body) { const r = lookup(bible, heading); if (r) body = passageText(r.verses); }
  if (kind === 'scripture' && heading) { const r = lookup(bible, heading); if (r) return { id: newId(), kind, heading: r.ref, body, flags }; }
  const label = kind === 'custom' ? (!isKind(b.kind) && b.kind ? String(b.kind).trim() : String(b.label || '').trim()) : '';
  return { id: newId(), kind, label, heading, body, flags };
}
async function uniquePath(root, dir, title, except) {
  const base = slugify(title); let name = base, n = 2;
  const exists = p => p !== except && fs.existsSync(path.join(root, p));
  while (exists((dir ? dir + '/' : '') + name + '.md')) name = base + ' ' + n++;
  return (dir ? dir + '/' : '') + name + '.md';
}
async function writeSermon(root, s) { await atomicWrite(path.join(root, s.path), serializeSermon(s)); return s.path; }
async function findSermon(p) { const { root } = await readAll(); const a = abs(p); if (!fs.existsSync(a)) throw new Error('Not found: ' + p); return { root, s: sermon(rel(root, a), await fsp.readFile(a, 'utf8')) }; }
const ok = v => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }] });
const fail = e => ({ isError: true, content: [{ type: 'text', text: String(e && e.message || e) }] });
const run = fn => async (args) => { try { return ok(await fn(args || {})); } catch (e) { return fail(e); } };

const blockSchema = z.object({ kind: z.string().describe('One of: ' + KIND_LIST.join(', ') + '. Any other word becomes a custom block labeled with it.'), label: z.string().optional().describe('custom only: the caption word(s), e.g. Announcement'), heading: z.string().optional().describe('Point/illustration title, scripture reference, quote source; headline for custom and other kinds'), body: z.string().optional().describe('Markdown. Scripture: leave empty to auto-fill KJV from the heading'), flags: z.array(z.enum(['hidden'])).optional() });
const metaSchema = { title: z.string().optional(), collection: z.string().optional(), date: z.string().optional().describe('YYYY-MM-DD'), passage: z.string().optional(), big_idea: z.string().optional(), status: z.enum(STATUSES).optional(), tags: z.array(z.string()).optional(), length: z.number().int().optional().describe('Target minutes'), template: z.boolean().optional().describe('true = a template: lives in Templates/ and is offered when creating sermons') };
const findTemplate = (sermons, key) => sermons.find(s => s.meta.template && (s.path === key || s.path === TEMPLATES_DIR + '/' + key || s.path === TEMPLATES_DIR + '/' + key + '.md' || s.meta.title.toLowerCase() === String(key).toLowerCase()));

const FORMAT_DOC = `# Sermon file format
One Markdown file per sermon in the library folder. Collection = subfolder; every sermon lives in one (old files may say "series:", read the same way). "Templates/" holds the templates (same format with "template: true", no collection or date; the app seeds the starter set once) and "Illustrations/" the illustration library.

---
title: The Good Shepherd
collection: Psalms
date: 2026-10-11
passage: Psalm 23
big_idea: God's care is personal, present and permanent.
status: draft            # draft | ready | done
tags: [comfort, trust]
length: 35               # target minutes
---

::: intro
Markdown body…
:::

::: point The Lord is my shepherd
Body. Points are auto-numbered and own every block after them up to the next point, transition, conclusion, prayer or invitation.
:::

::: scripture Psalm 23:1-3
1 The LORD is my shepherd; I shall not want.
2 He maketh me to lie down…
:::

::: quote C. H. Spurgeon
The quoted words.
:::

::: note {hidden}
Speaker note. {hidden} = not shown in Podium mode.
:::

::: custom Announcement | Potluck this Sunday
A custom block: the label is its caption, the part after " | " an optional headline. Any unknown kind word ("::: Me") becomes a custom block labeled with it (templates like Me·We·God·You·We rely on this).
:::

Kinds: ${KIND_LIST.join(', ')}. Heading meaning — point/illustration: title; scripture: reference (KJV text is one numbered verse per line); quote: source; custom: headline (its caption is the label); others: optional.`;

const server = new McpServer({ name: 'sermon-builder', version: '0.1.0' }, { instructions: 'Sermon Builder: build and edit sermons as block files in the preacher\'s library folder. Read sermon://format first. Scripture is KJV; prefer lookup_scripture over quoting from memory. Keep the preacher\'s voice; never delete sermons.' });

server.registerResource('format', 'sermon://format', { title: 'Sermon file format', description: 'How sermon files, blocks and kinds work', mimeType: 'text/markdown' }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: FORMAT_DOC }] }));

server.registerTool('library_overview', { title: 'Library overview', description: 'The open library: path, collections, every sermon (summary), the templates and the illustration count.', inputSchema: {} }, run(async () => {
  const { root, sermons, illustrations, collections } = await readAll();
  return { library: root, collections, sermons: sermons.filter(s => !s.meta.template).map(summary), templates: sermons.filter(s => s.meta.template).map(s => ({ path: s.path, title: s.meta.title })), illustrations: illustrations.length, kinds: KIND_LIST };
}));
server.registerTool('list_sermons', { title: 'List sermons', description: 'Sermon summaries, optionally filtered by collection, status or a text query.', inputSchema: { collection: z.string().optional(), status: z.enum(STATUSES).optional(), query: z.string().optional() } }, run(async ({ collection, status, query }) => {
  const { sermons } = await readAll(); const q = (query || '').toLowerCase();
  return sermons.filter(s => !s.meta.template && (!collection || s.meta.collection === collection) && (!status || s.meta.status === status) && (!q || [s.meta.title, s.meta.passage, s.meta.big_idea, ...s.meta.tags, ...s.blocks.map(b => b.heading + ' ' + b.body)].join(' ').toLowerCase().includes(q))).map(summary);
}));
server.registerTool('get_sermon', { title: 'Get sermon', description: 'Full sermon: meta and every block with its index.', inputSchema: { path: z.string().describe('Relative path from list_sermons, e.g. "Psalms/The Good Shepherd.md"') } }, run(async ({ path: p }) => detail((await findSermon(p)).s)));
server.registerTool('create_sermon', { title: 'Create sermon', description: 'Create a sermon file in a collection (required unless template: true). Blocks may be given directly, or start from a template in Templates/ (see list_templates). template: true creates a new template instead. Returns the new path.', inputSchema: { ...metaSchema, title: z.string(), from: z.string().optional().describe('A template to start from: its title or Templates/ path'), blocks: z.array(blockSchema).optional() } }, run(async ({ from, blocks, ...meta }) => {
  const { root, sermons } = await readAll();
  let list = [];
  if (blocks && blocks.length) list = blocks.map(cleanBlock);
  else if (from) { const t = findTemplate(sermons, from); if (!t) throw new Error('Template not found: ' + from); list = t.blocks.map(b => cleanBlock(b)); }
  const m = normalizeMeta(meta); if (m.template) { m.collection = ''; m.date = ''; }
  if (!m.template && !m.collection) throw new Error('collection is required: every sermon lives in one (see library_overview)');
  const dir = m.template ? TEMPLATES_DIR : m.collection ? slugify(m.collection) : '';
  const s = { path: await uniquePath(root, dir, m.title), dir, meta: m, blocks: list };
  await writeSermon(root, s); return { path: s.path, ...summary(s) };
}));
server.registerTool('update_sermon', { title: 'Update sermon', description: 'Change meta fields and/or replace the whole block list. A new title or collection moves the file, template: true moves it into Templates/; the returned path is authoritative.', inputSchema: { path: z.string(), meta: z.object(metaSchema).optional(), blocks: z.array(blockSchema).optional() } }, run(async ({ path: p, meta, blocks }) => {
  const { root, s } = await findSermon(p);
  const before = s.meta.collection;
  if (meta) s.meta = normalizeMeta({ ...s.meta, ...meta });
  if (s.meta.template) { s.meta.collection = ''; s.meta.date = ''; } else if (!s.meta.collection) s.meta.collection = before; // never out of a collection
  if (blocks) s.blocks = blocks.map(cleanBlock);
  const dir = s.meta.template ? TEMPLATES_DIR : (s.meta.collection ? slugify(s.meta.collection) : '');
  const target = await uniquePath(root, dir, s.meta.title, s.path);
  const moved = target !== s.path && !(path.dirname(target) === path.dirname(s.path) && path.basename(target, '.md') === path.basename(s.path, '.md'));
  const old = s.path; if (moved) s.path = target;
  await writeSermon(root, s); if (moved) await fsp.rm(path.join(root, old), { force: true });
  return detail(s);
}));
server.registerTool('edit_blocks', { title: 'Edit blocks', description: 'Apply ordered operations to a sermon\'s blocks by index: insert, replace, remove, move. Indexes refer to the list as it stands when each op runs.', inputSchema: { path: z.string(), ops: z.array(z.object({ op: z.enum(['insert', 'replace', 'remove', 'move']), index: z.number().int(), to: z.number().int().optional().describe('move: destination index'), block: blockSchema.optional() })) } }, run(async ({ path: p, ops }) => {
  const { root, s } = await findSermon(p);
  for (const o of ops) {
    const n = s.blocks.length;
    if (o.op === 'insert') { if (!o.block) throw new Error('insert needs block'); s.blocks.splice(Math.max(0, Math.min(o.index, n)), 0, cleanBlock(o.block)); }
    else if (o.index < 0 || o.index >= n) throw new Error('index out of range: ' + o.index);
    else if (o.op === 'replace') { if (!o.block) throw new Error('replace needs block'); const b = cleanBlock({ ...s.blocks[o.index], ...o.block }); s.blocks[o.index] = b; }
    else if (o.op === 'remove') s.blocks.splice(o.index, 1);
    else if (o.op === 'move') { const [b] = s.blocks.splice(o.index, 1); s.blocks.splice(Math.max(0, Math.min(o.to ?? 0, s.blocks.length)), 0, b); }
  }
  await writeSermon(root, s); return detail(s);
}));
server.registerTool('lookup_scripture', { title: 'Lookup scripture (KJV)', description: 'Verses for a reference like "John 3:16-18", "Psalm 23", "Rom 8:28, 31".', inputSchema: { reference: z.string() } }, run(async ({ reference }) => {
  const r = lookup(bible, reference); if (!r) throw new Error('Reference not found: ' + reference);
  return { reference: r.ref, version: 'KJV', verses: r.verses.map(v => ({ book: BOOKS[v.book].name, chapter: v.chapter, verse: v.verse, text: v.text })), text: passageText(r.verses) };
}));
server.registerTool('search_scripture', { title: 'Search scripture (KJV)', description: 'Find verses containing all the words (or a "quoted phrase"). Optional book filter.', inputSchema: { query: z.string(), book: z.string().optional(), limit: z.number().int().optional() } }, run(async ({ query, book, limit }) => {
  let books = null; if (book) { const i = bookIndex(book); if (i < 0) throw new Error('Unknown book: ' + book); books = i; }
  return search(bible, query, { books, limit: limit || 50 }).map(h => ({ reference: h.ref, text: h.text }));
}));
server.registerTool('list_templates', { title: 'List templates', description: 'The library\'s templates (Templates/*.md) with their block outlines. Pass a title or path as `from` to create_sermon.', inputSchema: {} }, run(async () => {
  const { sermons } = await readAll();
  return sermons.filter(s => s.meta.template).map(s => ({ path: s.path, title: s.meta.title, passage: s.meta.passage, tags: s.meta.tags, outline: s.blocks.map(b => b.kind + (b.heading ? ' ' + b.heading : '')) }));
}));
server.registerTool('list_illustrations', { title: 'List illustrations', description: 'The illustration library (Illustrations/*.md), optionally filtered; used_in lists the sermons whose illustration blocks carry each title.', inputSchema: { query: z.string().optional() } }, run(async ({ query }) => {
  const { illustrations, sermons } = await readAll();
  return illustrations.filter(i => illustrationMatches(i, query)).map(i => ({ ...i, used_in: illustrationUses(i, sermons).map(s => ({ path: s.path, title: s.meta.title })) }));
}));
server.registerTool('create_illustration', { title: 'Create illustration', description: 'Add an illustration to the library.', inputSchema: { title: z.string(), body: z.string(), tags: z.array(z.string()).optional(), source: z.string().optional() } }, run(async ({ title, body, tags = [], source = '' }) => {
  const root = lib(), p = await uniquePath(root, 'Illustrations', title);
  const lines = ['---', 'title: ' + title]; if (tags.length) lines.push('tags: [' + tags.join(', ') + ']'); if (source) lines.push('source: ' + source); lines.push('---', '', body.trim(), '');
  await atomicWrite(path.join(root, p), lines.join('\n')); return { path: p };
}));

server.registerPrompt('build_sermon', { title: 'Build a sermon', description: 'Draft a complete sermon from a passage or topic into the library', argsSchema: { passage: z.string().describe('Passage or topic'), title: z.string().optional(), collection: z.string().optional(), minutes: z.string().optional() } }, ({ passage, title, collection, minutes: mins }) => ({
  messages: [{ role: 'user', content: { type: 'text', text: `Read sermon://format, then build a sermon on ${passage}${title ? ' titled "' + title + '"' : ''}${collection ? ' in the collection "' + collection + '"' : ''}${mins ? ' of about ' + mins + ' minutes' : ''}. Use lookup_scripture for every quoted verse (KJV). Structure it with intro, numbered points each with scripture, illustration and application, transitions, conclusion and invitation. Write a one-sentence big_idea. Create it with create_sermon and report the path.` } }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
