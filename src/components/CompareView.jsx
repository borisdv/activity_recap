import CompareYears from './CompareYears.jsx';

export default function CompareView({ years, filterBar, ...props }) {
  const span = years.length > 1 ? `${years.at(-1)}–${years[0]}` : String(years[0]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Compare</h1>
          <p className="page-sub">
            {years.length > 1
              ? `${years.length} years side by side (${span}). Hover or tap the chart to compare any date.`
              : 'Add activities from another year to compare years.'}
          </p>
        </div>
      </div>
      {filterBar}
      <CompareYears years={years} {...props} />
    </>
  );
}
