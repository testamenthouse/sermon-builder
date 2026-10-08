// Copies the unbuilt app (index.html, app/, shared/, vendor/, the KJV) into desktop/app with the production CSP, and
// stages the MCP server + shared code + KJV into desktop/bundle so a packaged app can run the MCP server from
// Contents/Resources/bundle without the repo.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..'), desk = path.resolve(__dirname, '..'), bundle = path.join(desk, 'bundle');
const appDir = path.join(desk, 'app');
fs.rmSync(appDir, { recursive: true, force: true });
for (const d of ['app', 'shared', 'vendor', 'data/kjv']) fs.cpSync(path.join(root, d), path.join(appDir, d), { recursive: true });
// The page gets a strict CSP (the shell serves it from app://sermon); every script is a file, so no inline script is allowed.
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const CSP = `default-src 'self' app:; script-src 'self' app:; style-src 'self' 'unsafe-inline' app:; font-src 'self' app:; img-src 'self' data: blob: app:; connect-src 'self' app:; frame-src 'self' about: blob: app:`;
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + CSP + '">');
fs.writeFileSync(path.join(appDir, 'index.html'), html);
fs.rmSync(bundle, { recursive: true, force: true });
for (const d of ['mcp', 'shared', 'data/kjv']) fs.cpSync(path.join(root, d), path.join(bundle, d), { recursive: true });
fs.writeFileSync(path.join(bundle, 'package.json'), JSON.stringify({ name: 'sermon-builder-mcp', private: true, type: 'module', dependencies: { '@modelcontextprotocol/sdk': '^1.12.0', zod: '^3.24.0' } }, null, 2));
execSync('npm install --omit=dev --no-audit --no-fund --ignore-scripts', { cwd: bundle, stdio: 'inherit' });
execSync('node scripts/build-dictate.js', { cwd: desk, stdio: 'inherit' });
console.log('synced app (unbuilt) + bundle + dictate');
