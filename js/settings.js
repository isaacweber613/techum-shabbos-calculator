/*
 * Psak profiles & settings — mirrors TECHUM-SPEC.md Part 2.
 * Every disputed rule is a setting; profiles are documented defaults, all overridable.
 * Classic script: exposes window.TechumSettings.
 */
(function (root) {
  'use strict';

  const PROFILES = {
    'mishna-berura': {
      label: 'Mishna Berurah / Ashkenazi (default)',
      amahCm: 48,          // R' Chaim Naeh
      karpef: true,        // Rema, recorded MB 398:36
      squaringAngleDeg: 0, // automatic: preserve a clear rectangle; otherwise compass
      overlapPolicy: 'no-join', // R' Elyashiv / R' N. Karelitz / R' Belsky
      largeHolePolicy: 'include-with-warning', // Beit Yitzchok / R' Shulem Weiss
      bowPolicy: 'rema-majority', // Tosafos/Rosh/Rema; reviewer supplies real-city endpoints
      minCityHouses: 6,    // provisional footprint proxy for MB 398:38, not the rule itself
      // Spec rev. 25: a real 4×4-amah square must fit inside (Rosh; MA 398:6); 16 square amos
      // without one goes to review (Biur Halacha 398:6 leaves it open).
      sizeRule: 'square',
    },
    'chazon-ish': {
      label: 'Chazon Ish',
      amahCm: 57.6,
      karpef: true,        // CONFIRM CI's own karpef position with a posek (spec Part 2)
      squaringAngleDeg: 0, // same automatic SA/MB shape rule; nonzero is reviewer override
      // Rev. 20: off by default. CI 110:16 ends "the matter needs a ruling"; joint redraw
      // stays a labelled option whose use is a rav's decision.
      overlapPolicy: 'no-join',
      largeHolePolicy: 'include-with-warning',
      bowPolicy: 'rema-majority',
      minCityHouses: 6,
      sizeRule: 'square',  // spec rev. 25; the Chazon Ish's own words on shape were not read
    },
    'mechaber': {
      label: 'Mechaber / Sefardi',
      amahCm: 48,
      karpef: false,       // Rambam/Mechaber SA 398:5
      squaringAngleDeg: 0,
      overlapPolicy: 'no-join',
      largeHolePolicy: 'include-with-warning',
      bowPolicy: 'mechaber-curve',
      minCityHouses: 6,
      sizeRule: 'area',    // spec rev. 25: 16 square amos in any shape (Rambam; SA YD 286:13)
    },
  };

  const DEFAULTS = {
    profile: 'mishna-berura',
    ...PROFILES['mishna-berura'],
    includeUnknown: true,   // data policy (just-works default); flagged in UI
    includeReview: true,    // hotels/shuls/schools etc — flagged, open question Q5
    showVerifiedOnly: false, // optional reviewer scenario; ordinary users get one automatic result
    minSizeFilter: true,    // apply the minimum dwelling size of 4×4 amos (spec rev. 25)
    secondAmahCm: 0,        // 0 = off; draws a comparison techum line
    show12mil: false,
    pointRotationDeg: 0,    // open-field square rotation (SA 399 — person may orient)
    showAuditRings: false,  // dotted 70⅔-amos rings around buildings (manual-audit aid)
    cityQualificationOverrides: {}, // cluster key -> reviewer yes/no; empty preserves count proxy
    concavityReviews: {},   // review key -> reviewer-confirmed endpoints and application state
    useValidatedPerimeter: false, // explicit rav-supplied hukaf-l'dira alternative; never inferred
    fetchRadiusM: 1200,
    maxBuildings: 40000,
    maxExpandIterations: 4,
    dataSourceVersion: 2,   // migrates prior OSM-era display defaults once
    profileRevision: 20,    // spec rev. 20: Chazon Ish profile overlap default join-redraw -> no-join
  };

  const KEY = 'techum-settings-v1';

  function normalize(saved) {
    const settings = { ...saved };
    // Rev. 12 exposed a binary overlap switch. Preserve that explicit choice
    // before defaults add the Rev. 13 policy, for both storage and snapshots.
    if (!settings.overlapPolicy && typeof settings.overlapMerge === 'boolean') {
      settings.overlapPolicy = settings.overlapMerge ? 'join-redraw' : 'no-join';
    }
    delete settings.overlapMerge;
    // Rev. 25 added the size rule. A save or snapshot from before it takes the rule of its own
    // profile, so a Mechaber save gets the area rule; no choice a user made is changed.
    if (settings.sizeRule !== 'square' && settings.sizeRule !== 'area') {
      settings.sizeRule = (PROFILES[settings.profile] || PROFILES[DEFAULTS.profile]).sizeRule;
    }
    return { ...DEFAULTS, ...settings };
  }

  function load() {
    try {
      const raw = root.localStorage && localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // 30,000 was the old built-in metro cap, not a user/halachic choice. Migrate it
        // so Brooklyn-sized calculations can finish their boundary expansion.
        if (saved.maxBuildings === 30000 || saved.maxBuildings === 60000) saved.maxBuildings = DEFAULTS.maxBuildings;
        if (saved.dataSourceVersion !== 2) {
          saved.showVerifiedOnly = false;
          saved.dataSourceVersion = 2;
        }
        // Spec rev. 20 moved the Chazon Ish profile's overlap default from joint redraw to no
        // join. A saved setting that still matches the old profile exactly took that default
        // rather than choosing it, so it follows the new default. The comparison reads the
        // normalized values, so a save from before rev. 13 (binary overlapMerge switch, no
        // bow or hole setting yet) is recognised too, and a save marked with any later
        // revision is never switched again (rev. 21).
        if (!((Number(saved.profileRevision) || 0) >= 20)) {
          const ci = PROFILES['chazon-ish'], now = normalize(saved);
          if (now.profile === 'chazon-ish' && now.overlapPolicy === 'join-redraw' &&
            now.amahCm === ci.amahCm && now.karpef === ci.karpef &&
            now.squaringAngleDeg === ci.squaringAngleDeg && now.largeHolePolicy === ci.largeHolePolicy &&
            now.bowPolicy === ci.bowPolicy && now.minCityHouses === ci.minCityHouses) {
            saved.overlapPolicy = ci.overlapPolicy;
          }
          saved.profileRevision = 20;
        }
        // The validated perimeter itself is never stored in the browser (only in snapshots),
        // so a restored "use perimeter" flag would point at nothing.
        return { ...normalize(saved), useValidatedPerimeter: false };
      }
    } catch (e) { /* fresh defaults */ }
    return { ...DEFAULTS };
  }
  // Returns false when the browser refuses storage (private mode, quota) so the UI can say so.
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  }
  function applyProfile(s, profileKey) {
    const p = PROFILES[profileKey];
    if (!p) return s;
    return { ...s, profile: profileKey, amahCm: p.amahCm, karpef: p.karpef,
      squaringAngleDeg: p.squaringAngleDeg, overlapPolicy: p.overlapPolicy,
      largeHolePolicy: p.largeHolePolicy, bowPolicy: p.bowPolicy,
      minCityHouses: p.minCityHouses, sizeRule: p.sizeRule };
  }
  // Reviewer records (free-text evidence, member ids, endpoints) never go to analytics; only
  // how many exist.
  const REVIEW_RECORD_KEYS = ['cityQualificationOverrides', 'concavityReviews'];
  // Every setting that differs from the app-wide defaults (for analytics: "what do
  // people change?"). Keys mirror DEFAULTS; values are the chosen non-default value.
  function diffFromDefaults(s) {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) {
      if (REVIEW_RECORD_KEYS.includes(k)) {
        const count = s[k] && typeof s[k] === 'object' ? Object.keys(s[k]).length : 0;
        if (count) out[k + 'Count'] = count;
        continue;
      }
      if (s[k] !== DEFAULTS[k]) out[k] = s[k];
    }
    return out;
  }
  // If any profile-governed value differs from the selected profile, it's Custom.
  function effectiveProfile(s) {
    const p = PROFILES[s.profile];
    if (!p) return 'custom';
    const same = p.amahCm === s.amahCm && p.karpef === s.karpef &&
      p.squaringAngleDeg === s.squaringAngleDeg && p.overlapPolicy === s.overlapPolicy &&
      p.largeHolePolicy === s.largeHolePolicy && p.bowPolicy === s.bowPolicy &&
      p.minCityHouses === s.minCityHouses && p.sizeRule === s.sizeRule;
    return same ? s.profile : 'custom';
  }

  root.TechumSettings = { PROFILES, DEFAULTS, normalize, load, save, applyProfile,
    effectiveProfile, diffFromDefaults };
})(typeof self !== 'undefined' ? self : this);
