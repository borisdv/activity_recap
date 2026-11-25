import { useMemo } from 'react';
import * as stats from '../lib/stats.js';
import * as fmt from '../lib/format.js';
import { buildInsight } from '../lib/insights.js';
import YearRing from './YearRing.jsx';
import SportsPanel, { splitUnit } from './SportsPanel.jsx';
import MonthlyChart from './MonthlyChart.jsx';
import Highlights from './Highlights.jsx';
import { DotMatrix, Sparkline, TickBars, WeekdayCircles } from './minis.jsx';
import { ArrowUpRight, Calendar, ChevronLeft, ChevronRight, Clock, Mountain, Pulse, Route, Sparkle } from './icons.jsx';
import { Delta } from './ui.jsx';

const EVEREST_M = 8849;

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function spanDays(first, last) {
  return Math.round((Date.parse(last) - Date.parse(first)) / 86_400_000) + 1;
}

export default function DashboardView({ activities, years, year, onYear, dataEnd, sport, units, measure, filterBar, onCompare }) {
  const list = useMemo(() => stats.forYear(activities, year), [activities, year]);
  const cmp = useMemo(() => stats.comparisonFor(activities, year, dataEnd), [activities, year, dataEnd]);
  const s = useMemo(() => stats.summarize(list), [list]);
  const p = useMemo(() => (cmp ? stats.summarize(cmp.activities) : null), [cmp]);

  const isAll = year === 'all';
  const days = isAll ? (s.firstDate ? spanDays(s.firstDate, s.lastDate) : 1) : stats.daysCovered(year, dataEnd);
  const weeksCovered = Math.max(1, Math.ceil(days / 7));
  const partial = !isAll && days < 365;
  const sportCount = new Set(list.map((a) => a.category)).size;

  const summary = isAll
    ? `${fmt.formatNumber(s.count)} activities over ${years.length} ${years.length === 1 ? 'year' : 'years'}.`
    : partial
      ? `Your ${year} so far: ${fmt.formatNumber(s.count)} activities${sport === 'all' ? ` across ${sportCount} ${sportCount === 1 ? 'sport' : 'sports'}` : ''}.`
      : `In ${year} you logged ${fmt.formatNumber(s.count)} activities${sport === 'all' ? ` across ${sportCount} ${sportCount === 1 ? 'sport' : 'sports'}` : ''}.`;

  const header = (
    <div className="page-head">
      <div>
        <h1>Dashboard</h1>
        <p className="page-sub">
          {greeting()}. {summary}
        </p>
      </div>
      <YearStrip years={years} year={year} onYear={onYear} activities={activities} />
    </div>
  );

  if (!list.length) {
    return (
      <>
        {header}
        {filterBar}
        <section className="card empty">
          <p>No activities for this selection in {isAll ? 'any year' : year}.</p>
        </section>
      </>
    );
  }

  return (
    <>
      {header}
      {filterBar}
      <DashboardBody
        list={list}
        cmp={cmp}
        s={s}
        p={p}
        year={year}
        days={days}
        weeksCovered={weeksCovered}
        dataEnd={dataEnd}
        sport={sport}
        units={units}
        measure={measure}
        onCompare={onCompare}
      />
    </>
  );
}

