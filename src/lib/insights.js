// Plain-language summary sentences for the dashboard. Deterministic: they are
// computed from the numbers on the page, nothing is generated or guessed.

import { CATEGORIES, categoryById } from './categories.js';
import * as stats from './stats.js';
import { formatDistance, formatDuration, formatNumber, formatPercent, monthLong } from './format.js';

function headline(cur, prev, cmp, units) {
  const useDistance = cur.distanceM > 0 && prev.distanceM > 0;
  const a = useDistance ? cur.distanceM : cur.durationS;
  const b = useDistance ? prev.distanceM : prev.durationS;
  if (!b) return null;
  const diff = a - b;
  const amount = useDistance ? formatDistance(Math.abs(diff), units) : formatDuration(Math.abs(diff));
  const what = useDistance ? '' : ' of training';
  if (Math.abs(diff) / b < 0.01) {
    return cmp.cutoff ? `You're level with this point of ${cmp.year}.` : `Almost exactly the same as ${cmp.year}.`;
  }
  if (cmp.cutoff) {
    return diff > 0
      ? `You're ${amount}${what} ahead of this point in ${cmp.year}.`
      : `You're ${amount}${what} behind this point in ${cmp.year}.`;
  }
  return diff > 0 ? `${amount}${what} more than in ${cmp.year}.` : `${amount}${what} less than in ${cmp.year}.`;
}

/** Biggest rise and biggest drop among sports that make up a real share of the year. */
function movers(list, prevList, cmp) {
  const now = new Map(stats.byCategory(list).map((r) => [r.category, r]));
  const before = new Map(stats.byCategory(prevList).map((r) => [r.category, r]));
  const totalPrev = [...before.values()].reduce((acc, r) => acc + r.durationS, 0) || 1;
  const changes = [];
  for (const cat of CATEGORIES) {
    const p = before.get(cat.id);
    if (!p || p.durationS / totalPrev < 0.08) continue;
    const c = now.get(cat.id);
    const useDistance = cat.hasDistance && p.distanceM > 0;
    const ratio = stats.change(useDistance ? (c?.distanceM ?? 0) : (c?.durationS ?? 0), useDistance ? p.distanceM : p.durationS);
    if (ratio != null && Math.abs(ratio) >= 0.05) changes.push({ cat, ratio });
  }
  changes.sort((x, y) => y.ratio - x.ratio);
  const parts = [];
  const up = changes[0]?.ratio > 0 ? changes[0] : null;
  const down = changes.at(-1)?.ratio < 0 ? changes.at(-1) : null;
  if (up) parts.push(`${up.cat.label} is up ${formatPercent(up.ratio)}`);
  if (down) {
    const label = down.cat.label.toLowerCase();
    parts.push(down.ratio <= -0.995 ? `no ${label} ${cmp.cutoff ? 'yet' : 'this year'}` : `${label} is down ${formatPercent(-down.ratio)}`);
  }
  if (!parts.length) return null;
  const sentence = parts.join(', ');
  return `${sentence[0].toUpperCase()}${sentence.slice(1)}.`;
}

/**
 * @returns {string[]} one to two sentences
 */
export function buildInsight({ list, cmp, units, sport }) {
  if (!list.length) return [];
  const sentences = [];
  if (cmp?.activities.length) {
    const h = headline(stats.totals(list), stats.totals(cmp.activities), cmp, units);
    if (h) sentences.push(h);
    if (sport === 'all') {
      const m = movers(list, cmp.activities, cmp);
      if (m) sentences.push(m);
    }
  }
  if (sentences.length < 2) {
    const rows = stats.byCategory(list);
    const total = rows.reduce((acc, r) => acc + r.durationS, 0) || 1;
    if (sport === 'all' && rows.length > 1 && sentences.length === 0) {
      sentences.push(`Mostly ${categoryById(rows[0].category).label.toLowerCase()}: ${formatPercent(rows[0].durationS / total)} of your time.`);
    }
    const busiest = stats.highlights(list).busiestMonth;
    if (busiest) {
      const month = monthLong(Number(busiest.key.slice(5, 7)));
      sentences.push(`${month} was the busiest month, with ${formatNumber(busiest.count)} activities.`);
    }
  }
  return sentences.slice(0, 2);
}
