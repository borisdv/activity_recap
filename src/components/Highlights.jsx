import * as stats from '../lib/stats.js';
import * as fmt from '../lib/format.js';
import { Calendar, Clock, Mountain, Route, Sparkle } from './icons.jsx';

const LONGEST_LABEL = {
  running: 'Longest run',
  cycling: 'Longest ride',
  swimming: 'Longest swim',
  walking: 'Longest walk or hike',
  winter: 'Longest day on snow',
  water: 'Longest paddle',
};

export default function Highlights({ list, year, units }) {
  const h = stats.highlights(list);
  const about = (a) => `${a.title} · ${fmt.formatDate(a.date)}`;
  const cards = [];

  for (const r of stats.byCategory(list)) {
    const label = LONGEST_LABEL[r.category];
    if (!label || !r.longest?.distanceM) continue;
    const a = r.longest;
    cards.push({
      key: `longest-${r.category}`,
      cat: r.category,
      icon: <Route />,
      label,
      value: fmt.formatCategoryDistance(a.distanceM, units, a.category),
      sub: `${about(a)}${a.durationS ? ` · ${fmt.formatDuration(a.durationS)}` : ''}`,
    });
  }
  if (h.longestDuration) {
    const a = h.longestDuration;
    cards.push({ key: 'session', cat: a.category, icon: <Clock />, label: 'Longest session', value: fmt.formatDuration(a.durationS), sub: about(a) });
  }
  if (h.biggestClimb) {
    const a = h.biggestClimb;
    cards.push({ key: 'climb', cat: a.category, icon: <Mountain />, label: 'Biggest climb', value: fmt.formatElevation(a.elevationGainM, units), sub: about(a) });
  }
  if (h.busiestMonth) {
    const [y, mo] = h.busiestMonth.key.split('-').map(Number);
    cards.push({
      key: 'month',
      icon: <Calendar />,
      label: 'Most active month',
      value: `${fmt.monthLong(mo)}${year === 'all' ? ` ${y}` : ''}`,
      sub: `${fmt.formatDuration(h.busiestMonth.durationS)} · ${fmt.formatNumber(h.busiestMonth.count)} activities`,
    });
  }
  if (h.favouriteWeekday) {
    cards.push({
      key: 'weekday',
      icon: <Calendar />,
      label: 'Favourite day',
      value: `${h.favouriteWeekday.name}s`,
      sub: `${fmt.formatNumber(h.favouriteWeekday.count)} activities`,
    });
  }
  if (h.morningShare != null) {
    const early = h.morningShare >= 0.5;
    cards.push({
      key: 'clock',
      icon: <Sparkle />,
      label: early ? 'Early bird' : 'Afternoon and evening',
      value: fmt.formatPercent(early ? h.morningShare : 1 - h.morningShare),
      sub: early ? 'of activities started before noon' : 'of activities started after noon',
    });
  }

  return (
    <section aria-labelledby="highlights-title">
      <div className="section-title">
        <h2 id="highlights-title">Highlights</h2>
      </div>
      <div className="highlight-grid">
        {cards.map((c) => (
          <div className="card highlight" key={c.key} style={c.cat ? { '--c': `var(--cat-${c.cat})` } : undefined}>
            <span className="icon-ring">{c.icon}</span>
            <span className="hl-label">{c.label}</span>
            <span className="hl-value">{c.value}</span>
            <span className="hl-sub">{c.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
