// Aggregations over normalized activities (see garmin.js for the shape).

import { CATEGORIES } from './categories.js';

const DAY_MS = 86_400_000;

function dayIndex(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function emptyTotals() {
  return { count: 0, distanceM: 0, durationS: 0, elevationGainM: 0, calories: 0 };
}

function addTo(totals, a) {
  totals.count += 1;
  totals.distanceM += a.distanceM ?? 0;
  totals.durationS += a.durationS ?? 0;
  totals.elevationGainM += a.elevationGainM ?? 0;
  totals.calories += a.calories ?? 0;
  return totals;
}

export function totals(activities) {
  return activities.reduce(addTo, emptyTotals());
}

/** Longest run of consecutive calendar days with at least one activity. */
export function longestStreak(activities) {
  const days = [...new Set(activities.map((a) => dayIndex(a.date)))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function summarize(activities) {
  const dates = activities.map((a) => a.date).sort();
  return {
    ...totals(activities),
    activeDays: new Set(dates).size,
    longestStreak: longestStreak(activities),
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
  };
}

export function yearsIn(activities) {
  return [...new Set(activities.map((a) => a.year))].sort((a, b) => b - a);
}

export function forYear(activities, year) {
  return year === 'all' ? activities : activities.filter((a) => a.year === year);
}

/**
 * Totals grouped by `field` ('category' or 'typeLabel'), busiest (by time)
 * first. Each row also keeps its longest activity and a count per activity type.
 */
export function breakdown(activities, field = 'category') {
  const map = new Map();
  for (const a of activities) {
    const key = a[field];
    let row = map.get(key);
    if (!row) {
      row = { key, category: a.category, ...emptyTotals(), longest: null, types: new Map() };
      map.set(key, row);
    }
    addTo(row, a);
    row.types.set(a.typeLabel, (row.types.get(a.typeLabel) ?? 0) + 1);
    const dist = (x) => x.distanceM ?? 0;
    const longer =
      !row.longest ||
      dist(a) > dist(row.longest) ||
      (dist(a) === dist(row.longest) && (a.durationS ?? 0) > (row.longest.durationS ?? 0));
    if (longer) row.longest = a;
  }
  const order = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  return [...map.values()].sort(
    (a, b) => b.durationS - a.durationS || order.get(a.category) - order.get(b.category),
  );
}

export function byCategory(activities) {
  return breakdown(activities, 'category');
}

export function forSport(activities, sport) {
  return sport === 'all' ? activities : activities.filter((a) => a.category === sport);
}

export function latestDate(activities) {
  return activities.reduce((max, a) => (a.date > max ? a.date : max), '');
}

/** Keeps activities from Jan 1 up to `cutoff` ('MM-DD') of any year. */
export function withinCutoff(activities, cutoff) {
  return cutoff ? activities.filter((a) => a.date.slice(5) <= cutoff) : activities;
}

/** 'MM-DD' of the newest activity if the data stops before Dec 31, else null. */
export function partialYearCutoff(dataEnd) {
  return dataEnd && dataEnd.slice(5) < '12-31' ? dataEnd.slice(5) : null;
}

function bucket() {
  return { cats: {}, total: emptyTotals() };
}

function addToBucket(b, a) {
  addTo(b.total, a);
  addTo((b.cats[a.category] ??= emptyTotals()), a);
}

/** Twelve buckets (Jan..Dec), each with totals and per-category totals. */
export function byMonth(activities) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ...bucket() }));
  for (const a of activities) addToBucket(months[a.month - 1], a);
  return months;
}

/** One bucket per year from the first to the last year (gaps included), oldest first. */
export function byYearBuckets(activities) {
  const years = yearsIn(activities);
  if (!years.length) return [];
  const out = [];
  for (let y = years.at(-1); y <= years[0]; y++) out.push({ year: y, ...bucket() });
  const first = out[0].year;
  for (const a of activities) addToBucket(out[a.year - first], a);
  return out;
}

/** Summary per year, newest first, with the year's top category by time. */
export function byYear(activities) {
  return yearsIn(activities).map((year) => {
    const list = forYear(activities, year);
    return { year, ...summarize(list), topCategory: byCategory(list)[0]?.category ?? null };
  });
}

/**
 * What to compare a year against. If the year is the most recent one in the
 * data and doesn't run to Dec 31 (e.g. the current year), the previous year is
 * cut to the same date so a partial year isn't compared with a full one.
 * `dataEnd` is the newest date in the whole data set (defaults to `activities`).
 */
export function comparisonFor(activities, year, dataEnd = latestDate(activities)) {
  if (year === 'all' || !activities.length) return null;
  const previous = forYear(activities, year - 1);
  if (!previous.length) return null;
  const cutoff = Number(dataEnd.slice(0, 4)) === year ? partialYearCutoff(dataEnd) : null;
  return {
    year: year - 1,
    cutoff, // 'MM-DD' or null for the full year
    activities: withinCutoff(previous, cutoff),
  };
}

const MONTH_OFFSETS = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
export const CALENDAR_DAYS = 366;

/** Day number (0-365) in a leap-year calendar, so a date lines up across years. */
export function calendarIndex(date) {
  return MONTH_OFFSETS[Number(date.slice(5, 7)) - 1] + Number(date.slice(8, 10)) - 1;
}

/**
 * Running totals through the year for each of `years`, one value per
 * calendar day. The newest year stops at `dataEnd`.
 */
export function cumulativeByYear(activities, years, valueOf, dataEnd = latestDate(activities)) {
  const endYear = Number(dataEnd.slice(0, 4));
  return years.map((year) => {
    const cumulative = new Array(CALENDAR_DAYS).fill(0);
    for (const a of activities) if (a.year === year) cumulative[calendarIndex(a.date)] += valueOf(a);
    for (let i = 1; i < CALENDAR_DAYS; i++) cumulative[i] += cumulative[i - 1];
    const endIndex = year === endYear ? calendarIndex(dataEnd) : CALENDAR_DAYS - 1;
    return { year, cumulative, endIndex };
  });
}

/** Relative change, or null when there's nothing to compare with. */
export function change(current, previous) {
  if (!previous) return null;
  return (current - previous) / previous;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function maxBy(list, key) {
  let best = null;
  for (const a of list) if ((a[key] ?? 0) > 0 && (!best || a[key] > best[key])) best = a;
  return best;
}

export function highlights(activities) {
  const months = new Map();
  for (const a of activities) {
    const key = a.date.slice(0, 7);
    if (!months.has(key)) months.set(key, emptyTotals());
    addTo(months.get(key), a);
  }
  let busiestMonth = null;
  for (const [key, t] of months) {
    if (!busiestMonth || t.durationS > busiestMonth.durationS) busiestMonth = { key, ...t };
  }

  const weekdayCounts = Array(7).fill(0);
  for (const a of activities) weekdayCounts[new Date(dayIndex(a.date) * DAY_MS).getUTCDay()]++;
  const topWeekday = weekdayCounts.indexOf(Math.max(...weekdayCounts));

  const beforeNoon = activities.filter((a) => Number(a.start.slice(11, 13)) < 12).length;

  return {
    longestDuration: maxBy(activities, 'durationS'),
    biggestClimb: maxBy(activities, 'elevationGainM'),
    busiestMonth,
    favouriteWeekday: activities.length
      ? { name: WEEKDAYS[topWeekday], count: weekdayCounts[topWeekday] }
      : null,
    morningShare: activities.length ? beforeNoon / activities.length : null,
  };
}
