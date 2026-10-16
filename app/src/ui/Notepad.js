(function (SB) {
'use strict';
const { html } = SB.lib.html;
const { t } = SB.lib.i18n;
const { useEffect, useRef } = React;
const { useStore, setNotes, setSermonNotes, toggleNotes, setNotesTab, toggleBibleSlide } = SB.store;
const { BibleSlide: BibleRead } = SB.ui.Bible;
const { doPrintNotes } = SB.lib.print;
const { MdEditor } = SB.ui.MdEditor;
const { I } = SB.ui.Icons;
const { mdLine, lineOf, linesOf, caretOffset, setCaret, replaceLine, caretTo } = SB.lib.md;

const MARK = { ul: '- ', task: '- [ ] ' }, LISTS = ['ul', 'ol', 'task', 'done'];
// The selection must be in the editor for the editing commands to land; otherwise the caret goes to the end.
function ensure(el) { const sel = window.getSelection(); if (!sel.rangeCount || !el.contains(sel.anchorNode)) { el.focus(); caretTo(el, 'end'); } }
// **bold** / *italic* around the selection, or an empty pair with the caret inside; a selection already wrapped is unwrapped.
function wrap(el, m) {
  ensure(el); const sel = window.getSelection(), p = lineOf(el, sel.anchorNode); if (!p || !p.contains(sel.focusNode)) return;
  const t = sel.toString().replace(/ /g, ' ');
  if (!t) { document.execCommand('insertText', false, m + m); for (let i = 0; i < m.length; i++) sel.modify('move', 'backward', 'character'); return; }
  const un = t.length >= 2 * m.length && t.startsWith(m) && t.endsWith(m);
  document.execCommand('insertText', false, un ? t.slice(m.length, -m.length) : m + t + m);
}
// Bullets, numbers or boxes on every line the selection touches; lines already of that kind lose their marker.
function listify(el, kind) {
  ensure(el); const ps = linesOf(el); if (!ps.length) return;
  const single = ps.length === 1, off = single ? caretOffset(ps[0]) : -1;
  const all = ps.every(p => mdLine(p.textContent).t === kind || (kind === 'task' && mdLine(p.textContent).t === 'done'));
  let n = 1; const prev = ps[0].previousElementSibling; if (kind === 'ol' && prev) { const m = /^(\d+)[.)]\s/.exec(prev.textContent); if (m) n = Number(m[1]) + 1; }
  for (const p of ps) {
    const L = mdLine(p.textContent), rest = LISTS.includes(L.t) ? L.c : p.textContent, was = p.textContent.length;
    const mark = all ? '' : kind === 'ol' ? (n++) + '. ' : MARK[kind], text = mark + rest;
    replaceLine(p, text);
    if (single && off >= 0) setCaret(p, Math.min(text.length, Math.max(mark.length, off + text.length - was)));
  }
}

// The edge tabs on the right of every screen: the Bible (a chapter to read, `BibleSlide` in ui/Bible.js) above the notepad. One panel is out at a time; the tabs ride on the open panel's edge.
// The notepad holds two scratch pads — the open sermon's (`<title>.notes.md` beside it) and the library's (`Notes.md` in
// the root) — chosen by outlined chips while a sermon is open.
function EdgeTabs() {
  const { notes, bibleOpen, screen } = useStore(s => ({ notes: s.notesOpen, bibleOpen: s.bibleSlide, screen: s.screen }));
  return html`<div className=${'edge' + (notes || bibleOpen ? ' shift' : '')}>
    ${screen !== 'bible' && html`<button className=${bibleOpen ? 'on' : ''} title=${t('Bible')} onClick=${() => toggleBibleSlide()}><${I} name="book" /></button>`}
    <button className=${notes ? 'on' : ''} title=${t('Notes')} onClick=${() => toggleNotes()}><${I} name="pen" /></button>
  </div>`;
}
function BibleSlide() {
  const open = useStore(s => s.bibleSlide); const shown = useRef(false), box = useRef(null); if (open) shown.current = true;
  useEffect(() => { if (open && box.current) box.current.focus({ preventScroll: true }); else if (!open && box.current && box.current.contains(document.activeElement)) document.activeElement.blur(); }, [open]); // focus inside, so Esc closes it; given back on close
  return html`<div ref=${box} tabIndex=${-1} className=${'np np-bible' + (open ? ' open' : '')} onKeyDown=${e => { if (e.key === 'Escape') { e.stopPropagation(); toggleBibleSlide(false); } }}>
    ${shown.current && html`<${BibleRead} onClose=${() => toggleBibleSlide(false)} />`}
  </div>`;
}
function Notepad() {
  const { open, tab, screen, narrow, libNotes, sermon, libName, settings, reading } = useStore(s => ({ open: s.notesOpen, tab: s.notesTab, screen: s.screen, narrow: s.narrow, libNotes: s.notes, sermon: s.openPath ? s.sermons.find(x => x.path === s.openPath) : null, libName: s.libName, settings: s.settings, reading: s.reading }));
  const ed = useRef(null);
  const which = sermon ? tab : 'library'; // a sermon stays open behind the Bible, Illustrations and Bookmarks screens it led to
  useEffect(() => { if (open && ed.current && !narrow) { ed.current.focus({ preventScroll: true }); caretTo(ed.current, 'end'); } else if (!open && ed.current && ed.current.contains(document.activeElement)) document.activeElement.blur(); }, [open, which]); // a closed pad gives focus back, so the screen's own keys work again
  const act = fn => e => { e.preventDefault(); if (ed.current) fn(ed.current); };
  const value = which === 'sermon' ? (sermon.notes || '') : libNotes, onChange = which === 'sermon' ? setSermonNotes : setNotes;
  const print = () => doPrintNotes(which === 'sermon' ? sermon.meta.title : libName, value, settings, settings.pageNums);
  return html`<>
  <${EdgeTabs} />
  <${BibleSlide} />
  <div className=${'np' + (open ? ' open' : '')} onKeyDown=${e => { if (e.key === 'Escape') { e.stopPropagation(); toggleNotes(false); } }}>
    <div className="np-h">
      ${sermon ? html`<div className="views np-tabs"><button className=${which === 'sermon' ? 'on' : ''} onClick=${() => setNotesTab('sermon')}>${t('Sermon')}</button><button className=${which === 'library' ? 'on' : ''} onClick=${() => setNotesTab('library')}>${t('Library')}</button></div>` : html`<div className="views np-tabs"><button className="on">${t('Library')}</button></div>`}
      <span style=${{ flex: 1 }} />
      ${value.trim() && !reading ? html`<button className="ib quiet" title=${t('Print')} onClick=${print}><${I} name="printer" /></button>` : null}
      <button className="ib quiet" title=${t('Close')} onClick=${() => toggleNotes(false)}><${I} name="chevron-right" /></button>
    </div>
    <div className="np-f">
      <button className="ib quiet" title=${t('Bold')} onMouseDown=${act(el => wrap(el, '**'))}><${I} name="bold" /></button>
      <button className="ib quiet" title=${t('Italic')} onMouseDown=${act(el => wrap(el, '*'))}><${I} name="italic" /></button>
      <button className="ib quiet" title=${t('Bullets')} onMouseDown=${act(el => listify(el, 'ul'))}><${I} name="list" /></button>
      <button className="ib quiet" title=${t('Numbers')} onMouseDown=${act(el => listify(el, 'ol'))}><${I} name="list-ol" /></button>
      <button className="ib quiet" title=${t('Checklist')} onMouseDown=${act(el => listify(el, 'task'))}><${I} name="checklist" /></button>
    </div>
    <div className="np-body"><${MdEditor} key=${which === 'sermon' ? sermon.path : 'library'} editorRef=${ed} className="np-ed" value=${value} placeholder=${t('Notes')} onChange=${onChange} /></div>
  </div>
  </>`;
}
(SB.ui ||= {}).Notepad = { Notepad };
})(globalThis.SB ||= {});
