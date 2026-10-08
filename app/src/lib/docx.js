// Minimal Word export: a store-only zip of the handful of XML parts a .docx needs. Paragraph styles only — no library.
import { zip } from './zip.js';
import { mdLine } from './md.js';
import { kindLabel, kindColor } from '../../../shared/blocks.js';
import { pointNumbers, metaLine } from './print.js';

const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function runs(text) {
  // inline **bold**, *italic*, `code` → runs
  const out = []; const re = /(\*\*|__)(?=\S)([\s\S]*?\S)\1|(?<!\w)(\*|_)(?=\S)([^*_]*?\S)\3(?!\w)|(`+)([^`]+?)\5/g; let i = 0, m;
  while ((m = re.exec(text))) { if (m.index > i) out.push({ t: text.slice(i, m.index) }); if (m[1]) out.push({ t: m[2], b: true }); else if (m[3]) out.push({ t: m[4], i: true }); else out.push({ t: m[6], code: true }); i = re.lastIndex; }
  if (i < text.length) out.push({ t: text.slice(i) });
  return out;
}
const run = r => '<w:r><w:rPr>' + (r.b ? '<w:b/>' : '') + (r.i ? '<w:i/>' : '') + (r.sup ? '<w:vertAlign w:val="superscript"/>' : '') + (r.code ? '<w:rFonts w:ascii="Menlo" w:hAnsi="Menlo"/>' : '') + (r.color ? '<w:color w:val="' + r.color + '"/>' : '') + (r.sz ? '<w:sz w:val="' + r.sz + '"/>' : '') + '</w:rPr><w:t xml:space="preserve">' + x(r.t) + '</w:t></w:r>';
const para = (style, rs, extra = '') => '<w:p><w:pPr>' + (style ? '<w:pStyle w:val="' + style + '"/>' : '') + extra + '</w:pPr>' + rs.map(run).join('') + '</w:p>';
function bodyParas(text, scripture) {
  const out = [];
  for (const line of (text || '').split('\n')) {
    const L = mdLine(line, scripture);
    if (L.t === 'v') out.push(para('Scripture', [{ t: L.mark.trim(), sup: true, color: '808080' }, { t: ' ' }, ...runs(L.c)]));
    else if (L.t[0] === 'h') out.push(para(L.t === 'h1' ? 'Heading2' : 'Heading3', runs(L.c)));
    else if (L.t === 'q') out.push(para('Quote', runs(L.c)));
    else if (L.t === 'ul') out.push(para('Normal', [{ t: '• ' }, ...runs(L.c)], '<w:ind w:left="360" w:hanging="360"/>'));
    else if (L.t === 'ol') out.push(para('Normal', [{ t: L.mark.trim() + ' ' }, ...runs(L.c)], '<w:ind w:left="360" w:hanging="360"/>'));
    else if (L.t === 'hr') out.push(para('Normal', [{ t: '―――' }]));
    else out.push(para('Normal', runs(L.c)));
  }
  return out.join('');
}
export function docxBlob(sermon, colors) {
  const { meta, blocks } = sermon, nums = pointNumbers(blocks);
  let body = para('Title', [{ t: meta.title || 'Untitled' }]);
  if (metaLine(meta)) body += para('Subtitle', [{ t: metaLine(meta) }]);
  if (meta.big_idea) body += para('Normal', [{ t: meta.big_idea, i: true }]);
  for (const b of blocks) {
    body += para('Caption', [{ t: (nums.has(b.id) ? nums.get(b.id) + ' · ' : '') + kindLabel(b).toUpperCase(), color: (kindColor(b.kind, colors) || '#808080').slice(1), sz: 16 }]);
    if (b.heading && b.kind !== 'quote') body += para('Heading1', runs(b.heading));
    body += bodyParas(b.body, b.kind === 'scripture');
    if (b.kind === 'quote' && b.heading) body += para('Normal', [{ t: '— ' + b.heading, i: true }]);
  }
  const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>';
  const st = (id, name, pPr, rPr) => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:pPr>' + pPr + '</w:pPr><w:rPr>' + rPr + '</w:rPr></w:style>';
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="312" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
    st('Title', 'Title', '<w:spacing w:after="60"/>', '<w:b/><w:sz w:val="44"/>') + st('Subtitle', 'Subtitle', '<w:spacing w:after="240"/>', '<w:color w:val="595959"/>') +
    st('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="120" w:after="60"/>', '<w:b/><w:sz w:val="30"/>') + st('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="120" w:after="60"/>', '<w:b/><w:sz w:val="28"/>') + st('Heading3', 'heading 3', '<w:keepNext/>', '<w:b/><w:sz w:val="26"/>') +
    st('Caption', 'caption', '<w:keepNext/><w:spacing w:before="240" w:after="40"/>', '<w:sz w:val="16"/>') + st('Quote', 'Quote', '<w:ind w:left="567"/>', '<w:i/>') + st('Scripture', 'Scripture', '<w:ind w:left="360" w:hanging="360"/>', '') + '</w:styles>';
  const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const drels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const blob = zip([['[Content_Types].xml', types], ['_rels/.rels', rels], ['word/document.xml', doc], ['word/_rels/document.xml.rels', drels], ['word/styles.xml', styles]]);
  return new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
