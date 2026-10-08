# Sermon Builder

A minimalist, offline sermon editor that runs in Google Chrome on a desktop or laptop. You write a sermon as a stack of typed blocks, the King James Bible fills in scripture as you type a reference, Podium mode puts the sermon on screen while you preach, and the whole library is a plain folder of Markdown files you own.

**Try it now, or use it forever, without downloading anything:** https://testamenthouse.github.io/sermon-builder/

Open that link in Google Chrome and pick a folder for your sermons. That is the full app, not a demo. Nothing is installed, and no data is shared with anyone: nothing is sent to a server, and the page never sees your files. Everything stays on your own computer, in the folder you chose.

**Or run it yourself, no technical knowledge needed:** download the folder and double-click `index.html`. That is the whole setup. There is nothing to install, no build step and no server, and your sermons never leave your machine.

1. Click the green **Code** button at the top of this page, then **Download ZIP**.
2. Unzip it anywhere you like.
3. Open the folder and double-click `index.html`. If it opens in another browser, right-click it and choose **Open With → Google Chrome**.
4. Click **Open folder** and pick where your sermons should live.

Chrome has everything the app needs, dictation included.

**Desktop only.** There is no phone or tablet version. A phone browser cannot open a folder on disk, which is the only place the app stores anything, so on an iPhone, iPad or Android device the page shows a "Desktop Google Chrome required" screen and nothing else.

**There is no database.** The only storage is the folder you choose. The whole app runs off that folder: every sermon, collection, template, illustration and setting is a file in it, read and written directly. No accounts, no server, no analytics. Everything stays on your machine.

- [What it does](#what-it-does)
- [Get it](#get-it)
- [Your library is a folder](#your-library-is-a-folder)
- [Writing a sermon](#writing-a-sermon)
- [Preaching from it](#preaching-from-it)
- [Printing and exporting](#printing-and-exporting)
- [Dictation](#dictation)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Running the web version](#running-the-web-version)
- [Repository layout](#repository-layout)

## What it does

- **Blocks, not a blank page.** A sermon is an ordered list of blocks: introduction, point, scripture, illustration, application, quote, transition, conclusion, prayer, invitation, question, note, and custom. Points auto-number and group the blocks beneath them.
- **KJV built in.** Type `John 3:16-18` in a scripture block and the verses appear. A Bible pane does reference lookup, keyword search, and insert or copy.
- **Illustrations library.** Keep stories, tagged and sourced, in one place and drop them into any sermon. The library shows where each one has been used.
- **Podium mode.** Fullscreen, one block at a time, a countdown clock set to your target length, your notes on or off, and an outline to jump around.
- **Print and export.** Manuscript, outline, or handout on Letter paper. Markdown and Word downloads. A verse-list PDF for the media team.
- **Templates.** A starter set of sermon shapes (Three Point, Verse by Verse, Topical, Funeral, Wedding, and more). Edit them, add your own, or save any sermon as one.
- **Dictation.** Speak into any block, through Chrome's speech engine.
- **Calendar.** See your preaching dates by month and drag a sermon to a different day.

## Get it

**Web version.** Open the app in Google Chrome:

https://testamenthouse.github.io/sermon-builder/

**Your own copy.** Download the ZIP and double-click `index.html`, as described at the top. Same app, no server.

Desktop Chrome is required because the app opens a folder on your disk through the File System Access API, which Chrome ships on Mac, Windows and Linux only. Other browsers, and every phone and tablet, show a "Desktop Google Chrome required" screen.

## Your library is a folder

The first time you open the app it asks for a folder. That folder is your library and the only place anything is stored. There is no database behind it, no copy in the cloud, and no hidden cache: the entire UI is built from the files in that folder each time it reads them, and every edit goes straight back to disk. Keep it in iCloud Drive or Dropbox, open it in another editor, or back it up like any other folder.

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
- A [Writer](https://github.com/testamenthouse/minimalist-writer) library is refused untouched. Pick one by mistake and the app links you to Writer instead of writing anything into it.

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

Dictation uses Chrome's speech engine. Other browsers cannot dictate.

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

## Running the web version

There is no build step. Double-click `index.html` and Chrome runs the source as it is: every file is a classic script, loaded in order by `index.html`, with React and htm vendored in `vendor/` and the King James Bible in `data/kjv/kjv.js`. A static server works too, and GitHub Pages serves this repo from its root, so the published web version is https://testamenthouse.github.io/sermon-builder/

```sh
npm run dev        # serves this folder on http://localhost:5188, if you prefer a server
```

Adding a file means adding its `<script>` tag to `index.html` after the files it reads from; `npm test` checks the order. The tests load the same files through `shared/node.js` and `app/src/lib/node.js`.

```sh
npm test           # file format round-trips, Bible lookup, outline, dictation, script order
npm run vendor     # refresh vendor/ from unpkg after changing a version in scripts/vendor.js
npm run kjv        # rebuild data/kjv/kjv.js
```

## Repository layout

```
index.html      The app page. Double-click it and it runs.
app/            The UI: React through htm tagged templates, no JSX, no build, no modules
shared/         Pure modules shared by the app and the tests (file format, Bible, outline, templates)
data/kjv/       The King James Bible, 66 books, 31,102 verses (public domain)
tests/          node --test
samples/        A small library to open on first run
vendor/         Browser builds of React and htm (generated, never edited by hand)
.github/        Test workflow, manual-only (nothing runs automatically)
SPEC.md         The full behavior spec: every screen, rule and file-format detail
```

## License

[GPL-3.0](LICENSE). Scripture text is the King James Version, public domain.
