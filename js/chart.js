// Stacked bar chart built from plain HTML so labels stay readable on phones.

import { CATEGORIES } from './categories.js';
import { distanceValue, distanceUnit, escapeHtml, formatNumber } from './format.js';

export const METRICS = {
  distance: { label: 'Distance' },
  time: { label: 'Time' },
  count: { label: 'Activities' },
};

export function metricValue(totals, metric, units) {
  if (!totals) return 0;
  if (metric === 'distance') return distanceValue(totals.distanceM, units);
  if (metric === 'time') return totals.durationS / 3600;
  return totals.count;
}

export function formatMetric(value, metric, units) {
  if (metric === 'distance') return `${formatNumber(value, value < 10 ? 1 : 0)} ${distanceUnit(units)}`;
  if (metric === 'time') return `${formatNumber(value, value < 10 ? 1 : 0)} h`;
  return formatNumber(value);
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

/**
 * @param {Array<{label: string, shortLabel?: string, detailLabel: string, cats: object, total: object}>} columns
 */
export function renderBarChart(columns, { metric, units }) {
  const values = columns.map((c) => metricValue(c.total, metric, units));
  const { step, top } = niceScale(Math.max(0, ...values), { integer: metric === 'count' });
  const ticks = [];
  for (let t = 0; t <= top + 1e-9; t += step) ticks.push(t);

  const gridlines = ticks
    .map((t) => `<div class="gridline" style="bottom:${(t / top) * 100}%"><span>${formatNumber(t, 1)}</span></div>`)
    .join('');

  const bars = columns
    .map((c, i) => {
      const height = (values[i] / top) * 100;
      const segments = CATEGORIES.map((cat) => {
        const v = metricValue(c.cats[cat.id], metric, units);
        return v > 0 ? `<span class="seg" style="flex-grow:${v};background:var(--cat-${cat.id})"></span>` : '';
      }).join('');
      const label = `${c.detailLabel}: ${formatMetric(values[i], metric, units)}`;
      return `<button type="button" class="bar-col" data-index="${i}" aria-label="${escapeHtml(label)}">
        <span class="bar${values[i] > 0 ? '' : ' empty'}" style="height:${height}%">${segments}</span>
      </button>`;
    })
    .join('');

  const labels = columns
    .map(
      (c) =>
        `<span><span class="label-long">${escapeHtml(c.label)}</span><span class="label-short">${escapeHtml(c.shortLabel ?? c.label)}</span></span>`,
    )
    .join('');

  return `<div class="chart" style="--n:${columns.length}">
    <div class="chart-plot">
      <div class="gridlines" aria-hidden="true">${gridlines}</div>
      <div class="chart-bars">${bars}</div>
    </div>
    <div class="chart-labels" aria-hidden="true">${labels}</div>
  </div>`;
}

/** One-line breakdown shown under the chart for the selected column. */
export function describeColumn(column, { metric, units }) {
  const total = metricValue(column.total, metric, units);
  if (!total) return `<strong>${escapeHtml(column.detailLabel)}</strong> · no activities`;
  const parts = CATEGORIES.map((cat) => [cat, metricValue(column.cats[cat.id], metric, units)])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([cat, v]) =>
        `<span class="detail-part"><i class="dot" style="background:var(--cat-${cat.id})"></i>${escapeHtml(cat.label)} ${escapeHtml(formatMetric(v, metric, units))}</span>`,
    )
    .join('');
  return `<strong>${escapeHtml(column.detailLabel)}</strong> · ${escapeHtml(formatMetric(total, metric, units))} ${parts}`;
}
