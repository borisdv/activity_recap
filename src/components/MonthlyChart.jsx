import { useState } from 'react';
import { useElementWidth } from '../hooks/useElementWidth.js';
import { CATEGORIES } from '../lib/categories.js';
import { formatMeasure, formatTick, niceScale, ticksFor, totalsValue } from '../lib/measures.js';
import { Segmented, Tooltip } from './ui.jsx';

const GAP = 2; // surface gap between stacked segments
const RADIUS = 4;

function topRoundedRect(x, yTop, w, h, r) {
  const rr = Math.min(r, h, w / 2);
  const yb = yTop + h;
  return `M${x},${yb}V${yTop + rr}A${rr},${rr} 0 0 1 ${x + rr},${yTop}H${x + w - rr}A${rr},${rr} 0 0 1 ${x + w},${yTop + rr}V${yb}Z`;
}

/**
 * Stacked columns by sport.
 * `columns`: [{ key, label, shortLabel, detailLabel, cats: {id: totals}, total }]
 */
export default function MonthlyChart({ title, columns, measure, units }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);
  const [view, setView] = useState('chart');

  const present = CATEGORIES.filter((cat) => columns.some((c) => totalsValue(c.cats[cat.id], measure, units) > 0));
  const narrow = width < 520;
  const height = narrow ? 210 : 250;
  const m = { top: 22, right: 6, bottom: 26, left: 44 };
  const plotW = Math.max(10, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;

  const values = columns.map((c) => totalsValue(c.total, measure, units));
  const maxValue = Math.max(0, ...values);
  const maxIndex = values.indexOf(maxValue);
  const scale = niceScale(maxValue, { integer: measure === 'count' });
  const band = plotW / Math.max(1, columns.length);
  const barW = Math.min(24, band * 0.62);
  const cx = (i) => m.left + band * (i + 0.5);
  const y = (v) => m.top + plotH - (v / scale.top) * plotH;

  const onKey = (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    setHover((h) => Math.max(0, Math.min(columns.length - 1, (h ?? maxIndex) + moves[e.key])));
  };

  const tooltip =
    hover != null && values[hover] > 0
      ? {
          title: `${columns[hover].detailLabel} · ${formatMeasure(values[hover], measure, units)}`,
          rows: present
            .map((cat) => ({ cat, v: totalsValue(columns[hover].cats[cat.id], measure, units) }))
            .filter((r) => r.v > 0)
            .sort((a, b) => b.v - a.v)
            .map(({ cat, v }) => ({
              key: cat.id,
              shape: 'rect',
              color: `var(--cat-${cat.id})`,
              value: formatMeasure(v, measure, units),
              label: cat.label,
            })),
        }
      : null;

  return (
    <section className="card" aria-label={title}>
      <div className="section-head">
        <h2>{title}</h2>
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'chart', label: 'Chart' },
            { value: 'table', label: 'Table' },
          ]}
        />
      </div>

      {present.length > 1 && (
        <div className="legend legend-top">
          {present.map((cat) => (
            <span className="legend-item" key={cat.id}>
              <i className="key key-rect" style={{ background: `var(--cat-${cat.id})` }} />
              {cat.label}
            </span>
          ))}
        </div>
      )}

      {view === 'chart' ? (
        <div className="chart-wrap" ref={ref}>
          <div
            className="chart-focus"
            tabIndex={0}
            role="img"
            aria-label={`${title}, stacked by sport. Use the arrow keys to read each column, or switch to the table.`}
            onKeyDown={onKey}
            onFocus={() => setHover((h) => h ?? maxIndex)}
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

              {columns.map((c, i) => {
                const segs = present
                  .map((cat) => ({ cat, v: totalsValue(c.cats[cat.id], measure, units) }))
                  .filter((s) => s.v > 0);
                let acc = 0;
                const x = cx(i) - barW / 2;
                return (
                  <g key={c.key} className="column" style={{ opacity: hover != null && hover !== i ? 0.45 : 1 }}>
                    {segs.map((s, j) => {
                      const yBottom = y(acc);
                      acc += s.v;
                      let yTop = y(acc);
                      const isTop = j === segs.length - 1;
                      if (!isTop && yBottom - yTop > GAP + 1) yTop += GAP;
                      const h = Math.max(0.75, yBottom - yTop);
                      return isTop ? (
                        <path key={s.cat.id} d={topRoundedRect(x, yBottom - h, barW, h, RADIUS)} style={{ fill: `var(--cat-${s.cat.id})` }} />
                      ) : (
                        <rect key={s.cat.id} x={x} y={yBottom - h} width={barW} height={h} style={{ fill: `var(--cat-${s.cat.id})` }} />
                      );
                    })}
                  </g>
                );
              })}

              {hover == null && maxValue > 0 && (
                <text className="cap-label" x={cx(maxIndex)} y={y(maxValue) - 7} textAnchor="middle">
                  {formatMeasure(maxValue, measure, units)}
                </text>
              )}

              {columns.map((c, i) => (
                <text key={c.key} className="tick" x={cx(i)} y={height - 8} textAnchor="middle">
                  {narrow ? c.shortLabel : c.label}
                </text>
              ))}

              {columns.map((c, i) => (
                <rect
                  key={c.key}
                  className="hit"
                  x={m.left + band * i}
                  y={0}
                  width={band}
                  height={height}
                  onPointerEnter={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                  onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
                />
              ))}
            </svg>
          </div>
          {tooltip && (
            <Tooltip x={cx(hover) + barW / 2} y={m.top} width={width} title={tooltip.title} rows={tooltip.rows} />
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col" className="sticky-col">
                  <span className="sr-only">Period</span>
                </th>
                {present.length > 1 &&
                  present.map((cat) => (
                    <th scope="col" className="num" key={cat.id}>
                      {cat.label}
                    </th>
                  ))}
                <th scope="col" className="num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c, i) => (
                <tr key={c.key}>
                  <th scope="row" className="sticky-col">
                    {c.label}
                  </th>
                  {present.length > 1 &&
                    present.map((cat) => {
                      const v = totalsValue(c.cats[cat.id], measure, units);
                      return (
                        <td className="num" key={cat.id}>
                          {v ? formatMeasure(v, measure, units) : '–'}
                        </td>
                      );
                    })}
                  <td className="num strong">{values[i] ? formatMeasure(values[i], measure, units) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
