import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseCsv } from '../js/csv.js';
import { categorize, normalizeTypeKey } from '../js/categories.js';
import {
  mergeActivities,
  parseDuration,
  parseExportFile,
  parseGarminCsv,
  parseGarminJson,
  parseLocalDateTime,
  parseNumber,
} from '../js/garmin.js';

test('parseCsv handles quotes, escaped quotes, CRLF, BOM and blank lines', () => {
  const text = '﻿a,b,c\r\n"x, y","say ""hi""",3\r\n\r\n"multi\nline",,\n';
  assert.deepEqual(parseCsv(text), [
    ['a', 'b', 'c'],
    ['x, y', 'say "hi"', '3'],
    ['multi\nline', '', ''],
  ]);
});

test('parseCsv detects semicolon delimiters', () => {
  assert.deepEqual(parseCsv('a;b\n1,5;2\n'), [
    ['a', 'b'],
    ['1,5', '2'],
  ]);
});

test('parseNumber understands Garmin number formats', () => {
  assert.equal(parseNumber('5.01'), 5.01);
  assert.equal(parseNumber('1,500'), 1500);
  assert.equal(parseNumber('12,345.6'), 12345.6);
  assert.equal(parseNumber('5,01'), 5.01);
  assert.equal(parseNumber('--'), null);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber(undefined), null);
  assert.equal(parseNumber(42), 42);
});

test('parseDuration converts clock strings to seconds', () => {
  assert.equal(parseDuration('01:02:03'), 3723);
  assert.equal(parseDuration('45:12'), 2712);
  assert.equal(parseDuration('00:45:12.5'), 2712.5);
  assert.equal(parseDuration('--'), null);
});

test('parseLocalDateTime keeps wall-clock time', () => {
  assert.equal(parseLocalDateTime('2024-03-05 07:02:09'), '2024-03-05T07:02:09');
  assert.equal(parseLocalDateTime('2024-3-5'), '2024-03-05T00:00:00');
  assert.equal(parseLocalDateTime('nonsense'), null);
});

test('activity types map to categories', () => {
  const cases = {
    Running: 'running',
    'Trail Running': 'running',
    treadmill_running: 'running',
    'Road Cycling': 'cycling',
    'Gravel/Unpaved Cycling': 'cycling',
    'Mountain Biking': 'cycling',
    virtual_ride: 'cycling',
    'Pool Swim': 'swimming',
    open_water_swimming: 'swimming',
    Hiking: 'walking',
    Walking: 'walking',
    'Resort Skiing/Snowboarding': 'winter',
    backcountry_skiing_ws: 'winter',
    'Cross Country Classic Skiing': 'winter',
    'Strength Training': 'fitness',
    'Indoor Rowing': 'fitness',
    Yoga: 'fitness',
    Rowing: 'water',
    'Stand Up Paddleboarding': 'water',
    Golf: 'other',
    multi_sport: 'other',
  };
  for (const [type, expected] of Object.entries(cases)) {
    assert.equal(categorize(type), expected, type);
  }
  assert.equal(normalizeTypeKey('Lap Swimming v2'), 'lap_swimming');
});

const CSV_HEADER =
  '"Activity Type","Date","Favorite","Title","Distance","Calories","Time","Avg HR","Max HR","Total Ascent","Moving Time","Elapsed Time"';

test('parseGarminCsv reads a metric export', () => {
  const csv = [
    CSV_HEADER,
    '"Running","2024-06-01 07:30:00","false","Morning Run","10.50","720","00:52:30","150","170","85","00:52:00","00:55:00"',
    '"Pool Swim","2024-06-02 19:00:00","false","Pool Swim","1,500","410","00:32:10","130","150","--","00:30:00","00:35:00"',
    '"Strength Training","2024-06-03 18:00:00","false","Strength","--","300","00:45:00","110","140","--","--","00:45:00"',
  ].join('\n');
  const { activities, skipped } = parseGarminCsv(csv);
  assert.equal(skipped, 0);
  assert.equal(activities.length, 3);

  const [run, swim, gym] = activities;
  assert.equal(run.category, 'running');
  assert.equal(run.distanceM, 10500);
  assert.equal(run.durationS, 3150);
  assert.equal(run.movingS, 3120);
  assert.equal(run.elevationGainM, 85);
  assert.equal(run.calories, 720);
  assert.equal(run.year, 2024);
  assert.equal(run.month, 6);
  assert.equal(run.date, '2024-06-01');

  assert.equal(swim.category, 'swimming');
  assert.equal(swim.distanceM, 1500, 'swims are listed in metres');

  assert.equal(gym.category, 'fitness');
  assert.equal(gym.distanceM, null);
  assert.equal(gym.elevationGainM, null);
});

test('parseGarminCsv converts statute units', () => {
  const csv = [
    CSV_HEADER,
    '"Running","2024-06-01 07:30:00","false","Run","6.2","700","00:52:30","150","170","300","--","--"',
    '"Pool Swim","2024-06-02 19:00:00","false","Swim","1,000","400","00:30:00","130","150","--","--","--"',
  ].join('\n');
  const [run, swim] = parseGarminCsv(csv, { units: 'imperial' }).activities;
  assert.ok(Math.abs(run.distanceM - 9978.0) < 1);
  assert.ok(Math.abs(run.elevationGainM - 91.44) < 0.01);
  assert.ok(Math.abs(swim.distanceM - 914.4) < 0.01, 'swims in yards');
});

