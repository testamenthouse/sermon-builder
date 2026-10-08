import { html } from '../lib/html.js';
import { useStore, pickFolder, resumeFolder } from '../store.js';
export function Gate() {
  const { resumable, gateStatus } = useStore(s => ({ resumable: s.resumable, gateStatus: s.gateStatus }));
  return html`<div className="gate">
    <h1>Sermon Builder</h1>
    ${resumable ? html`<><button className="pb" onClick=${resumeFolder}>Resume</button><button className="tb" onClick=${pickFolder}>Open folder</button></>` : html`<button className="pb" onClick=${pickFolder}>Open folder</button>`}
    <div className="status">${gateStatus}</div>
  </div>`;
}
// The web build outside Google Chrome: nothing else renders.
export function Blocked() {
  return html`<div className="gate">
    <h1>Sermon Builder</h1>
    <a className="pb" href="https://www.google.com/chrome/">Get Google Chrome</a>
    <div className="status">Google Chrome required</div>
  </div>`;
}
