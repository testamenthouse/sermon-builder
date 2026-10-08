(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef } = React;
const { useStore, set, createIllustration, updateIllustration, renameIllustration, deleteIllustration, leaveIllustrations, openSermon } = SB.store;
const { illustrationUses } = SB.shared.illustrations;
const { MdEditor } = SB.ui.MdEditor;
const { TagsInput } = SB.ui.Tags;
const { I } = SB.ui.Icons;
const { MobileTop, DrawerScrim } = SB.ui.Mobile;
const { fmtDate } = SB.lib.print;

function Illustrations() {
  const { ills, illPath, status, sermons, narrow, drawer } = useStore(s => ({ ills: s.illustrations, illPath: s.illPath, status: s.status, sermons: s.sermons, narrow: s.narrow, drawer: s.drawer }));
  const cur = ills.find(i => i.path === illPath) || null; const h1 = useRef(null);
  useEffect(() => { const el = h1.current; if (el && cur && document.activeElement !== el && el.textContent !== cur.meta.title) el.textContent = cur.meta.title; });
  const add = () => set({ nameDialog: { placeholder: 'Illustration title', onSave: async t => { const p = await createIllustration({ title: t }); if (p) set({ illPath: p }); } } });
  // A phone has no rail beside the page: the first illustration opens by itself instead of a blank screen.
  useEffect(() => { if (narrow && !cur && ills.length) set({ illPath: ills[0].path }); }, [narrow, cur, ills.length]);
  const uses = cur ? illustrationUses(cur, sermons) : [];
  return html`<div className=${'ill' + (narrow ? ' narrow' : '') + (drawer ? ' drawer' : '')}>
    ${narrow && html`<${MobileTop} onBack=${leaveIllustrations} />`}
    ${narrow && drawer && html`<${DrawerScrim} />`}
    <div className="rail group">
      <div className="rail-top"><button className="ib" onClick=${leaveIllustrations}><${I} name="arrow-left" /></button><span style=${{ flex: 1 }} /><button className="ib reveal" title="New" onClick=${() => { set({ drawer: false }); add(); }}><${I} name="plus" /></button></div>
      <h2>Illustrations</h2>
      <div className="outline">${ills.map(i => html`<div key=${i.path} className=${'row' + (i.path === illPath ? ' cur' : '')} onClick=${() => set({ illPath: i.path, drawer: false })}><span className="t">${i.meta.title}</span><span className="m">${i.meta.tags.slice(0, 2).join(' · ')}</span></div>`)}</div>
      <div className="rail-bot"><button className="tb" onClick=${() => set({ settingsOpen: true, drawer: false })}><${I} name="settings" />Settings</button><span className="status">${status}</span></div>
    </div>
    <div className="main">
      ${cur ? html`<>
        <div className="tools group"><button className="ib reveal" title="Delete" onClick=${() => set({ confirm: { title: cur.meta.title, onYes: () => deleteIllustration(cur.path) } })}><${I} name="trash" /></button></div>
        <div className="page">
          <h1 ref=${h1} className="ill-h1" contentEditable suppressContentEditableWarning data-ph="Title" onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} onBlur=${e => { const t = e.currentTarget.textContent.trim(); if (t) renameIllustration(cur.path, t); else e.currentTarget.textContent = cur.meta.title; }} />
          <${TagsInput} className="tagsin" value=${cur.meta.tags} onChange=${tags => updateIllustration(cur.path, i => { i.meta.tags = tags; })} />
          <input className="tagsin" placeholder="Source" value=${cur.meta.source} onChange=${e => updateIllustration(cur.path, i => { i.meta.source = e.target.value; })} />
          <${MdEditor} value=${cur.body} onChange=${t => updateIllustration(cur.path, i => { i.body = t; })} />
          ${uses.length > 0 && html`<div className="uses"><span className="cap">Used in</span><div className="rows">
            ${uses.map(s => html`<div key=${s.path} className="row" onClick=${() => openSermon(s.path)}><span className="t">${s.meta.title}</span><span className="m">${[s.meta.collection, s.meta.date ? fmtDate(s.meta.date) : ''].filter(Boolean).join(' · ')}</span></div>`)}
          </div></div>`}
        </div>
      </>` : !ills.length ? html`<div className="none"><button className="pb" onClick=${add}>New illustration</button></div>` : null}
    </div>
  </div>`;
}
(SB.ui ||= {}).Illustrations = { Illustrations };
})(globalThis.SB ||= {});
