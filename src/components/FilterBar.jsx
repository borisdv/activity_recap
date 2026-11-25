import { CATEGORIES, categoryById } from '../lib/categories.js';
import { MEASURES } from '../lib/measures.js';
import { Segmented } from './ui.jsx';

/** Sport and measure: scope everything below. */
export default function FilterBar({ sports, sport, onSport, measure, onMeasure, distanceDisabled }) {
  const present = CATEGORIES.filter((c) => sports.includes(c.id));
  return (
    <div className="filter-bar">
      <div className="chips" role="group" aria-label="Sport">
        <button type="button" className="chip" aria-pressed={sport === 'all'} onClick={() => onSport('all')}>
          All sports
        </button>
        {present.map((c) => (
          <button
            key={c.id}
            type="button"
            className="chip"
            aria-pressed={sport === c.id}
            onClick={() => onSport(c.id)}
          >
            <span aria-hidden="true">{categoryById(c.id).icon}</span> {c.label}
          </button>
        ))}
      </div>
      <Segmented
        label="Measure"
        value={measure}
        onChange={onMeasure}
        options={Object.entries(MEASURES).map(([id, m]) => ({
          value: id,
          label: m.label,
          disabled: id === 'distance' && distanceDisabled,
          title: id === 'distance' && distanceDisabled ? 'These activities have no distance' : undefined,
        }))}
      />
    </div>
  );
}
