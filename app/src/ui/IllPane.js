(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState } = React;
const { useStore, set, toggleIll, useIllustration, openIllustrations, createIllustration, open, flash } = SB.store;
const { illustrationMatches } = SB.shared.illustrations;
const { I } = SB.ui.Icons;

// Library beside the sermon, like the Bible pane: find, preview, Insert fills the current empty illustration block or adds one after it.
function IllPane() {
  const ills = useStore(s => s.illustrations);
  const cur = useStore(s => { const o = open(); return o ? o.blocks.find(b => b.id === s.curBlock) : null; });
  const [q, setQ] = useState(''); const [sel, setSel] = useState(null); const inp = useRef(null);
  useEffect(() => { inp.current && inp.current.focus(); }, []);
  const list = ills.filter(i => illustrationMatches(i, q));
  const ill = sel ? ills.find(i => i.path === sel) : null;
  const insert = i => { if (useIllustration(i)) { flash('Inserted'); setSel(null); } };
  const save = async () => { if (!cur) return; const p = await createIllustration({ title: cur.heading || 'Untitled', body: cur.body }); if (p) { flash('Saved to library'); setSel(p); } };
  const add = () => set({ nameDialog: { placeholder: 'Illustration title', onSave: async t => { const p = await createIllustration({ title: t }); if (p) openIllustrations(p); } } });
  return html`<div className="pane">
    <div className="pane-h"><input ref=${inp} className="q" placeholder="Find" value=${q} onChange=${e => { setQ(e.target.value); setSel(null); }} onKeyDown=${e => { if (e.key === 'Enter' && list[0]) insert(list[0]); }} /><button className="ib quiet" title="New" onClick=${add}><${I} name="plus" /></button><button className="ib quiet" onClick=${() => toggleIll(false)}><${I} name="chevron-right" /></button></div>
    ${ill ? html`<>
      <div className="ref-t"><button className="ib quiet" onClick=${() => setSel(null)}><${I} name="chevron-left" size=${14} /></button><span>${ill.meta.title}</span></div>
      <div className="prev">${ill.body}${ill.meta.source && html`<span className="src">— ${ill.meta.source}</span>`}</div>
      <div className="pane-acts"><button className="tb" onClick=${() => openIllustrations(ill.path)}>Edit</button><span className="sp" /><button className="pb sm" onClick=${() => insert(ill)}>Insert</button></div>
    </>` : html`<>
      <div className="ills">${list.map(i => html`<div key=${i.path} className="row" onClick=${() => setSel(i.path)}><span className="t">${i.meta.title}</span><span className="m">${i.meta.tags.slice(0, 2).join(' · ')}</span></div>`)}</div>
      <div className="pane-acts">${cur && cur.kind === 'illustration' && cur.body.trim() ? html`<button className="tb" onClick=${save}>Save to library</button>` : null}<span className="sp" /><button className="tb" onClick=${() => openIllustrations()}>Library</button></div>
    </>`}
  </div>`;
}
(SB.ui ||= {}).IllPane = { IllPane };
})(globalThis.SB ||= {});
