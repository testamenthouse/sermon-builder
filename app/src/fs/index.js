import { fsa } from './fsa.js';
// Electron's preload exposes window.sermon with the same interface; the browser falls back to the File System Access API.
export const fs = typeof window !== 'undefined' && window.sermon ? { kind: 'electron', supported: true, ...window.sermon } : fsa;
if (typeof window !== 'undefined') window.__sb = Object.assign(window.__sb || {}, { fs, setLibrary: h => fsa.__setLibrary(h) });
