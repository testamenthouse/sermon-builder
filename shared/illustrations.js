// Illustration library ↔ sermon glue. A sermon uses an illustration when an illustration block's heading is its title,
// so the link survives hand edits and files with no extra markup.
(function (SB) {
'use strict';
const norm = s => String(s || '').trim().toLowerCase();

// Body an illustration block gets when it is filled from the library: the text, then the source as an em-dash line.
function illustrationBody(ill) {
  const body = String(ill.body || '').trim(), source = String((ill.meta ? ill.meta.source : ill.source) || '').trim();
  return body + (source ? (body ? '\n\n' : '') + '— ' + source : '');
}
const illustrationTitle = ill => String((ill.meta ? ill.meta.title : ill.title) || '');
const illustrationTags = ill => (ill.meta ? ill.meta.tags : ill.tags) || [];

// Sermons (never templates) with an illustration block whose heading is this illustration's title.
function illustrationUses(ill, sermons) {
  const t = norm(illustrationTitle(ill)); if (!t) return [];
  return (sermons || []).filter(s => !(s.meta && s.meta.template) && (s.blocks || []).some(b => b.kind === 'illustration' && norm(b.heading) === t));
}
// Title, tags, source and body all count for the find field.
function illustrationMatches(ill, q) {
  const needle = norm(q); if (!needle) return true;
  const source = (ill.meta ? ill.meta.source : ill.source) || '';
  return [illustrationTitle(ill), source, String(ill.body || ''), ...illustrationTags(ill)].some(x => norm(x).includes(needle));
}
(SB.shared ||= {}).illustrations = { illustrationBody, illustrationTitle, illustrationUses, illustrationMatches };
})(globalThis.SB ||= {});
