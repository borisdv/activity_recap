import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInsight } from '../src/lib/insights.js';
import * as stats from '../src/lib/stats.js';

let n = 0;
const act = (date, category, distanceKm, hours = 1) => ({
  id: `${date}|${category}|${n++}`,
  title: category,
  typeKey: category,
  typeLabel: category,
  category,
  start: `${date}T08:00:00`,
  date,
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
  distanceM: distanceKm ? distanceKm * 1000 : null,
  durationS: hours * 3600,
  movingS: null,
  elevationGainM: null,
  calories: null,
  avgHr: null,
  maxHr: null,
});

const data = [
  act('2025-02-01', 'running', 10),
  act('2025-03-01', 'cycling', 50, 2),
  act('2025-09-01', 'cycling', 80, 3),
  act('2026-02-01', 'running', 20, 2),
  act('2026-03-01', 'cycling', 40, 2),
];

test('insight says how far ahead of the same point last year', () => {
  const list = stats.forYear(data, 2026);
  const cmp = stats.comparisonFor(data, 2026);
  const [first, second] = buildInsight({ list, cmp, units: 'metric', sport: 'all' });
  assert.equal(first, "You're level with this point of 2025."); // 60 km by Mar 1 in both years
  assert.equal(second, 'Running is up 100%, cycling is down 20%.');
});

test('insight reports a lead in distance', () => {
  const more = [...data, { ...data[3], id: 'x', date: '2026-02-02', start: '2026-02-02T08:00:00', distanceM: 15_000 }];
  const [first] = buildInsight({ list: stats.forYear(more, 2026), cmp: stats.comparisonFor(more, 2026), units: 'metric', sport: 'all' });
  assert.equal(first, "You're 15 km ahead of this point in 2025.");
});

test('insight for a full past year without a previous year', () => {
  const list = stats.forYear(data, 2025);
  const sentences = buildInsight({ list, cmp: null, units: 'metric', sport: 'all' });
  assert.match(sentences[0], /^Mostly cycling: 83% of your time\.$/);
  assert.match(sentences[1], /September was the busiest month/);
});

test('dashboard helpers', () => {
  assert.equal(stats.dayOfYear('2025-03-01'), 60);
  assert.equal(stats.dayOfYear('2024-03-01'), 61);
  assert.equal(stats.daysCovered(2026, '2026-03-01'), 60);
  assert.equal(stats.daysCovered(2024, '2026-03-01'), 366);
  assert.equal(stats.byWeek(data.filter((a) => a.year === 2025))[4].count, 1); // Feb 1 = day 32 -> week 4
  assert.deepEqual(stats.weekdayCounts([act('2025-11-24', 'running', 5)]), [1, 0, 0, 0, 0, 0, 0]); // a Monday
  assert.deepEqual(stats.longestStreakRange([act('2025-01-01', 'running'), act('2025-01-02', 'running'), act('2025-01-05', 'running')]), {
    length: 2,
    start: '2025-01-01',
    end: '2025-01-02',
  });
});

test('a sport that stopped reads as "no ... yet" rather than -100%', () => {
  const list = [act('2024-02-01', 'swimming', 2), act('2024-03-01', 'running', 10), act('2025-03-01', 'running', 20)];
  const cmp = stats.comparisonFor(list, 2025);
  const sentences = buildInsight({ list: stats.forYear(list, 2025), cmp, units: 'metric', sport: 'all' });
  assert.equal(sentences[1], 'Running is up 100%, no swimming yet.');
});
