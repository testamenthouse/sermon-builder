# Sermon Builder — MCP server

Local Claude (Claude Code or Claude Desktop) builds sermons straight into the library folder the app has open. The app watches the folder, so every tool call shows up live.

```sh
claude mcp add sermon-builder -- node /path/to/sermon-builder/mcp/server.js
```

Settings → Claude → **Copy** in the app puts that exact command on the clipboard (the packaged app points at its bundled copy of the server).

The library path comes from `$SERMON_LIBRARY`, else `~/Library/Application Support/Sermon Builder/config.json` (written by the app when a folder is opened).

Tools: `library_overview`, `list_sermons`, `get_sermon`, `create_sermon` (`from` = a template title or `Templates/` path; `template: true` makes a template), `update_sermon` (`template: true` moves a sermon into `Templates/`), `edit_blocks`, `lookup_scripture`, `search_scripture`, `list_templates` (the library's `Templates/` files with outlines), `list_illustrations`, `create_illustration`. Resource `sermon://format` documents the file format. Prompt `build_sermon` drafts a whole sermon from a passage.

A library without a `Templates/` folder is seeded with the starter templates on first read, the same way the app does it.

Nothing here deletes a sermon.
