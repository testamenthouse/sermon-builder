(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { useEffect, useRef, useState } = React;
const { useStore, set, leaveBible, setBiblePos, insertFromBible, insertScripture, openBible, openSermon, flash } = SB.store;
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

// Reading view: the whole book in one fullscreen column that scrolls by itself. The verse nearest the middle of the
// screen is at full contrast and the rest fade (Writer's typewriter + dim); a mask fades the top and bottom edges.
// Space pauses and plays, ↑/↓ change the speed (persisted), ←/→ jump a chapter, Esc or × leaves on the chapter in view.
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4], BASE_PX = 18; // 1× ≈ a spoken reading pace at the Podium text size
const readSpeed = () => { try { const v = +localStorage.getItem('sermon.readspeed'); return SPEEDS.includes(v) ? v : 1; } catch (e) { return 1; } };
function Reader({ book, chapter, onClose, onInsert }) {
  const { size, bookmarks, back } = useStore(s => ({ size: s.settings.podium, bookmarks: s.bookmarks, back: s.bibleReturn }));
  const [sel, setSel] = useState(new Set()); const [last, setLast] = useState(null);
  const box = useRef(null), raf = useRef(0), tops = useRef([]), curEl = useRef(null), playRef = useRef(true), speedRef = useRef(readSpeed()), pos = useRef(0); // pos: the exact scroll position; scrollTop itself is snapped to whole pixels
  const [playing, setPlaying] = useState(true); const [speed, setSpeed] = useState(speedRef.current); const [cur, setCur] = useState(chapter); const [prog, setProg] = useState(0); const curRef = useRef(chapter);
  const all = verses(bible(), { refs: [{ book, c1: 1, v1: 0, c2: BOOKS[book].chapters, v2: 0 }] });
  const chRef = c => formatRef({ refs: [{ book, c1: c, v1: 0, c2: c, v2: 0 }] });
  const key = v => v.chapter + ':' + v.verse, marks = marksFor(bookmarks, book);
  // A click picks a verse (and pauses, since the reader is now choosing), shift-click extends from the last click, a second click clears one.
  const pick = (v, e) => { e.stopPropagation(); play(false); const k = key(v), n = new Set(sel); if (e.shiftKey && last) { const a = all.findIndex(x => key(x) === last), b = all.findIndex(x => key(x) === k); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) n.add(key(all[i])); } else n.has(k) ? n.delete(k) : n.add(k); setSel(n); setLast(k); };
  const chosen = all.filter(v => sel.has(key(v))), chosenRef = chosen.length ? versesRef(chosen) : '';
  const clear = () => { setSel(new Set()); setLast(null); };
  const copy = async () => { try { await navigator.clipboard.writeText(chosen.map(v => v.text).join(' ') + ' (' + chosenRef + ', KJV)'); flash('Copied'); } catch (e) { flash('Could not copy'); } };
  const play = v => { playRef.current = v; setPlaying(v); };
  const setSpd = v => { speedRef.current = v; setSpeed(v); try { localStorage.setItem('sermon.readspeed', String(v)); } catch (e) {} };
  const step = d => { const i = SPEEDS.indexOf(speedRef.current); setSpd(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + d))]); };
  const centerOn = (el, p) => { el.scrollTop = p.offsetTop + p.offsetHeight / 2 - el.clientHeight / 2; pos.current = el.scrollTop; };
  const jump = d => { const el = box.current; if (!el) return; const c = Math.max(1, Math.min(BOOKS[book].chapters, cur + d)); const p = el.querySelector('p[data-c="' + c + '"]'); if (p) { centerOn(el, p); mark(); } };
  // The verse whose middle is nearest the screen's middle: binary search over the verse tops cached after layout.
  const mark = () => {
    const el = box.current; if (!el) return; const ps = el.querySelectorAll('.rd-page p'); if (!ps.length) return;
    if (Math.abs(el.scrollTop - pos.current) > 1) pos.current = el.scrollTop; // the wheel or a jump moved it
    if (tops.current.length !== ps.length) tops.current = Array.from(ps, p => p.offsetTop + p.offsetHeight / 2);
    const mid = el.scrollTop + el.clientHeight / 2, t = tops.current; let lo = 0, hi = t.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < mid) lo = m + 1; else hi = m; }
    const i = lo > 0 && Math.abs(t[lo - 1] - mid) < Math.abs(t[lo] - mid) ? lo - 1 : lo, p = ps[i];
    if (p !== curEl.current) { if (curEl.current) curEl.current.classList.remove('on'); p.classList.add('on'); curEl.current = p; const c = +p.dataset.c; curRef.current = c; setCur(c); }
    const max = el.scrollHeight - el.clientHeight; setProg(max > 0 ? Math.min(1, el.scrollTop / max) : 1);
    if (max > 0 && el.scrollTop >= max - 1 && playRef.current) play(false);
  };
  useEffect(() => {
    const el = box.current; if (!el) return;
    const p = el.querySelector('p[data-c="' + chapter + '"]'); if (p) centerOn(el, p); mark();
    set({ reading: true }); // the edge panels hide what would break fullscreen (print)
    const left = () => { if (!document.fullscreenElement) onClose(curRef.current); };
    try { document.documentElement.requestFullscreen().then(() => document.addEventListener('fullscreenchange', left)).catch(() => {}); } catch (e) {}
    let last = performance.now();
    const tick = now => { const dt = Math.min(0.1, (now - last) / 1000); last = now; if (playRef.current && box.current) { pos.current += BASE_PX * speedRef.current * dt * (size / 28); box.current.scrollTop = Math.round(pos.current); mark(); } raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    const onResize = () => { tops.current = []; mark(); };
    window.addEventListener('resize', onResize);
    return () => { set({ reading: false }); cancelAnimationFrame(raf.current); window.removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', left); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, []);
  useEffect(() => {
    const h = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable || e.target.closest('.np, .scrim')) return;
      if (e.key === ' ') { e.preventDefault(); play(!playRef.current); }
      else if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowDown' || e.key === '-') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); jump(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); jump(1); }
      else if (e.key === 'Escape') { e.preventDefault(); if (sel.size) clear(); else onClose(curRef.current); }
    };
    document.addEventListener('keydown', h, true); return () => document.removeEventListener('keydown', h, true);
  });
  const stop = e => e.stopPropagation();
  let lastCh = 0;
  return html`<div className="reader">
    <div className="prog" style=${{ width: (prog * 100) + '%' }} />
    <div className="rd-ref">${chRef(cur)}</div>
    <button className="ib quiet x" title="Close" onClick=${() => onClose(cur)} onMouseDown=${stop}><${I} name="x" /></button>
    <div ref=${box} className="rd-scroll" onScroll=${mark} onClick=${() => play(!playRef.current)}>
      <div className="rd-page" style=${{ fontSize: size + 'px' }}>
        ${all.map(v => { const head = v.chapter !== lastCh; lastCh = v.chapter; return html`<${React.Fragment} key=${v.chapter + ':' + v.verse}>${head && html`<div className="rd-ch" data-c=${v.chapter}>${chRef(v.chapter)}</div>`}<p data-c=${v.chapter} className=${(sel.has(key(v)) ? 'sel' : '') + (marks.has(key(v)) ? ' marked' : '')} onMouseDown=${e => { if (e.shiftKey) e.preventDefault(); }} onClick=${e => pick(v, e)}><span className="vn">${v.verse}</span>${v.text}${marks.has(key(v)) && html`<button className="bmk" title=${marks.get(key(v)).meta.reference} onClick=${e => { e.stopPropagation(); play(false); set({ bookmarkModal: { path: marks.get(key(v)).path } }); }}><${I} name="bookmark" size=${12} fill="currentColor" /></button>`}</p><//>`; })}
      </div>
    </div>
    ${chosen.length > 0 && html`<div className="actbar" onMouseDown=${stop}>
      <span className="ref">${chosenRef}</span>
      <button className="tb" onClick=${copy}>Copy</button>
      <button className="tb" onClick=${() => set({ bookmarkModal: { reference: chosenRef } })}><${I} name="bookmark" size=${14} />Bookmark</button>
      ${back && html`<button className="pb sm" onClick=${() => onInsert(chosenRef, chosen, curRef.current)}>Insert</button>`}
      <button className="ib quiet" title="Clear" onClick=${clear}><${I} name="x" size=${14} /></button>
    </div>`}
    <div className="aids" onMouseDown=${stop}>
      <button className="on" onClick=${() => play(!playing)}><${I} name=${playing ? 'pause' : 'play'} size=${13} />${playing ? 'Pause' : 'Play'}</button>
      <button onClick=${() => step(-1)} disabled=${speed === SPEEDS[0]}>Slower</button>
      <button onClick=${() => step(1)} disabled=${speed === SPEEDS[SPEEDS.length - 1]}>Faster</button>
      <span className="spd">${speed}×</span>
    </div>
  </div>`;
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
  const inp = useRef(null), page = useRef(null); const [reading, setReading] = useState(false);
  useEffect(() => { if (query) set({ bibleQuery: '' }); }, []);
  useEffect(() => { setBiblePos({ book, chapter }); }, [book, chapter]);
  useEffect(() => { if (!hits) window.scrollTo(0, 0); }, [book, chapter, hits]);
  const goTo = (b, c, keep) => { setBook(b); setChapter(c); setOpen(b); setHits(null); setSel(new Set(keep || [])); setLast(null); };
  const shift = d => { const c = chapter + d; if (c >= 1 && c <= BOOKS[book].chapters) return goTo(book, c); const b = book + d; if (b >= 0 && b < BOOKS.length) goTo(b, d > 0 ? 1 : BOOKS[b].chapters); };
  useEffect(() => {
    const h = e => { if (reading || e.metaKey || e.ctrlKey || e.altKey) return; const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
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
        <div className="ch-h"><h1 className="title">${ref}</h1><span className="sp" /><button className="ib quiet" title="Previous chapter" onClick=${() => shift(-1)}><${I} name="chevron-left" /></button><button className="ib quiet" title="Next chapter" onClick=${() => shift(1)}><${I} name="chevron-right" /></button><button className="ib quiet" title="Read" onClick=${() => setReading(true)}><${I} name="play" /></button></div>
        <div className="vrs">${vs.map(v => { const bm = marks.get(key(v)); return html`<p key=${v.verse} className=${(sel.has(key(v)) ? 'sel' : '') + (bm ? ' marked' : '')} onMouseDown=${e => { if (e.shiftKey) e.preventDefault(); }} onClick=${e => pick(v, e)}><span className="vn">${v.verse}</span>${v.text}${bm && html`<button className="bmk" title=${bm.meta.reference} onClick=${e => { e.stopPropagation(); set({ bookmarkModal: { path: bm.path } }); }}><${I} name="bookmark" size=${12} fill="currentColor" /></button>`}</p>`; })}</div>
        ${preached.length > 0 && html`<div className="uses"><span className="cap">Preached in</span><div className="rows">
          ${preached.map(s => html`<div key=${s.path} className="row" onClick=${() => openSermon(s.path)}><span className="t">${s.meta.title}</span><span className="m">${[s.meta.collection, s.meta.date ? fmtDate(s.meta.date) : ''].filter(Boolean).join(' · ')}</span></div>`)}
        </div></div>`}
      </div>`}
      ${reading && html`<${Reader} book=${book} chapter=${chapter} onClose=${c => { setReading(false); if (c && c !== chapter) goTo(book, c); }} onInsert=${(r, vs) => { setReading(false); if (insertFromBible(r, vs)) flash('Inserted'); }} />`}
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
// The Bible behind the edge tab: a chapter to read in a 400px panel on any screen. ‹ › step chapters (across books),
// the title opens the book and chapter picker, the search glyph opens a field (a reference jumps, words list hits),
// verses pick as on the Bible screen, and the bar beneath copies, bookmarks or (on the sermon screen) inserts them.
// Position is the Bible screen's (`biblePos`), so the two always open on the same chapter.
function BibleSlide({ onClose }) {
  const { open, pos, bookmarks, sermons, openPath, screen, cur } = useStore(s => ({ open: s.bibleSlide, pos: s.biblePos, bookmarks: s.bookmarks, sermons: s.sermons, openPath: s.openPath, screen: s.screen, cur: s.curBlock }));
  const [book, setBook] = useState(pos && pos.book >= 0 ? pos.book : 42); const [chapter, setChapter] = useState(pos && pos.chapter ? pos.chapter : 1);
  const [pick, setPick] = useState(false); const [openBook, setOpenBook] = useState(-1);
  const [find, setFind] = useState(false); const [q, setQ] = useState(''); const [hits, setHits] = useState(null);
  const [sel, setSel] = useState(new Set()); const [last, setLast] = useState(null);
  const body = useRef(null), inp = useRef(null);
  // Reopening adopts wherever the Bible screen left off.
  useEffect(() => { if (open && pos && pos.book >= 0 && pos.chapter && (pos.book !== book || pos.chapter !== chapter)) { setBook(pos.book); setChapter(pos.chapter); setSel(new Set()); setHits(null); } }, [open]);
  useEffect(() => { if (find && inp.current) inp.current.focus(); }, [find]);
  const goTo = (b, c, keep) => { setBook(b); setChapter(c); setPick(false); setHits(null); setSel(new Set(keep || [])); setLast(null); setBiblePos({ book: b, chapter: c }); if (body.current) body.current.scrollTop = 0; };
  const shift = d => { const c = chapter + d; if (c >= 1 && c <= BOOKS[book].chapters) return goTo(book, c); const b = book + d; if (b >= 0 && b < BOOKS.length) goTo(b, d > 0 ? 1 : BOOKS[b].chapters); };
  const go = () => {
    const t = q.trim(); if (!t) return; const p = parseRef(t);
    if (p) { const vs = verses(bible(), p); if (vs.length) { goTo(p.refs[0].book, p.refs[0].c1, p.refs[0].v1 ? vs.map(v => v.chapter + ':' + v.verse) : []); setQ(''); setFind(false); return; } }
    const h = search(bible(), t, { limit: 150 }); setHits(h); setPick(false); if (!h.length) flash('No matches');
  };
  const vs = verses(bible(), { refs: [{ book, c1: chapter, v1: 0, c2: chapter, v2: 0 }] });
  const marks = marksFor(bookmarks, book), key = v => v.chapter + ':' + v.verse;
  const pickV = (v, e) => { const k = key(v), n = new Set(sel); if (e.shiftKey && last) { const a = vs.findIndex(x => key(x) === last), b = vs.findIndex(x => key(x) === k); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) n.add(key(vs[i])); } else n.has(k) ? n.delete(k) : n.add(k); setSel(n); setLast(k); };
  const chosen = vs.filter(v => sel.has(key(v))), chosenRef = chosen.length ? versesRef(chosen) : '';
  const ref = formatRef({ refs: [{ book, c1: chapter, v1: 0, c2: chapter, v2: 0 }] });
  const canInsert = !!openPath && screen === 'sermon';
  const copy = async () => { try { await navigator.clipboard.writeText(chosen.map(v => v.text).join(' ') + ' (' + chosenRef + ', KJV)'); flash('Copied'); } catch (e) { flash('Could not copy'); } };
  const preached = sermons.filter(s => !s.meta.template && s.path !== openPath && sermonTouches(s, book, chapter));
  const bookRow = (b, i) => html`<div key=${i} className=${'row' + (i === book ? ' cur' : '')} onClick=${() => setOpenBook(openBook === i ? -1 : i)}><span className="t">${b.name}</span></div>
    ${openBook === i && html`<div key=${'c' + i} className="ch-grid">${Array.from({ length: b.chapters }, (_, c) => html`<button key=${c} className=${i === book && c + 1 === chapter ? 'on' : ''} onClick=${() => goTo(i, c + 1)}>${c + 1}</button>`)}</div>`}`;
  return html`<div className="bs">
    <div className="bs-h">
      <button className="ib quiet" title="Previous chapter" onClick=${() => shift(-1)}><${I} name="chevron-left" /></button>
      <button className=${'bs-t' + (pick ? ' on' : '')} onClick=${() => { setPick(!pick); setOpenBook(book); setHits(null); }}>${ref}<${I} name="chevron-down" size=${14} /></button>
      <button className="ib quiet" title="Next chapter" onClick=${() => shift(1)}><${I} name="chevron-right" /></button>
      <span style=${{ flex: 1 }} />
      <button className=${'ib quiet' + (find ? ' on' : '')} title="Find" onClick=${() => { setFind(!find); if (find) { setQ(''); setHits(null); } }}><${I} name="search" /></button>
      <button className="ib quiet" title="Open Bible" onClick=${() => { onClose(); openBible(ref); }}><${I} name="expand" /></button>
      <button className="ib quiet" title="Close" onClick=${onClose}><${I} name="chevron-right" /></button>
    </div>
    ${find && html`<input ref=${inp} className="rail-find bs-find" placeholder="Reference or words" value=${q} onChange=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') go(); else if (e.key === 'Escape') { e.stopPropagation(); setQ(''); setHits(null); setFind(false); } }} />`}
    <div ref=${body} className="bs-body">
      ${pick ? html`<div className="outline books">
        <span className="cap">Old Testament</span>${BOOKS.slice(0, OT).map(bookRow)}
        <span className="cap" style=${{ marginTop: 12 }}>New Testament</span>${BOOKS.slice(OT).map((b, i) => bookRow(b, i + OT))}
      </div>` : hits ? html`<div className="hits">${hits.map(h => html`<div key=${h.ref} className="hit" onClick=${() => { goTo(h.book, h.chapter, [h.chapter + ':' + h.verse]); setHits(null); }}><b>${h.ref}</b><span>${h.text}</span></div>`)}</div>` : html`<>
        <div className="vrs">${vs.map(v => { const bm = marks.get(key(v)); return html`<p key=${v.verse} className=${(sel.has(key(v)) ? 'sel' : '') + (bm ? ' marked' : '')} onMouseDown=${e => { if (e.shiftKey) e.preventDefault(); }} onClick=${e => pickV(v, e)}><span className="vn">${v.verse}</span>${v.text}${bm && html`<button className="bmk" title=${bm.meta.reference} onClick=${e => { e.stopPropagation(); set({ bookmarkModal: { path: bm.path } }); }}><${I} name="bookmark" size=${12} fill="currentColor" /></button>`}</p>`; })}</div>
        ${preached.length > 0 && html`<div className="uses"><span className="cap">Preached in</span><div className="rows">
          ${preached.map(s => html`<div key=${s.path} className="row" onClick=${() => { onClose(); openSermon(s.path); }}><span className="t">${s.meta.title}</span><span className="m">${[s.meta.collection, s.meta.date ? fmtDate(s.meta.date) : ''].filter(Boolean).join(' · ')}</span></div>`)}
        </div></div>`}
      </>`}
    </div>
    ${chosen.length > 0 && html`<div className="pane-acts bs-acts">
      <span className="ref">${chosenRef}</span><span className="sp" />
      <button className="tb" onClick=${copy}>Copy</button>
      <button className="tb" onClick=${() => set({ bookmarkModal: { reference: chosenRef } })}><${I} name="bookmark" size=${14} />Bookmark</button>
      ${canInsert && html`<button className="pb sm" onClick=${() => { insertScripture(chosenRef, chosen, cur); flash('Inserted'); }}>Insert</button>`}
      <button className="ib quiet" title="Clear" onClick=${() => { setSel(new Set()); setLast(null); }}><${I} name="x" size=${14} /></button>
    </div>`}
  </div>`;
}
(SB.ui ||= {}).Bible = { Bible, BibleSlide };
})(globalThis.SB ||= {});
