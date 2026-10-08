// The starter templates. They are seeded into a library's Templates/ folder the first time it opens without one;
// from then on the folder is the only source (edit, rename, delete, add — the app reads the files).
(function (SB) {
'use strict';
const { serializeSermon, normalizeMeta, slugify, newId } = SB.shared.format;

const TEMPLATES_DIR = 'Templates';
const B = (kind, heading = '', body = '') => ({ kind, heading, body });
const explain = () => [B('point'), B('scripture'), B('illustration'), B('application')];

const SEED_TEMPLATES = [
  { name: 'Three Point', blocks: [B('intro'), B('scripture'), ...explain(), B('transition'), ...explain(), B('transition'), ...explain(), B('conclusion'), B('invitation')] },
  { name: 'Verse by Verse', blocks: [B('intro'), B('custom', 'Background'), B('scripture'), B('custom', 'Explanation'), B('scripture'), B('custom', 'Explanation'), B('illustration'), B('scripture'), B('custom', 'Explanation'), B('application'), B('conclusion')] },
  { name: 'Me · We · God · You · We', blocks: [B('custom', 'Me'), B('custom', 'We'), B('custom', 'God'), B('scripture'), B('custom', 'You'), B('application'), B('custom', 'We'), B('conclusion')] },
  { name: 'Defender', blocks: [B('intro'), B('custom', 'Principle'), B('scripture'), B('custom', 'Objection'), B('custom', 'Defense'), B('scripture'), B('application'), B('conclusion')] },
  { name: 'Children', blocks: [B('intro'), B('custom', 'Word of the Day'), B('custom', 'Bible Story'), B('scripture'), B('illustration'), B('application'), B('question'), B('custom', 'Game')] },
  { name: 'Youth', blocks: [B('custom', 'Capture'), B('custom', 'Connect'), B('custom', 'Consider'), B('scripture'), B('custom', 'Collide'), B('custom', 'Call'), B('invitation')] },
  { name: 'Topical', blocks: [B('intro'), B('custom', 'The Question'), B('point'), B('scripture'), B('point'), B('scripture'), B('point'), B('scripture'), B('illustration'), B('application'), B('conclusion'), B('invitation')] },
  { name: 'Narrative', blocks: [B('intro'), B('custom', 'The Story'), B('scripture'), B('custom', 'The Tension'), B('custom', 'The Turn'), B('scripture'), B('custom', 'The Truth'), B('application'), B('conclusion')] },
  { name: 'Bible Study', blocks: [B('intro'), B('scripture'), B('custom', 'Observation'), B('custom', 'Interpretation'), B('question'), B('question'), B('question'), B('application'), B('prayer')] },
  { name: 'Wedding', blocks: [B('custom', 'Welcome'), B('scripture'), B('custom', 'Charge'), B('illustration'), B('custom', 'Vows'), B('custom', 'Rings'), B('custom', 'Pronouncement'), B('prayer')] },
  { name: 'Funeral', blocks: [B('custom', 'Welcome'), B('scripture'), B('custom', 'Remembrance'), B('illustration'), B('custom', 'Comfort'), B('scripture'), B('custom', 'Hope'), B('invitation'), B('prayer')] },
  { name: 'Baby Dedication', blocks: [B('custom', 'Welcome'), B('scripture'), B('custom', 'Charge to Parents'), B('custom', 'Charge to Church'), B('prayer')] },
  { name: 'Graduation', blocks: [B('intro'), B('scripture'), B('point', 'Remember'), B('point', 'Resolve'), B('point', 'Rely'), B('illustration'), B('custom', 'Charge'), B('prayer')] }
];

// → [{ path, meta, blocks, text }] ready to write into the library.
function seedTemplates() {
  return SEED_TEMPLATES.map(t => {
    const meta = normalizeMeta({ title: t.name, template: true });
    const blocks = t.blocks.map(b => ({ id: newId(), kind: b.kind, label: b.kind === 'custom' ? b.heading || '' : '', heading: b.kind === 'custom' ? '' : b.heading || '', body: b.body || '', flags: [] }));
    return { path: TEMPLATES_DIR + '/' + slugify(t.name) + '.md', meta, blocks, text: serializeSermon({ meta, blocks }) };
  });
}
(SB.shared ||= {}).templates = { TEMPLATES_DIR, SEED_TEMPLATES, seedTemplates };
})(globalThis.SB ||= {});
