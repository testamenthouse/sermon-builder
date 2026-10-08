import { html } from '../lib/html.js';
import { useEffect, useRef, useState } from 'react';
import { useStore, set, toggleBible, insertScripture, open, flash } from '../store.js';
import { loadBible, bible, parseRef, formatRef, verses, search, refLabel, BOOKS } from '../lib/bible.js';
import { I } from './Icons.js';

export function BiblePane() {
  const cur = useStore(s => { const o = s.openPath ? s.sermons.find(x => x.path === s.openPath) : null; return o ? o.blocks.find(b => b.id === s.curBlock) : null; });
  const [q, setQ] = useState(''); const [view, setView] = useState(null); const [hits, setHits] = useState(null); const [sel, setSel] = useState(new Set()); const [ready, setReady] = useState(!!bible());
  const inp = useRef(null), lastRef = useRef('');
  useEffect(() => { loadBible().then(() => setReady(true)).catch(() => {}); inp.current && inp.current.focus(); }, []);
  useEffect(() => { if (cur && cur.kind === 'scripture' && cur.heading && cur.heading !== lastRef.current && ready) { const p = parseRef(cur.heading); if (p) { lastRef.current = cur.heading; show(p); setQ(cur.heading); } } }, [cur && cur.heading, ready]);
  const show = p => { const vs = verses(bible(), p); if (!vs.length) return false; setView({ ref: formatRef(p), parsed: p, verses: vs }); setHits(null); setSel(new Set()); return true; };
  const go = () => {
    if (!ready) return; const p = parseRef(q);
    if (p && show(p)) return;
    const h = search(bible(), q, { limit: 150 }); setHits(h); setView(null); if (!h.length) flash('No matches');
  };
  const chapter = d => { if (!view) return; const r = view.parsed.refs[0], c = r.c1 + d, book = BOOKS[r.book]; if (c < 1 || c > book.chapters) return; const p = { refs: [{ book: r.book, c1: c, v1: 0, c2: c, v2: 0 }] }; setQ(formatRef(p)); show(p); };
  const chosen = () => { if (!view) return []; const vs = sel.size ? view.verses.filter(v => sel.has(v.chapter + ':' + v.verse)) : view.verses; return vs; };
  const chosenRef = () => { const vs = chosen(); if (!vs.length) return ''; if (!sel.size) return view.ref; const f = vs[0], l = vs[vs.length - 1]; return formatRef({ refs: [{ book: f.book, c1: f.chapter, v1: f.verse, c2: l.chapter, v2: l.verse }] }); };
  const insert = () => { const vs = chosen(); if (!vs.length) return; insertScripture(chosenRef(), vs, cur ? cur.id : null); };
  const copy = async () => { const vs = chosen(); if (!vs.length) return; try { await navigator.clipboard.writeText(vs.map(v => v.text).join(' ') + ' (' + chosenRef() + ', KJV)'); flash('Copied'); } catch (e) { flash('Could not copy'); } };
  const toggle = v => { const k = v.chapter + ':' + v.verse, n = new Set(sel); n.has(k) ? n.delete(k) : n.add(k); setSel(n); };
  return html`<div className="pane">
    <div className="pane-h"><input ref=${inp} className="q" placeholder="Reference or words" value=${q} onChange=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') go(); }} /><button className="ib quiet" onClick=${toggleBible}><${I} name="chevron-right" /></button></div>
    ${view && html`<div className="ref-t"><button className="ib quiet" onClick=${() => chapter(-1)}><${I} name="chevron-left" size=${14} /></button><span>${view.ref}</span><button className="ib quiet" onClick=${() => chapter(1)}><${I} name="chevron-right" size=${14} /></button></div>`}
    <div className="vs">
      ${view && view.verses.map(v => html`<p key=${v.chapter + ':' + v.verse} className=${sel.has(v.chapter + ':' + v.verse) ? 'sel' : ''} onClick=${() => toggle(v)}><span className="vn">${v.verse}</span>${v.text}</p>`)}
      ${hits && hits.map(h => html`<div key=${h.ref} className="hit" onClick=${() => { setQ(h.ref); show(parseRef(h.ref)); }}><b>${h.ref}</b><span>${h.text}</span></div>`)}
    </div>
    ${view && html`<div className="pane-acts"><button className="tb" onClick=${copy}>Copy</button><button className="pb sm" onClick=${insert}>Insert</button></div>`}
  </div>`;
}
