import { useMemo, useState } from 'react';
import { CATEGORIES, categoryById } from '../lib/categories.js';
import * as stats from '../lib/stats.js';
import * as fmt from '../lib/format.js';
import { MEASURES, activityValue, measureUnit } from '../lib/measures.js';
import CumulativeChart from './CumulativeChart.jsx';
import { Delta, Segmented } from './ui.jsx';

const MAX_LINES = 4; // the year colour ramp has four steps

export default function CompareYears({ activities, years, dataEnd, measure, units, sportLabel, selectedYear, onSelectYear }) {
  const chartYears = years.slice(0, MAX_LINES);
  const colorOf = (year) => `var(--year-${chartYears.indexOf(year) + 1})`;

  const series = useMemo(
    () => stats.cumulativeByYear(activities, chartYears, (a) => activityValue(a, measure, units), dataEnd),
    [activities, years, measure, units, dataEnd], // chartYears comes from years
  );

  const label = `Running total of ${MEASURES[measure].label.toLowerCase()}${sportLabel ? ` (${sportLabel})` : ''} through the year, ${chartYears.join(', ')}`;

  return (
    <>
    <section className="card" aria-labelledby="compare-title">
      <div className="section-head">
        <div>
          <h2 id="compare-title">Running total</h2>
          <p className="muted small subtitle">
            {MEASURES[measure].label} accumulated through each year ({measureUnit(measure, units)})
            {sportLabel ? ` · ${sportLabel}` : ''}
          </p>
        </div>
        {chartYears.length > 1 && (
          <div className="legend" aria-label="Years">
            {chartYears.map((y) => (
              <span className="legend-item" key={y}>
                <i className="key key-line" style={{ background: colorOf(y) }} />
                {y}
              </span>
            ))}
          </div>
        )}
      </div>

      <CumulativeChart series={series} measure={measure} units={units} colorOf={colorOf} label={label} />

      {years.length === 1 && (
        <p className="muted small note">Add activities from another year to compare years.</p>
      )}
      {years.length > MAX_LINES && (
        <p className="muted small note">
          The chart shows the {MAX_LINES} most recent years; the table below has all of them.
        </p>
      )}
    </section>

      <CompareTable
        activities={activities}
        years={years}
        dataEnd={dataEnd}
        units={units}
        showSports={!sportLabel}
        selectedYear={selectedYear}
        onSelectYear={onSelectYear}
      />
    </>
  );
}

function CompareTable({ activities, years, dataEnd, units, showSports, selectedYear, onSelectYear }) {
  const cutoff = stats.partialYearCutoff(dataEnd);
  const [range, setRange] = useState('same');
  const sameRange = cutoff && range === 'same';
  const latestYear = years[0];
  const currentYearPartial = Boolean(cutoff);

  const columns = useMemo(
    () =>
      years.map((year) => {
        const list = stats.withinCutoff(stats.forYear(activities, year), sameRange ? cutoff : null);
        const days =
          sameRange ? stats.calendarIndex(`2000-${cutoff}`) + 1
          : year === latestYear && currentYearPartial ? stats.calendarIndex(dataEnd) + 1
          : 365;
        return {
          year,
          summary: stats.summarize(list),
          weeks: days / 7,
          cats: new Map(stats.byCategory(list).map((r) => [r.category, r])),
        };
      }),
    [activities, years, sameRange, cutoff, dataEnd, latestYear, currentYearPartial],
  );

  const anyDistance = columns.some((c) => c.summary.distanceM > 0);
  const anyElevation = columns.some((c) => c.summary.elevationGainM > 0);

  const rows = [
    { key: 'count', label: 'Activities', get: (c) => c.summary.count, show: (v) => fmt.formatNumber(v) },
    anyDistance && { key: 'distance', label: 'Distance', get: (c) => c.summary.distanceM, show: (v) => fmt.formatDistance(v, units) },
    { key: 'time', label: 'Time', get: (c) => c.summary.durationS, show: fmt.formatDuration },
    { key: 'week', label: 'Time per week', get: (c) => c.summary.durationS / c.weeks, show: fmt.formatDuration },
    anyElevation && { key: 'elev', label: 'Elevation gain', get: (c) => c.summary.elevationGainM, show: (v) => fmt.formatElevation(v, units) },
    { key: 'days', label: 'Active days', get: (c) => c.summary.activeDays, show: (v) => fmt.formatNumber(v) },
    { key: 'streak', label: 'Longest streak', get: (c) => c.summary.longestStreak, show: (v) => `${fmt.formatNumber(v)} d` },
  ].filter(Boolean);

  const sportRows = showSports
    ? CATEGORIES.filter((cat) => columns.some((c) => c.cats.has(cat.id))).map((cat) => {
        const useDistance = cat.hasDistance && columns.some((c) => (c.cats.get(cat.id)?.distanceM ?? 0) > 0);
        return {
          key: cat.id,
          cat,
          label: cat.label,
          sub: useDistance ? 'distance' : 'time',
          get: (c) => (useDistance ? c.cats.get(cat.id)?.distanceM : c.cats.get(cat.id)?.durationS) ?? 0,
          show: (v) => (useDistance ? fmt.formatCategoryDistance(v, units, cat.id) : fmt.formatDuration(v)),
        };
      })
    : [];

  const cell = (row, c, i) => {
    const value = row.get(c);
    const prev = columns[i + 1];
    const comparable = prev && prev.year === c.year - 1 && (sameRange || !(c.year === latestYear && currentYearPartial));
    return (
      <td key={c.year} className={`num${c.year === selectedYear ? ' selected' : ''}`}>
        <span className="cell-value">{value ? row.show(value) : '–'}</span>
        {comparable && value > 0 && <Delta current={value} previous={row.get(prev)} />}
      </td>
    );
  };

  return (
    <section className="card" aria-labelledby="side-title">
      <div className="section-head">
        <h2 id="side-title">Side by side</h2>
        {cutoff && (
          <Segmented
            label="Date range"
            value={range}
            onChange={setRange}
            options={[
              { value: 'same', label: `Jan 1 – ${fmt.formatMonthDay(cutoff)}` },
              { value: 'full', label: 'Full years' },
            ]}
          />
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" className="sticky-col">
                <span className="sr-only">Measure</span>
              </th>
              {columns.map((c) => (
                <th scope="col" key={c.year} className={`num${c.year === selectedYear ? ' selected' : ''}`}>
                  <button type="button" className="link" onClick={() => onSelectYear(c.year)}>
                    {c.year}
                  </button>
                  {!sameRange && c.year === latestYear && currentYearPartial && <span className="badge">so far</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="sticky-col">
                  {row.label}
                </th>
                {columns.map((c, i) => cell(row, c, i))}
              </tr>
            ))}
            {sportRows.length > 0 && (
              <tr className="group-row">
                <th scope="rowgroup" colSpan={columns.length + 1} className="sticky-col">
                  By sport
                </th>
              </tr>
            )}
            {sportRows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="sticky-col">
                  <span className="sport-name">
                    <i className="key key-rect" style={{ background: `var(--cat-${row.cat.id})` }} />
                    {categoryById(row.cat.id).label}
                  </span>
                  <span className="muted small"> {row.sub}</span>
                </th>
                {columns.map((c, i) => cell(row, c, i))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small note">
        {sameRange
          ? `Each year counted from Jan 1 to ${fmt.formatMonthDay(cutoff)}, so the current year compares fairly. `
          : ''}
        Arrows compare with the year before.
      </p>
    </section>
  );
}
