(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { createRoot } = ReactDOM;
const { App } = SB.app;
createRoot(document.getElementById('root')).render(html`<${App} />`);
})(globalThis.SB ||= {});
