// Fetches the browser (UMD) builds of React 18, ReactDOM and htm from unpkg into vendor/ as classic scripts that set the
// globals React, ReactDOM and htm, so the page runs from a double-clicked index.html with no bundler and no network.
// Re-run to change a version; the versions are pinned here.
import fs from 'node:fs';
import path from 'node:path';
const out = path.resolve(import.meta.dirname, '..', 'vendor');
const FILES = {
  'react.js': 'react@18.3.1/umd/react.production.min.js',
  'react-dom.js': 'react-dom@18.3.1/umd/react-dom.production.min.js',
  'htm.js': 'htm@3.1.1/dist/htm.umd.js'
};
fs.mkdirSync(out, { recursive: true });
for (const [name, spec] of Object.entries(FILES)) {
  const r = await fetch('https://unpkg.com/' + spec); if (!r.ok) throw new Error(spec + ': ' + r.status);
  const js = await r.text();
  fs.writeFileSync(path.join(out, name), '// ' + spec + ' (unpkg), fetched by scripts/vendor.js\n' + js);
  console.log(name, js.length);
}
