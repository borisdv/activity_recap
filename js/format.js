// Display formatting. `units` is 'metric' or 'imperial'.

const MILE = 1609.344;
const YARD = 0.9144;
const FOOT = 0.3048;

const numberFormats = new Map();
function num(value, maxDigits = 0) {
  let nf = numberFormats.get(maxDigits);
  if (!nf) {
    nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: maxDigits, minimumFractionDigits: 0 });
    numberFormats.set(maxDigits, nf);
  }
  return nf.format(value);
}

export function formatNumber(value, maxDigits = 0) {
  return num(value ?? 0, maxDigits);
}

/** Distance as a number (km or mi) for charts and comparisons. */
export function distanceValue(meters, units) {
  return (meters ?? 0) / (units === 'imperial' ? MILE : 1000);
}

export function distanceUnit(units) {
  return units === 'imperial' ? 'mi' : 'km';
}

export function formatDistance(meters, units) {
  const v = distanceValue(meters, units);
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${num(v, digits)} ${distanceUnit(units)}`;
}

/** Swims read better in pool units. */
export function formatSwimDistance(meters, units) {
  if (units === 'imperial') return `${num((meters ?? 0) / YARD)} yd`;
  return `${num(meters ?? 0)} m`;
}

export function formatCategoryDistance(meters, units, category) {
  if (category === 'swimming' && (meters ?? 0) < 10_000) return formatSwimDistance(meters, units);
  return formatDistance(meters, units);
}

export function formatElevation(meters, units) {
  if (units === 'imperial') return `${num((meters ?? 0) / FOOT)} ft`;
  return `${num(meters ?? 0)} m`;
}

export function formatDuration(seconds) {
  const total = Math.round(seconds ?? 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${num(h)}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

export function formatHours(seconds) {
  return `${num((seconds ?? 0) / 3600)} h`;
}

export function formatPercent(ratio, digits = 0) {
  return `${num(ratio * 100, digits)}%`;
}

/** "+12%", "−5%", or "±0%". */
export function formatChange(ratio) {
  if (ratio == null) return '';
  const pct = Math.round(ratio * 100);
  if (pct === 0) return '±0%';
  return `${pct > 0 ? '+' : '−'}${num(Math.abs(pct))}%`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const monthShort = (m) => MONTHS_SHORT[m - 1];
export const monthLong = (m) => MONTHS_LONG[m - 1];

/** '2024-03-15' -> 'Mar 15, 2024' */
export function formatDate(date) {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}

/** 'MM-DD' -> 'Mar 15' */
export function formatMonthDay(md) {
  const [m, d] = md.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
