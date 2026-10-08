# Sermon Builder

A personal sermon-writing app for Google Chrome. Read `SPEC.md` (the spec) before changing anything and update it with every change.

- React through `htm` templates in `app/` (no build, no modules: `index.html` at the root loads classic scripts in order over the global `SB`, React vendored in `vendor/`), pure shared code in `shared/`, tests in `tests/` (`npm test`). No desktop app: it was removed 2026-10-08, never bring Electron back.
- Never `git commit`. `npm run dev` serves the folder on :5188, or double-click `index.html`.
- Design rules are Writer's: tokens only, Inter chrome, no helper text, no emoji, no browser dialogs, every delete confirms, folder is the only truth. No receipt printing (that is Writer's alone).
- The file format in `shared/format.js` is a contract (the app and plain text editors both read it); keep round-trip exactness and the tests green.
