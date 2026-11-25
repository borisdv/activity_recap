import { Upload } from './icons.jsx';

export default function ImportScreen({ csvUnits, onCsvUnits, onFiles, onSample, loading }) {
  return (
    <section className="card import">
      <p className="eyebrow">Garmin activity recap</p>
      <h1>Compare your years in sport</h1>
      <p className="lead">
        Add your Garmin Connect export (two or three years work best) to see how each year compares: running totals
        through the year, distance and time by sport, month by month, and your highlights. The files are read in this
        browser tab and never uploaded. Nothing is saved, so reloading the page clears them.
      </p>

      <label className="dropzone">
        <input
          type="file"
          accept=".csv,.json,.zip,text/csv,application/json"
          multiple
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <span className="dropzone-icon" aria-hidden="true">
          <Upload size={20} />
        </span>
        <span className="dropzone-title">
          {loading ? 'Reading…' : 'Choose files'} <span className="muted">or drag them here</span>
        </span>
        <span className="muted small">
          <code>Activities.csv</code> or <code>*_summarizedActivities.json</code>, as many as you like
        </span>
      </label>

      <div className="import-options">
        <label className="small">
          Distances in my CSV are in{' '}
          <select value={csvUnits} onChange={(e) => onCsvUnits(e.target.value)}>
            <option value="metric">km and metres</option>
            <option value="imperial">miles and feet</option>
          </select>
        </label>
        <button type="button" className="btn btn-quiet" onClick={onSample} disabled={loading}>
          Try it with sample data
        </button>
      </div>

      <details className="howto">
        <summary>How do I export my activities from Garmin?</summary>
        <div className="howto-body">
          <h3>Quick: activities CSV</h3>
          <ol>
            <li>
              Open <strong>connect.garmin.com</strong> in a desktop browser and go to{' '}
              <em>Activities → All Activities</em>.
            </li>
            <li>Scroll down until every activity you want has loaded (the export only includes loaded rows).</li>
            <li>
              Click <em>Export CSV</em> at the top right and add the file here.
            </li>
          </ol>
          <h3>Complete history: account data export</h3>
          <ol>
            <li>
              In Garmin Connect, open <em>Account settings → Data Management → Export Your Data</em>. Garmin emails you
              a download link.
            </li>
            <li>
              Unzip it, open <code>DI_CONNECT/DI-Connect-Fitness</code> and add every{' '}
              <code>*_summarizedActivities.json</code> file.
            </li>
          </ol>
          <p className="muted small">You can add several files; activities already loaded are skipped.</p>
        </div>
      </details>
    </section>
  );
}
