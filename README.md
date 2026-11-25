# activity_recap

A simple web page that turns your **Garmin activity export** into a yearly recap:
totals, a breakdown by sport, month-by-month charts, highlights, and a comparison
with earlier years.

It's a static site with no backend and no dependencies. Your files are read in the
browser and never uploaded anywhere. Imported activities are kept in the browser's
local storage so they're still there next time; **Clear** removes them.

## What you get

- **Year tabs** for every year in your data, plus an *All time* view
- **Headline totals**: distance, time, activities, elevation gain, active days,
  longest streak and calories, each with the change from the previous year.
  For the current year, the previous year is cut to the same date so a partial
  year isn't compared with a full one.
- **By sport**: Running, Cycling, Swimming, Walking & Hiking, Winter Sports,
  Paddling & Rowing, Gym & Fitness, Other, with counts, distance, time, elevation and
  share of your time
- **Month by month** stacked chart (distance, time or number of activities); the
  *All time* view shows year by year instead
- **Highlights**: longest run, ride, swim and hike, longest session, biggest climb,
  most active month, favourite weekday
- **Year by year** table
- km/mi toggle, light and dark mode, works on phones

## Getting your data out of Garmin

**Quick: activities CSV.** In Garmin Connect on the web, go to *Activities → All
Activities*, scroll down until everything you want has loaded (the export only
includes loaded rows), then click *Export CSV*. If your Garmin account uses statute
units, pick "miles and feet" before importing.

**Complete history: account data export.** In Garmin Connect, open *Account
settings → Data Management → Export Your Data*. Garmin emails you a zip. Unzip it
and import every `DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json` file.

You can import several files, in either format. Activities that are already loaded
(same start time and sport) are skipped.

## Running it

```sh
npm start        # http://localhost:8000 (no install needed)
npm test         # unit tests (Node's built-in test runner)
npm run sample   # regenerate samples/sample-activities.csv
```

Opening `index.html` directly from disk doesn't work, because browsers block
JavaScript modules on `file://` URLs. Use `npm start` or any static file server
(e.g. `python3 -m http.server`).

To publish it, any static host works. For GitHub Pages: *Settings → Pages →
Deploy from a branch*, then pick the branch and `/ (root)`.

## Project layout

```
index.html                 page markup
css/style.css              styles (light and dark mode)
js/app.js                  UI: import, state, rendering
js/garmin.js               Garmin CSV / JSON parsing into one activity shape
js/csv.js                  CSV parser
js/categories.js           activity type → sport category
js/stats.js                totals, per-category, per-month and per-year stats
js/chart.js                stacked bar chart (plain HTML)
js/format.js               number, distance and duration formatting
samples/                   made-up sample data in Garmin CSV format
scripts/                   dev server and sample-data generator
test/                      unit tests
```

## Notes and limitations

- Garmin's CSV has no unit column, so the importer needs to be told whether your
  account uses metric or statute units. Swims are read in pool units (m or yd).
- In the account data export, distances are in centimetres, times in
  milliseconds and calories in kilojoules. The importer converts all of them.
- Multisport parents (e.g. triathlons) are dropped from the JSON export when
  their individual legs are also present, so nothing is counted twice.
- Zip files aren't read directly yet: unzip the export first.
