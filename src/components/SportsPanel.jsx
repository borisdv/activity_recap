import { categoryById } from '../lib/categories.js';
import * as stats from '../lib/stats.js';
import * as fmt from '../lib/format.js';
import { Delta } from './ui.jsx';

/** Dark panel: one glassy card per sport (or activity type) plus the weekly-rhythm gauge. */
export default function SportsPanel({ list, cmp, sport, units, rhythm, year }) {
  const byType = sport !== 'all';
  const field = byType ? 'typeLabel' : 'category';
  const rows = stats.breakdown(list, field);
  const prev = new Map((cmp ? stats.breakdown(cmp.activities, field) : []).map((r) => [r.key, r]));
  const totalTime = rows.reduce((acc, r) => acc + r.durationS, 0) || 1;

  return (
    <section className="dark-panel" aria-labelledby="sports-title">
      <div className="dark-head">
        <h2 id="sports-title">{byType ? 'Activity types' : 'Sports'}</h2>
        <p>
          {year === 'all' ? 'All years' : year} · {rows.length} {byType ? 'types' : rows.length === 1 ? 'sport' : 'sports'}
          {cmp ? ` · changes vs ${cmp.year}` : ''}
        </p>
      </div>
      <div className="dark-body">
        <div className="sport-cards">
          {rows.map((r) => {
            const cat = categoryById(r.category);
            const p = prev.get(r.key);
            const useDistance = r.distanceM > 0;
            const hours = r.durationS / 3600;
            const value = useDistance
              ? fmt.formatCategoryDistance(r.distanceM, units, r.category)
              : `${fmt.formatNumber(hours, hours < 10 ? 1 : 0)} h`;
            const [num, unit] = splitUnit(value);
            const share = r.durationS / totalTime;
            return (
              <article className="sport-card" key={r.key} style={{ '--c': `var(--cat-${cat.id})` }}>
                <div className="sc-head">
                  <span className="icon-ring glass" aria-hidden="true">
                    {cat.icon}
                  </span>
                  <div>
                    <h3>{byType ? r.key : cat.label}</h3>
                    <p>
                      {fmt.formatNumber(r.count)} {r.count === 1 ? 'activity' : 'activities'} · {fmt.formatDuration(r.durationS)}
                    </p>
                  </div>
                </div>
                <div className="sc-mid">
                  <span className="sc-value">
                    {num}
                    {unit && <small>{unit}</small>}
                  </span>
                  {cmp && (
                    <span className="sc-side">
                      <span>vs {cmp.year}</span>
                      {p ? (
                        <Delta current={useDistance ? r.distanceM : r.durationS} previous={useDistance ? p.distanceM : p.durationS} />
                      ) : (
                        <span className="delta">new</span>
                      )}
                    </span>
                  )}
                </div>
                <div
                  className="sc-bar"
                  role="meter"
                  aria-label="Share of time"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(share * 100)}
                >
                  <span style={{ width: `${(share * 100).toFixed(1)}%` }} />
                </div>
                <div className="sc-foot">
                  <span>{fmt.formatPercent(share)} of your time</span>
                  {r.longest?.distanceM > 0 && (
                    <span>longest {fmt.formatCategoryDistance(r.longest.distanceM, units, r.category)}</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <Gauge value={rhythm.value} previous={rhythm.previous} previousLabel={rhythm.previousLabel} />
      </div>
    </section>
  );
}

export function splitUnit(text) {
  const m = String(text).match(/^(.*\d)\s+([^\d\s]+)$/);
  return m ? [m[1], m[2]] : [text, ''];
}

/** Half-circle gauge for activities per week, with last year's value as a tick. */
function Gauge({ value, previous, previousLabel }) {
  const max = Math.max(7, Math.ceil(Math.max(value, previous ?? 0) * 1.25));
  const size = 180;
  const c = size / 2;
  const r = 70;
  const toAngle = (v) => Math.PI + (Math.min(v, max) / max) * Math.PI; // left (pi) to right (2pi)
  const pt = (radius, a) => [c + radius * Math.cos(a), c + radius * Math.sin(a)];
  const arc = (radius, a0, a1) => {
    const [x0, y0] = pt(radius, a0);
    const [x1, y1] = pt(radius, a1);
    return `M${x0},${y0} A${radius},${radius} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
  };
  const a = toAngle(value);
  const [nx, ny] = pt(r - 6, a);
  const prevA = previous != null ? toAngle(previous) : null;

  return (
    <div className="gauge">
      <svg width={size} height={c + 14} viewBox={`0 0 ${size} ${c + 14}`} role="img" aria-label={`Weekly rhythm ${fmt.formatNumber(value, 1)} activities per week`}>
        <path d={arc(r - 12, Math.PI, 2 * Math.PI)} className="gauge-track" />
        <path d={arc(r + 4, Math.PI, 2 * Math.PI)} className="gauge-rim" />
        <path d={arc(r + 4, Math.PI, a)} className="gauge-value" />
        {prevA != null && (
          <line
            x1={pt(r - 2, prevA)[0]}
            y1={pt(r - 2, prevA)[1]}
            x2={pt(r + 10, prevA)[0]}
            y2={pt(r + 10, prevA)[1]}
            className="gauge-prev"
          />
        )}
        <circle cx={pt(r + 4, a)[0]} cy={pt(r + 4, a)[1]} r="3.5" className="gauge-dot" />
        <line x1={c} y1={c} x2={nx} y2={ny} className="gauge-needle" />
        <circle cx={c} cy={c} r="4" className="gauge-hub" />
      </svg>
      <span className="gauge-label">Weekly rhythm</span>
      <span className="gauge-value-text">
        {fmt.formatNumber(value, 1)}
        <small> / week</small>
      </span>
      {previous != null && (
        <span className="gauge-prev-text">
          {previousLabel}: {fmt.formatNumber(previous, 1)}
        </span>
      )}
    </div>
  );
}
