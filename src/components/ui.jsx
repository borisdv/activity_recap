import { change } from '../lib/stats.js';
import { formatNumber } from '../lib/format.js';

export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "▲ 12%" / "▼ 5%" / "±0%". Arrow plus colour, so direction never relies on colour alone. */
export function Delta({ current, previous }) {
  const ratio = change(current, previous);
  if (ratio == null) return null;
  const pct = Math.round(ratio * 100);
  if (pct === 0) return <span className="delta flat">±0%</span>;
  const up = pct > 0;
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      <span className="sr-only">{up ? 'up' : 'down'}</span> {formatNumber(Math.abs(pct))}%
    </span>
  );
}

/** Floating readout used by the charts. `x`/`y` are relative to the chart wrapper. */
export function Tooltip({ x, y, width, title, rows }) {
  const flip = x > width / 2;
  return (
    <div
      className="tooltip"
      role="presentation"
      style={{
        top: y,
        ...(flip ? { right: width - x + 12 } : { left: x + 12 }),
      }}
    >
      <div className="tooltip-title">{title}</div>
      {rows.map((r) => (
        <div className="tooltip-row" key={r.key}>
          <i className={`key key-${r.shape ?? 'line'}`} style={{ background: r.color }} />
          <strong>{r.value}</strong>
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}
