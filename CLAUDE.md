# Sermon Builder

A personal sermon-writing Mac app. Read `SPEC.md` (the spec) and `DESIGN-NOTES.md` (decisions) before changing anything; update both with every change.

- React through `htm` templates in `app/` (no build: `index.html` at the root runs the source as ES modules, React vendored in `vendor/`), pure shared modules in `shared/`, Electron in `desktop/`, MCP server in `mcp/`, tests in `tests/` (`npm test`).
- Never `git commit`. `npm run dev` serves the folder on :5188; run the Mac app with `cd desktop && env -u ELECTRON_RUN_AS_NODE npm start`.
- Design rules are Writer's: tokens only, Inter chrome, no helper text, no emoji, no browser dialogs, every delete confirms, folder is the only truth. No receipt printing (that is Writer's alone).
- The file format in `shared/format.js` is a contract (MCP, app and plain text editors all read it); keep round-trip exactness and the tests green.
