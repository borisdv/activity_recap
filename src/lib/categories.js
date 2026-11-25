// Groups Garmin activity types (e.g. "trail_running", "Indoor Cycling",
// "lap_swimming") into a handful of recap categories.

// The order is also the stacking order in charts and the order of the
// colour slots (--cat-<id> in styles.css). That colour order was checked for
// colour-blind separation between neighbours, so keep the two in sync.
export const CATEGORIES = [
  { id: 'running', label: 'Running', icon: '🏃', hasDistance: true },
  { id: 'cycling', label: 'Cycling', icon: '🚴', hasDistance: true },
  { id: 'swimming', label: 'Swimming', icon: '🏊', hasDistance: true },
  { id: 'water', label: 'Paddling & Rowing', icon: '🛶', hasDistance: true },
  { id: 'fitness', label: 'Gym & Fitness', icon: '🏋️', hasDistance: false },
  { id: 'walking', label: 'Walking & Hiking', icon: '🥾', hasDistance: true },
  { id: 'winter', label: 'Winter Sports', icon: '⛷️', hasDistance: true },
  { id: 'other', label: 'Other', icon: '✨', hasDistance: false },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryById(id) {
  return BY_ID.get(id) ?? BY_ID.get('other');
}

// Order matters: the first matching rule wins. Indoor rowing is gym work,
// so the fitness rule runs before the paddling/rowing one.
const RULES = [
  ['swimming', /swim/],
  ['running', /run|jog/],
  ['cycling', /cycl|bik|ride|spin/],
  ['walking', /walk|hik|trek|mountaineer/],
  ['winter', /ski|snowboard|snowshoe|skat/],
  [
    'fitness',
    /strength|hiit|cardio|elliptical|stair|yoga|pilates|fitness|breath|floor_climb|indoor_row|boxing|crossfit|jump_rope|training|workout|gym|barre|mobility/,
  ],
  ['water', /row|kayak|paddl|canoe|sail|surf|raft/],
];

/** "Trail Running" / "trail_running_v2" -> "trail_running" */
export function normalizeTypeKey(type) {
  return String(type ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_(ws|v\d+)$/, '');
}

/** "trail_running" -> "Trail Running" */
export function labelFromTypeKey(key) {
  if (!key) return 'Unknown';
  return key
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export function categorize(type) {
  const key = normalizeTypeKey(type);
  for (const [id, re] of RULES) {
    if (re.test(key)) return id;
  }
  return 'other';
}
