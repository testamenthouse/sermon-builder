// The page is classic scripts loaded in order from index.html (no modules, so a double-clicked file works). Each script
// may only read SB namespaces that an earlier script defined, and the Node loaders must list the same order.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const scripts = [...read('index.html').matchAll(/<script src="\.\/([^"]+)"><\/script>/g)].map(m => m[1]);
const defOf = src => { const m = src.match(/^\(?(?:SB\.(\w+) \|\|= \{\}\)\.(\w+)|SB\.(\w+)) = \{/m); return m ? (m[1] ? `${m[1]}.${m[2]}` : m[3]) : null; };
const refsOf = src => new Set([...src.matchAll(/\bSB\.(shared|lib|ui)\.(\w+)|\bSB\.(fs|fsa|store|app|kjv)\b/g)].map(m => m[3] || `${m[1]}.${m[2]}`));

test('index.html loads every script after the ones it reads from', () => {
  assert.ok(scripts.length > 30);
  const defined = new Set(['React', 'ReactDOM', 'htm']);
  for (const p of scripts) {
    const src = read(p);
    if (p.startsWith('vendor/')) continue;
    const def = p === 'data/kjv/kjv.js' ? 'kjv' : defOf(src);
    for (const r of refsOf(src)) if (r !== def) assert.ok(defined.has(r), `${p} reads SB.${r} before it is defined`);
    if (def) defined.add(def);
  }
  assert.equal(scripts.at(-1), 'app/src/main.js');
});

test('the Node loaders follow the same order as index.html', () => {
  for (const [loader, dir] of [['shared/node.js', 'shared/'], ['app/src/lib/node.js', 'app/src/lib/']]) {
    const listed = [...read(loader).matchAll(/^import '\.\/([^']+)';/gm)].map(m => dir + m[1]);
    const page = scripts.filter(p => listed.includes(p));
    assert.deepEqual(listed, page, loader);
  }
});

test('every page script is a classic script, not a module', () => {
  for (const p of scripts) if (!p.startsWith('vendor/')) assert.ok(!/^(import|export)\b/m.test(read(p)), p + ' uses module syntax');
});
