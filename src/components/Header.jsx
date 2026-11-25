import { Segmented } from './ui.jsx';

export default function Header({ units, onUnits, hasData, onAdd, onClear }) {
  return (
    <header className="topbar">
      <a className="brand" href="./">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="8" />
          <path d="M7 22l6-8 5 5 7-10" />
        </svg>
        <span className="brand-text">Activity Recap</span>
      </a>
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
            <button type="button" className="btn" onClick={onAdd}>
              Add files
            </button>
            <button type="button" className="btn btn-quiet" onClick={onClear}>
              Clear
            </button>
          </>
        )}
      </div>
    </header>
  );
}
