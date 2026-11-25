import { useMemo, useRef, useState } from 'react';
import { mergeActivities, parseExportFile } from './lib/garmin.js';
import { categoryById } from './lib/categories.js';
import * as stats from './lib/stats.js';
import { formatNumber } from './lib/format.js';
import { useFileDrop } from './hooks/useFileDrop.js';
import Header from './components/Header.jsx';
import ImportScreen from './components/ImportScreen.jsx';
import FilterBar from './components/FilterBar.jsx';
import DashboardView from './components/DashboardView.jsx';
import CompareView from './components/CompareView.jsx';

const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/sample-activities.csv`;

// All data lives in React state only: nothing is stored or uploaded, and a
// reload starts from scratch.
export default function App() {
  const [data, setData] = useState({ activities: [], isSample: false });
  const [units, setUnits] = useState('metric');
  const [csvUnits, setCsvUnits] = useState('metric');
  const [sport, setSport] = useState('all');
  const [measure, setMeasure] = useState('distance');
  const [year, setYear] = useState(null);
  const [view, setView] = useState('dashboard');
  const [status, setStatus] = useState(null); // { kind: 'info' | 'error', lines: string[] }
  const [loading, setLoading] = useState(false);
  const fileInput = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  function addActivities(incoming, { sample = false } = {}) {
    // Real files replace the sample set rather than mixing with it.
    const base = dataRef.current.isSample && !sample ? [] : dataRef.current.activities;
    const result = mergeActivities(base, incoming);
    const next = { activities: result.activities, isSample: sample };
    dataRef.current = next;
    setData(next);
    if (result.added) setYear(stats.yearsIn(result.activities)[0]);
    return result;
  }

  async function importFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    setLoading(true);
    const incoming = [];
    const problems = [];
    let skipped = 0;
    for (const file of files) {
      if (/\.zip$/i.test(file.name)) {
        problems.push(
          `${file.name}: unzip the export first, then add the *_summarizedActivities.json files from DI_CONNECT/DI-Connect-Fitness.`,
        );
        continue;
      }
      try {
        const parsed = parseExportFile(file.name, await file.text(), { units: csvUnits });
        incoming.push(...parsed.activities);
        skipped += parsed.skipped;
        if (!parsed.activities.length) problems.push(`${file.name}: no activities found.`);
      } catch (err) {
        problems.push(`${file.name}: ${err.message}`);
      }
    }
    const { added, duplicates } = incoming.length ? addActivities(incoming) : { added: 0, duplicates: 0 };
    const lines = [];
    if (added) {
      const years = stats.yearsIn(dataRef.current.activities);
      const span = years.length > 1 ? `${years.at(-1)}–${years[0]}` : String(years[0]);
      lines.push(`Added ${formatNumber(added)} activities (${span}).`);
    }
    if (duplicates) lines.push(`${formatNumber(duplicates)} were already loaded.`);
    if (skipped) lines.push(`${formatNumber(skipped)} rows had no date or type and were skipped.`);
    lines.push(...problems);
    setStatus({ kind: problems.length && !added ? 'error' : 'info', lines });
    setLoading(false);
  }

  async function loadSample() {
    setLoading(true);
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { activities } = parseExportFile('sample.csv', await res.text(), { units: 'metric' });
      dataRef.current = { activities: [], isSample: true };
      addActivities(activities, { sample: true });
      setStatus(null);
    } catch (err) {
      setStatus({ kind: 'error', lines: [`Couldn't load the sample data (${err.message}).`] });
    }
    setLoading(false);
  }

  function clearData() {
    if (!window.confirm('Remove all loaded activities?')) return;
    dataRef.current = { activities: [], isSample: false };
    setData(dataRef.current);
    setSport('all');
    setYear(null);
    setView('dashboard');
    setStatus(null);
  }

  function openCompare(nextMeasure) {
    if (nextMeasure) setMeasure(nextMeasure);
    setView('compare');
    window.scrollTo({ top: 0 });
  }

  const dragging = useFileDrop(importFiles);

  const { activities, isSample } = data;
  const hasData = activities.length > 0;
  const years = useMemo(() => stats.yearsIn(activities), [activities]);
  const dataEnd = useMemo(() => stats.latestDate(activities), [activities]);
  const sports = useMemo(() => stats.byCategory(activities).map((r) => r.category), [activities]);
  const activeSport = sport === 'all' || sports.includes(sport) ? sport : 'all';
  const filtered = useMemo(() => stats.forSport(activities, activeSport), [activities, activeSport]);
  const hasDistance = filtered.some((a) => a.distanceM > 0);
  const activeMeasure = measure === 'distance' && !hasDistance ? 'time' : measure;
  const activeYear = year === 'all' || years.includes(year) ? year : years[0];

  const filterBar = (
    <FilterBar
      sports={sports}
      sport={activeSport}
      onSport={setSport}
      measure={activeMeasure}
      onMeasure={setMeasure}
      distanceDisabled={!hasDistance}
    />
  );

  return (
    <>
      <Header
        view={view}
        onView={(v) => {
          setView(v);
          window.scrollTo({ top: 0 });
        }}
        units={units}
        onUnits={setUnits}
        hasData={hasData}
        onAdd={() => fileInput.current?.click()}
        onClear={clearData}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.json,.zip,text/csv,application/json"
        multiple
        hidden
        onChange={(e) => {
          importFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <main>
        {status && (
          <div className="status" data-kind={status.kind} role="status">
            {status.lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            <button type="button" className="status-close" aria-label="Dismiss" onClick={() => setStatus(null)}>
              ×
            </button>
          </div>
        )}
        {isSample && (
          <p className="status">
            You're looking at <strong>made-up sample data</strong>. Add your own Garmin export to replace it.
          </p>
        )}

        {!hasData ? (
          <ImportScreen
            csvUnits={csvUnits}
            onCsvUnits={setCsvUnits}
            onFiles={importFiles}
            onSample={loadSample}
            loading={loading}
          />
        ) : view === 'compare' ? (
          <CompareView
            filterBar={filterBar}
            activities={filtered}
            years={years}
            dataEnd={dataEnd}
            measure={activeMeasure}
            units={units}
            sportLabel={activeSport === 'all' ? null : categoryById(activeSport).label}
            selectedYear={activeYear}
            onSelectYear={(y) => {
              setYear(y);
              setView('dashboard');
              window.scrollTo({ top: 0 });
            }}
          />
        ) : (
          <DashboardView
            filterBar={filterBar}
            activities={filtered}
            years={years}
            year={activeYear}
            onYear={setYear}
            dataEnd={dataEnd}
            sport={activeSport}
            measure={activeMeasure}
            units={units}
            onCompare={openCompare}
          />
        )}
      </main>
      <footer className="footer">
        Not affiliated with Garmin. Your files are read in this browser tab and never uploaded; reloading the page
        clears them.
      </footer>
      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <span>Drop your Garmin export to add it</span>
        </div>
      )}
    </>
  );
}
