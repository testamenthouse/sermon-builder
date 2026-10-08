import { html } from '../lib/html.js';
import { toggleDrawer } from '../store.js';
import { I } from './Icons.js';

// Narrow screens only (styles.css hides both above 760px): the rail is a drawer over the single column.
// A fixed top-left pair — back, and the list button that opens the drawer; the scrim behind the open drawer closes it.
export function MobileTop({ onBack }) {
  return html`<div className="mtop">
    <button className="ib" onClick=${onBack}><${I} name="arrow-left" /></button>
    <button className="ib" title="Outline" onClick=${() => toggleDrawer(true)}><${I} name="list" /></button>
  </div>`;
}
export function DrawerScrim() { return html`<div className="drawer-scrim" onClick=${() => toggleDrawer(false)} />`; }
