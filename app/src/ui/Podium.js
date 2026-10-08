import { html } from '../lib/html.js';
import { useEffect, useRef, useState } from 'react';
import { useStore, set, open } from '../store.js';
import { mdHtml } from '../lib/md.js';
import { headingOf, metaLine } from '../lib/print.js';
import { pointNumbers, depths } from '../../../shared/outline.js';
import { kindLabel, kindColor } from '../../../shared/blocks.js';
import { lookupNow, loadBible } from '../lib/bible.js';
import { I, KIND_ICON } from './Icons.js';

const pad = n => String(Math.floor(n)).padStart(2, '0');
const fmt = s => (s < 0 ? '−' : '') + pad(Math.abs(s) / 60) + ':' + pad(Math.abs(s) % 60);

export function Podium() {
  const s = useStore(st => st.openPath ? st.sermons.find(x => x.path === st.openPath) : null); const colors = useStore(st => st.settings.colors);
  const kc = b => { const c = kindColor(b.kind, colors); return c ? { '--kc': c } : undefined; };
  const [cur, setCur] = useState(0); const [notes, setNotes] = useState(true); const [outline, setOutline] = useState(false); const [remaining, setRemaining] = useState(true); const [now, setNow] = useState(Date.now()); const [pop, setPop] = useState(null);
  const start = useRef(Date.now()); const root = useRef(null);
  // Fullscreen is the Podium: when the browser leaves it (Esc is swallowed by Chrome in fullscreen and never reaches the page) the Podium closes too.
  useEffect(() => {
    loadBible().catch(() => {}); const t = setInterval(() => setNow(Date.now()), 1000);
    const left = () => { if (!document.fullscreenElement) set({ podium: false }); };
    try { document.documentElement.requestFullscreen().then(() => document.addEventListener('fullscreenchange', left)).catch(() => {}); } catch (e) {}
    return () => { clearInterval(t); document.removeEventListener('fullscreenchange', left); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, []);
  const blocks = s ? s.blocks.filter(b => !b.flags.includes('hidden') && (notes || b.kind !== 'note')) : [];
  // One block on stage at a time: it sits in the middle of the screen, neighbors dimmed above and below.
  // Blocks taller than the stage align to the top instead so their first line is never cut off.
  const goTo = i => { const n = Math.max(0, Math.min(blocks.length - 1, i)); setCur(n); const el = root.current && root.current.querySelector('[data-i="' + n + '"]'); if (el) el.scrollIntoView({ block: el.offsetHeight > root.current.clientHeight * 0.8 ? 'start' : 'center', behavior: 'smooth' }); };
  // Wheel or trackpad scrolling moves the stage too: the block nearest the middle of the screen becomes current.
  useEffect(() => {
    const el = root.current; if (!el) return; let raf = 0;
    const h = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      const mid = el.clientHeight / 2; let best = -1, d = Infinity;
      el.querySelectorAll('.stage').forEach(n => { const r = n.getBoundingClientRect(); const dd = r.top > mid ? r.top - mid : r.bottom < mid ? mid - r.bottom : 0; if (dd < d) { d = dd; best = +n.dataset.i; } });
      if (best >= 0) setCur(c => c === best ? c : best);
    }); };
    el.addEventListener('scroll', h, { passive: true }); return () => { el.removeEventListener('scroll', h); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape') { setPop(null); set({ podium: false }); }
      else if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goTo(cur + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(cur - 1); }
      else if (e.key === 'n') setNotes(v => !v); else if (e.key === 'o' || (e.key === 'Enter' && outline)) toggleOutline();
    };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [cur, blocks.length, outline]);
  const toggleOutline = () => { setOutline(v => !v); requestAnimationFrame(() => goTo(cur)); };
  if (!s) return null;
  const nums = pointNumbers(s.blocks), depth = depths(s.blocks), target = (s.meta.length || 0) * 60, elapsed = Math.floor((now - start.current) / 1000);
  const clock = remaining && target ? fmt(target - elapsed) : fmt(elapsed), over = target && elapsed > target;
  const onClick = e => {
    const x = e.target.closest('.xref');
    if (x) { const r = lookupNow(x.dataset.ref); if (r) { const rect = x.getBoundingClientRect(), sc = root.current; setPop({ ref: r.ref, text: r.verses.map(v => v.text).join(' '), top: rect.bottom + sc.scrollTop + 8, left: Math.max(16, Math.min(rect.left, window.innerWidth - 540)) }); } return; }
    setPop(null);
    const b = e.target.closest('.stage'); if (b) goTo(+b.dataset.i);
  };
  return html`<div ref=${root} className="podium" onClick=${onClick}>
    <div className="prog" style=${{ width: blocks.length ? ((cur + 1) / blocks.length * 100) + '%' : 0 }} />
    <button className=${'clock' + (over ? ' over' : '')} onClick=${e => { e.stopPropagation(); if (e.altKey) start.current = Date.now(); else setRemaining(!remaining); }} title="Reset: ⌥click">${clock}</button>
    <button className="ib quiet x" onClick=${() => set({ podium: false })}><${I} name="x" /></button>
    ${outline ? html`<div className="ov">
      <div className="head"><h1>${s.meta.title}</h1></div>
      ${blocks.map((b, i) => html`<div key=${b.id} data-i=${i} className=${'ovr' + (i === cur ? ' cur' : '') + (depth.get(b.id) ? ' d1' : '')} style=${kc(b)} onClick=${e => { e.stopPropagation(); setOutline(false); requestAnimationFrame(() => goTo(i)); }}>
        ${nums.has(b.id) ? html`<span className="n">${nums.get(b.id)}</span>` : html`<span className="k"><${I} name=${KIND_ICON[b.kind] || 'box'} size=${18} /></span>`}
        <span className="t">${b.kind === 'quote' ? headingOf({ body: b.body }) || 'Quote' : headingOf(b) || kindLabel(b)}</span>
        <span className="c">${kindLabel(b)}</span>
      </div>`)}
    </div>` : html`<div className="inner">
      <div className=${'head' + (cur > 0 ? ' off' : '')}>${metaLine(s.meta) && html`<div className="cap">${metaLine(s.meta)}</div>`}<h1>${s.meta.title}</h1>${s.meta.big_idea && html`<div className="bi">${s.meta.big_idea}</div>`}</div>
      ${blocks.map((b, i) => html`<div key=${b.id} data-i=${i} className=${'stage ' + b.kind + (i === cur ? ' cur' : '')} style=${kc(b)}>
        <div className="cap">${kindLabel(b)}</div>
        ${b.kind === 'scripture' && b.heading && html`<div className="hd">${b.heading}</div>`}
        ${b.heading && b.kind !== 'scripture' && b.kind !== 'quote' && html`<div className="hd">${nums.has(b.id) && html`<span className="n">${nums.get(b.id)}</span>`}${b.heading}</div>`}
        <div className="bd" dangerouslySetInnerHTML=${{ __html: mdHtml(b.body, { scripture: b.kind === 'scripture', refs: b.kind !== 'scripture' }) }} />
        ${b.kind === 'quote' && b.heading && html`<div className="cap" style=${{ marginTop: '.3em' }}>— ${b.heading}</div>`}
      </div>`)}
    </div>`}
    ${pop && html`<div className="vpop" style=${{ top: pop.top, left: pop.left }} onClick=${e => e.stopPropagation()}><b>${pop.ref}</b>${pop.text}</div>`}
    <div className="aids">
      <button className=${notes ? 'on' : ''} onClick=${e => { e.stopPropagation(); setNotes(!notes); }}>Notes</button>
      <button className=${outline ? 'on' : ''} onClick=${e => { e.stopPropagation(); toggleOutline(); }}>Outline</button>
    </div>
    <div className="pos">${blocks.length ? (cur + 1) + ' / ' + blocks.length : ''}</div>
  </div>`;
}
