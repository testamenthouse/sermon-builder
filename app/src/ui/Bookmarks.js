(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState } = React;
const { useStore, set, createBookmark, updateBookmark, renameBookmark, deleteBookmark, leaveBookmarks, flash } = SB.store;
const { lookupNow } = SB.lib.bible;
const { bookmarkMatches } = SB.shared.bookmarks;
const { MdEditor } = SB.ui.MdEditor;
const { TagsInput } = SB.ui.Tags;
const { I } = SB.ui.Icons;
const { MobileTop, DrawerScrim } = SB.ui.Mobile;

// The Bookmarks screen: the library's Bookmarks/ files in a rail, the open one as reference (editable, renames the
// file), tags, the KJV text of the passage, and a note. New bookmarks come from the Bible pane's bookmark button.
function Bookmarks() {
  const { bms, bmPath, status, narrow, drawer } = useStore(s => ({ bms: s.bookmarks, bmPath: s.bmPath, status: s.status, narrow: s.narrow, drawer: s.drawer }));
  const [q, setQ] = useState('');
  const cur = bms.find(i => i.path === bmPath) || null; const h1 = useRef(null);
  useEffect(() => { const el = h1.current; if (el && cur && document.activeElement !== el && el.textContent !== cur.meta.reference) el.textContent = cur.meta.reference; });
  useEffect(() => { if (narrow && !cur && bms.length) set({ bmPath: bms[0].path }); }, [narrow, cur, bms.length]);
  const list = bms.filter(b => bookmarkMatches(b, q));
  // A new bookmark from here asks for the reference, the only name it has; an unknown reference creates nothing.
  const add = () => set({ nameDialog: { placeholder: 'Reference', onSave: async t => { const p = await createBookmark({ reference: t }); if (p) set({ bmPath: p }); else flash('Reference not found'); } } });
  const passage = cur ? lookupNow(cur.meta.reference) : null;
  return html`<div className=${'ill' + (narrow ? ' narrow' : '') + (drawer ? ' drawer' : '')}>
    ${narrow && html`<${MobileTop} onBack=${leaveBookmarks} />`}
    ${narrow && drawer && html`<${DrawerScrim} />`}
    <div className="rail group">
      <div className="rail-top"><button className="ib" onClick=${leaveBookmarks}><${I} name="arrow-left" /></button><span style=${{ flex: 1 }} /><button className="ib reveal" title="New" onClick=${() => { set({ drawer: false }); add(); }}><${I} name="plus" /></button></div>
      <h2>Bookmarks</h2>
      ${bms.length > 6 && html`<input className="rail-find" placeholder="Find" value=${q} onChange=${e => setQ(e.target.value)} />`}
      <div className="outline">${list.map(i => html`<div key=${i.path} className=${'row' + (i.path === bmPath ? ' cur' : '')} onClick=${() => set({ bmPath: i.path, drawer: false })}><span className="t">${i.meta.reference}</span><span className="m">${i.meta.tags.slice(0, 2).join(' · ')}</span></div>`)}</div>
      <div className="rail-bot"><button className="tb" onClick=${() => set({ settingsOpen: true, drawer: false })}><${I} name="settings" />Settings</button><span className="status">${status}</span></div>
    </div>
    <div className="main">
      ${cur ? html`<>
        <div className="tools group"><button className="ib reveal" title="Delete" onClick=${() => set({ confirm: { title: cur.meta.reference, onYes: () => deleteBookmark(cur.path) } })}><${I} name="trash" /></button></div>
        <div className="page">
          <h1 ref=${h1} className="ill-h1" contentEditable suppressContentEditableWarning data-ph="Reference" onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} onBlur=${async e => { const t = e.currentTarget.textContent.trim(); if (!t || !await renameBookmark(cur.path, t)) { e.currentTarget.textContent = cur.meta.reference; if (t) flash('Reference not found'); } }} />
          <${TagsInput} className="tagsin" value=${cur.meta.tags} onChange=${tags => updateBookmark(cur.path, i => { i.meta.tags = tags; })} />
          ${passage && html`<div className="passage">${passage.verses.map(v => html`<p key=${v.chapter + ':' + v.verse}><span className="vn">${v.verse}</span>${v.text}</p>`)}</div>`}
          <${MdEditor} value=${cur.body} placeholder="Note" onChange=${t => updateBookmark(cur.path, i => { i.body = t; })} />
        </div>
      </>` : !bms.length ? html`<div className="none"><button className="pb" onClick=${add}>New bookmark</button></div>` : null}
    </div>
  </div>`;
}
(SB.ui ||= {}).Bookmarks = { Bookmarks };
})(globalThis.SB ||= {});
