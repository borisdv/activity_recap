// Turns Garmin exports into a common activity shape:
//
//   {
//     id, title, typeKey, typeLabel, category,
//     start: 'YYYY-MM-DDTHH:MM:SS' (local wall-clock time), date: 'YYYY-MM-DD',
//     year, month (1-12),
//     distanceM, durationS, movingS, elevationGainM, calories, avgHr, maxHr
//   }
//
// Missing values are null. Supported inputs:
//   - Activities CSV from Garmin Connect (Activities > All Activities > Export CSV)
//   - *_summarizedActivities.json from the Garmin account data export
//   - Activity lists from the Garmin Connect API (e.g. the python `garminconnect` lib)

import { parseCsv } from './csv.js';
import { categorize, labelFromTypeKey, normalizeTypeKey } from './categories.js';

const KM = 1000;
const MILE = 1609.344;
const YARD = 0.9144;
const FOOT = 0.3048;
const KJ_PER_KCAL = 4.184;

// ---------------------------------------------------------------- helpers

/** Parses "1,234.5", "5.01", "5,01", "--" and plain numbers. */
export function parseNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim().replace(/\s/g, '');
  if (s === '' || /^-+$/.test(s)) return null;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ''); // thousands separators
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.'); // decimal comma
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Parses "01:02:03", "1:02:03.5", "45:12" into seconds. */
export function parseDuration(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!/^\d+(:\d{1,2})*(\.\d+)?$/.test(s)) return null;
  return s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}

const pad = (n) => String(n).padStart(2, '0');

