// Node entry for the shared code. The files are classic scripts (so the page opens from a double-clicked index.html with
// no server); this loads them in dependency order, the same order index.html uses, and exports their namespaces.
import './books.js';
import './bible.js';
import './blocks.js';
import './format.js';
import './illustrations.js';
import './outline.js';
import './templates.js';
import './library.js';
import '../data/kjv/kjv.js';
export const { books, bible, blocks, format, illustrations, outline, templates, library } = globalThis.SB.shared;
export const kjv = globalThis.SB.kjv;
