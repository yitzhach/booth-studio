// The view suites (tests/view-*.mjs) and how CI splits them into shards.
//
// SECONDS is how long each suite took on a GitHub runner (CI run 146, main at
// 45a0c47, 2026-10-26), read from the views job's log. It is the order
// `npm run test:view` runs them in, and the weights the shards are cut by:
// suites go longest first onto whichever shard has the least so far, so the
// shards finish close together instead of one waiting on a long tail (the
// round-robin it replaces ran 7, 14, 11 and 8 minutes). A rough number is
// enough for a new suite; tests/run-views.test.js fails until every
// tests/view-*.mjs file has one.
export const SECONDS = {
  "view-city": 9,
  "view-lighting": 43,
  "view-hdri": 75,
  "view-textures": 53,
  "view-ground-library": 14,
  "view-video": 76,
  "view-timeline": 101,
  "view-people": 47,
  "view-panels": 50,
  "view-responsive": 231,
  "view-artshow": 61,
  "view-row": 38,
  "view-finish": 26,
  "view-measure": 24,
  "view-furniture": 70,
  "view-arrange": 33,
  "view-quickstart": 24,
  "view-showpack": 17,
  "view-toolsearch": 17,
  "view-tier": 20,
  "view-guides": 22,
  "view-views": 74,
  "view-plan": 49,
  "view-box": 61,
  "view-hall": 18,
  "view-frame": 30,
  "view-batch": 161,
  "view-show": 17,
  "view-show3d": 36,
  "view-linked": 29,
  "view-ai": 40,
  "view-tools2": 100,
  "view-hub": 9,
  "view-share": 42,
  "view-floor2": 9,
  "view-round12": 33,
  "view-round13": 59,
  "view-assistant": 81,
  "view-password": 7,
  "view-roles": 57,
  "view-polish": 140,
  "view-wall-assets": 166,
  "view-keep-safe": 51,
  "view-report": 12,
  "view-environment": 120, // a guess: 135 s in the sandbox, 2026-10-26
};

export const SUITES = Object.keys(SECONDS);

/** The suites of shard `index` (0-based) of `count`, in SUITES order. */
export function shard(index, count) {
  const load = Array(count).fill(0);
  const owner = new Map();
  const longestFirst = [...SUITES].sort((a, b) => SECONDS[b] - SECONDS[a] || SUITES.indexOf(a) - SUITES.indexOf(b));
  for (const suite of longestFirst) {
    const least = load.indexOf(Math.min(...load));
    owner.set(suite, least);
    load[least] += SECONDS[suite];
  }
  return SUITES.filter((suite) => owner.get(suite) === index);
}
