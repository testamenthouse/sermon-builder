import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const lib = path.resolve('tests/.tmp/lib-' + process.pid);
fs.rmSync(lib, { recursive: true, force: true }); fs.mkdirSync(lib, { recursive: true });

test('mcp end to end', async () => {
  const client = new Client({ name: 't', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['mcp/server.js'], env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('NODE_TEST'))), SERMON_LIBRARY: lib }, stderr: 'pipe' }));
  const call = async (name, args) => { const r = await client.callTool({ name, arguments: args }); assert.ok(!r.isError, r.content[0].text); return JSON.parse(r.content[0].text); };
  try {
  const tools = (await client.listTools()).tools.map(t => t.name);
  assert.ok(tools.includes('create_sermon') && tools.includes('lookup_scripture'));
  const ov = await call('library_overview', {}); assert.equal(ov.sermons.length, 0);
  const bad = await client.callTool({ name: 'create_sermon', arguments: { title: 'Nowhere' } }); assert.ok(bad.isError && /collection/.test(bad.content[0].text)); assert.equal(ov.templates.length, 13); assert.ok(fs.existsSync(path.join(lib, 'Templates', 'Three Point.md')));
  const tpls = await call('list_templates', {}); assert.ok(tpls.some(t => t.title === 'Three Point' && t.outline[0] === 'intro'));
  const s = await call('create_sermon', { title: 'Test: Grace', collection: 'Romans', date: '2026-10-11', passage: 'Romans 5', from: 'Three Point' });
  assert.equal(s.path, 'Romans/Test- Grace.md');
  const got = await call('get_sermon', { path: s.path }); assert.equal(got.blocks[0].kind, 'intro'); assert.equal(got.blocks.length, 18);
  const ed = await call('edit_blocks', { path: s.path, ops: [{ op: 'replace', index: 1, block: { kind: 'scripture', heading: 'rom 5:1-2' } }, { op: 'insert', index: 0, block: { kind: 'Me', body: 'hello' } }] });
  assert.equal(ed.blocks[0].kind, 'custom'); assert.equal(ed.blocks[0].label, 'Me'); assert.equal(ed.blocks[0].heading, ''); assert.equal(ed.blocks[2].heading, 'Romans 5:1–2'); assert.match(ed.blocks[2].body, /^1 Therefore being justified by faith/);
  const up = await call('update_sermon', { path: s.path, meta: { title: 'Grace Alone', status: 'ready' } });
  assert.equal(up.path, 'Romans/Grace Alone.md'); assert.ok(fs.existsSync(path.join(lib, up.path))); assert.ok(!fs.existsSync(path.join(lib, s.path)));
  const text = fs.readFileSync(path.join(lib, up.path), 'utf8'); assert.match(text, /^---\ntitle: Grace Alone\ncollection: Romans/);
  const v = await call('lookup_scripture', { reference: 'Jn 3:16' }); assert.equal(v.reference, 'John 3:16');
  const h = await call('search_scripture', { query: 'faith hope charity', book: '1 Cor' }); assert.ok(h.some(x => x.reference === '1 Corinthians 13:13'));
  const ill = await call('create_illustration', { title: 'Lost sheep', body: 'A shepherd…', tags: ['care'] }); assert.equal(ill.path, 'Illustrations/Lost sheep.md');
  assert.equal((await call('list_illustrations', { query: 'care' })).length, 1);
  const tpl = await call('create_sermon', { title: 'My Shape', template: true, blocks: [{ kind: 'intro' }, { kind: 'point' }] }); assert.equal(tpl.path, 'Templates/My Shape.md'); assert.equal(tpl.template, true);
  assert.equal((await call('library_overview', {})).templates.length, 14);
  const res = await client.readResource({ uri: 'sermon://format' }); assert.match(res.contents[0].text, /::: point/);
  } finally { await client.close(); fs.rmSync(lib, { recursive: true, force: true }); }
});
