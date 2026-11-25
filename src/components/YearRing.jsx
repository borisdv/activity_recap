import { useState } from 'react';
import { useElementWidth } from '../hooks/useElementWidth.js';
import { CATEGORIES, categoryById } from '../lib/categories.js';
import { CALENDAR_DAYS } from '../lib/stats.js';
import * as fmt from '../lib/format.js';
import { calendarLabel } from './CumulativeChart.jsx';
import { DotMatrix } from './minis.jsx';

const MONTH_STARTS = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

function dominant(cats) {
  let best = null;
  for (const [id, v] of Object.entries(cats)) if (!best || v > cats[best]) best = id;
  return best ?? 'other';
}

/**
 * The year as a ring: one spoke per calendar day, length = time trained that
 * day, colour = the day's main sport. Hover or tap a spoke to read the day.
 */
export default function YearRing({ days, title, subtitle, units, consistency }) {
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);

  const size = Math.max(0, Math.min(width, 430));
  const c = size / 2;
  const rOuter = c - 20;
  const rInner = rOuter * 0.6;
  const maxDur = Math.max(1, ...days.map((d) => d.durationS));
  const angle = (i) => ((-90 + ((i + 0.5) / CALENDAR_DAYS) * 360) * Math.PI) / 180;
  const at = (r, a) => [c + r * Math.cos(a), c + r * Math.sin(a)];

  const onPointer = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - box.left - c;
    const dy = e.clientY - box.top - c;
    const dist = Math.hypot(dx, dy);
    if (dist < rInner * 0.75 || dist > rOuter + 16) {
      if (e.pointerType === 'mouse') setHover(null);
      return;
    }
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    setHover(Math.min(CALENDAR_DAYS - 1, Math.floor((deg / 360) * CALENDAR_DAYS)));
  };

  const day = hover != null ? days[hover] : null;
  const dayCats = day
    ? CATEGORIES.filter((cat) => day.cats[cat.id]).sort((a, b) => day.cats[b.id] - day.cats[a.id])
    : [];

  return (
    <div className="ring-wrap" ref={ref}>
      {size > 0 && (
        <div className="ring" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            role="img"
            aria-label={`${title}: one spoke per day you were active, coloured by sport.`}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
          >
            <circle cx={c} cy={c} r={rInner} className="ring-track" />
            <circle cx={c} cy={c} r={rOuter + 4} className="ring-outer" />
            {MONTH_STARTS.map((start, m) => {
              const [x1, y1] = at(rInner - 5, angle(start - 0.5));
              const [x2, y2] = at(rInner, angle(start - 0.5));
              const [lx, ly] = at(rOuter + 13, angle(start + 15));
              return (
                <g key={start}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className="ring-month-tick" />
                  <text x={lx} y={ly} dy="0.35em" textAnchor="middle" className="ring-month">
                    {fmt.monthShort(m + 1)[0]}
                  </text>
                </g>
              );
            })}
            {days.map((d, i) => {
              if (!d.count) return null;
              const len = 3 + (rOuter - rInner - 6) * Math.sqrt(d.durationS / maxDur);
              const [x1, y1] = at(rInner + 3, angle(i));
              const [x2, y2] = at(rInner + 3 + len, angle(i));
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={`ring-spoke${hover === i ? ' active' : ''}`}
                  style={{ stroke: `var(--cat-${dominant(d.cats)})` }}
                />
              );
            })}
            {hover != null && (
              <line
                className="ring-cursor"
                x1={at(rInner - 6, angle(hover))[0]}
                y1={at(rInner - 6, angle(hover))[1]}
                x2={at(rOuter + 4, angle(hover))[0]}
                y2={at(rOuter + 4, angle(hover))[1]}
              />
            )}
          </svg>

          <div className="ring-center" style={{ width: rInner * 1.5 }}>
            {day ? (
              <>
                <span className="ring-center-date">{calendarLabel(hover)}</span>
                {day.count ? (
                  <>
                    <span className="ring-center-value">{fmt.formatDuration(day.durationS)}</span>
                    {day.distanceM > 0 && <span className="ring-center-sub">{fmt.formatDistance(day.distanceM, units)}</span>}
                    <span className="ring-center-cats">
                      {dayCats.map((cat) => (
                        <span key={cat.id}>
                          <i className="key key-rect" style={{ background: `var(--cat-${cat.id})` }} />
                          {categoryById(cat.id).label}
                        </span>
                      ))}
                    </span>
                  </>
                ) : (
                  <span className="ring-center-sub">Rest day</span>
                )}
              </>
            ) : (
              <>
                <span className="ring-center-title">{title}</span>
                <span className="ring-center-sub">{subtitle}</span>
              </>
            )}
          </div>
        </div>
      )}

      {consistency && (
        <div className="glass-card">
          <div className="glass-head">
            <span>Consistency</span>
            <strong>
              {fmt.formatNumber(consistency.share * 100)}
              <small>%</small>
            </strong>
          </div>
          <DotMatrix cells={consistency.cells} cols={12} size={8} />
          <span className="glass-foot">{consistency.caption}</span>
        </div>
      )}
    </div>
  );
}
