# Sermon Builder

A minimalist, offline sermon editor for the Mac (and Chrome). You write a sermon as a stack of typed blocks, the King James Bible fills in scripture as you type a reference, Podium mode puts the sermon on screen while you preach, and the whole library is a plain folder of Markdown files you own.

No accounts, no server, no analytics. Everything stays on your machine.

- [What it does](#what-it-does)
- [Get it](#get-it)
- [Your library is a folder](#your-library-is-a-folder)
- [Writing a sermon](#writing-a-sermon)
- [Preaching from it](#preaching-from-it)
- [Printing and exporting](#printing-and-exporting)
- [Dictation](#dictation)
- [Working with Claude](#working-with-claude)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Building the desktop app](#building-the-desktop-app)
- [Running the web version](#running-the-web-version)
- [Repository layout](#repository-layout)

## What it does

- **Blocks, not a blank page.** A sermon is an ordered list of blocks: introduction, point, scripture, illustration, application, quote, transition, conclusion, prayer, invitation, question, note, and custom. Points auto-number and group the blocks beneath them.
- **KJV built in.** Type `John 3:16-18` in a scripture block and the verses appear. A Bible pane does reference lookup, keyword search, and insert or copy.
- **Illustrations library.** Keep stories, tagged and sourced, in one place and drop them into any sermon. The library shows where each one has been used.
- **Podium mode.** Fullscreen, one block at a time, a countdown clock set to your target length, your notes on or off, and an outline to jump around.
- **Print and export.** Manuscript, outline, or handout on Letter paper. Markdown and Word downloads. A verse-list PDF for the media team.
- **Templates.** A starter set of sermon shapes (Three Point, Verse by Verse, Topical, Funeral, Wedding, and more). Edit them, add your own, or save any sermon as one.
- **Dictation.** Speak into any block. On the Mac the speech recognition runs on-device through Apple's own recognizer.
- **Calendar.** See your preaching dates by month and drag a sermon to a different day.
- **Claude.** Point Claude Code or Claude Desktop at the same folder and it can draft, read, and edit sermons live in the app.

## Get it

**Mac app (Apple Silicon).** Download the latest `.dmg` from [Releases](../../releases), open it, and drag Sermon Builder to Applications. The app checks for updates on launch and installs them on quit.

**Web version.** Serve this folder with any static server and open it in Google Chrome (see [Running the web version](#running-the-web-version)). Chrome is required because the app opens a folder on your disk through the File System Access API. Other browsers show a "Google Chrome required" screen.

Phones and tablets can read a library over the web version when the layout collapses to one column, but they cannot open a folder. Writing happens on a desktop.

## Your library is a folder

The first time you open the app it asks for a folder. That folder is your library. The app reads and writes the files in it directly and caches nothing, so you can keep it in iCloud Drive or Dropbox, open it in another editor, or back it up like any other folder.

```
My Sermons/
  sermon.json                  settings (font, colors, theme)
  Psalms/                      a collection
    collection.json            { "color": "#rrggbb" }
    The Good Shepherd.md       a sermon
  Advent 2026/
    ...
  Templates/                   sermon templates (reserved)
    Three Point.md
  Illustrations/               illustration library (reserved)
    The lost lamb.md
```

- Every sermon lives in a collection, which is just a subfolder with an optional color.
- A sermon is one Markdown file. Rename the sermon and the file renames. Move it to another collection and the file moves.
- `Templates/` and `Illustrations/` are reserved. The starter templates are written once into a library that has none, and after that they are yours.
- `Log out` in Settings is the only thing that makes the app forget the folder.

Open `samples/Library` to see a small library with a sermon, a template, and an illustration.

### The sermon file

```markdown
---
title: The Good Shepherd
collection: Psalms
date: 2026-10-11
passage: Psalm 23
big_idea: God's care is personal, present and permanent.
status: ready            # draft | ready | done
tags: [comfort, trust]
length: 35               # target minutes for the Podium clock
---

::: intro
Markdown works here. **bold**, *italic*, > quotes, - lists.
:::

::: point The Lord is my shepherd
Points auto-number. Add {hidden} to keep a block out of Podium.
:::

::: scripture Psalm 23:1-3
1 The LORD is my shepherd; I shall not want.
2 He maketh me to lie down in green pastures: he leadeth me beside the still waters.
3 He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake.
:::

::: quote C. H. Spurgeon
The heading of a quote is its source.
:::
```

Each block is a `::: kind Heading` fence. Scripture bodies are written out in full, so the file stands on its own without the app. The full format, including every rule the parser follows, is in [SPEC.md](SPEC.md#file-format).

## Writing a sermon

1. **New collection** with `+` in the library, then **New sermon** from the collection's own `+`. Pick a template or start blank. Nothing is created until you give it a name.
2. **Add blocks** with the `+` that appears between blocks, or type `/` on an empty block to pick a kind. The outline on the left tracks every block. Drag rows to reorder, or use the block's `…` menu.
3. **Scripture.** Type a reference in a scripture block's heading and press Enter. The KJV text fills in. Change the reference and the text refills.
4. **Bible pane** (`⌘B`) for lookup and keyword search. Click verses to select a range, then Insert or Copy.
5. **Illustrations pane** (`⌘I`) to search your library and insert one. Any illustration block can be saved back to the library.
6. **Everything autosaves** less than a second after you stop typing. `⌘S` forces it. The status line shows `Saved h:mm`.

The sermon settings (gear) hold the collection, date, passage, status, tags, and target length. `Save as template` and `Delete sermon` are there too.

## Preaching from it

Press `⌘⇧P` or the podium icon. Podium mode goes fullscreen with one block on stage and the neighbors dimmed above and below.

- `Space`, `→`, or `↓` for the next block. `←` or `↑` to go back.
- The clock top-left counts down from the sermon's target length. Click it to flip between elapsed and remaining.
- `n` toggles your notes. `o` opens an outline overview so you can jump to any block.
- Scripture references typed in prose are tappable and show the KJV text in a popover.
- Blocks marked hidden never appear.
- `Esc` leaves.

## Printing and exporting

`⌘P` opens the print dialog with three layouts on Letter paper, each with optional page numbers:

- **Manuscript**: the full text with a label column on the left.
- **Outline**: headings and first lines only, grouped by point.
- **Handout**: numbered points, their scripture references, and a questions list with answer lines.

The download menu offers the sermon as **Markdown**, as a **Word** document, and as a **Verse list PDF** that lists every scripture reference in order for whoever runs the screens.

## Dictation

Click the mic in the sermon tools or press `⌘⇧D`. Words land at the caret, in whatever block it is in, and follow the caret if you move it. A bar at the bottom shows the words still forming, and a solid Stop button sits bottom right.

Speak punctuation the way macOS Dictation expects: `period`, `comma`, `question mark`, `open quote`, `new paragraph`, and so on.

- **Mac app:** recognition runs on-device through Apple's Speech framework. The first use asks for microphone and speech recognition permission. macOS Dictation must be turned on in System Settings → Keyboard → Dictation.
- **Web version:** uses Chrome's speech engine. Other browsers cannot dictate.

## Working with Claude

The repo ships an [MCP server](mcp/README.md) that works on the same folder the app has open. Claude can list and read sermons, create and edit them block by block, look up and search the KJV, and use your illustration library. The app watches the folder, so every change shows up live. Nothing in the server can delete a sermon.

Settings → Claude → **Copy** puts the exact command on your clipboard. For a checkout of this repo:

```sh
claude mcp add sermon-builder -- node /path/to/sermon-builder/mcp/server.js
```

The server finds the library through `$SERMON_LIBRARY`, or through the path the app saved when you opened a folder.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `⌘S` | Save now |
| `⌘F` | Find across all blocks (Enter / Shift+Enter to step) |
| `⌘B` | Bible pane |
| `⌘I` | Illustrations pane |
| `⌘⇧D` | Start or stop dictation |
| `⌘P` | Print |
| `⌘⇧P` | Podium mode |
| `⌘Enter` | New block below |
| `⌘D` | Duplicate block |
| `⌥⌘↑` / `⌥⌘↓` | Move block up or down |
| `/` on an empty block | Choose the block kind |
| `Enter` in a scripture heading | Fill in the KJV text |
| `Esc` | Close pane, dialog, find, or Podium |

## Building the desktop app

The Mac app is an [Electron](https://www.electronjs.org/) shell around the web app, built with electron-builder. It targets Apple Silicon only.

**You need**

- Node.js 22
- Xcode command line tools (`xcode-select --install`) for the Swift dictation helper
- For a signed, notarized release: a Developer ID certificate and an Apple ID app-specific password

**Run it locally**

```sh
git clone https://github.com/testamenthouse/sermon-builder.git
cd sermon-builder
npm install
cd desktop && npm install
env -u ELECTRON_RUN_AS_NODE npm start
```

`npm start` first runs `npm run sync`, which copies the web app into `desktop/app`, bundles the MCP server and KJV so the packaged app can hand Claude a server that exists outside the repo, and compiles `dictate/dictate.swift` into `bin/dictate`.

**Build an installer**

```sh
cd desktop
npm run dist
```

This writes `Sermon Builder-<version>-mac-arm64.dmg` and a matching `.zip` into `desktop/dist`. The zip is what the auto-updater needs.

**Publish a release**

Bump `version` in `desktop/package.json`, then push a tag:

```sh
git tag v0.2.0
git push origin v0.2.0
```

The [release workflow](.github/workflows/release.yml) runs the tests, builds on macOS, signs and notarizes, and uploads the DMG and zip to a GitHub release. It needs these repository secrets: `MAC_CERT_P12_BASE64`, `MAC_CERT_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Running `npm run release` locally does the same with the same variables in your environment.

Installed apps check GitHub Releases on launch and every hour, download quietly, and install on quit. The app menu offers **Restart to Update** when one is ready.

**Troubleshooting**

- *Electron starts as plain Node, or nothing opens.* VS Code terminals set `ELECTRON_RUN_AS_NODE=1`. Unset it, as in the commands above.
- *npm reports blocked install scripts.* Run `npm approve-scripts esbuild` in the repo root and `npm approve-scripts electron electron-builder` in `desktop/`, then `node node_modules/electron/install.js` in `desktop/`.
- *Dictation crashes or never prompts in a dev run.* The dev script already handles this (the helper disclaims the terminal as its responsible process). If macOS Dictation itself is off, the app tells you and opens the settings pane.
- *`npm run smoke`* runs a headless load check and exits. `DICTATE_BIN=<script> npm run smoke` drives the dictation bridge with a fake helper.

## Running the web version

There is no build step. The browser runs the source as plain ES modules, with React vendored in `vendor/`.

```sh
npm install
npm run dev        # serves this folder on http://localhost:5188
```

Open it in Google Chrome. Any static server over the repo folder works the same, including GitHub Pages on the repo root.

```sh
npm test           # file format round-trips, Bible lookup, outline, dictation, MCP end to end
npm run vendor     # refresh vendor/ from esm.sh after changing a version in scripts/vendor.js
npm run kjv        # rebuild data/kjv/kjv.json
```

## Repository layout

```
index.html      The app page. Serve the repo folder and it runs.
app/            The UI: React through htm tagged templates, no JSX, no build
shared/         Pure modules shared by the app, MCP server and tests (file format, Bible, outline, templates)
data/kjv/       The King James Bible, 66 books, 31,102 verses (public domain)
mcp/            MCP server for Claude
desktop/        Electron shell, electron-builder config, Swift dictation helper, update wiring
tests/          node --test
samples/        A small library to open on first run
vendor/         Browser builds of React and htm (generated, never edited by hand)
SPEC.md         The full behavior spec: every screen, rule and file-format detail
DESIGN-NOTES.md The design decision log
```

Scripture text is the King James Version, public domain.
