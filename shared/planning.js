// Planning: services (the weekly teaching slots), the dates a sermon was or will be preached, week rows for the
// Schedule, month spans for pillars and collections in the Year view, the books a sermon touches, and the roadmap
// text for the worship and media team. Pure functions; the store and the tests both use them.
(function (SB) {
'use strict';
const { parseRef, formatRef } = SB.shared.bible;
const { BOOKS } = SB.shared.books;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const isDate = s => !!parse(s);
const isMonth = s => /^\d{4}-\d{2}$/.test(s || '');
function addDays(s, n) { const d = parse(s); if (!d) return s; d.setDate(d.getDate() + n); return ymd(d); }
function weekday(s) { const d = parse(s); return d ? d.getDay() : 0; }
// The Sunday that starts the week a date falls in.
function weekStart(s) { const d = parse(s); if (!d) return s; return addDays(s, -d.getDay()); }
// Every week start from the week of `from` through the week holding `to`.
function weeksBetween(from, to) { const out = []; let w = weekStart(from); const end = weekStart(to); while (w <= end) { out.push(w); w = addDays(w, 7); } return out; }

// sermon.json `plan`: services, guests and pillars, each a list. Anything malformed is dropped.
function normPlan(p) {
  p = p && typeof p === 'object' ? p : {};
  const arr = k => Array.isArray(p[k]) ? p[k] : [];
  return {
    services: arr('services').map(x => ({ name: String((x && x.name) || '').trim(), day: Number.isInteger(+(x && x.day)) ? Math.min(6, Math.max(0, +x.day)) : 0, time: String((x && x.time) || '').trim() })).filter(x => x.name),
    guests: arr('guests').map(x => ({ date: String((x && x.date) || '').trim(), service: String((x && x.service) || '').trim(), name: String((x && x.name) || '').trim() })).filter(x => isDate(x.date) && x.name).sort((a, b) => a.date.localeCompare(b.date)),
    pillars: arr('pillars').map(x => ({ name: String((x && x.name) || '').trim(), color: /^#[0-9a-f]{6}$/i.test((x && x.color) || '') ? x.color : '', from: String((x && x.from) || '').trim(), to: String((x && x.to) || '').trim() })).filter(x => x.name && isMonth(x.from) && isMonth(x.to) && x.from <= x.to).sort((a, b) => a.from.localeCompare(b.from) || a.name.localeCompare(b.name))
  };
}
// With no services configured the Schedule has one unnamed Sunday column and sermons carry no service.
const DEFAULT_SERVICES = [{ name: '', day: 0, time: '' }];
const serviceColumns = services => (services && services.length ? services : DEFAULT_SERVICES);
// Which service an entry on `date` belongs to: its own name when it is a configured service, else the first service
// on that weekday, else the first service. '' when there are no services.
function slotService(name, date, services) {
  const cols = serviceColumns(services);
  if (name && cols.some(s => s.name === name)) return name;
  const wd = weekday(date), onDay = cols.find(s => s.day === wd);
  return (onDay || cols[0]).name;
}
// The date a service falls on inside the week that starts on `week`.
function slotDate(week, service) { return addDays(week, service ? service.day : 0); }
// 10:00 AM from "10:00"; '' stays ''.
function fmtTime(t) { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); if (!m) return t || ''; const h = +m[1], ap = h < 12 ? 'AM' : 'PM'; return (h % 12 || 12) + ':' + m[2] + ' ' + ap; }

// `preached:` entries are "YYYY-MM-DD" or "YYYY-MM-DD Service name".
function parsePreached(entry) { const m = /^(\d{4}-\d{2}-\d{2})(?:\s+(.*))?$/.exec(String(entry || '').trim()); return m && isDate(m[1]) ? { date: m[1], service: (m[2] || '').trim() } : null; }
function preachedEntry(date, service) { return date + (service ? ' ' + service : ''); }
// Every date a sermon stands on: its own date, then each repeat. { date, service, repeat }.
function sermonDates(s) {
  const m = s.meta || {}, out = [];
  if (isDate(m.date)) out.push({ date: m.date, service: m.service || '', repeat: false });
  for (const e of m.preached || []) { const p = parsePreached(e); if (p) out.push({ date: p.date, service: p.service, repeat: true, entry: e }); }
  return out;
}

// Book indexes a sermon touches: its passage and every scripture block's reference.
function sermonBooks(s) {
  const out = new Set();
  const add = r => { const p = parseRef(r); if (p) for (const x of p.refs) out.add(x.book); };
  if (s.meta && s.meta.passage) add(s.meta.passage);
  for (const b of s.blocks || []) if (b.kind === 'scripture' && b.heading) add(b.heading);
  return out;
}
// True when any reference in the sermon reaches into this chapter of this book.
function sermonTouches(s, book, chapter) {
  const hit = r => { const p = parseRef(r); return !!p && p.refs.some(x => x.book === book && x.c1 <= chapter && chapter <= x.c2); };
  return !!(s.meta && s.meta.passage && hit(s.meta.passage)) || (s.blocks || []).some(b => b.kind === 'scripture' && b.heading && hit(b.heading));
}

// Year view geometry: a span as fractions of the year, 0 = Jan 1, 1 = past Dec 31; null when it misses the year.
const monthFrac = (ym, year, end) => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + (end ? 1 : 0); return (y - year) + m / 12; };
function pillarSpan(p, year) { const a = monthFrac(p.from, year, false), b = monthFrac(p.to, year, true); if (b <= 0 || a >= 1) return null; return [Math.max(0, a), Math.min(1, b)]; }
function dateFrac(s, year) { const d = parse(s); if (!d) return null; const start = new Date(year, 0, 1), days = (new Date(year + 1, 0, 1) - start) / 864e5; return (d - start) / 864e5 / days; }
// A collection's span across a year: first sermon date to last, over the dates that fall in that year (ticks = each date).
function collectionSpan(sermons, year) {
  const ds = []; for (const s of sermons) for (const e of sermonDates(s)) if (e.date.slice(0, 4) === String(year)) ds.push(e.date);
  if (!ds.length) return null; ds.sort();
  const a = dateFrac(ds[0], year), b = dateFrac(ds[ds.length - 1], year);
  return { from: a, to: b, ticks: ds.map(d => dateFrac(d, year)) };
}
// Pillars that cover a month ("2026-10").
function pillarsIn(pillars, ym) { return (pillars || []).filter(p => p.from <= ym && ym <= p.to); }

// The roadmap as plain text, for a message to the team. Sermons in date order; undated ones last.
function roadmapText(col, sermons, { fmtDate = d => d } = {}) {
  const list = [...sermons].sort((a, b) => (a.meta.date || '9999').localeCompare(b.meta.date || '9999') || a.meta.title.localeCompare(b.meta.title));
  const lines = [col.name];
  if (col.big_idea) lines.push(col.big_idea);
  lines.push('');
  list.forEach((s, i) => {
    const m = s.meta, head = (i + 1) + '. ' + (m.date ? fmtDate(m.date) + (m.service ? ', ' + m.service : '') + ' — ' : '') + m.title;
    lines.push(head);
    if (m.passage) lines.push('   ' + m.passage);
    if (m.big_idea) lines.push('   ' + m.big_idea);
  });
  return lines.join('\n') + '\n';
}
// Every entry that stands on a date: sermons at their date and each repeat, guests from the plan.
function entriesByDate(sermons, guests) {
  const by = {};
  const put = (d, e) => (by[d] = by[d] || []).push(e);
  for (const s of sermons) for (const e of sermonDates(s)) put(e.date, { sermon: s, repeat: e.repeat, entry: e.entry, service: e.service });
  for (const g of guests || []) put(g.date, { guest: g, service: g.service });
  return by;
}
// The schedule as data: every slot (week × service) from `from` through `to`, with the entries that land in it
// (its own service, else the first service on its weekday, else the first — slotService). The view, the print and the CSV all read this.
function scheduleSlots(sermons, guests, services, from, to) {
  const cols = serviceColumns(services), by = entriesByDate(sermons, guests), inSlot = {};
  for (const d of Object.keys(by)) for (const e of by[d]) { const k = weekStart(d) + '|' + slotService(e.service, d, services); (inSlot[k] = inSlot[k] || []).push({ ...e, date: d }); }
  const out = [];
  for (const w of weeksBetween(from, to)) for (const sv of cols) out.push({ week: w, service: sv, date: slotDate(w, sv), entries: inSlot[w + '|' + sv.name] || [] });
  return out;
}
// What a printed or exported schedule covers: this week through the last planned entry, never less than thirteen weeks.
function scheduleSpan(sermons, guests, today) {
  const from = weekStart(today); let to = addDays(from, 7 * 12);
  for (const d of Object.keys(entriesByDate(sermons, guests))) if (d > to) to = d;
  return { from, to };
}
const csvCell = v => { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
// One row per entry, an open slot as one empty row; RFC 4180 quoting, CRLF line ends.
function scheduleCsv(slots) {
  const rows = [['Week', 'Date', 'Service', 'Title', 'Collection', 'Passage', 'Status', 'Type']];
  for (const sl of slots) {
    if (!sl.entries.length) rows.push([sl.week, sl.date, sl.service.name, '', '', '', '', '']);
    for (const e of sl.entries) rows.push(e.guest ? [sl.week, e.date, sl.service.name, e.guest.name, '', '', '', 'Guest']
      : [sl.week, e.date, sl.service.name, e.sermon.meta.title, e.sermon.dir || e.sermon.meta.collection || '', e.sermon.meta.passage || '', e.sermon.meta.status || '', e.repeat ? 'Repeat' : 'Sermon']);
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
(SB.shared ||= {}).planning = { DAYS, ymd, addDays, weekday, weekStart, weeksBetween, normPlan, serviceColumns, slotService, slotDate, fmtTime, parsePreached, preachedEntry, sermonDates, sermonBooks, sermonTouches, pillarSpan, dateFrac, collectionSpan, pillarsIn, roadmapText, formatRef, BOOKS, entriesByDate, scheduleSlots, scheduleSpan, scheduleCsv };
})(globalThis.SB ||= {});
