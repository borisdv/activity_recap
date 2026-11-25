import { mergeActivities, parseExportFile } from './garmin.js';
import { CATEGORIES, categoryById } from './categories.js';
import * as stats from './stats.js';
import * as fmt from './format.js';
import { METRICS, describeColumn, renderBarChart } from './chart.js';

const STORE_KEY = 'activity-recap:activities:v1';
const PREFS_KEY = 'activity-recap:prefs:v1';
const SAMPLE_URL = 'samples/sample-activities.csv';
const EARTH_CIRCUMFERENCE_M = 40_075_000;

const $ = (sel) => document.querySelector(sel);
const esc = fmt.escapeHtml;

const state = {
  activities: [],
  isSample: false,
  year: null, // number or 'all'
  units: 'metric', // display units
  csvUnits: 'metric', // units the Garmin account used when the CSV was exported
  metric: 'distance', // chart metric
  chartColumns: [],
};

// ------------------------------------------------------------- persistence
// Data lives only in this browser's localStorage; nothing is uploaded.

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (Array.isArray(saved?.activities)) {
      state.activities = saved.activities;
      state.isSample = Boolean(saved.isSample);
    }
  } catch {
    /* unreadable storage: start empty */
  }
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    if (prefs.units === 'metric' || prefs.units === 'imperial') state.units = prefs.units;
    if (prefs.csvUnits === 'metric' || prefs.csvUnits === 'imperial') state.csvUnits = prefs.csvUnits;
    if (prefs.metric in METRICS) state.metric = prefs.metric;
  } catch {
    /* ignore */
  }
}

function saveActivities() {
  try {
    if (state.activities.length) {
      localStorage.setItem(STORE_KEY, JSON.stringify({ activities: state.activities, isSample: state.isSample }));
    } else {
      localStorage.removeItem(STORE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

function savePrefs() {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ units: state.units, csvUnits: state.csvUnits, metric: state.metric }),
    );
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------- import

function showStatus(html, kind = 'info') {
  const el = $('#status');
  el.innerHTML = html;
  el.dataset.kind = kind;
  el.hidden = !html;
}

function addActivities(incoming, { sample = false } = {}) {
  if (state.isSample && !sample) {
    // Real data replaces the sample set instead of mixing with it.
    state.activities = [];
    state.isSample = false;
  }
  const result = mergeActivities(state.activities, incoming);
  state.activities = result.activities;
  if (sample) state.isSample = true;
  if (result.added) state.year = stats.yearsIn(state.activities)[0];
  return { ...result, saved: saveActivities() };
}

async function importFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  const incoming = [];
  const problems = [];
  let skipped = 0;

  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      problems.push(
        `${esc(file.name)}: unzip the export first, then pick the <code>*_summarizedActivities.json</code> file(s) from <code>DI_CONNECT/DI-Connect-Fitness</code>.`,
      );
      continue;
    }
    try {
      const parsed = parseExportFile(file.name, await file.text(), { units: state.csvUnits });
      incoming.push(...parsed.activities);
      skipped += parsed.skipped;
      if (!parsed.activities.length) problems.push(`${esc(file.name)}: no activities found.`);
    } catch (err) {
      problems.push(`${esc(file.name)}: ${esc(err.message)}`);
    }
  }

  const { added, duplicates, saved } = addActivities(incoming);
  const lines = [];
  if (added) lines.push(`Added <strong>${fmt.formatNumber(added)}</strong> activities.`);
  if (duplicates) lines.push(`${fmt.formatNumber(duplicates)} were already loaded.`);
  if (skipped) lines.push(`${fmt.formatNumber(skipped)} rows had no date or type and were skipped.`);
  if (!saved && state.activities.length) {
    lines.push("Your browser wouldn't let this page save the data, so it will be gone after a reload.");
  }
  lines.push(...problems);
  showStatus(lines.join(' '), problems.length && !added ? 'error' : 'info');
  render();
}

