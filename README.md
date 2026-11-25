# activity_recap

A web page that takes your **Garmin activity export** (two or three years work
best), analyses it and **compares your years**: running totals through the year,
distance and time by sport, month by month, highlights and a side-by-side table.

It's a static React site with no backend. Files are read in the browser tab and
**kept in memory only**: nothing is uploaded or saved, and reloading the page
clears everything.

## What you get

Two views, switched with the pills at the top. A sport filter (or all sports)
and a measure (distance, time or number of activities) apply to both.

**Dashboard**, one year at a time (or all time), picked from the year strip:

- A greeting line that sums up the year so far
- **Year ring**: every day you trained as a spoke around the year, its length
  showing the time trained and its colour the main sport. Hover or tap a spoke
  to read that day. Underneath, a *consistency* card shows the share of active
  days and the last 12 weeks as dots.
- **Insight card**: one or two plain sentences computed from your numbers,
  e.g. "You're 105 km ahead of this point in 2025. Running is up 18%."
- **Metric cards** for distance, time, activities, elevation and active days,
  each with the change from last year and a small chart (monthly trend,
  fortnightly hours, active weeks, favourite weekdays). The ↗ button opens
  the year comparison for that measure.
- **Sports panel**: a card per sport (or per activity type when one sport is
  selected) with its total, the change from last year and its share of your
  time, plus a weekly-rhythm gauge (activities per week vs last year)
- Month-by-month stacked chart (with a table view) and highlights: longest
  run, ride, swim and hike, biggest climb, most active month, favourite weekday

**Compare**, all years at once:

- Running-total chart: one line per year (up to the 4 most recent), so you can
  see whether you're ahead of last year on any date
- Side-by-side table of every year (activities, distance, time, time per week,
  elevation, active days, longest streak, each sport), with the change from the
  year before. While the current year is still running, every year is counted
  from Jan 1 to the same date; "Full years" switches that off.

Also: km/mi toggle, light and dark mode, works on phones.

The visual style (light cards, pill navigation, thin numerals, a dark panel
with gradient cards) takes its cue from an "AI wellness dashboard" concept
shot on Dribbble; all content and graphics here are drawn from your own data.

## Getting your data out of Garmin

**Quick: activities CSV.** In Garmin Connect on the web, go to *Activities → All
Activities*, scroll down until everything you want has loaded (the export only
includes loaded rows), then click *Export CSV*. If your Garmin account uses statute
units, pick "miles and feet" before adding the file.

**Complete history: account data export.** In Garmin Connect, open *Account
settings → Data Management → Export Your Data*. Garmin emails you a zip. Unzip it
and add every `DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json` file.

You can add several files, in either format. Activities that are already loaded
(same start time and sport) are skipped.

## Development

Needs Node 20.19+.

```sh
npm install
npm run dev       # local dev server with hot reload
npm test          # unit tests for parsing and stats (Node's built-in runner)
npm run build     # static site in dist/
npm run preview   # serve the built site locally
npm run sample    # regenerate public/samples/sample-activities.csv
```

The build uses relative paths, so `dist/` can be hosted anywhere static
(GitHub Pages, Netlify, Cloudflare Pages, any file server).

## Project layout

```
index.html                   Vite entry
src/main.jsx                 React root
src/App.jsx                  state (in memory), importing files, page layout
src/components/              UI: header, dashboard and compare views, charts, cards
src/hooks/                   element width (for charts), page-wide file drop
src/lib/garmin.js            Garmin CSV / JSON parsing into one activity shape
src/lib/csv.js               CSV parser
src/lib/categories.js        activity type → sport category (and colour order)
src/lib/stats.js             totals, per sport / month / year, running totals
src/lib/measures.js          distance / time / count values and chart scales
src/lib/format.js            number, distance and duration formatting
src/lib/insights.js          the plain-language sentences on the insight card
src/styles.css               styles and colour tokens (light and dark)
public/samples/              made-up sample data in Garmin CSV format
scripts/make-sample.mjs      sample-data generator
test/                        unit tests
```

## Notes and limitations

- Garmin's CSV has no unit column, so you have to say whether your account uses
  metric or statute units. Swims are read in pool units (m or yd).
- In the account data export, distances are in centimetres, times in
  milliseconds and calories in kilojoules. The importer converts all of them.
- Multisport parents (e.g. triathlons) are dropped from the JSON export when
  their individual legs are also present, so nothing is counted twice.
- Zip files aren't read directly yet: unzip the export first.
- The Outfit font is bundled with the site (via `@fontsource-variable/outfit`),
  so the page makes no requests to font services or anywhere else.
- The sport colours and the year-line colours were checked for colour-blind
  separation. If you change them, keep the order in `src/lib/categories.js` and
  the `--cat-*` tokens in `src/styles.css` in sync.
