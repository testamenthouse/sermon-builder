// Node entry for the app libraries the tests cover (classic scripts, see shared/node.js). DOM-free at load time.
import '../../../shared/node.js';
import '../i18n/es.js';
import './i18n.js';
import './md.js';
import './pdf.js';
import './verses.js';
import './dictation.js';
export const { i18n, md, pdf, verses, dictation } = globalThis.SB.lib;
