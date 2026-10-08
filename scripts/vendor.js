// Fetches the browser ES-module builds of React, ReactDOM, scheduler and htm from esm.sh into vendor/ and points
// their imports at each other by relative path, so the app runs from the repo folder with no bundler and no
// network. Re-run to change a version; the versions are pinned here and mirrored by the import map in index.html.
import fs from 'node:fs';
import path from 'node:path';
const out = path.resolve(import.meta.dirname, '..', 'vendor');
const FILES = {
  'react.mjs': 'react@18.3.1/es2022/react.mjs',
  'react-dom.mjs': 'react-dom@18.3.1/es2022/react-dom.mjs',
  'client.mjs': 'react-dom@18.3.1/es2022/client.mjs',
  'scheduler.mjs': 'scheduler@0.23.2/es2022/scheduler.mjs',
  'htm.mjs': 'htm@3.1.1/es2022/htm.mjs'
};
fs.mkdirSync(out, { recursive: true });
for (const [name, spec] of Object.entries(FILES)) {
  const r = await fetch('https://esm.sh/' + spec); if (!r.ok) throw new Error(spec + ': ' + r.status);
  let js = await r.text();
  js = js.replace(/from"\/react@[^"]*\/react\.mjs"/g, 'from"./react.mjs"').replace(/from"\/scheduler@[^"]*"/g, 'from"./scheduler.mjs"');
  const left = js.match(/from"[^".][^"]*"/g); if (left) throw new Error(name + ' still imports ' + left.join(' '));
  fs.writeFileSync(path.join(out, name), '// ' + spec + ' (esm.sh), imports rewritten by scripts/vendor.js\n' + js);
  console.log(name, js.length);
}
