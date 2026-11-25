// Generates public/samples/sample-activities.csv: a made-up but plausible athlete,
// written in the same layout as Garmin Connect's "Export CSV".
// Deterministic, so re-running it produces the same file.
//
//   node scripts/make-sample.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/samples/sample-activities.csv', import.meta.url));
const START = Date.UTC(2023, 0, 1);
const END = Date.UTC(2026, 10, 22);
const DAY = 86_400_000;

// mulberry32
let seed = 20231;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a, b) => a + (b - a) * rand();
const chance = (p) => rand() < p;
const pick = (list) => list[Math.floor(rand() * list.length)];

const pad = (n) => String(n).padStart(2, '0');
const hms = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;
const thousands = (n) => Math.round(n).toLocaleString('en-US');

// Gets a bit fitter every year.
const FORM = { 2023: 0.78, 2024: 0.9, 2025: 1.0, 2026: 1.12 };

const rows = [];
function add(day, hour, a) {
  const d = new Date(day);
  const minute = Math.floor(between(0, 59));
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(hour)}:${pad(minute)}:${pad(Math.floor(between(0, 59)))}`;
  const moving = a.seconds;
  const elapsed = moving * between(1.0, 1.08);
  rows.push([
    a.type,
    date,
    'false',
    a.title,
    a.distance ?? '--',
    thousands(a.calories),
    hms(moving),
    String(Math.round(a.hr ?? between(120, 150))),
    String(Math.round((a.hr ?? 135) + between(15, 30))),
    a.ascent != null ? thousands(a.ascent) : '--',
    a.ascent != null ? thousands(a.ascent * between(0.9, 1.05)) : '--',
    hms(moving),
    hms(elapsed),
  ]);
}

function run(kind, km) {
  const pace = between(285, 350); // s/km
  const types = { road: 'Running', trail: 'Trail Running', treadmill: 'Treadmill Running' };
  const titles = {
    road: pick(['Riverton Running', 'Riverton Running', 'Morning Run', 'Tempo Run', 'Easy Run']),
    trail: pick(['Ridge Trail Run', 'Forest Loop', 'Pine Hill Trail Running']),
    treadmill: 'Treadmill Running',
  };
  const s = km * pace * (kind === 'trail' ? 1.2 : 1);
  return {
    type: types[kind],
    title: titles[kind],
    distance: km.toFixed(2),
    seconds: s,
    calories: km * between(60, 72),
    hr: between(140, 158),
    ascent: kind === 'treadmill' ? null : kind === 'trail' ? km * between(25, 55) : km * between(2, 12),
  };
}

function ride(kind, km) {
  const speed = { road: between(25, 31), gravel: between(20, 25), mtb: between(13, 18), indoor: between(28, 33), commute: between(18, 23) }[kind];
  const types = { road: 'Road Cycling', gravel: 'Gravel/Unpaved Cycling', mtb: 'Mountain Biking', indoor: 'Indoor Cycling', commute: 'Cycling' };
  const titles = {
    road: pick(['Riverton Road Cycling', 'Coast Road Loop', 'Hill Repeats Ride', 'Long Ride']),
    gravel: pick(['Gravel Loop', 'Riverton Gravel']),
    mtb: pick(['Pine Hill MTB', 'Ridge Trails MTB']),
    indoor: pick(['Indoor Cycling', 'Zwift - Watopia', 'Turbo Intervals']),
    commute: 'Commute',
  };
  return {
    type: types[kind],
    title: titles[kind],
    distance: km.toFixed(2),
    seconds: (km / speed) * 3600,
    calories: km * between(22, 32),
    hr: between(125, 150),
    ascent: kind === 'indoor' ? null : km * { road: between(6, 16), gravel: between(8, 14), mtb: between(20, 35), commute: between(2, 5) }[kind],
  };
}

function swim(meters, open = false) {
  const pace = between(108, 135); // s/100m
  return {
    type: open ? 'Open Water Swimming' : 'Pool Swim',
    title: open ? 'Lake Swim' : 'Pool Swim',
    distance: thousands(meters),
    seconds: (meters / 100) * pace,
    calories: (meters / 100) * between(28, 36),
    hr: between(125, 145),
    ascent: null,
  };
}

function timed(type, title, minutes, kcalPerMin, hr) {
  return { type, title, seconds: minutes * 60, calories: minutes * kcalPerMin, hr, ascent: null };
}

function hike(km) {
  return {
    type: 'Hiking',
    title: pick(['Pine Ridge Hike', 'Summit Trail', 'Lakeside Hike', 'Valley Walk']),
    distance: km.toFixed(2),
    seconds: (km / between(3.6, 4.8)) * 3600,
    calories: km * between(55, 70),
    hr: between(100, 125),
    ascent: km * between(40, 90),
  };
}

function walk(km) {
  return {
    type: 'Walking',
    title: pick(['Evening Walk', 'Riverton Walking', 'Park Walk']),
    distance: km.toFixed(2),
    seconds: (km / between(4.6, 5.6)) * 3600,
    calories: km * between(45, 55),
    hr: between(90, 110),
    ascent: km * between(3, 12),
  };
}

let vacationUntil = 0;
for (let day = START; day <= END; day += DAY) {
  const d = new Date(day);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const dow = d.getUTCDay(); // 0 = Sunday
  const form = FORM[year];
  const summer = month >= 5 && month <= 9;
  const winter = month === 12 || month <= 2;
  const season = summer ? 1.15 : winter ? 0.85 : 1;

  if (day < vacationUntil) continue;
  if (chance(0.006)) {
    vacationUntil = day + Math.round(between(5, 12)) * DAY;
    continue;
  }
  const p = (base) => Math.min(0.95, base * (0.75 + form * 0.25) * season);

  switch (dow) {
    case 1:
      if (chance(p(0.6))) add(day, 18, timed('Strength Training', 'Strength', between(35, 55), between(5, 7), between(100, 120)));
      break;
    case 2:
      if (chance(p(0.8))) add(day, 7, winter && chance(0.4) ? run('treadmill', between(6, 9) * form) : run('road', between(6, 10) * form));
      if (summer && chance(0.35)) add(day, 8, ride('commute', between(11, 16)));
      break;
    case 3:
      if (summer && chance(0.3)) add(day, 18, swim(Math.round(between(1500, 3000) / 50) * 50, true));
      else if (chance(p(0.55))) add(day, 19, swim(Math.round((between(1500, 2800) * form) / 50) * 50));
      break;
    case 4:
      if (chance(p(0.75))) add(day, 7, run('road', between(7, 11) * form));
      if (summer && chance(0.35)) add(day, 8, ride('commute', between(11, 16)));
      if (winter && chance(0.35)) add(day, 19, ride('indoor', between(25, 40) * form));
      break;
    case 5:
      if (chance(0.25)) add(day, 19, timed('Yoga', 'Yoga', between(30, 60), between(2.5, 3.5), between(80, 95)));
      if (chance(0.12)) add(day, 18, walk(between(3, 7)));
      break;
    case 6:
      if (winter && chance(0.3)) {
        add(day, 9, {
          type: 'Resort Skiing/Snowboarding',
          title: pick(['Snowpeak Resort Skiing', 'Alpine Day']),
          distance: between(20, 45).toFixed(2),
          seconds: between(3, 5.5) * 3600,
          calories: between(900, 1600),
          hr: between(105, 125),
          ascent: between(80, 300),
        });
      } else if (summer ? chance(0.85) : chance(p(0.45))) {
        const kind = summer ? pick(['road', 'road', 'road', 'gravel', 'mtb']) : winter ? 'indoor' : pick(['road', 'gravel', 'indoor']);
        const km = { road: between(45, 115), gravel: between(35, 80), mtb: between(20, 40), indoor: between(28, 45) }[kind] * form;
        add(day, 8, ride(kind, km));
      }
      break;
    case 0:
      if (summer && chance(0.22)) add(day, 9, hike(between(8, 18)));
      else if (chance(p(0.8))) add(day, 9, run(chance(0.25) ? 'trail' : 'road', between(12, 21) * form * (month === 10 && chance(0.2) ? 1.6 : 1)));
      if (chance(0.15)) add(day, 17, walk(between(3, 8)));
      break;
  }
}

// A couple of standout days so the highlights have something to say.
add(Date.UTC(2025, 9, 12), 8, { ...run('road', 42.2), title: 'Riverton Marathon', seconds: 42.2 * 300 });
add(Date.UTC(2026, 5, 20), 6, { ...ride('road', 205), title: 'Midsummer Century', seconds: (205 / 27.5) * 3600, ascent: 2350 });
add(Date.UTC(2026, 7, 2), 7, { ...hike(24), title: 'Twin Peaks Traverse', ascent: 1850 });

rows.sort((a, b) => (a[1] < b[1] ? 1 : -1)); // Garmin exports newest first

const header = [
  'Activity Type', 'Date', 'Favorite', 'Title', 'Distance', 'Calories', 'Time', 'Avg HR', 'Max HR',
  'Total Ascent', 'Total Descent', 'Moving Time', 'Elapsed Time',
];
const csvField = (v) => `"${v.replace(/"/g, '""')}"`; // Garmin quotes every field
const csv = [header, ...rows].map((r) => r.map((v) => csvField(String(v))).join(',')).join('\n') + '\n';
writeFileSync(OUT, csv);
console.log(`Wrote ${rows.length} activities to ${OUT}`);