function DashboardBody({ list, cmp, s, p, year, days, weeksCovered, dataEnd, sport, units, measure, onCompare }) {
  const isAll = year === 'all';
  const vs = cmp ? String(cmp.year) : null;

  const buckets = useMemo(() => (isAll ? stats.byYearBuckets(list) : stats.byMonth(list)), [list, isAll]);
  const weeks = useMemo(() => stats.byWeek(list), [list]);
  const ringDays = useMemo(() => stats.byCalendarDay(list), [list]);
  const insight = useMemo(() => buildInsight({ list, cmp, units, sport }), [list, cmp, units, sport]);

  // Mini-chart inputs
  const distanceSeries = buckets.map((b) => b.total.distanceM);
  const elevationSeries = buckets.map((b) => b.total.elevationGainM);
  const timeTicks = isAll
    ? buckets.map((b) => b.total.durationS)
    : Array.from({ length: 27 }, (_, i) => weeks[2 * i].durationS + (weeks[2 * i + 1]?.durationS ?? 0));

  let activeCells;
  let activeCols;
  let activeCaption;
  if (isAll) {
    const months = new Set(list.map((a) => a.date.slice(0, 7)));
    const firstYear = list[0] ? Math.min(...list.map((a) => a.year)) : 0;
    const lastYear = Math.max(...list.map((a) => a.year));
    activeCells = [];
    for (let y = firstYear; y <= lastYear; y++) {
      for (let m = 1; m <= 12; m++) activeCells.push(months.has(`${y}-${String(m).padStart(2, '0')}`));
    }
    activeCols = 12;
    activeCaption = `${months.size} active months`;
  } else {
    activeCells = weeks.slice(0, 52).map((w) => w.count > 0);
    activeCols = 13;
    const activeWeeks = weeks.filter((w) => w.count > 0).length;
    activeCaption = `${activeWeeks} of ${Math.min(52, weeksCovered)} weeks active`;
  }

  // Consistency card on the ring: active share of days plus the last 12 weeks.
  const activeDates = new Set(list.map((a) => a.date));
  const endDate = isAll ? s.lastDate : Number(dataEnd.slice(0, 4)) === year ? dataEnd : `${year}-12-31`;
  const gridStart = addDays(endDate, -83);
  const consistencyCells = [];
  for (let r = 0; r < 7; r++) for (let w = 0; w < 12; w++) consistencyCells.push(activeDates.has(addDays(gridStart, w * 7 + r)));
  const consistency = {
    share: s.activeDays / days,
    cells: consistencyCells,
    caption: `of days active · dots show the last 12 weeks`,
  };

  const perWeek = (v) => v / weeksCovered;
  const streak = stats.longestStreakRange(list);
  const cmpDays = cmp ? (cmp.cutoff ? stats.dayOfYear(`${cmp.year}-${cmp.cutoff}`) : stats.daysCovered(cmp.year, dataEnd)) : null;

  const cards = [
    s.distanceM > 0 && {
      key: 'distance',
      icon: <Route />,
      title: 'Distance',
      delta: [s.distanceM, p?.distanceM],
      extra: `${fmt.formatDistance(perWeek(s.distanceM), units)} a week`,
      value: fmt.formatDistance(s.distanceM, units),
      viz: <Sparkline values={distanceSeries} />,
      open: () => onCompare('distance'),
    },
    {
      key: 'time',
      icon: <Clock />,
      title: 'Time',
      delta: [s.durationS, p?.durationS],
      extra: `${fmt.formatDuration(perWeek(s.durationS))} a week`,
      value: `${fmt.formatNumber(Math.round(s.durationS / 3600))} h`,
      viz: <TickBars values={timeTicks} />,
      open: () => onCompare('time'),
    },
    {
      key: 'count',
      icon: <Pulse />,
      title: 'Activities',
      delta: [s.count, p?.count],
      extra: activeCaption,
      value: fmt.formatNumber(s.count),
      viz: <DotMatrix cells={activeCells} cols={activeCols} />,
      open: () => onCompare('count'),
    },
    s.elevationGainM > 0 && {
      key: 'elevation',
      icon: <Mountain />,
      title: 'Elevation gain',
      delta: [s.elevationGainM, p?.elevationGainM],
      extra: `${fmt.formatNumber(s.elevationGainM / EVEREST_M, 1)}× Everest`,
      value: fmt.formatElevation(s.elevationGainM, units),
      viz: <Sparkline values={elevationSeries} />,
      open: () => onCompare(null),
    },
    {
      key: 'days',
      icon: <Calendar />,
      title: 'Active days',
      delta: [s.activeDays, p?.activeDays],
      extra: streak.length > 1 ? `Longest streak ${streak.length} days` : null,
      value: fmt.formatNumber(s.activeDays),
      viz: <WeekdayCircles counts={stats.weekdayCounts(list)} />,
      open: () => onCompare(null),
    },
  ].filter(Boolean);

  const rhythm = {
    value: s.count / (days / 7),
    previous: p && cmpDays ? p.count / (cmpDays / 7) : null,
    previousLabel: cmp ? String(cmp.year) : '',
  };

  const columns = buckets.map((b) =>
    isAll
      ? { key: b.year, label: String(b.year), shortLabel: `’${String(b.year).slice(2)}`, detailLabel: String(b.year), cats: b.cats, total: b.total }
      : {
          key: b.month,
          label: fmt.monthShort(b.month),
          shortLabel: fmt.monthShort(b.month)[0],
          detailLabel: `${fmt.monthLong(b.month)} ${year}`,
          cats: b.cats,
          total: b.total,
        },
  );

  return (
    <>
      <div className="dash-grid">
        <YearRing
          days={ringDays}
          title={isAll ? 'All years' : String(year)}
          subtitle={`${fmt.formatNumber(s.activeDays)} active days`}
          units={units}
          consistency={consistency}
        />
        <div className="cards-grid">
          <article className="metric-card insight-card">
            <div className="mc-top">
              <span className="icon-ring glass">
                <Sparkle />
              </span>
              <button type="button" className="arrow-btn light" aria-label="Compare years" onClick={() => onCompare(measure)}>
                <ArrowUpRight />
              </button>
            </div>
            <h3 className="mc-title">Insight</h3>
            <p className="mc-sub">{cmp ? `Compared with ${cmp.cutoff ? `the same dates in ${cmp.year}` : cmp.year}` : 'From your activities'}</p>
            <div className="insight-text">
              {insight.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </article>
          {cards.map((c) => {
            const [num, unit] = splitUnit(c.value);
            return (
              <article className="metric-card" key={c.key}>
                <div className="mc-top">
                  <span className="icon-ring">{c.icon}</span>
                  <button type="button" className="arrow-btn" aria-label={`Compare ${c.title.toLowerCase()} across years`} onClick={c.open}>
                    <ArrowUpRight />
                  </button>
                </div>
                <h3 className="mc-title">{c.title}</h3>
                <p className="mc-sub">
                  {vs && c.delta[1] ? (
                    <>
                      <Delta current={c.delta[0]} previous={c.delta[1]} /> vs {vs}
                      {c.extra ? ' · ' : ''}
                    </>
                  ) : null}
                  {c.extra}
                </p>
                <div className="mc-bottom">
                  <span className="mc-value">
                    {num}
                    {unit && <small>{unit}</small>}
                  </span>
                  <span className="mc-viz">{c.viz}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <SportsPanel list={list} cmp={cmp} sport={sport} units={units} rhythm={rhythm} year={year} />

      <MonthlyChart title={isAll ? 'Year by year' : 'Month by month'} columns={columns} measure={measure} units={units} />

      <Highlights list={list} year={year} units={units} />
    </>
  );
}

/** Year picker styled like a date strip: arrows, years with activity dots, and All. */
function YearStrip({ years, year, onYear, activities }) {
  const asc = [...years].sort((a, b) => a - b);
  const counts = new Map(asc.map((y) => [y, 0]));
  for (const a of activities) counts.set(a.year, (counts.get(a.year) ?? 0) + 1);
  const max = Math.max(1, ...counts.values());
  const items = [...asc, 'all'];
  const index = items.indexOf(year);
  const go = (d) => {
    const next = items[index + d];
    if (next !== undefined) onYear(next);
  };

  return (
    <nav className="year-strip" aria-label="Year">
      <button type="button" className="strip-arrow" aria-label="Previous year" disabled={index <= 0} onClick={() => go(-1)}>
        <ChevronLeft size={16} />
      </button>
      <div className="strip-items">
        {items.map((y) => {
          const count = y === 'all' ? activities.length : counts.get(y) ?? 0;
          const dots = y === 'all' ? 0 : Math.max(count ? 1 : 0, Math.round((count / max) * 3));
          return (
            <button key={y} type="button" className="strip-item" aria-pressed={year === y} onClick={() => onYear(y)}>
              <span className="strip-num">
                {y === 'all' ? 'All' : y}
                {dots > 0 && (
                  <span className="strip-dots" aria-hidden="true">
                    {Array.from({ length: dots }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                )}
              </span>
              <span className="strip-sub">
                {fmt.formatNumber(count)} {count === 1 ? 'activity' : 'activities'}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className="strip-arrow" aria-label="Next year" disabled={index >= items.length - 1} onClick={() => go(1)}>
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
