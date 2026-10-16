(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState } = React;
const { useStore, set, leaveBible, setBiblePos, insertFromBible, openSermon, flash } = SB.store;
const { bible, parseRef, formatRef, verses, versesRef, search, BOOKS } = SB.lib.bible;
const { sermonTouches } = SB.shared.planning;
const { fmtDate } = SB.lib.print;
const { I } = SB.ui.Icons;
const { MobileTop, DrawerScrim } = SB.ui.Mobile;

const OT = 39;
// Which verses of a book each bookmark covers: "c:v" → the bookmark, so a bookmarked verse can show its mark.
function marksFor(bookmarks, book) {
  const m = new Map();
  for (const bm of bookmarks) { const p = parseRef(bm.meta.reference); if (!p) continue; for (const v of verses(bible(), p)) if (v.book === book && !m.has(v.chapter + ':' + v.verse)) m.set(v.chapter + ':' + v.verse, bm); }
  return m;
}

// The Bible as a reading screen: search (a reference or words) and the books in the rail, a chapter in the content
// font on the page. Click a verse to highlight it, shift-click for a range; the bar beneath copies, bookmarks or
// (from a sermon) inserts the highlighted verses. Bookmarked verses carry a mark that opens the bookmark.
function Bible() {
  const { bookmarks, sermons, pos, query, back, narrow, drawer, status } = useStore(s => ({ bookmarks: s.bookmarks, sermons: s.sermons, pos: s.biblePos, query: s.bibleQuery, back: s.bibleReturn, narrow: s.narrow, drawer: s.drawer, status: s.status }));
  const start = (() => { const p = query && parseRef(query); if (p) return { book: p.refs[0].book, chapter: p.refs[0].c1, sel: p.refs[0].v1 ? verses(bible(), p).map(v => v.chapter + ':' + v.verse) : [] }; return { book: pos && pos.book >= 0 ? pos.book : 42, chapter: pos && pos.chapter ? pos.chapter : 1, sel: [] }; })();
  const [book, setBook] = useState(start.book); const [chapter, setChapter] = useState(start.chapter);
  const [sel, setSel] = useState(new Set(start.sel)); const [last, setLast] = useState(null);
  const [q, setQ] = useState(''); const [hits, setHits] = useState(null); const [open, setOpen] = useState(start.book);
  const inp = useRef(null), page = useRef(null);
  useEffect(() => { if (query) set({ bibleQuery: '' }); }, []);
  useEffect(() => { setBiblePos({ book, chapter }); }, [book, chapter]);
  useEffect(() => { if (!hits) window.scrollTo(0, 0); }, [book, chapter, hits]);
  const goTo = (b, c, keep) => { setBook(b); setChapter(c); setOpen(b); setHits(null); setSel(new Set(keep || [])); setLast(null); };
  const shift = d => { const c = chapter + d; if (c >= 1 && c <= BOOKS[book].chapters) return goTo(book, c); const b = book + d; if (b >= 0 && b < BOOKS.length) goTo(b, d > 0 ? 1 : BOOKS[b].chapters); };
  useEffect(() => {
    const h = e => { if (e.metaKey || e.ctrlKey || e.altKey) return; const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      if (e.key === 'ArrowLeft') shift(-1); else if (e.key === 'ArrowRight') shift(1); else if (e.key === '/') { e.preventDefault(); inp.current && inp.current.focus(); } };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  });
  const go = () => {
    const t = q.trim(); if (!t) return; const p = parseRef(t);
    if (p) { const vs = verses(bible(), p); if (vs.length) { goTo(p.refs[0].book, p.refs[0].c1, p.refs[0].v1 ? vs.map(v => v.chapter + ':' + v.verse) : []); setQ(''); return; } }
    const h = search(bible(), t, { limit: 200 }); setHits(h); if (!h.length) flash('No matches');
  };
  const vs = verses(bible(), { refs: [{ book, c1: chapter, v1: 0, c2: chapter, v2: 0 }] });
  const marks = marksFor(bookmarks, book);
  const key = v => v.chapter + ':' + v.verse;
  // click toggles a verse; shift-click takes the range from the last click
  const pick = (v, e) => { const k = key(v); const n = new Set(sel); if (e.shiftKey && last) { const a = vs.findIndex(x => key(x) === last), b = vs.findIndex(x => key(x) === k); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) n.add(key(vs[i])); } else n.has(k) ? n.delete(k) : n.add(k); setSel(n); setLast(k); };
  const chosen = vs.filter(v => sel.has(key(v)));
  const chosenRef = chosen.length ? versesRef(chosen) : '';
  const ref = formatRef({ refs: [{ book, c1: chapter, v1: 0, c2: chapter, v2: 0 }] });
  const copy = async () => { try { await navigator.clipboard.writeText(chosen.map(v => v.text).join(' ') + ' (' + chosenRef + ', KJV)'); flash('Copied'); } catch (e) { flash('Could not copy'); } };
  const preached = sermons.filter(s => !s.meta.template && s.path !== back && sermonTouches(s, book, chapter));
  const bookRow = (b, i) => html`<div key=${i} className=${'row' + (i === book ? ' cur' : '')} onClick=${() => setOpen(open === i ? -1 : i)}><span className="t">${b.name}</span></div>
    ${open === i && html`<div key=${'c' + i} className="ch-grid">${Array.from({ length: b.chapters }, (_, c) => html`<button key=${c} className=${i === book && c + 1 === chapter ? 'on' : ''} onClick=${() => goTo(i, c + 1)}>${c + 1}</button>`)}</div>`}`;
  return html`<div className=${'ill bible' + (narrow ? ' narrow' : '') + (drawer ? ' drawer' : '')}>
    ${narrow && html`<${MobileTop} onBack=${leaveBible} />`}
    ${narrow && drawer && html`<${DrawerScrim} />`}
    <div className="rail group">
      <div className="rail-top"><button className="ib" onClick=${leaveBible}><${I} name="arrow-left" /></button><span style=${{ flex: 1 }} /></div>
      <input ref=${inp} className="rail-find" placeholder="Reference or words" value=${q} onChange=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') go(); else if (e.key === 'Escape') { setQ(''); setHits(null); } }} />
      <div className="outline books">
        <span className="cap">Old Testament</span>${BOOKS.slice(0, OT).map(bookRow)}
        <span className="cap" style=${{ marginTop: 12 }}>New Testament</span>${BOOKS.slice(OT).map((b, i) => bookRow(b, i + OT))}
      </div>
      <div className="rail-bot"><button className="tb" onClick=${() => set({ settingsOpen: true, drawer: false })}><${I} name="settings" />Settings</button><span className="status">${status}</span></div>
    </div>
    <div className="main">
      ${hits ? html`<div className="page" ref=${page}>
        <div className="caption">Search</div>
        <h1 className="title">${q}</h1>
        <div className="hits">${hits.map(h => html`<div key=${h.ref} className="hit" onClick=${() => goTo(h.book, h.chapter, [h.chapter + ':' + h.verse])}><b>${h.ref}</b><span>${h.text}</span></div>`)}</div>
      </div>` : html`<div className="page" ref=${page}>
        <div className="caption">${BOOKS[book].name}</div>
        <div className="ch-h"><h1 className="title">${ref}</h1><span className="sp" /><button className="ib quiet" title="Previous chapter" onClick=${() => shift(-1)}><${I} name="chevron-left" /></button><button className="ib quiet" title="Next chapter" onClick=${() => shift(1)}><${I} name="chevron-right" /></button></div>
        <div className="vrs">${vs.map(v => { const bm = marks.get(key(v)); return html`<p key=${v.verse} className=${(sel.has(key(v)) ? 'sel' : '') + (bm ? ' marked' : '')} onMouseDown=${e => { if (e.shiftKey) e.preventDefault(); }} onClick=${e => pick(v, e)}><span className="vn">${v.verse}</span>${v.text}${bm && html`<button className="bmk" title=${bm.meta.reference} onClick=${e => { e.stopPropagation(); set({ bookmarkModal: { path: bm.path } }); }}><${I} name="bookmark" size=${12} fill="currentColor" /></button>`}</p>`; })}</div>
        ${preached.length > 0 && html`<div className="uses"><span className="cap">Preached in</span><div className="rows">
          ${preached.map(s => html`<div key=${s.path} className="row" onClick=${() => openSermon(s.path)}><span className="t">${s.meta.title}</span><span className="m">${[s.meta.collection, s.meta.date ? fmtDate(s.meta.date) : ''].filter(Boolean).join(' · ')}</span></div>`)}
        </div></div>`}
      </div>`}
      ${chosen.length > 0 && html`<div className="actbar">
        <span className="ref">${chosenRef}</span>
        <button className="tb" onClick=${copy}>Copy</button>
        <button className="tb" onClick=${() => set({ bookmarkModal: { reference: chosenRef } })}><${I} name="bookmark" size=${14} />Bookmark</button>
        ${back && html`<button className="pb sm" onClick=${() => { if (insertFromBible(chosenRef, chosen)) flash('Inserted'); }}>Insert</button>`}
        <button className="ib quiet" title="Clear" onClick=${() => { setSel(new Set()); setLast(null); }}><${I} name="x" size=${14} /></button>
      </div>`}
    </div>
  </div>`;
}
(SB.ui ||= {}).Bible = { Bible };
})(globalThis.SB ||= {});