async function loadSample() {
  try {
    const res = await fetch(SAMPLE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { activities } = parseExportFile('sample.csv', await res.text(), { units: 'metric' });
    addActivities(activities, { sample: true });
    showStatus('');
    render();
  } catch (err) {
    showStatus(
      `Couldn't load the sample data (${esc(err.message)}). If you opened the file directly, run <code>npm start</code> and use the local address instead.`,
      'error',
    );
  }
}

function clearData() {
  if (!confirm('Remove all imported activities from this browser?')) return;
  state.activities = [];
  state.isSample = false;
  state.year = null;
  saveActivities();
  showStatus('');
  render();
}

// ------------------------------------------------------------- rendering

function deltaHtml(current, previous) {
  const ratio = stats.change(current, previous);
  if (ratio == null) return '';
  const dir = Math.round(ratio * 100) > 0 ? 'up' : Math.round(ratio * 100) < 0 ? 'down' : 'flat';
  return `<span class="delta ${dir}">${fmt.formatChange(ratio)}</span>`;
}

function comparisonLabel(cmp) {
  if (!cmp) return '';
  return cmp.cutoff ? `Jan 1 – ${fmt.formatMonthDay(cmp.cutoff)}, ${cmp.year}` : String(cmp.year);
}

function renderYearTabs(years) {
  const tab = (value, label) =>
    `<button type="button" class="tab" data-year="${value}" aria-pressed="${state.year === value}">${label}</button>`;
  $('#year-tabs').innerHTML = years.map((y) => tab(y, y)).join('') + tab('all', 'All time');
}

function renderHero(list, cmp) {
  const s = stats.summarize(list);
  const p = cmp ? stats.summarize(cmp.activities) : null;
  const u = state.units;

  // "3,832 km" -> number large, unit small
  const withUnit = (text) => text.replace(/ ([^\s\d]+)$/, ' <small>$1</small>');
  const tile = (label, value, cur, prev, big = false) => `
    <div class="tile${big ? ' tile-big' : ''}">
      <span class="tile-label">${label}</span>
      <span class="tile-value">${withUnit(value)}</span>
      ${p ? deltaHtml(cur, prev) : ''}
    </div>`;

  const laps = s.distanceM / EARTH_CIRCUMFERENCE_M;
  const fun =
    s.distanceM > 0
      ? laps >= 1
        ? `That's <strong>${fmt.formatNumber(laps, 1)}×</strong> around the Earth.`
        : `That's <strong>${fmt.formatPercent(laps, laps < 0.1 ? 1 : 0)}</strong> of the way around the Earth.`
      : '';

  $('#hero').innerHTML = `
    <div class="hero-head">
      <div>
        <p class="eyebrow">${state.year === 'all' ? 'All time' : 'Year recap'}</p>
        <h1>${state.year === 'all' ? 'Every activity so far' : `Your ${state.year}`}</h1>
        <p class="muted">${fmt.formatDate(s.firstDate)} – ${fmt.formatDate(s.lastDate)}</p>
      </div>
      ${cmp ? `<p class="compare-note">Changes compared with <strong>${esc(comparisonLabel(cmp))}</strong></p>` : ''}
    </div>
    <div class="tiles tiles-main">
      ${tile('Distance', fmt.formatDistance(s.distanceM, u), s.distanceM, p?.distanceM, true)}
      ${tile('Time', fmt.formatDuration(s.durationS), s.durationS, p?.durationS, true)}
      ${tile('Activities', fmt.formatNumber(s.count), s.count, p?.count, true)}
    </div>
    <div class="tiles tiles-sub">
      ${tile('Elevation gain', fmt.formatElevation(s.elevationGainM, u), s.elevationGainM, p?.elevationGainM)}
      ${tile('Active days', fmt.formatNumber(s.activeDays), s.activeDays, p?.activeDays)}
      ${tile('Longest streak', `${fmt.formatNumber(s.longestStreak)} ${s.longestStreak === 1 ? 'day' : 'days'}`, s.longestStreak, p?.longestStreak)}
      ${tile('Calories', `${fmt.formatNumber(s.calories)} kcal`, s.calories, p?.calories)}
    </div>
    ${fun ? `<p class="fun">${fun}</p>` : ''}`;
}

function renderCategories(list, cmp) {
  const rows = stats.byCategory(list);
  const prevRows = new Map((cmp ? stats.byCategory(cmp.activities) : []).map((r) => [r.category, r]));
  const totalTime = rows.reduce((acc, r) => acc + r.durationS, 0) || 1;
  const u = state.units;

  const items = rows
    .map((r) => {
      const cat = categoryById(r.category);
      const prev = prevRows.get(r.category);
      const types = [...r.types.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name)
        .join(' · ');
      const share = r.durationS / totalTime;
      const stat = (k, v, delta = '') =>
        `<div><span class="k">${k}</span><span class="v"><span>${v}</span>${delta}</span></div>`;
      const showDistance = cat.hasDistance && r.distanceM > 0;
      return `
        <li class="cat-row" style="--c:var(--cat-${cat.id})">
          <div class="cat-name">
            <span class="cat-icon" aria-hidden="true">${cat.icon}</span>
            <div>
              <strong>${esc(cat.label)}</strong>
              <span class="muted small">${esc(types)}</span>
            </div>
          </div>
          <div class="cat-stats">
            ${stat('Activities', fmt.formatNumber(r.count), cmp ? deltaHtml(r.count, prev?.count) : '')}
            ${showDistance ? stat('Distance', fmt.formatCategoryDistance(r.distanceM, u, r.category), cmp ? deltaHtml(r.distanceM, prev?.distanceM) : '') : ''}
            ${stat('Time', fmt.formatDuration(r.durationS), cmp ? deltaHtml(r.durationS, prev?.durationS) : '')}
            ${r.elevationGainM > 0 ? stat('Elevation', fmt.formatElevation(r.elevationGainM, u)) : ''}
          </div>
          <div class="cat-share" title="${fmt.formatPercent(share)} of your time">
            <div class="share-bar"><span style="width:${(share * 100).toFixed(1)}%"></span></div>
            <span class="muted small">${fmt.formatPercent(share)} of time</span>
          </div>
        </li>`;
    })
    .join('');

  $('#categories').innerHTML = `
    <div class="section-head"><h2>By sport</h2></div>
    <ul class="cat-list">${items}</ul>`;
}

function chartColumns(list) {
  if (state.year === 'all') {
    return stats.byYearBuckets(list).map((b) => ({
      label: String(b.year),
      shortLabel: `’${String(b.year).slice(2)}`,
      detailLabel: String(b.year),
      cats: b.cats,
      total: b.total,
    }));
  }
  return stats.byMonth(list).map((b) => ({
    label: fmt.monthShort(b.month),
    shortLabel: fmt.monthShort(b.month)[0],
    detailLabel: `${fmt.monthLong(b.month)} ${state.year}`,
    cats: b.cats,
    total: b.total,
  }));
}

function renderChart(list) {
  const columns = chartColumns(list);
  state.chartColumns = columns;
  const opts = { metric: state.metric, units: state.units };
  const present = new Set(list.map((a) => a.category));

  const metricButtons = Object.entries(METRICS)
    .map(
      ([id, m]) =>
        `<button type="button" data-metric="${id}" aria-pressed="${state.metric === id}">${m.label}</button>`,
    )
    .join('');

  const legend = CATEGORIES.filter((c) => present.has(c.id))
    .map((c) => `<span class="legend-item"><i class="dot" style="background:var(--cat-${c.id})"></i>${esc(c.label)}</span>`)
    .join('');

  // Start with the biggest column described.
  let busiest = 0;
  columns.forEach((c, i) => {
    if (c.total.durationS > columns[busiest].total.durationS) busiest = i;
  });

  $('#chart').innerHTML = `
    <div class="section-head">
      <h2>${state.year === 'all' ? 'Year by year' : 'Month by month'}</h2>
      <div class="segmented" role="group" aria-label="Chart metric">${metricButtons}</div>
    </div>
    ${renderBarChart(columns, opts)}
    <p class="chart-detail" id="chart-detail" aria-live="polite">${columns.length ? describeColumn(columns[busiest], opts) : ''}</p>
    <div class="legend">${legend}</div>`;
  $('#chart').querySelector(`.bar-col[data-index="${busiest}"]`)?.classList.add('active');
}

function selectChartColumn(button) {
  const column = state.chartColumns[Number(button.dataset.index)];
  if (!column) return;
  $('#chart-detail').innerHTML = describeColumn(column, { metric: state.metric, units: state.units });
  $('#chart').querySelectorAll('.bar-col.active').forEach((b) => b.classList.remove('active'));
  button.classList.add('active');
}

const LONGEST_LABEL = {
  running: 'Longest run',
  cycling: 'Longest ride',
  swimming: 'Longest swim',
  walking: 'Longest walk or hike',
  winter: 'Longest day on snow',
  water: 'Longest paddle',
};

function renderHighlights(list) {
  const h = stats.highlights(list);
  const u = state.units;
  const cards = [];
  const card = (label, value, sub, cat) =>
    cards.push(`
      <div class="highlight"${cat ? ` style="--c:var(--cat-${cat})"` : ''}>
        <span class="tile-label">${label}</span>
        <span class="highlight-value">${value}</span>
        <span class="muted small">${sub}</span>
      </div>`);
  const about = (a) => `${esc(a.title)} · ${fmt.formatDate(a.date)}`;

  for (const r of stats.byCategory(list)) {
    const label = LONGEST_LABEL[r.category];
    if (!label || !r.longest?.distanceM) continue;
    const a = r.longest;
    card(
      label,
      fmt.formatCategoryDistance(a.distanceM, u, a.category),
      `${about(a)}${a.durationS ? ` · ${fmt.formatDuration(a.durationS)}` : ''}`,
      r.category,
    );
  }
  if (h.longestDuration) {
    const a = h.longestDuration;
    card('Longest session', fmt.formatDuration(a.durationS), about(a), a.category);
  }
  if (h.biggestClimb) {
    const a = h.biggestClimb;
    card('Biggest climb', fmt.formatElevation(a.elevationGainM, u), about(a), a.category);
  }
  if (h.busiestMonth) {
    const [y, m] = h.busiestMonth.key.split('-').map(Number);
    card(
      'Most active month',
      `${fmt.monthLong(m)}${state.year === 'all' ? ` ${y}` : ''}`,
      `${fmt.formatDuration(h.busiestMonth.durationS)} · ${fmt.formatNumber(h.busiestMonth.count)} activities`,
    );
  }
  if (h.favouriteWeekday) {
    card('Favourite day', `${h.favouriteWeekday.name}s`, `${fmt.formatNumber(h.favouriteWeekday.count)} activities`);
  }
  if (h.morningShare != null) {
    const early = h.morningShare >= 0.5;
    card(
      early ? 'Early bird' : 'Afternoon & evening',
      fmt.formatPercent(early ? h.morningShare : 1 - h.morningShare),
      early ? 'of activities started before noon' : 'of activities started after noon',
    );
  }

  $('#highlights').innerHTML = `
    <div class="section-head"><h2>Highlights</h2></div>
    <div class="highlight-grid">${cards.join('')}</div>`;
}

function renderYearsTable() {
  const rows = stats.byYear(state.activities);
  const maxDistance = Math.max(...rows.map((r) => r.distanceM), 1);
  const u = state.units;

  const body = rows
    .map((r, i) => {
      const prev = rows[i + 1]?.year === r.year - 1 ? rows[i + 1] : null;
      const partial = r.year === new Date().getFullYear();
      const topCat = r.topCategory ? categoryById(r.topCategory) : null;
      return `
        <tr class="${state.year === r.year ? 'selected' : ''}">
          <th scope="row"><button type="button" class="link" data-year="${r.year}">${r.year}</button>${partial ? ' <span class="badge">so far</span>' : ''}</th>
          <td class="num">${fmt.formatNumber(r.count)}</td>
          <td class="num distance-cell">
            <span class="inline-bar" style="width:${((r.distanceM / maxDistance) * 100).toFixed(1)}%"></span>
            <span>${fmt.formatDistance(r.distanceM, u)}</span>
            ${prev && !partial ? deltaHtml(r.distanceM, prev.distanceM) : ''}
          </td>
          <td class="num">${fmt.formatDuration(r.durationS)}</td>
          <td class="num">${fmt.formatElevation(r.elevationGainM, u)}</td>
          <td class="num">${fmt.formatNumber(r.activeDays)}</td>
          <td>${topCat ? `${topCat.icon} ${esc(topCat.label)}` : '–'}</td>
        </tr>`;
    })
    .join('');

  $('#years').innerHTML = `
    <div class="section-head"><h2>Year by year</h2></div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th scope="col">Year</th><th scope="col" class="num">Activities</th><th scope="col" class="num">Distance</th>
          <th scope="col" class="num">Time</th><th scope="col" class="num">Elevation</th>
          <th scope="col" class="num">Active days</th><th scope="col">Top sport</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function syncToggles() {
  document.querySelectorAll('[data-units]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.units === state.units));
  $('#csv-units').value = state.csvUnits;
}

function render() {
  const has = state.activities.length > 0;
  $('#import').hidden = has;
  $('#recap').hidden = !has;
  $('#add-data').hidden = !has;
  $('#clear-data').hidden = !has;
  $('#sample-banner').hidden = !state.isSample;
  syncToggles();
  if (!has) return;

  const years = stats.yearsIn(state.activities);
  if (state.year !== 'all' && !years.includes(state.year)) state.year = years[0];
  const list = stats.forYear(state.activities, state.year);
  const cmp = stats.comparisonFor(state.activities, state.year);

  renderYearTabs(years);
  renderHero(list, cmp);
  renderCategories(list, cmp);
  renderChart(list);
  renderHighlights(list);
  renderYearsTable();
}

// ------------------------------------------------------------- events

function bindEvents() {
  const input = $('#file-input');
  input.addEventListener('change', () => {
    importFiles(input.files);
    input.value = '';
  });
  $('#add-data').addEventListener('click', () => input.click());
  $('#clear-data').addEventListener('click', clearData);
  $('#load-sample').addEventListener('click', loadSample);
  $('#csv-units').addEventListener('change', (e) => {
    state.csvUnits = e.target.value;
    savePrefs();
  });

  document.addEventListener('click', (e) => {
    const units = e.target.closest('[data-units]');
    if (units) {
      state.units = units.dataset.units;
      savePrefs();
      render();
      return;
    }
    const year = e.target.closest('[data-year]');
    if (year) {
      state.year = year.dataset.year === 'all' ? 'all' : Number(year.dataset.year);
      render();
      if (year.closest('#years')) $('#recap').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const metric = e.target.closest('[data-metric]');
    if (metric) {
      state.metric = metric.dataset.metric;
      savePrefs();
      render();
      return;
    }
    const col = e.target.closest('.bar-col');
    if (col) selectChartColumn(col);
  });
  document.addEventListener('pointerover', (e) => {
    const col = e.target.closest?.('.bar-col');
    if (col && e.pointerType === 'mouse') selectChartColumn(col);
  });
  document.addEventListener('focusin', (e) => {
    const col = e.target.closest?.('.bar-col');
    if (col) selectChartColumn(col);
  });

  // Drag and drop anywhere on the page.
  let depth = 0;
  document.addEventListener('dragenter', (e) => {
    if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return;
    depth++;
    document.body.classList.add('dragging');
  });
  document.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) document.body.classList.remove('dragging');
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    document.body.classList.remove('dragging');
    if (e.dataTransfer?.files?.length) importFiles(e.dataTransfer.files);
  });
}

loadState();
bindEvents();
render();
