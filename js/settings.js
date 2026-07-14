/*
 * Psak profiles & settings — mirrors TECHUM-SPEC.md Part 2 (rev. 13).
 * Every disputed rule is a setting; profiles are documented defaults, all overridable.
 * Classic script: exposes window.TechumSettings.
 */
(function (root) {
  'use strict';

  const AMOS_OPTIONS = [
    { cm: 48, label: "R' Chaim Naeh — 18.90 in (2,000 amos = 960 m)" },
    { cm: 53.98, label: "R' Moshe Feinstein — 21.25 in (2000 amos = 1,080 m)" },
    { cm: 57.6, label: 'Chazon Ish — 22.68 in (2,000 amos = 1,152 m)' },
  ];

  const PROFILES = {
    'mishna-berura': {
      label: 'Mishna Berurah / Ashkenazi (default)',
      amahCm: 48,          // R' Chaim Naeh
      karpef: true,        // Rema, recorded MB 398:36
      squaringAngleDeg: 0, // automatic: preserve a clear rectangle; otherwise compass
      overlapPolicy: 'no-join', // R' Elyashiv / R' N. Karelitz / R' Belsky
      largeHolePolicy: 'include-with-warning', // Beit Yitzchok / R' Shulem Weiss
      bowPolicy: 'rema-majority', // Tosafos/Rosh/Rema; reviewer supplies real-city endpoints
      minCityHouses: 6,    // MB 398:38
    },
    'chazon-ish': {
      label: 'Chazon Ish',
      amahCm: 57.6,
      karpef: true,        // CONFIRM CI's own karpef position with a posek (spec Part 2)
      squaringAngleDeg: 0, // same automatic SA/MB shape rule; nonzero is reviewer override
      overlapPolicy: 'join-redraw', // expansive reading of CI 110:16; practical CI conclusion uncertain
      largeHolePolicy: 'include-with-warning',
      bowPolicy: 'rema-majority',
      minCityHouses: 6,
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
    },
  };

  const DEFAULTS = {
    profile: 'mishna-berura',
    ...PROFILES['mishna-berura'],
    includeUnknown: true,   // data policy (just-works default); flagged in UI
    includeReview: true,    // hotels/shuls/schools etc — flagged, open question Q5
    showVerifiedOnly: false, // optional reviewer scenario; ordinary users get one automatic result
    minSizeFilter: true,    // exclude structures below 4x4 amos (SA HaRav 398:10)
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
    autoCheckDays: 30,      // auto change-check when cached data is older than this; no user button
    dataSourceVersion: 2,   // migrates prior OSM-era display defaults once
  };

  const KEY = 'techum-settings-v1';

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
        // Rev. 12 exposed only a binary overlap switch. Preserve the user's intent,
        // but migrate it to the three actual mehalachim recorded in Rev. 13.
        if (!saved.overlapPolicy && typeof saved.overlapMerge === 'boolean') {
          saved.overlapPolicy = saved.overlapMerge ? 'join-redraw' : 'no-join';
        }
        delete saved.overlapMerge;
        return { ...DEFAULTS, ...saved };
      }
    } catch (e) { /* fresh defaults */ }
    return { ...DEFAULTS };
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }
  function applyProfile(s, profileKey) {
    const p = PROFILES[profileKey];
    if (!p) return s;
    return { ...s, profile: profileKey, amahCm: p.amahCm, karpef: p.karpef,
      squaringAngleDeg: p.squaringAngleDeg, overlapPolicy: p.overlapPolicy,
      largeHolePolicy: p.largeHolePolicy, bowPolicy: p.bowPolicy,
      minCityHouses: p.minCityHouses };
  }
  // Every setting that differs from the app-wide defaults (for analytics: "what do
  // people change?"). Keys mirror DEFAULTS; values are the chosen non-default value.
  function diffFromDefaults(s) {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) {
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
      p.minCityHouses === s.minCityHouses;
    return same ? s.profile : 'custom';
  }

  root.TechumSettings = { PROFILES, DEFAULTS, AMOS_OPTIONS, load, save, applyProfile,
    effectiveProfile, diffFromDefaults };
})(typeof self !== 'undefined' ? self : this);
