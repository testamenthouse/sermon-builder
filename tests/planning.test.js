import test from 'node:test';
import assert from 'node:assert/strict';
import { planning, format } from '../shared/node.js';
const { weekStart, weeksBetween, addDays, normPlan, slotService, slotDate, fmtTime, parsePreached, preachedEntry, sermonDates, sermonBooks, sermonTouches, pillarSpan, collectionSpan, pillarsIn, roadmapText, serviceColumns } = planning;
const { parseSermon } = format;

const SERVICES = [{ name: 'Sunday morning teaching', day: 0, time: '10:00' }, { name: 'Sunday morning preaching', day: 0, time: '11:00' }, { name: 'Wednesday', day: 3, time: '19:00' }];

test('weeks start on Sunday', () => {
  assert.equal(weekStart('2026-10-15'), '2026-10-11'); // a Thursday
  assert.equal(weekStart('2026-10-11'), '2026-10-11');
  assert.deepEqual(weeksBetween('2026-10-15', '2026-10-26'), ['2026-10-11', '2026-10-18', '2026-10-25']);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
test('plan normalizes and drops junk', () => {
  const p = normPlan({ services: [{ name: ' Wednesday ', day: '3', time: '19:00' }, { name: '' }], guests: [{ date: '2026-11-01', service: 'Wednesday', name: 'Bro. Smith' }, { date: 'nope', name: 'x' }], pillars: [{ name: 'Prayer', color: '#bfe0f5', from: '2026-10', to: '2027-01' }, { name: 'Bad', from: '2027-02', to: '2027-01' }] });
  assert.deepEqual(p.services, [{ name: 'Wednesday', day: 3, time: '19:00' }]);
  assert.equal(p.guests.length, 1); assert.equal(p.pillars.length, 1);
  assert.deepEqual(normPlan(null), { services: [], guests: [], pillars: [] });
  assert.deepEqual(serviceColumns([]), [{ name: '', day: 0, time: '' }]);
});
test('slots: a service by name, else the first on that weekday, else the first', () => {
  assert.equal(slotService('Wednesday', '2026-10-14', SERVICES), 'Wednesday');
  assert.equal(slotService('', '2026-10-14', SERVICES), 'Wednesday');
  assert.equal(slotService('', '2026-10-11', SERVICES), 'Sunday morning teaching');
  assert.equal(slotService('Friday night', '2026-10-16', SERVICES), 'Sunday morning teaching');
  assert.equal(slotService('', '2026-10-11', []), '');
  assert.equal(slotDate('2026-10-11', SERVICES[2]), '2026-10-14');
  assert.equal(fmtTime('19:00'), '7:00 PM'); assert.equal(fmtTime('10:00'), '10:00 AM'); assert.equal(fmtTime(''), '');
});
test('preached entries carry a date and an optional service', () => {
  assert.deepEqual(parsePreached('2026-10-25 Sunday morning preaching'), { date: '2026-10-25', service: 'Sunday morning preaching' });
  assert.deepEqual(parsePreached('2026-10-25'), { date: '2026-10-25', service: '' });
  assert.equal(parsePreached('soon'), null);
  assert.equal(preachedEntry('2026-10-25', 'Wednesday'), '2026-10-25 Wednesday');
  const s = parseSermon('---\ntitle: Again\ndate: 2026-01-04\nservice: Wednesday\npreached: [2026-06-07 Sunday morning preaching, 2026-03-01]\n---\n');
  assert.deepEqual(sermonDates(s).map(e => [e.date, e.service, e.repeat]), [['2026-01-04', 'Wednesday', false], ['2026-03-01', '', true], ['2026-06-07', 'Sunday morning preaching', true]]);
});
test('books a sermon touches', () => {
  const s = parseSermon('---\ntitle: T\npassage: Psalm 23\n---\n::: scripture John 10:11-14\n:::\n::: scripture Jn 3:16\n:::\n');
  assert.deepEqual([...sermonBooks(s)].sort((a, b) => a - b), [18, 42]);
  assert.equal(sermonTouches(s, 42, 10), true); assert.equal(sermonTouches(s, 42, 4), false); assert.equal(sermonTouches(s, 18, 23), true);
});
test('year geometry', () => {
  assert.deepEqual(pillarSpan({ from: '2026-10', to: '2027-01' }, 2026), [9 / 12, 1]);
  assert.deepEqual(pillarSpan({ from: '2026-10', to: '2027-01' }, 2027), [0, 1 / 12]);
  assert.equal(pillarSpan({ from: '2026-10', to: '2027-01' }, 2025), null);
  const sp = collectionSpan([parseSermon('---\ntitle: A\ndate: 2026-07-01\n---\n'), parseSermon('---\ntitle: B\ndate: 2026-12-31\n---\n'), parseSermon('---\ntitle: C\ndate: 2025-01-01\n---\n')], 2026);
  assert.ok(sp.from > 0.49 && sp.from < 0.5); assert.ok(sp.to > 0.99); assert.equal(sp.ticks.length, 2);
  assert.deepEqual(pillarsIn([{ name: 'P', from: '2026-10', to: '2026-12' }], '2026-11').map(p => p.name), ['P']);
  assert.deepEqual(pillarsIn([{ name: 'P', from: '2026-10', to: '2026-12' }], '2027-01'), []);
});
test('roadmap text', () => {
  const t = roadmapText({ name: 'Kingdom', big_idea: 'Unshakable.' }, [parseSermon('---\ntitle: Two\ndate: 2026-10-18\nservice: Sunday morning preaching\npassage: Matthew 7:24-27\nbig_idea: Build on the rock.\n---\n'), parseSermon('---\ntitle: One\ndate: 2026-10-11\n---\n')]);
  assert.equal(t, 'Kingdom\nUnshakable.\n\n1. 2026-10-11 — One\n2. 2026-10-18, Sunday morning preaching — Two\n   Matthew 7:24-27\n   Build on the rock.\n');
});
