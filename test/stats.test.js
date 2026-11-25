import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as stats from '../src/lib/stats.js';
import { niceScale } from '../src/lib/measures.js';
import { formatChange, formatDuration } from '../src/lib/format.js';

let n = 0;
function act(start, category, { distanceM = null, durationS = 3600, elevationGainM = null, calories = null } = {}) {
  n++;
  return {
    id: `${start}|${category}|${n}`,
    title: `${category} ${n}`,
    typeKey: category,
    typeLabel: category,
    category,
    start,
    date: start.slice(0, 10),
    year: Number(start.slice(0, 4)),
    month: Number(start.slice(5, 7)),
    distanceM,
    durationS,
    movingS: null,
    elevationGainM,
    calories,
    avgHr: null,
    maxHr: null,
  };
}

const data = [
  act('2024-01-05T07:00:00', 'running', { distanceM: 10_000, durationS: 3000, elevationGainM: 50 }),
  act('2024-01-06T07:00:00', 'running', { distanceM: 5_000, durationS: 1500 }),
  act('2024-07-01T18:00:00', 'cycling', { distanceM: 50_000, durationS: 7200, elevationGainM: 500 }),
  act('2024-11-30T18:00:00', 'cycling', { distanceM: 20_000, durationS: 3600 }),
  act('2025-01-01T08:00:00', 'running', { distanceM: 12_000, durationS: 3600 }),
  act('2025-01-02T08:00:00', 'fitness', { durationS: 2700 }),
  act('2025-01-03T19:00:00', 'running', { distanceM: 8_000, durationS: 2400 }),
  act('2025-03-10T07:00:00', 'swimming', { distanceM: 2_000, durationS: 2700 }),
];

test('summarize totals a list of activities', () => {
  const s = stats.summarize(stats.forYear(data, 2024));
  assert.equal(s.count, 4);
  assert.equal(s.distanceM, 85_000);
  assert.equal(s.durationS, 15_300);
  assert.equal(s.elevationGainM, 550);
  assert.equal(s.activeDays, 4);
  assert.equal(s.longestStreak, 2);
  assert.equal(s.firstDate, '2024-01-05');
  assert.equal(s.lastDate, '2024-11-30');
});

test('longestStreak counts consecutive days across a year boundary and ignores same-day doubles', () => {
  const list = [
    act('2024-12-30T07:00:00', 'running'),
    act('2024-12-31T07:00:00', 'running'),
    act('2024-12-31T18:00:00', 'cycling'),
    act('2025-01-01T07:00:00', 'running'),
    act('2025-01-03T07:00:00', 'running'),
  ];
  assert.equal(stats.longestStreak(list), 3);
  assert.equal(stats.longestStreak([]), 0);
});

test('yearsIn lists years newest first', () => {
  assert.deepEqual(stats.yearsIn(data), [2025, 2024]);
});

test('byCategory sorts by time and keeps the longest activity', () => {
  const rows = stats.byCategory(stats.forYear(data, 2024));
  assert.deepEqual(
    rows.map((r) => r.category),
    ['cycling', 'running'],
  );
  assert.equal(rows[0].longest.distanceM, 50_000);
  assert.equal(rows[1].count, 2);
  assert.equal(rows[1].distanceM, 15_000);
});

test('byMonth returns twelve buckets with per-category totals', () => {
  const months = stats.byMonth(stats.forYear(data, 2024));
  assert.equal(months.length, 12);
  assert.equal(months[0].total.count, 2);
  assert.equal(months[0].cats.running.distanceM, 15_000);
  assert.equal(months[6].cats.cycling.durationS, 7200);
  assert.equal(months[3].total.count, 0);
});

test('byYearBuckets fills gap years', () => {
  const list = [act('2021-05-01T07:00:00', 'running'), act('2023-05-01T07:00:00', 'running')];
  assert.deepEqual(
    stats.byYearBuckets(list).map((b) => [b.year, b.total.count]),
    [
      [2021, 1],
      [2022, 0],
      [2023, 1],
    ],
  );
});

test('comparisonFor cuts the previous year to the same date when the latest year is partial', () => {
  const cmp = stats.comparisonFor(data, 2025);
  assert.equal(cmp.year, 2024);
  assert.equal(cmp.cutoff, '03-10');
  assert.deepEqual(
    cmp.activities.map((a) => a.date),
    ['2024-01-05', '2024-01-06'],
  );
  assert.equal(stats.comparisonFor(data, 2024), null, 'no 2023 data');
  assert.equal(stats.comparisonFor(data, 'all'), null);
});