test('parseGarminCsv rejects files that are not activity exports', () => {
  assert.throws(() => parseGarminCsv('foo,bar\n1,2\n'), /Garmin Connect activities CSV/);
});

test('parseGarminJson reads the account data export (cm, ms, kJ)', () => {
  const json = JSON.stringify([
    {
      summarizedActivitiesExport: [
        {
          activityId: 1,
          name: 'Riverton Running',
          activityType: 'running',
          startTimeLocal: Date.UTC(2023, 4, 7, 8, 15, 0), // local wall time stored as UTC
          startTimeGmt: Date.UTC(2023, 4, 7, 6, 15, 0),
          duration: 2_418_000,
          movingDuration: 2_400_000,
          distance: 806_430,
          elevationGain: 4_600,
          calories: 2_384.5,
          avgHr: 150,
          maxHr: 171,
        },
      ],
    },
  ]);
  const { activities } = parseGarminJson(json);
  assert.equal(activities.length, 1);
  const a = activities[0];
  assert.equal(a.start, '2023-05-07T08:15:00');
  assert.equal(a.category, 'running');
  assert.equal(a.durationS, 2418);
  assert.equal(a.movingS, 2400);
  assert.ok(Math.abs(a.distanceM - 8064.3) < 1e-9);
  assert.equal(a.elevationGainM, 46);
  assert.ok(Math.abs(a.calories - 570) < 1);
});

test('parseGarminJson reads Connect API activity lists (s, m, kcal)', () => {
  const json = JSON.stringify([
    {
      activityId: 9,
      activityName: 'Long Ride',
      activityType: { typeKey: 'road_biking' },
      startTimeLocal: '2024-08-10 08:00:00',
      duration: 10_800,
      distance: 90_000,
      elevationGain: 900,
      calories: 2_100,
      averageHR: 135,
      maxHR: 168,
    },
  ]);
  const [a] = parseGarminJson(json).activities;
  assert.equal(a.category, 'cycling');
  assert.equal(a.typeLabel, 'Road Biking');
  assert.equal(a.distanceM, 90_000);
  assert.equal(a.durationS, 10_800);
  assert.equal(a.calories, 2_100);
  assert.equal(a.avgHr, 135);
});

test('parseGarminJson drops multisport parents whose legs are present', () => {
  const t = Date.UTC(2024, 6, 1, 7);
  const leg = (id, type, offset) => ({ activityId: id, activityType: type, startTimeLocal: t + offset, duration: 1000, distance: 1000 });
  const json = JSON.stringify([
    { activityId: 1, activityType: 'multi_sport', startTimeLocal: t, duration: 3000, distance: 3000, childIds: [2, 3, 4] },
    leg(2, 'open_water_swimming', 0),
    leg(3, 'cycling', 60_000),
    leg(4, 'running', 120_000),
  ]);
  const { activities, skipped } = parseGarminJson(json);
  assert.deepEqual(
    activities.map((a) => a.category),
    ['swimming', 'cycling', 'running'],
  );
  assert.equal(skipped, 1);
});

test('mergeActivities skips duplicates and sorts by start', () => {
  const csv = (rows) => [CSV_HEADER, ...rows].join('\n');
  const a = parseGarminCsv(
    csv(['"Running","2024-06-02 07:30:00","false","Run","5","1","00:30:00","1","1","1","--","--"']),
  ).activities;
  const b = parseGarminCsv(
    csv([
      '"Running","2024-06-02 07:30:00","false","Run","5","1","00:30:00","1","1","1","--","--"',
      '"Cycling","2024-06-01 07:30:00","false","Ride","20","1","00:50:00","1","1","1","--","--"',
    ]),
  ).activities;
  const merged = mergeActivities(a, b);
  assert.equal(merged.added, 1);
  assert.equal(merged.duplicates, 1);
  assert.deepEqual(
    merged.activities.map((x) => x.date),
    ['2024-06-01', '2024-06-02'],
  );
});

test('parseExportFile picks the parser from the name or content', () => {
  assert.equal(parseExportFile('x.json', '[]').activities.length, 0);
  assert.equal(parseExportFile('export', '[]').activities.length, 0);
  assert.throws(() => parseExportFile('x.json', '{oops'), /invalid JSON/);
});

test('the bundled sample file parses cleanly', () => {
  const text = readFileSync(new URL('../samples/sample-activities.csv', import.meta.url), 'utf8');
  const { activities, skipped } = parseGarminCsv(text);
  assert.equal(skipped, 0);
  assert.ok(activities.length > 500);
  const cats = new Set(activities.map((a) => a.category));
  for (const c of ['running', 'cycling', 'swimming', 'walking', 'winter', 'fitness']) assert.ok(cats.has(c), c);
  const swims = activities.filter((a) => a.category === 'swimming');
  assert.ok(swims.every((s) => s.distanceM >= 1000 && s.distanceM < 5000), 'swim distances in metres');
});
