import { useState } from 'react';
import { useElementWidth } from '../hooks/useElementWidth.js';
import { CALENDAR_DAYS } from '../lib/stats.js';
import { formatMeasure, formatTick, niceScale, ticksFor } from '../lib/measures.js';
import { monthShort } from '../lib/format.js';
import { Tooltip } from './ui.jsx';

const MONTH_STARTS = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

export function calendarLabel(index) {
  let m = 11;
  while (MONTH_STARTS[m] > index) m--;
  return `${monthShort(m + 1)} ${index - MONTH_STARTS[m] + 1}`;
}

/**
 * Running total through the year, one line per year.
 * `series`: [{ year, cumulative: number[366], endIndex }], newest first.
 */
export default function CumulativeChart({ series, measure, units, colorOf, label }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);

  const narrow = width < 520;
  const height = narrow ? 240 : 300;
  const m = { top: 14, right: narrow ? 44 : 104, bottom: 28, left: 44 };
  const plotW = Math.max(10, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const last = CALENDAR_DAYS - 1;

  const max = Math.max(0, ...series.map((s) => s.cumulative[s.endIndex]));
  const scale = niceScale(max, { integer: measure === 'count' });
  const x = (i) => m.left + (i / last) * plotW;
  const y = (v) => m.top + plotH - (v / scale.top) * plotH;

  const paths = series.map((s) => {
    let d = '';
    for (let i = 0; i <= s.endIndex; i++) d += `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.cumulative[i]).toFixed(1)}`;
    return d;
  });

  // Direct labels at line ends; a label that would collide with a newer
  // year's label is dropped (the legend and tooltip still carry it).
  const labels = [];
  for (const s of series) {
    const ex = x(s.endIndex);
    const ey = y(s.cumulative[s.endIndex]);
    if (labels.every((l) => Math.abs(l.ey - ey) >= 18 || Math.abs(l.ex - ex) > 110)) labels.push({ s, ex, ey });
  }

  const indexAt = (clientX, svg) => {
    const px = clientX - svg.getBoundingClientRect().left;
    return Math.max(0, Math.min(last, Math.round(((px - m.left) / plotW) * last)));
  };
  const onPointer = (e) => setHover(indexAt(e.clientX, e.currentTarget.ownerSVGElement));
  const onKey = (e) => {
    const step = e.shiftKey ? 30 : 7;
    const current = hover ?? series[0]?.endIndex ?? 0;
    const moves = { ArrowLeft: -step, ArrowRight: step, Home: -Infinity, End: Infinity };
    if (!(e.key in moves)) return;
    e.preventDefault();
    setHover(Math.max(0, Math.min(last, current + moves[e.key])));
  };

  const hoverRows =
    hover == null
      ? []
      : series
          .filter((s) => hover <= s.endIndex)
          .map((s) => ({
            key: s.year,
            color: colorOf(s.year),
            value: formatMeasure(s.cumulative[hover], measure, units),
            label: String(s.year),
          }));

  return (
    <div className="chart-wrap" ref={ref}>
      <div
        className="chart-focus"
        tabIndex={0}
        role="img"
        aria-label={`${label}. Use the arrow keys to move through the year.`}
        onKeyDown={onKey}
        onFocus={() => setHover((h) => h ?? series[0]?.endIndex ?? 0)}
        onBlur={() => setHover(null)}
      >
        <svg width={width} height={height} className="chart-svg" aria-hidden="true">
          {ticksFor(scale).map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'axis' : 'grid'} x1={m.left} x2={m.left + plotW} y1={y(t)} y2={y(t)} />
              <text className="tick" x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {formatTick(t)}
              </text>
            </g>
          ))}
          {MONTH_STARTS.map((start, i) => (
            <text key={start} className="tick" x={x(start + 15)} y={height - 8} textAnchor="middle">
              {narrow ? monthShort(i + 1)[0] : monthShort(i + 1)}
            </text>
          ))}

          {paths.map((d, i) => (
            <path key={series[i].year} d={d} className="line" style={{ stroke: colorOf(series[i].year) }} />
          ))}

          {hover != null && (
            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + plotH} />
          )}

          {series.map((s) => {
            const i = hover != null && hover <= s.endIndex ? hover : s.endIndex;
            return (
              <circle
                key={s.year}
                className="dot"
                cx={x(i)}
                cy={y(s.cumulative[i])}
                r="4"
                style={{ fill: colorOf(s.year) }}
              />
            );
          })}

          {hover == null &&
            labels.map(({ s, ex, ey }) => (
              <text key={s.year} className="end-label" x={ex + 9} y={ey} dy="0.32em">
                <tspan className="end-year">{s.year}</tspan>
                {!narrow && <tspan className="end-value"> {formatMeasure(s.cumulative[s.endIndex], measure, units)}</tspan>}
              </text>
            ))}

          <rect
            className="hit"
            x={m.left}
            y={0}
            width={plotW}
            height={height}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
          />
        </svg>
      </div>
      {hover != null && hoverRows.length > 0 && (
        <Tooltip
          x={x(hover)}
          y={m.top}
          width={width}
          title={`Jan 1 – ${calendarLabel(hover)}`}
          rows={hoverRows}
        />
      )}
    </div>
  );
}
