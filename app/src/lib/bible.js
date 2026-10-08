// The bundled KJV (data/kjv/kjv.js, a classic script that sets SB.kjv before this file loads). loadBible() stays a promise
// for the callers that await it; nothing is fetched.
(function (SB) {
'use strict';
const B = SB.shared.bible;
const data = SB.kjv;
function loadBible() { return data ? Promise.resolve(data) : Promise.reject(new Error('KJV not loaded')); }
const bible = () => data;
function lookupNow(ref) { return data ? B.lookup(data, ref) : null; }
(SB.lib ||= {}).bible = { ...SB.shared.bible, loadBible, bible, lookupNow };
})(globalThis.SB ||= {});
