import { useMemo } from 'react';
import { categoryById } from '../lib/categories.js';
import * as stats from '../lib/stats.js';
import * as fmt from '../lib/format.js';
import MonthlyChart from './MonthlyChart.jsx';
import { Delta } from './ui.jsx';

const EARTH_CIRCUMFERENCE_M = 40_075_000;

/** Year tabs plus everything they scope: totals, breakdown, monthly chart, highlights. */
export default function YearRecap({ activities, years, year, onYear, dataEnd, sport, measure, units }) {
  const list = useMemo(() => stats.forYear(activities, year), [activities, year]);
  const cmp = useMemo(() => stats.comparisonFor(activities, year, dataEnd), [activities, year, dataEnd]);
  const sportLabel = sport === 'all' ? null : categoryById(sport).label;

  const columns = useMemo(() => {
    if (year === 'all') {
      return stats.byYearBuckets(list).map((b) => ({
        key: b.year,
        label: String(b.year),
        shortLabel: `’${String(b.year).slice(2)}`,
        detailLabel: String(b.year),
        cats: b.cats,
        total: b.total,
      }));
    }
    return stats.byMonth(list).map((b) => ({
      key: b.month,
      label: fmt.monthShort(b.month),
      shortLabel: fmt.monthShort(b.month)[0],
      detailLabel: `${fmt.monthLong(b.month)} ${year}`,
      cats: b.cats,
      total: b.total,
    }));
  }, [list, year]);

  return (
    <div className="year-recap" id="year-recap">
      <nav className="year-tabs" aria-label="Year">
        {years.map((y) => (
          <button key={y} type="button" className="tab" aria-pressed={year === y} onClick={() => onYear(y)}>
            {y}
          </button>
        ))}
        <button type="button" className="tab" aria-pressed={year === 'all'} onClick={() => onYear('all')}>
          All time
        </button>
      </nav>

      {list.length === 0 ? (
        <section className="card empty">
          <p>
            No {sportLabel ? sportLabel.toLowerCase() : ''} activities in {year}.
          </p>
        </section>
      ) : (
        <>
          <Hero list={list} cmp={cmp} year={year} measure={measure} units={units} sportLabel={sportLabel} />
          <Breakdown list={list} cmp={cmp} sport={sport} units={units} />
          <MonthlyChart
            title={year === 'all' ? 'Year by year' : 'Month by month'}
            columns={columns}
            measure={measure}
            units={units}
          />
          <Highlights list={list} year={year} units={units} />
        </>
      )}
    </div>
  );
}

function comparisonLabel(cmp) {
  return cmp.cutoff ? `Jan 1 – ${fmt.formatMonthDay(cmp.cutoff)}, ${cmp.year}` : String(cmp.year);
}

