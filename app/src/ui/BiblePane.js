(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState } = React;
const { useStore, set, toggleBible, setBibleMode, insertScripture, useBookmark, openBookmarks, openBible, openSermon, flash } = SB.store;
const { loadBible, bible, parseRef, formatRef, verses, versesRef, search, refLabel, BOOKS } = SB.lib.bible;
const { bookmarkMatches, findBookmark } = SB.shared.bookmarks;
const { sermonTouches } = SB.shared.planning;
const { fmtDate } = SB.lib.print;
const { I } = SB.ui.Icons;

// Text mode: a reference or words in one field, the passage with verse numbers, Insert and Copy, a bookmark on the
// chapter or the selected verses, and the sermons that preach into the chapter on screen. Bookmarks mode: the
// library's bookmarks filtered by the same field; a row shows its passage, Enter inserts the first match.
function BiblePane() {
  const cur = useStore(s => { const o = s.openPath ? s.sermons.find(x => x.path === s.openPath) : null; return o ? o.blocks.find(b => b.id === s.curBlock) : null; });
  const { mode, bookmarks, sermons, openPath } = useStore(s => ({ mode: s.bibleMode, bookmarks: s.bookmarks, sermons: s.sermons, openPath: s.openPath }));
  const [q, setQ] = useState(''); const [view, setView] = useState(null); const [hits, setHits] = useState(null); const [sel, setSel] = useState(new Set()); const [ready, setReady] = useState(!!bible());
  const inp = useRef(null), lastRef = useRef('');
  useEffect(() => { loadBible().then(() => setReady(true)).catch(() => {}); inp.current && inp.current.focus(); }, []);
  useEffect(() => { if (inp.current) inp.current.focus(); if (mode === 'bookmarks') setQ(''); }, [mode]);
  useEffect(() => { if (cur && cur.kind === 'scripture' && cur.heading && cur.heading !== lastRef.current && ready) { const p = parseRef(cur.heading); if (p) { lastRef.current = cur.heading; show(p); setQ(cur.heading); } } }, [cur && cur.heading, ready]);
  const show = (p, keep) => { const vs = verses(bible(), p); if (!vs.length) return false; setView({ ref: formatRef(p), parsed: p, verses: vs }); setHits(null); setSel(keep || new Set()); return true; };
  const go = () => {
    if (!ready) return; const p = parseRef(q);
    if (p && show(p)) return;
    const h = search(bible(), q, { limit: 150 }); setHits(h); setView(null); if (!h.length) flash('No matches');
  };
  const chapter = d => { if (!view) return; const r = view.parsed.refs[0], c = r.c1 + d, book = BOOKS[r.book]; if (c < 1 || c > book.chapters) return; const p = { refs: [{ book: r.book, c1: c, v1: 0, c2: c, v2: 0 }] }; setQ(formatRef(p)); show(p); };
  const chosen = () => { if (!view) return []; const vs = sel.size ? view.verses.filter(v => sel.has(v.chapter + ':' + v.verse)) : view.verses; return vs; };
  const chosenRef = () => { const vs = chosen(); if (!vs.length) return ''; return sel.size ? versesRef(vs) : view.ref; };
  const insert = () => { const vs = chosen(); if (!vs.length) return; insertScripture(chosenRef(), vs, cur ? cur.id : null); };
  const copy = async () => { const vs = chosen(); if (!vs.length) return; try { await navigator.clipboard.writeText(vs.map(v => v.text).join(' ') + ' (' + chosenRef() + ', KJV)'); flash('Copied'); } catch (e) { flash('Could not copy'); } };
  const toggle = v => { const k = v.chapter + ':' + v.verse, n = new Set(sel); n.has(k) ? n.delete(k) : n.add(k); setSel(n); };
  const marked = view ? findBookmark(bookmarks, chosenRef()) : null;
  // Preached in: sermons (never templates, never the open one) whose passage or scripture blocks reach into the chapters on screen.
  const chapters = view ? [...new Set(view.verses.map(v => v.book + ':' + v.chapter))].map(k => k.split(':').map(Number)) : [];
  const preached = view ? sermons.filter(s => !s.meta.template && s.path !== openPath && chapters.some(([b, c]) => sermonTouches(s, b, c))) : [];
  // A bookmark row: show its passage with the verses selected so Insert takes exactly that range.
  const showBookmark = bm => { const p = parseRef(bm.meta.reference); if (!p) return; const vs = verses(bible(), p); setQ(bm.meta.reference); setBibleMode('text'); show(p, new Set(p.refs.some(r => r.v1) ? vs.map(v => v.chapter + ':' + v.verse) : [])); };
  const list = mode === 'bookmarks' ? bookmarks.filter(b => bookmarkMatches(b, q)) : [];
  const onKey = e => { if (e.key !== 'Enter') return; if (mode === 'bookmarks') { if (list[0] && useBookmark(list[0])) flash('Inserted'); } else go(); };
  return html`<div className="pane">
    <div className="pane-h">
      <input ref=${inp} className="q" placeholder=${mode === 'bookmarks' ? 'Find' : 'Reference or words'} value=${q} onChange=${e => setQ(e.target.value)} onKeyDown=${onKey} />
      <button className="ib quiet" title="Open Bible" onClick=${() => openBible(view ? view.ref : q)}><${I} name="expand" /></button>
      <button className=${'ib quiet' + (mode === 'bookmarks' ? ' on' : '')} title="Bookmarks" onClick=${() => { setQ(''); setBibleMode(mode === 'bookmarks' ? 'text' : 'bookmarks'); }}><${I} name="bookmark" /></button>
      <button className="ib quiet" onClick=${() => toggleBible(false)}><${I} name="chevron-right" /></button>
    </div>
    ${mode === 'bookmarks' ? html`<>
      <div className="ills">${list.map(b => html`<div key=${b.path} className="row" onClick=${() => showBookmark(b)}><span className="t">${b.meta.reference}</span><span className="m">${b.meta.tags.slice(0, 2).join(' · ')}</span><button className="ib quiet ins" title="Insert" onClick=${e => { e.stopPropagation(); if (useBookmark(b)) flash('Inserted'); }}><${I} name="plus" size=${14} /></button></div>`)}</div>
      <div className="pane-acts"><span className="sp" /><button className="tb" onClick=${() => openBookmarks()}>Library</button></div>
    </>` : html`<>
      ${view && html`<div className="ref-t"><button className="ib quiet" onClick=${() => chapter(-1)}><${I} name="chevron-left" size=${14} /></button><span>${view.ref}</span>
        <button className=${'ib quiet' + (marked ? ' on' : '')} title=${marked ? 'Bookmark' : 'Bookmark ' + chosenRef()} onClick=${() => set({ bookmarkModal: marked ? { path: marked.path } : { reference: chosenRef() } })}><${I} name="bookmark" size=${14} fill=${marked ? 'currentColor' : 'none'} /></button>
        <button className="ib quiet" onClick=${() => chapter(1)}><${I} name="chevron-right" size=${14} /></button></div>`}
      <div className="vs">
        ${view && view.verses.map(v => html`<p key=${v.chapter + ':' + v.verse} className=${sel.has(v.chapter + ':' + v.verse) ? 'sel' : ''} onClick=${() => toggle(v)}><span className="vn">${v.verse}</span>${v.text}</p>`)}
        ${hits && hits.map(h => html`<div key=${h.ref} className="hit" onClick=${() => { setQ(h.ref); show(parseRef(h.ref)); }}><b>${h.ref}</b><span>${h.text}</span></div>`)}
        ${preached.length > 0 && html`<div className="uses"><span className="cap">Preached in</span><div className="rows">
          ${preached.map(s => html`<div key=${s.path} className="row" onClick=${() => openSermon(s.path)}><span className="t">${s.meta.title}</span><span className="m">${[s.meta.collection, s.meta.date ? fmtDate(s.meta.date) : ''].filter(Boolean).join(' · ')}</span></div>`)}
        </div></div>`}
      </div>
      ${view && html`<div className="pane-acts"><button className="tb" onClick=${copy}>Copy</button><button className="pb sm" onClick=${insert}>Insert</button></div>`}
    </>`}
  </div>`;
}
(SB.ui ||= {}).BiblePane = { BiblePane };
})(globalThis.SB ||= {});
