import { Logo, Plus, Trash } from './icons.jsx';
import { Segmented } from './ui.jsx';

const VIEWS = [
  ['dashboard', 'Dashboard'],
  ['compare', 'Compare'],
];

export default function Header({ view, onView, units, onUnits, hasData, onAdd, onClear }) {
  return (
    <header className="topbar">
      <a className="brand" href="./" aria-label="Activity Recap home">
        <Logo />
        <span>
          activity <span className="brand-light">recap</span>
        </span>
      </a>

      {hasData && (
        <nav className="nav-pills" aria-label="Views">
          {VIEWS.map(([id, label]) => (
            <button key={id} type="button" className="pill" aria-pressed={view === id} onClick={() => onView(id)}>
              {label}
            </button>
          ))}
        </nav>
      )}

      <div className="topbar-actions">
        <Segmented
          label="Units"
          value={units}
          onChange={onUnits}
          options={[
            { value: 'metric', label: 'km' },
            { value: 'imperial', label: 'mi' },
          ]}
        />
        {hasData && (
          <>
            <button type="button" className="icon-btn" onClick={onClear} aria-label="Clear all activities" title="Clear all activities">
              <Trash size={17} />
            </button>
            <button type="button" className="icon-btn dark" onClick={onAdd} aria-label="Add files" title="Add files">
              <Plus size={18} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
