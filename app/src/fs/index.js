(function (SB) {
'use strict';
const { fsa } = SB.fsa;
const fs = fsa;
if (typeof window !== 'undefined') window.__sb = Object.assign(window.__sb || {}, { fs, setLibrary: h => fsa.__setLibrary(h) });
SB.fs = { fs };
})(globalThis.SB ||= {});
