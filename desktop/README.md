# Sermon Builder — desktop

Electron shell around the unbuilt web app. `npm run sync` (run by every script) copies `../index.html`, `../app`, `../shared`, `../vendor` and `../data/kjv` into `./app` — adding the strict CSP, with the import map allowed by hash — and stages `mcp/`, `shared/`, `data/kjv` plus their two runtime dependencies into `./bundle`, which ships as `Contents/Resources/bundle` so the packaged app can hand Claude an MCP server path that exists without the repo.

- `npm start` — run locally (unset `ELECTRON_RUN_AS_NODE` in VS Code shells).
- `npm run smoke` — headless load check (prints `SMOKE {...}` and exits).
- `npm run dist` — DMG + zip for Apple Silicon in `dist/` (the zip is what electron-updater needs on macOS).
- `npm run release` — build and publish to the GitHub release for the current version (run from your Mac; the workflow in `.github/workflows` is manual-only).

The main process owns the library: native folder picker, path remembered in `userData/config.json` (`~/Library/Application Support/Sermon Builder/config.json`, which the MCP server also reads), `fs.watch` recursive → `lib:changed` to the renderer, atomic writes, every path checked to stay inside the library. The renderer is sandboxed with context isolation; `src/preload.js` exposes `window.sermon` with the same interface as the browser adapter.

Updates: electron-updater checks GitHub Releases on launch and hourly, downloads quietly, installs on quit; app menu offers Restart to Update. macOS needs a Developer ID-signed, notarized build (the environment variables are listed in the root README under "Publish a release").

Dictation: `npm run sync` also compiles `dictate/dictate.swift` (Speech.framework, on-device) into `bin/dictate` with `xcrun swiftc`; it ships as an extra resource and the page reaches it through `src/preload.js` (`window.dictate`). The first use prompts for the microphone and speech recognition. `DICTATE_BIN=<fake helper> npm run smoke` prints the relayed events.
