// The three things charts can measure: distance, time and number of activities.

import { distanceUnit, distanceValue, formatDuration, formatNumber } from './format.js';

export const MEASURES = {
  distance: { label: 'Distance' },
  time: { label: 'Time' },
  count: { label: 'Activities' },
};

/** Value of one activity in display units (km/mi, hours, or 1). */
export function activityValue(a, measure, units) {
  if (measure === 'distance') return distanceValue(a.distanceM, units);
  if (measure === 'time') return (a.durationS ?? 0) / 3600;
  return 1;
}

/** Value of a totals object ({distanceM, durationS, count}) in display units. */
export function totalsValue(t, measure, units) {
  if (!t) return 0;
  if (measure === 'distance') return distanceValue(t.distanceM, units);
  if (measure === 'time') return t.durationS / 3600;
  return t.count;
}

export function formatMeasure(value, measure, units) {
  if (measure === 'distance') return `${formatNumber(value, value < 10 ? 1 : 0)} ${distanceUnit(units)}`;
  if (measure === 'time') return formatDuration(value * 3600);
  return formatNumber(value);
}

export function measureUnit(measure, units) {
  if (measure === 'distance') return distanceUnit(units);
  if (measure === 'time') return 'hours';
  return 'activities';
}

/** Axis tick: full numbers under 10,000, compact (10K, 25K) above. */
export function formatTick(value) {
  if (Math.abs(value) >= 10_000) return `${formatNumber(value / 1000, 1)}K`;
  return formatNumber(value, 1);
}

/**
 * Picks a round gridline step (1, 2, 2.5 or 5 x 10^n) giving at most
 * `maxTicks` steps up to `max`. Counts only get whole-number steps.
 */
export function niceScale(max, { maxTicks = 5, integer = false } = {}) {
  if (!(max > 0)) return { step: 1, top: 1 };
  const exp = 10 ** Math.floor(Math.log10(max / maxTicks));
  for (const m of [1, 2, 2.5, 5, 10]) {
    const step = m * exp;
    if (integer && !Number.isInteger(step)) continue;
    if (max / step <= maxTicks) return { step, top: Math.ceil(max / step - 1e-9) * step };
  }
  return { step: 10 * exp, top: Math.ceil(max / (10 * exp)) * 10 * exp };
}

export function ticksFor(scale) {
  const ticks = [];
  for (let t = 0; t <= scale.top + 1e-9; t += scale.step) ticks.push(t);
  return ticks;
}