test('comparisonFor uses the full previous year for completed years', () => {
  const list = [...data, act('2026-02-01T07:00:00', 'running')];
  const cmp = stats.comparisonFor(list, 2025);
  assert.equal(cmp.cutoff, null);
  assert.equal(cmp.activities.length, 4);
});

test('change and formatChange', () => {
  assert.equal(stats.change(120, 100), 0.2);
  assert.equal(stats.change(5, 0), null);
  assert.equal(formatChange(0.2), '+20%');
  assert.equal(formatChange(-0.054), '−5%');
  assert.equal(formatChange(0.001), '±0%');
  assert.equal(formatChange(null), '');
});

test('highlights finds the standouts', () => {
  const h = stats.highlights(stats.forYear(data, 2024));
  assert.equal(h.longestDuration.distanceM, 50_000);
  assert.equal(h.biggestClimb.elevationGainM, 500);
  assert.equal(h.busiestMonth.key, '2024-07');
  assert.equal(h.morningShare, 0.5);
});

test('formatDuration', () => {
  assert.equal(formatDuration(3723), '1h 02m');
  assert.equal(formatDuration(1500), '25m');
  assert.equal(formatDuration(42), '42s');
});

test('niceScale picks round gridline steps', () => {
  assert.deepEqual(niceScale(230), { step: 50, top: 250 });
  assert.deepEqual(niceScale(3.2, { integer: true }), { step: 1, top: 4 });
  assert.deepEqual(niceScale(12, { integer: true }), { step: 5, top: 15 });
  assert.deepEqual(niceScale(0), { step: 1, top: 1 });
});

test('calendarIndex lines up dates across leap and normal years', () => {
  assert.equal(stats.calendarIndex('2025-01-01'), 0);
  assert.equal(stats.calendarIndex('2024-02-29'), 59);
  assert.equal(stats.calendarIndex('2025-03-01'), 60);
  assert.equal(stats.calendarIndex('2024-03-01'), 60);
  assert.equal(stats.calendarIndex('2025-12-31'), 365);
});

test('cumulativeByYear builds running totals and stops the newest year at the data end', () => {
  const series = stats.cumulativeByYear(data, [2025, 2024], (a) => a.distanceM / 1000, '2025-03-10');
  const [y2025, y2024] = series;
  assert.equal(y2025.endIndex, stats.calendarIndex('2025-03-10'));
  assert.equal(y2025.cumulative[0], 12);
  assert.equal(y2025.cumulative[2], 20);
  assert.equal(y2025.cumulative[365], 22);
  assert.equal(y2024.endIndex, 365);
  assert.equal(y2024.cumulative[4], 10);
  assert.equal(y2024.cumulative[365], 85);
});

test('comparisonFor takes the data end from the full data set when filtering by sport', () => {
  const running = stats.forSport(data, 'running');
  // Running alone ends on Jan 3 2025, but the data goes on to Mar 10.
  const cmp = stats.comparisonFor(running, 2025, stats.latestDate(data));
  assert.equal(cmp.cutoff, '03-10');
  assert.equal(cmp.activities.length, 2);
});

test('breakdown groups by activity type', () => {
  const list = [
    { ...act('2024-01-01T07:00:00', 'running'), typeLabel: 'Trail Running' },
    { ...act('2024-01-02T07:00:00', 'running'), typeLabel: 'Running' },
    { ...act('2024-01-03T07:00:00', 'running', { durationS: 9000 }), typeLabel: 'Trail Running' },
  ];
  const rows = stats.breakdown(list, 'typeLabel');
  assert.deepEqual(
    rows.map((r) => [r.key, r.count]),
    [
      ['Trail Running', 2],
      ['Running', 1],
    ],
  );
});

test('withinCutoff and partialYearCutoff', () => {
  assert.equal(stats.partialYearCutoff('2026-11-22'), '11-22');
  assert.equal(stats.partialYearCutoff('2025-12-31'), null);
  assert.equal(stats.partialYearCutoff(''), null);
  assert.equal(stats.withinCutoff(data, '01-05').length, 4);
});