function Hero({ list, cmp, year, measure, units, sportLabel }) {
  const s = stats.summarize(list);
  const p = cmp ? stats.summarize(cmp.activities) : null;

  const all = {
    distance: { label: 'Distance', value: fmt.formatDistance(s.distanceM, units), cur: s.distanceM, prev: p?.distanceM },
    time: { label: 'Time', value: fmt.formatDuration(s.durationS), cur: s.durationS, prev: p?.durationS },
    count: { label: 'Activities', value: fmt.formatNumber(s.count), cur: s.count, prev: p?.count },
  };
  const lead = all[measure];
  const tiles = [
    ...Object.entries(all)
      .filter(([id]) => id !== measure && !(id === 'distance' && !s.distanceM))
      .map(([, t]) => t),
    s.elevationGainM > 0 && {
      label: 'Elevation gain',
      value: fmt.formatElevation(s.elevationGainM, units),
      cur: s.elevationGainM,
      prev: p?.elevationGainM,
    },
    { label: 'Active days', value: fmt.formatNumber(s.activeDays), cur: s.activeDays, prev: p?.activeDays },
    {
      label: 'Longest streak',
      value: `${fmt.formatNumber(s.longestStreak)} ${s.longestStreak === 1 ? 'day' : 'days'}`,
      cur: s.longestStreak,
      prev: p?.longestStreak,
    },
    s.calories > 0 && { label: 'Calories', value: `${fmt.formatNumber(s.calories)} kcal`, cur: s.calories, prev: p?.calories },
  ].filter(Boolean);

  const laps = s.distanceM / EARTH_CIRCUMFERENCE_M;
  const unitSplit = (text) => {
    const match = text.match(/^(.*\d)\s+([^\d\s]+)$/);
    return match ? (
      <>
        {match[1]} <small>{match[2]}</small>
      </>
    ) : (
      text
    );
  };

  return (
    <section className="card hero" aria-labelledby="hero-title">
      <div className="hero-head">
        <div>
          <p className="eyebrow">
            {year === 'all' ? 'All time' : `${year} recap`}
            {sportLabel ? ` · ${sportLabel}` : ''}
          </p>
          <h2 id="hero-title">{year === 'all' ? 'Every activity so far' : `Your ${year}`}</h2>
          <p className="muted">
            {fmt.formatDate(s.firstDate)} – {fmt.formatDate(s.lastDate)}
          </p>
        </div>
        {cmp && (
          <p className="compare-note">
            Changes compared with <strong>{comparisonLabel(cmp)}</strong>
          </p>
        )}
      </div>

      <div className="hero-figure">
        <span className="tile-label">{lead.label}</span>
        <span className="hero-value">{unitSplit(lead.value)}</span>
        {p && <Delta current={lead.cur} previous={lead.prev} />}
      </div>

      <div className="tiles">
        {tiles.map((t) => (
          <div className="tile" key={t.label}>
            <span className="tile-label">{t.label}</span>
            <span className="tile-value">{unitSplit(t.value)}</span>
            {p && <Delta current={t.cur} previous={t.prev} />}
          </div>
        ))}
      </div>

      {s.distanceM > 0 && (
        <p className="fun">
          That's{' '}
          <strong>
            {laps >= 1 ? `${fmt.formatNumber(laps, 1)}×` : fmt.formatPercent(laps, laps < 0.1 ? 1 : 0)}
          </strong>{' '}
          {laps >= 1 ? 'around the Earth.' : 'of the way around the Earth.'}
        </p>
      )}
    </section>
  );
}

