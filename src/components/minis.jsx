// Tiny inline charts for the metric cards. Decorative summaries: every value
// they show is also on the page as text or in a table.

const W = 96;
const H = 34;

/** Smooth line through the values (monthly totals), with a dot on the last one. */
export function Sparkline({ values, width = W, height = H }) {
  const max = Math.max(...values, 0) || 1;
  const pts = values.map((v, i) => [
    2 + (i / Math.max(1, values.length - 1)) * (width - 4),
    height - 3 - (v / max) * (height - 8),
  ]);
  // Catmull-Rom to Bezier
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const last = pts.at(-1);
  return (
    <svg className="mini" width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" className="mini-dot" />
    </svg>
  );
}

/** A row of thin ticks (e.g. hours per fortnight); the tallest are emphasised. */
export function TickBars({ values, width = W, height = H }) {
  const max = Math.max(...values, 0) || 1;
  const step = width / values.length;
  return (
    <svg className="mini" width={width} height={height} aria-hidden="true">
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 4));
        return (
          <rect
            key={i}
            x={i * step + step / 2 - 0.9}
            y={height - h}
            width="1.8"
            height={h}
            rx="0.9"
            className={v / max > 0.6 ? 'mini-strong' : 'mini-soft'}
          />
        );
      })}
    </svg>
  );
}

/** Dot grid, one dot per week: filled when you trained that week. */
export function DotMatrix({ cells, cols, size = 7 }) {
  const rows = Math.ceil(cells.length / cols);
  return (
    <svg className="mini" width={cols * size} height={rows * size} aria-hidden="true">
      {cells.map((on, i) => (
        <circle
          key={i}
          cx={(i % cols) * size + size / 2}
          cy={Math.floor(i / cols) * size + size / 2}
          r={on ? 1.9 : 1.4}
          className={on ? 'mini-strong' : 'mini-off'}
        />
      ))}
    </svg>
  );
}

/** Seven circles, Monday to Sunday: fuller means more activities on that weekday. */
export function WeekdayCircles({ counts }) {
  const max = Math.max(...counts, 0) || 1;
  const top = counts.indexOf(max);
  return (
    <svg className="mini" width={7 * 14} height={22} aria-hidden="true">
      {counts.map((c, i) => (
        <g key={i}>
          <circle cx={i * 14 + 7} cy={8} r="5.2" className="mini-ring" />
          <circle cx={i * 14 + 7} cy={8} r={1 + (c / max) * 3.6} className={i === top ? 'mini-strong' : 'mini-soft'} />
          <text x={i * 14 + 7} y={21} textAnchor="middle" className="mini-label">
            {'MTWTFSS'[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}