function wallClock(y, mo, d, h = 0, mi = 0, s = 0) {
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(Math.floor(s))}`;
}

/** Parses "2024-03-15 07:12:33" (or ISO-like) into a wall-clock string. */
export function parseLocalDateTime(value) {
  if (value == null) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return wallClock(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return wallClock(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
}

/** Garmin's startTimeLocal epoch is local wall-clock time stored as if it were UTC. */
function wallClockFromLocalEpoch(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return wallClock(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  );
}

const positive = (n) => (n != null && n > 0 ? n : null);

function makeActivity({ title, type, start, distanceM, durationS, movingS, elevationGainM, calories, avgHr, maxHr }) {
  const typeKey = normalizeTypeKey(type) || 'unknown';
  const category = categorize(typeKey);
  return {
    // Same start minute + same category = same activity, whatever file it came from.
    id: `${start.slice(0, 16)}|${category}`,
    title: title?.trim() || labelFromTypeKey(typeKey),
    typeKey,
    typeLabel: labelFromTypeKey(typeKey),
    category,
    start,
    date: start.slice(0, 10),
    year: Number(start.slice(0, 4)),
    month: Number(start.slice(5, 7)),
    distanceM: positive(distanceM),
    durationS: positive(durationS),
    movingS: positive(movingS),
    elevationGainM: positive(elevationGainM),
    calories: positive(calories),
    avgHr: positive(avgHr),
    maxHr: positive(maxHr),
  };
}

// ---------------------------------------------------------------- CSV

const CSV_COLUMNS = {
  type: ['activity type'],
  date: ['date'],
  title: ['title'],
  distance: ['distance'],
  calories: ['calories'],
  time: ['time'],
  moving: ['moving time'],
  elapsed: ['elapsed time'],
  avgHr: ['avg hr', 'average heart rate'],
  maxHr: ['max hr', 'maximum heart rate'],
  ascent: ['total ascent', 'elev gain'],
};

/**
 * @param {string} text  CSV file contents
 * @param {{units?: 'metric'|'imperial'}} options  units the Garmin account was set to
 */
export function parseGarminCsv(text, { units = 'metric' } = {}) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error('The CSV file is empty.');

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [key, names] of Object.entries(CSV_COLUMNS)) {
    col[key] = header.findIndex((h) => names.includes(h));
  }
  if (col.type < 0 || col.date < 0) {
    throw new Error(
      "This doesn't look like a Garmin Connect activities CSV (no \"Activity Type\" or \"Date\" column).",
    );
  }

  const imperial = units === 'imperial';
  const activities = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const get = (key) => (col[key] >= 0 ? row[col[key]] : undefined);
    const start = parseLocalDateTime(get('date'));
    const type = get('type');
    if (!start || !type) {
      skipped++;
      continue;
    }

    // Garmin lists swims in pool units (m / yd) and everything else in km / mi.
    let distance = parseNumber(get('distance'));
    if (distance != null) {
      const isSwimInPoolUnits = categorize(type) === 'swimming' && distance >= 25;
      if (isSwimInPoolUnits) distance *= imperial ? YARD : 1;
      else distance *= imperial ? MILE : KM;
    }
    const ascent = parseNumber(get('ascent'));

    activities.push(
      makeActivity({
        title: get('title'),
        type,
        start,
        distanceM: distance,
        durationS: parseDuration(get('time')) ?? parseDuration(get('elapsed')),
        movingS: parseDuration(get('moving')),
        elevationGainM: ascent == null ? null : ascent * (imperial ? FOOT : 1),
        calories: parseNumber(get('calories')),
        avgHr: parseNumber(get('avgHr')),
        maxHr: parseNumber(get('maxHr')),
      }),
    );
  }
  return { activities, skipped };
}

// ---------------------------------------------------------------- JSON

function extractActivityList(data) {
  if (Array.isArray(data)) {
    if (data.length && data.every((d) => Array.isArray(d?.summarizedActivitiesExport))) {
      return data.flatMap((d) => d.summarizedActivitiesExport);
    }
    return data;
  }
  if (Array.isArray(data?.summarizedActivitiesExport)) return data.summarizedActivitiesExport;
  if (Array.isArray(data?.activities)) return data.activities;
  throw new Error("This JSON file doesn't contain a list of Garmin activities.");
}

function typeOf(item) {
  const t = item.activityType;
  if (typeof t === 'string') return t;
  return t?.typeKey ?? item.sportType ?? null;
}

/**
 * The account data export (summarizedActivities.json) stores epoch ms
 * timestamps, durations in ms, distances and elevation in cm and energy in kJ.
 * The Connect API returns date strings, seconds, metres and kcal.
 */
function fromJsonItem(item) {
  const type = typeOf(item);
  if (!type) return null;

  const isExportFormat = typeof item.startTimeLocal === 'number';
  if (isExportFormat) {
    const start = wallClockFromLocalEpoch(item.startTimeLocal);
    if (!start) return null;
    const cal = parseNumber(item.calories);
    return makeActivity({
      title: item.name,
      type,
      start,
      distanceM: item.distance != null ? item.distance / 100 : null,
      durationS: item.duration != null ? item.duration / 1000 : null,
      movingS: item.movingDuration != null ? item.movingDuration / 1000 : null,
      elevationGainM: item.elevationGain != null ? item.elevationGain / 100 : null,
      calories: cal != null ? cal / KJ_PER_KCAL : null,
      avgHr: parseNumber(item.avgHr),
      maxHr: parseNumber(item.maxHr),
    });
  }

  const start = parseLocalDateTime(item.startTimeLocal ?? item.startTime);
  if (!start) return null;
  return makeActivity({
    title: item.activityName ?? item.name,
    type,
    start,
    distanceM: parseNumber(item.distance),
    durationS: parseNumber(item.duration),
    movingS: parseNumber(item.movingDuration),
    elevationGainM: parseNumber(item.elevationGain),
    calories: parseNumber(item.calories),
    avgHr: parseNumber(item.averageHR ?? item.avgHr),
    maxHr: parseNumber(item.maxHR ?? item.maxHr),
  });
}

export function parseGarminJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The JSON file could not be read (invalid JSON).');
  }
  const list = extractActivityList(data);

  // Multisport parents (triathlons etc.) repeat their legs' totals; drop the
  // parent when its child activities are in the same file.
  const ids = new Set(list.map((a) => a?.activityId).filter((id) => id != null));
  const isParentWithChildren = (a) => Array.isArray(a?.childIds) && a.childIds.some((id) => ids.has(id));

  const activities = [];
  let skipped = 0;
  for (const item of list) {
    const activity = item && !isParentWithChildren(item) ? fromJsonItem(item) : null;
    if (activity) activities.push(activity);
    else skipped++;
  }
  return { activities, skipped };
}

// ---------------------------------------------------------------- entry points

export function parseExportFile(name, text, options = {}) {
  const looksLikeJson = /\.json$/i.test(name) || /^\s*[[{]/.test(text);
  return looksLikeJson ? parseGarminJson(text) : parseGarminCsv(text, options);
}

/** Adds `incoming` to `existing`, skipping activities that are already there. */
export function mergeActivities(existing, incoming) {
  const seen = new Set(existing.map((a) => a.id));
  const merged = [...existing];
  let duplicates = 0;
  for (const a of incoming) {
    if (seen.has(a.id)) {
      duplicates++;
      continue;
    }
    seen.add(a.id);
    merged.push(a);
  }
  merged.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return { activities: merged, added: merged.length - existing.length, duplicates };
}