function Breakdown({ list, cmp, sport, units }) {
  const byType = sport !== 'all';
  const rows = stats.breakdown(list, byType ? 'typeLabel' : 'category');
  const prevRows = new Map((cmp ? stats.breakdown(cmp.activities, byType ? 'typeLabel' : 'category') : []).map((r) => [r.key, r]));
  const totalTime = rows.reduce((acc, r) => acc + r.durationS, 0) || 1;

  return (
    <section className="card" aria-labelledby="breakdown-title">
      <div className="section-head">
        <h2 id="breakdown-title">{byType ? 'By activity type' : 'By sport'}</h2>
      </div>
      <ul className="cat-list">
        {rows.map((r) => {
          const cat = categoryById(r.category);
          const prev = prevRows.get(r.key);
          const share = r.durationS / totalTime;
          const types = [...r.types.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name)
            .join(' · ');
          return (
            <li className="cat-row" key={r.key} style={{ '--c': `var(--cat-${cat.id})` }}>
              <div className="cat-name">
                <span className="cat-icon" aria-hidden="true">
                  {cat.icon}
                </span>
                <div>
                  <strong>{byType ? r.key : cat.label}</strong>
                  {!byType && <span className="muted small">{types}</span>}
                </div>
              </div>
              <div className="cat-stats">
                <Stat label="Activities" value={fmt.formatNumber(r.count)} cur={r.count} prev={prev?.count} cmp={cmp} />
                {r.distanceM > 0 && (
                  <Stat
                    label="Distance"
                    value={fmt.formatCategoryDistance(r.distanceM, units, r.category)}
                    cur={r.distanceM}
                    prev={prev?.distanceM}
                    cmp={cmp}
                  />
                )}
                <Stat label="Time" value={fmt.formatDuration(r.durationS)} cur={r.durationS} prev={prev?.durationS} cmp={cmp} />
                {r.elevationGainM > 0 && <Stat label="Elevation" value={fmt.formatElevation(r.elevationGainM, units)} />}
              </div>
              <div className="cat-share">
                <div
                  className="share-bar"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(share * 100)}
                  aria-label="Share of time"
                >
                  <span style={{ width: `${(share * 100).toFixed(1)}%` }} />
                </div>
                <span className="muted small">{fmt.formatPercent(share)} of time</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ label, value, cur, prev, cmp }) {
  return (
    <div>
      <span className="k">{label}</span>
      <span className="v">
        <span>{value}</span>
        {cmp && cur != null && <Delta current={cur} previous={prev} />}
      </span>
    </div>
  );
}

const LONGEST_LABEL = {
  running: 'Longest run',
  cycling: 'Longest ride',
  swimming: 'Longest swim',
  walking: 'Longest walk or hike',
  winter: 'Longest day on snow',
  water: 'Longest paddle',
};

function Highlights({ list, year, units }) {
  const h = stats.highlights(list);
  const about = (a) => `${a.title} · ${fmt.formatDate(a.date)}`;
  const cards = [];

  for (const r of stats.byCategory(list)) {
    const label = LONGEST_LABEL[r.category];
    if (!label || !r.longest?.distanceM) continue;
    const a = r.longest;
    cards.push({
      key: `longest-${r.category}`,
      cat: r.category,
      label,
      value: fmt.formatCategoryDistance(a.distanceM, units, a.category),
      sub: `${about(a)}${a.durationS ? ` · ${fmt.formatDuration(a.durationS)}` : ''}`,
    });
  }
  if (h.longestDuration) {
    const a = h.longestDuration;
    cards.push({ key: 'session', cat: a.category, label: 'Longest session', value: fmt.formatDuration(a.durationS), sub: about(a) });
  }
  if (h.biggestClimb) {
    const a = h.biggestClimb;
    cards.push({ key: 'climb', cat: a.category, label: 'Biggest climb', value: fmt.formatElevation(a.elevationGainM, units), sub: about(a) });
  }
  if (h.busiestMonth) {
    const [y, mo] = h.busiestMonth.key.split('-').map(Number);
    cards.push({
      key: 'month',
      label: 'Most active month',
      value: `${fmt.monthLong(mo)}${year === 'all' ? ` ${y}` : ''}`,
      sub: `${fmt.formatDuration(h.busiestMonth.durationS)} · ${fmt.formatNumber(h.busiestMonth.count)} activities`,
    });
  }
  if (h.favouriteWeekday) {
    cards.push({
      key: 'weekday',
      label: 'Favourite day',
      value: `${h.favouriteWeekday.name}s`,
      sub: `${fmt.formatNumber(h.favouriteWeekday.count)} activities`,
    });
  }
  if (h.morningShare != null) {
    const early = h.morningShare >= 0.5;
    cards.push({
      key: 'clock',
      label: early ? 'Early bird' : 'Afternoon and evening',
      value: fmt.formatPercent(early ? h.morningShare : 1 - h.morningShare),
      sub: early ? 'of activities started before noon' : 'of activities started after noon',
    });
  }

  return (
    <section className="card" aria-labelledby="highlights-title">
      <div className="section-head">
        <h2 id="highlights-title">Highlights</h2>
      </div>
      <div className="highlight-grid">
        {cards.map((c) => (
          <div className="highlight" key={c.key} style={c.cat ? { '--c': `var(--cat-${c.cat})` } : undefined}>
            <span className="tile-label">{c.label}</span>
            <span className="highlight-value">{c.value}</span>
            <span className="muted small">{c.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
