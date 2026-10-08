import { html } from '../lib/html.js';
import { useEffect, useRef } from 'react';
import { useStore, set, setLibLayout, closeLibFind, newTemplate } from '../store.js';
import { Card, openIt } from './Library.js';
import { I } from './Icons.js';

// The Templates screen: every file in Templates/, the same thumbnails / list as the library. A template opens in the
// sermon editor (its ← comes back here); double-click → the Sermon modal (name, passage, tags, Delete template).
export function Templates() {
  const { sermons, libLayout, libQuery, libFindOpen, status } = useStore(s => ({ sermons: s.sermons, libLayout: s.libLayout, libQuery: s.libQuery, libFindOpen: s.libFindOpen, status: s.status }));
  const findRef = useRef(null); const findOpen = libFindOpen || !!libQuery;
  useEffect(() => { if (libFindOpen && findRef.current) findRef.current.focus(); }, [libFindOpen]);
  const q = libQuery.trim().toLowerCase();
  const all = sermons.filter(s => s.meta.template).sort((a, b) => a.meta.title.localeCompare(b.meta.title));
  const list = all.filter(s => !q || [s.meta.title, s.meta.passage, ...s.meta.tags].join(' ').toLowerCase().includes(q));
  const listMode = libLayout === 'list';
  const back = () => { closeLibFind(); set({ screen: 'library' }); };
  return html`<div className="lib">
    <div className="lib-top">
      <button className="ib" onClick=${back}><${I} name="arrow-left" /></button>
      <h1>Templates</h1>
      ${findOpen && html`<div className="find"><input ref=${findRef} placeholder="Find" value=${libQuery} onChange=${e => set({ libQuery: e.target.value })} onKeyDown=${e => { if (e.key === 'Escape') { e.stopPropagation(); closeLibFind(); } }} />
        <button className="ib quiet" title="Close" onClick=${closeLibFind}><${I} name="x" size=${14} /></button></div>`}
      <button className=${'ib' + (findOpen ? ' on' : '')} title="Find" onClick=${() => findOpen ? closeLibFind() : set({ libFindOpen: true })}><${I} name="search" /></button>
      <button className="ib" title="New template" onClick=${newTemplate}><${I} name="plus" /></button>
      <button className="ib" title="Settings" onClick=${() => set({ settingsOpen: true })}><${I} name="settings" /></button>
    </div>
    <div className="lib-bar">
      <span className="sp" />
      <div className="seg">
        <button className=${!listMode ? 'on' : ''} title="Thumbnails" onClick=${() => setLibLayout('cards')}><${I} name="grid" size=${14} /></button>
        <button className=${listMode ? 'on' : ''} title="List" onClick=${() => setLibLayout('list')}><${I} name="list" size=${14} /></button>
      </div>
    </div>
    ${!all.length ? html`<div className="none"><button className="pb" onClick=${newTemplate}>New template</button></div>`
      : listMode ? html`<div className="sec list"><div className="tbl">
        <div className="tr th"><span className="td t">Title</span><span className="td p">Passage</span><span className="td tg">Tags</span></div>
        ${list.map(s => html`<div key=${s.path} className="tr" ...${openIt(s)}><span className="td t">${s.meta.title}</span><span className="td p">${s.meta.passage}</span><span className="td tg">${s.meta.tags.join(' · ')}</span></div>`)}
      </div></div>`
      : html`<div className="sec"><div className="grid">${list.map(s => html`<${Card} key=${s.path} s=${s} color="" />`)}</div></div>`}
    <div className="status" style=${{ position: 'fixed', left: 20, bottom: 16 }}>${status}</div>
  </div>`;
}
