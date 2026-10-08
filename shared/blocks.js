// Block kinds. `heading` says what the first fence-line text means for that kind; `body` whether a body is expected.
export const KINDS = [
  { kind: 'intro', label: 'Introduction', heading: '' },
  { kind: 'point', label: 'Point', heading: 'Point' },
  { kind: 'scripture', label: 'Scripture', heading: 'Reference' },
  { kind: 'illustration', label: 'Illustration', heading: 'Title' },
  { kind: 'application', label: 'Application', heading: '' },
  { kind: 'quote', label: 'Quote', heading: 'Source' },
  { kind: 'transition', label: 'Transition', heading: '' },
  { kind: 'conclusion', label: 'Conclusion', heading: '' },
  { kind: 'prayer', label: 'Prayer', heading: '' },
  { kind: 'invitation', label: 'Invitation', heading: '' },
  { kind: 'question', label: 'Question', heading: '' },
  { kind: 'note', label: 'Note', heading: '' },
  { kind: 'custom', label: 'Custom', heading: 'Headline' }, // custom blocks also carry `label`: the caption word(s)
  { kind: 'text', label: 'Text', heading: '' }
];
export const KIND = Object.fromEntries(KINDS.map(k => [k.kind, k]));
// Ink colors a kind may wear (caption, glyph, number, a point's rule). '' = the faint token. Chosen to read on white and on charcoal.
export const KIND_COLORS = ['', '#78716c', '#dc2626', '#d97706', '#65a30d', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];
export const DEFAULT_KIND_COLORS = { intro: '', point: '#2563eb', scripture: '#dc2626', illustration: '#d97706', application: '#16a34a', quote: '#7c3aed', transition: '', conclusion: '', prayer: '#db2777', invitation: '#db2777', question: '#0891b2', note: '', custom: '#65a30d', text: '' };
export const kindColor = (kind, colors) => (colors && colors[kind]) || '';
export const FLAGS = ['hidden'];
export function isKind(k) { return !!KIND[k]; }
// What the outline / caption shows for a block: custom blocks are captioned by their own label (their heading is a headline like any other kind's).
export function kindLabel(b) { return b.kind === 'custom' ? ((b.label || '').trim() || 'Custom') : (KIND[b.kind] || KIND.text).label; }
