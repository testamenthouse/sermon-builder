// Dictation through Chrome's Web Speech API; other browsers are refused. Final segments go into a contenteditable through execCommand so the
// editor's own input path (serialize, decorate, autosave, undo) runs unchanged; the partial segment is only
// previewed. "new paragraph" / "new line" inside a segment break the paragraph; "period", "comma",
// "question mark" and the other spoken marks become punctuation (the engine does not do that itself).
(function (SB) {
'use strict';
const isChrome = () => {
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  if (brands) return brands.some(b => b.brand === 'Google Chrome');
  const ua = navigator.userAgent;
  return /Chrome\//.test(ua) && !/Edg\/|OPR\/|Brave|SamsungBrowser|CriOS|Vivaldi|YaBrowser/.test(ua);
};
// The app itself runs only where its folder access and dictation work: Google Chrome.
const supported = () => isChrome();
const WebSR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
// 'web' | null (null outside Chrome: the caller shows the Chrome alert)
function backend() { return WebSR() && isChrome() ? 'web' : null; }

// ---- spoken punctuation, the way macOS Dictation reads it: the command word becomes its mark, attached to the
// word before it (an opening mark to the word after it), and the next word is capitalized after a sentence end.
// A mark the recognizer already attached around the command ("store. Period.") is folded into the spoken one.
const MARKS = {
  close: { period: '.', 'full stop': '.', comma: ',', 'question mark': '?', 'exclamation point': '!', 'exclamation mark': '!', colon: ':', semicolon: ';', ellipsis: '…', 'dot dot dot': '…', 'close quote': '"', 'close quotes': '"', 'end quote': '"', 'end quotes': '"', 'close paren': ')', 'close parenthesis': ')', 'close bracket': ']' },
  open: { 'open quote': '"', 'open quotes': '"', 'begin quote': '"', 'begin quotes': '"', 'open paren': '(', 'open parenthesis': '(', 'open bracket': '[' },
  tight: { hyphen: '-', apostrophe: "'", dash: '—', 'em dash': '—', 'en dash': '–' }
};
const PHRASES = Object.values(MARKS).flatMap(Object.keys).sort((a, b) => b.length - a.length).map(p => p.replace(/ /g, '\\s+')).join('|');
const SPOKEN = new RegExp(`\\s*([.,;:!?]?)\\s*\\b(${PHRASES})\\b[.,;:!?]?\\s*`, 'gi');
function spokenPunctuation(text) {
  let t = String(text || '').replace(SPOKEN, (m, lead, phrase) => {
    const key = phrase.toLowerCase().replace(/\s+/g, ' ');
    if (key in MARKS.close) return MARKS.close[key] + ' ';
    if (key in MARKS.open) return lead + ' ' + MARKS.open[key];
    return MARKS.tight[key];
  });
  t = t.replace(/ +/g, ' ').replace(/ ([.,;:!?…)\]])/g, '$1').trim();
  return t.replace(/([.!?]["')\]]?\s+)(\p{Ll})/gu, (m, a, c) => a + c.toUpperCase()); // an ellipsis trails off, the sentence goes on
}

// ---- text joining: a space before the segment unless the paragraph is empty, ends in whitespace or the segment
// starts with punctuation; a capital when the segment starts a paragraph or follows a sentence end; a spoken mark
// the paragraph already ends with is not doubled.
const SENTENCE_END = /[.!?…]["')\]]?\s*$/;
function joinText(before, seg) {
  let t = spokenPunctuation(seg); if (!t) return '';
  const b = String(before || '').replace(/ /g, ' ');
  if (b && /[.,;:!?…]$/.test(b) && t[0] === b[b.length - 1]) { t = t.slice(1).trimStart(); if (!t) return ''; }
  if (b && !/\s$/.test(b) && !/^[,.;:!?)\]'"…]/.test(t)) t = ' ' + t;
  if (!b.trim() || SENTENCE_END.test(b)) t = t.replace(/^(\s*)(\p{Ll})/u, (m, s, c) => s + c.toUpperCase());
  return t;
}
// a spoken "new paragraph" / "new line" as words (Chrome) or as the newlines Apple's recognizer turns them into
const splitCommands = seg => String(seg || '').split(/\s*(?:\bnew\s+(?:paragraph|line)\b[.,]?|\n+)\s*/i);

function paragraphBefore(el) {
  const sel = window.getSelection(); if (!sel.rangeCount || !el.contains(sel.anchorNode)) return '';
  let block = sel.anchorNode; while (block && block.parentNode !== el) block = block.parentNode;
  const r = document.createRange(); r.selectNodeContents(block || el); r.setEnd(sel.anchorNode, sel.anchorOffset);
  return r.toString();
}
const endOf = el => { const r = document.createRange(); r.selectNodeContents(el.lastElementChild || el); r.collapse(false); return r; };

// Where the words land: the contenteditable that had focus when dictation began (else `fallback()`), at its
// caret, followed while the user moves it — into any other editable too. A target that leaves the DOM (chapter
// switch, block delete) gives way to the fallback with the caret at its end.
function createInserter(fallback) {
  let target = null, range = null;
  // follow the caret: into another block, heading or title as well as within the target
  const track = () => {
    const sel = window.getSelection(); if (!sel.rangeCount) return;
    const n = sel.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement), ce = el && el.closest('[contenteditable]');
    if (ce && ce.isContentEditable) { target = ce; range = sel.getRangeAt(0).cloneRange(); }
  };
  const resolve = () => {
    if (!target || !target.isConnected) { target = fallback(); range = null; }
    if (!target) return false;
    if (!range || !range.startContainer.isConnected || !target.contains(range.startContainer)) range = endOf(target);
    return true;
  };
  return {
    begin() {
      const a = document.activeElement; target = a && a.isContentEditable ? a : fallback(); if (!target) return false;
      const sel = window.getSelection();
      range = sel.rangeCount && target.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : endOf(target);
      document.addEventListener('selectionchange', track); return true;
    },
    end() { document.removeEventListener('selectionchange', track); target = null; range = null; },
    target: () => target,
    insert(seg) {
      if (!resolve()) return;
      target.focus({ preventScroll: true });
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      splitCommands(seg).forEach((p, i) => {
        if (i) document.execCommand('insertParagraph');
        const t = joinText(paragraphBefore(target), p); if (t) document.execCommand('insertText', false, t);
      });
      track();
    }
  };
}

// One session. onState: 'starting' | 'listening' | 'off' (always ends with 'off'); onPartial(text); onFinal(text);
// onError(label); onLevel(0…1) = how loud the microphone hears (the web engine only says sound / no sound).
function createDictation({ onState, onPartial, onFinal, onError, onLevel = () => {} }) {
  let active = false, off = null, rec = null, closing = null;
  const finish = () => { if (!active && !closing) return; active = false; clearTimeout(closing); closing = null; if (off) { off(); off = null; } onState('off'); };
  const be = backend();
  const startWeb = lang => {
    const R = WebSR(); rec = new R(); rec.continuous = true; rec.interimResults = true; rec.lang = lang || navigator.language || 'en-US';
    let fatal = false;
    rec.onstart = () => onState('listening');
    rec.onsoundstart = () => onLevel(1); rec.onsoundend = () => onLevel(0);
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) onFinal(r[0].transcript); else interim += r[0].transcript; }
      onPartial(spokenPunctuation(interim));
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { fatal = true; onError('Microphone blocked'); }
      else if (e.error === 'network') { fatal = true; onError('No connection'); }
      else if (e.error === 'audio-capture') { fatal = true; onError('No microphone'); }
      else if (e.error === 'no-speech') onError('No speech heard');
    };
    // Chrome ends a session after silence or a minute; keep listening until told to stop.
    rec.onend = () => { if (active && !fatal) { try { rec.start(); return; } catch (err) {} } finish(); };
    try { rec.start(); } catch (err) { onError('Dictation failed'); finish(); }
  };
  return {
    backend: be,
    start(lang) { if (active || !be) return; active = true; onState('starting'); startWeb(lang); },
    stop() {
      if (!active) return; active = false;
      closing = setTimeout(finish, 3000);
      if (rec) { try { rec.stop(); } catch (err) { finish(); } }
    },
    get active() { return active; }
  };
}
(SB.lib ||= {}).dictation = { isChrome, supported, backend, spokenPunctuation, joinText, splitCommands, paragraphBefore, createInserter, createDictation };
})(globalThis.SB ||= {});
