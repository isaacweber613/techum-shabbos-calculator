/*
 * Psak profiles & settings — mirrors TECHUM-SPEC.md Part 2 (rev. 4).
 * Every disputed rule is a setting; profiles are documented defaults, all overridable.
 * Classic script: exposes window.TechumSettings.
 */
(function (root) {
  'use strict';

  const AMOS_OPTIONS = [
    { cm: 48, label: "R' Chaim Naeh — 48 cm (2000 amos = 960 m)" },
    { cm: 53.98, label: "R' Moshe Feinstein — 21.25 in (2000 amos = 1,080 m)" },
    { cm: 57.6, label: 'Chazon Ish — 57.6 cm (2000 amos = 1,152 m)' },
  ];

  const PROFILES = {
    'mishna-berura': {
      label: 'Mishna Berurah / Ashkenazi (default)',
      amahCm: 48,          // R' Chaim Naeh
      karpef: true,        // Rema, recorded MB 398:36
      squaringAngleDeg: 0, // compass (Chayei Adam 68:14)
      overlapMerge: false, // strict (R' S. Miller) + warning
      minCityHouses: 6,    // MB 398:38
    },
    'chazon-ish': {
      label: 'Chazon Ish',
      amahCm: 57.6,
      karpef: true,        // CONFIRM CI's own karpef position with a posek (spec Part 2)
      squaringAngleDeg: 0, // natural-edge PERMITTED — user sets the angle (CI OC 110:23)
      overlapMerge: true,  // CI redraws the joint rectangle
      minCityHouses: 6,
    },
    'mechaber': {
      label: 'Mechaber / Sefardi',
      amahCm: 48,
      karpef: false,       // Rambam/Mechaber SA 398:5
      squaringAngleDeg: 0,
      overlapMerge: false,
      minCityHouses: 6,
    },
  };

  const DEFAULTS = {
    profile: 'mishna-berura',
    ...PROFILES['mishna-berura'],
    includeUnknown: true,   // data policy (just-works default); flagged in UI
    includeReview: true,    // hotels/shuls/schools etc — flagged, open question Q5
    showVerifiedOnly: true, // second scenario line: verified dwellings only (neither is authoritative)
    minSizeFilter: true,    // exclude structures below 4x4 amos (SA HaRav 398:10)
    secondAmahCm: 0,        // 0 = off; draws a comparison techum line
    show12mil: false,
    pointRotationDeg: 0,    // open-field square rotation (SA 399 — person may orient)
    fetchRadiusM: 1200,
    maxBuildings: 30000,
    maxExpandIterations: 4,
    autoCheckDays: 30,      // auto change-check when cached data is older than this; no user button
  };

  const KEY = 'techum-settings-v1';

  function load() {
    try {
      const raw = root.localStorage && localStorage.getItem(KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
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
      squaringAngleDeg: p.squaringAngleDeg, overlapMerge: p.overlapMerge,
      minCityHouses: p.minCityHouses };
  }
  // If any profile-governed value differs from the selected profile, it's Custom.
  function effectiveProfile(s) {
    const p = PROFILES[s.profile];
    if (!p) return 'custom';
    const same = p.amahCm === s.amahCm && p.karpef === s.karpef &&
      p.squaringAngleDeg === s.squaringAngleDeg && p.overlapMerge === s.overlapMerge &&
      p.minCityHouses === s.minCityHouses;
    return same ? s.profile : 'custom';
  }

  root.TechumSettings = { PROFILES, DEFAULTS, AMOS_OPTIONS, load, save, applyProfile, effectiveProfile };
})(typeof self !== 'undefined' ? self : this);
