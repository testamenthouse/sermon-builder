(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { toggleDrawer } = SB.store;
const { I } = SB.ui.Icons;

// Narrow screens only (styles.css hides both above 760px): the rail is a drawer over the single column.
// A fixed top-left pair — back, and the list button that opens the drawer; the scrim behind the open drawer closes it.
function MobileTop({ onBack }) {
  return html`<div className="mtop">
    <button className="ib" onClick=${onBack}><${I} name="arrow-left" /></button>
    <button className="ib" title="Outline" onClick=${() => toggleDrawer(true)}><${I} name="list" /></button>
  </div>`;
}
function DrawerScrim() { return html`<div className="drawer-scrim" onClick=${() => toggleDrawer(false)} />`; }
(SB.ui ||= {}).Mobile = { MobileTop, DrawerScrim };
})(globalThis.SB ||= {});
