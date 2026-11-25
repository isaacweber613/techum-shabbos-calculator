/*
 * Spec-traced golden tests. Every case names the TECHUM-SPEC.md line it proves and
 * its expected value is worked out by hand from that line (amah 48 cm unless stated:
 * 70⅔ amos = 33.92 m, 141⅓ = 67.84 m, 2000 = 960 m, 4000 = 1920 m, 4 = 1.92 m).
 * Cases where the spec is silent or unclear are listed as PENDING and never fail.
 * Run: node tests/spec-golden.test.js
 */
const G = require('../js/geometry.js');
const D = require('../js/data.js').TechumData;
const SET = require('../js/settings.js').TechumSettings;
const fs = require('node:fs');
const path = require('node:path');

let passed = 0, failed = 0;
const pending = [];
const asyncChecks = []; // checks that await something; the summary waits for them
function check(id, specLine, name, cond, detail) {
  const label = `[${id} · TECHUM-SPEC.md:${specLine}] ${name}`;
  if (cond) { passed++; console.log('  ok  ' + label); }
  else { failed++; console.error('FAIL  ' + label + (detail ? ' — ' + detail : '')); }
}
function pend(id, specLine, question) { pending.push(`[${id} · TECHUM-SPEC.md:${specLine}] ${question}`); }
const approx = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// ---------- helpers --------------------------------------------------------------
let nextId = 0;
function box(minX, minY, maxX, maxY, extra) {
  const ring = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
  return { id: `b${nextId++}`, ring, bbox: G._internals.bboxOfRing(ring), included: true, ...(extra || {}) };
}
const house = (cx, cy, size = 10) => box(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2);
function polygonHouse(points) {
  const ring = points.map(([x, y]) => ({ x, y }));
  return { id: `b${nextId++}`, ring, bbox: G._internals.bboxOfRing(ring), included: true };
}
// Six 10 m houses, 3 x 2, 20 m apart: walls span x [x0, x0+50], y [y0, y0+30].
function town(x0, y0) {
  const out = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) out.push(box(x0 + i * 20, y0 + j * 20, x0 + i * 20 + 10, y0 + j * 20 + 10));
  return out;
}
function span(ring) {
  const xs = ring.map((p) => p.x), ys = ring.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys),
    w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
const sameSpan = (a, b, tol = 1e-6) => ['minX', 'maxX', 'minY', 'maxY'].every((k) => approx(a[k], b[k], tol));
const regionSig = (regions) => regions.map((ring) => ring.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort().join(';')).sort().join('|');
const has = (r, type) => r.warnings.some((w) => w.type === type);
const rotate = (deg) => { const a = deg * Math.PI / 180; return ([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; };

const RCN = 0.48, CI = 0.576, RMF = 0.54;
const S = { amahM: RCN, karpef: false, minCityHouses: 6, overlapPolicy: 'no-join',
  largeHolePolicy: 'include-with-warning', bowPolicy: 'rema-majority', squaringAngleDeg: 0 };
// Spec values, written out here and never read back from the engine, so a changed engine
// constant fails a test instead of moving the expectation with it (rev. 21).
const SPEC_AMOS = { JOIN: 70 + 2 / 3, JOIN2: 141 + 1 / 3, KARPEF: 70 + 2 / 3, TECHUM: 2000, BOW: 4000, MIL12: 24000, PERSON: 4, DWELLING: 4 };
const JOIN = 33.92, T2 = 67.84, TECHUM = 960, BOW = 1920; // the same four at 48 cm
const run = (buildings, settings, pin) => G.runPipeline(buildings, { ...S, ...(settings || {}) }, pin || { x: 0, y: 0 });

// =================================================================================
// §1.1 / §1.2 — base rule and the amah as the master scaling constant
// =================================================================================
{
  // Spec table §1.2: 48 cm -> 960 m, 33.9 m, 67.8 m; 57.6 cm -> 1,152 m, 40.7 m, 81.4 m;
  // 54 cm -> 1,080 m, 38.2 m, 76.3 m. Exact products: 70⅔·0.48 = 33.92, 141⅓·0.48 = 67.84.
  const t = (amahM) => run([], { amahM }).thresholds;
  const r = t(RCN), c = t(CI), m = t(RMF);
  check('1.2-a', 44, 'R\' Chaim Naeh 48 cm: 70⅔ = 33.92 m, 141⅓ = 67.84 m, 2000 = 960 m, karpef = 33.92 m',
    approx(r.joinM, 33.92, 1e-9) && approx(r.t2, 67.84, 1e-9) && approx(r.techumM, 960, 1e-9) && approx(r.karpefM, 33.92, 1e-9), JSON.stringify(r));
  check('1.2-b', 46, 'Chazon Ish 57.6 cm: 70⅔ = 40.704 m, 141⅓ = 81.408 m, 2000 = 1,152 m',
    approx(c.joinM, 40.704, 1e-9) && approx(c.t2, 81.408, 1e-9) && approx(c.techumM, 1152, 1e-9), JSON.stringify(c));
  check('1.2-c', 45, 'R\' Moshe 54 cm: 70⅔ = 38.16 m, 141⅓ = 76.32 m, 2000 = 1,080 m',
    approx(m.joinM, 38.16, 1e-9) && approx(m.t2, 76.32, 1e-9) && approx(m.techumM, 1080, 1e-9), JSON.stringify(m));
  check('1.2-f', 53, 'every engine threshold in amos is the spec value (70⅔, 141⅓, karpef 70⅔, 2000, 4000, 24,000, 4)',
    Object.entries(SPEC_AMOS).every(([key, amos]) => G.AMOS[key] === amos), JSON.stringify(G.AMOS));

  // §1.2 line 52: every threshold (4, 70⅔, 141⅓, 2000, 4000, 24,000) scales from the amah.
  const ciPoint = span(run([], { amahM: CI }).techumCorners);
  check('1.2-d', 53, 'the 4-amah point square scales too: CI point techum = 4·0.576 + 2·1152 = 2306.304 m',
    approx(ciPoint.w, 2306.304, 1e-9) && approx(ciPoint.h, 2306.304, 1e-9), JSON.stringify(ciPoint));
  const cityRes = run(town(0, 0));
  const city = span(cityRes.cityCorners), mil = span(cityRes.mil12Corners);
  check('1.1-a', 31, '12-mil comparison ring = city + 24,000 amos (11,520 m) on every side',
    approx(mil.minX, city.minX - 11520, 1e-6) && approx(mil.maxY, city.maxY + 11520, 1e-6), JSON.stringify(mil));
  // Rev. 21 left open whether the ring starts beyond the Rema karpef (Part 7 Q15). Rev. 22
  // (lines 975-987) answers it from research: 24,000 amos from the town's own squared edge,
  // without the karpef, in every profile. Before rev. 22 the engine added the karpef
  // (11,520 + 33.92 m per side at 48 cm), which every check below would catch.
  {
    const ring = (r) => span(r.mil12Corners);
    const onTown = run(town(0, 0), { karpef: true }, { x: 5, y: 5 });
    check('rev22-a', 984, 'karpef on (MB): the 12-mil ring is the squared town + 11,520 m on every side, not + 11,553.92 m',
      onTown.mode === 'city' && sameSpan(ring(onTown), { minX: -11520, maxX: 50 + 11520, minY: -11520, maxY: 30 + 11520 }),
      JSON.stringify(ring(onTown)));
    check('rev22-b', 989, 'the 2000-amah techum still keeps its karpef: walls ± (33.92 + 960) m',
      sameSpan(span(onTown.techumCorners), { minX: -993.92, maxX: 1043.92, minY: -993.92, maxY: 1023.92 }),
      JSON.stringify(span(onTown.techumCorners)));
    // Chazon Ish amah: 24,000 · 0.576 = 13,824 m (before: + 40.704 = 13,864.704 m).
    const ciTown = run(town(0, 0), { amahM: CI, karpef: true }, { x: 5, y: 5 });
    check('rev22-c', 987, 'Chazon Ish amah (57.6 cm) with karpef: ring = squared town + 13,824 m',
      sameSpan(ring(ciTown), { minX: -13824, maxX: 50 + 13824, minY: -13824, maxY: 30 + 13824 }), JSON.stringify(ring(ciTown)));
    // Two towns exactly 141⅓ amos (67.84 m) apart are one town: walls x [0, 167.84].
    const joined = run(town(0, 0).concat(town(50 + T2, 0)), { karpef: true }, { x: 5, y: 5 });
    check('rev22-d', 988, 'two towns joined at 141⅓ amos: the ring is measured from the merged town: x [-11,520, 11,687.84]',
      joined.clusters.length === 1 && sameSpan(ring(joined), { minX: -11520, maxX: 167.84 + 11520, minY: -11520, maxY: 30 + 11520 }),
      JSON.stringify(ring(joined)));
    const mech = run(town(0, 0), { karpef: false, bowPolicy: 'mechaber-curve' }, { x: 5, y: 5 });
    check('rev22-e', 996, 'Mechaber (karpef off): ring = squared town + 11,520 m, unchanged',
      sameSpan(ring(mech), { minX: -11520, maxX: 50 + 11520, minY: -11520, maxY: 30 + 11520 }));
    check('rev22-f', 987, 'with karpef on and off the ring is identical (it never depends on the karpef)',
      regionSig(onTown.mil12Regions) === regionSig(mech.mil12Regions));
    // A rav-validated enclosure x [-10,60], y [-10,40] is the town's edge (§3.2 line 1019).
    const enclosure = [{ x: -10, y: -10 }, { x: 60, y: -10 }, { x: 60, y: 40 }, { x: -10, y: 40 }];
    const enc = run(town(0, 0), { karpef: true, validatedCityPerimeter: enclosure }, { x: 5, y: 5 });
    check('rev22-g', 987, 'validated enclosure with karpef: ring = enclosure + 11,520 m: x [-11,530, 11,580]',
      enc.validatedPerimeterActive && sameSpan(ring(enc), { minX: -11530, maxX: 11580, minY: -11530, maxY: 11560 }), JSON.stringify(ring(enc)));
    // A lone house never had a karpef: walls x [0,10] -> ring x [-11,520, 11,530].
    const lone = run([box(0, 0, 10, 10)], { karpef: true }, { x: 5, y: 5 });
    check('rev22-h', 987, 'building mode: ring = the house walls + 11,520 m',
      lone.mode === 'building' && sameSpan(ring(lone), { minX: -11520, maxX: 11530, minY: -11520, maxY: 11530 }));
    // A town split into regions by an unfilled pocket: each region gets 24,000 amos, no karpef.
    // Tiny amah 0.01 m: 24,000 amos = 240 m, karpef 0.70667 m.
    const deepU = [];
    for (let n = 0; n <= 10; n++) { deepU.push(house(0, n * 10), house(100, n * 10)); if (n > 0 && n < 10) deepU.push(house(n * 10, 0)); }
    const multi = run(deepU, { amahM: 0.01, karpef: true }, { x: 0, y: 50 });
    check('rev22-i', 987, 'a town of several regions: each region\'s ring is that region + 240 m (24,000 amos at 1 cm), no karpef',
      multi.cityRegions.length > 1 && multi.mil12Regions.length === multi.cityRegions.length &&
      multi.cityRegions.every((region, i) => { const c = span(region), m = span(multi.mil12Regions[i]);
        return approx(m.minX, c.minX - 240) && approx(m.maxX, c.maxX + 240) && approx(m.minY, c.minY - 240) && approx(m.maxY, c.maxY + 240); }),
      `regions=${multi.cityRegions.length}`);
    const mainJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
    check('rev22-j', 997, 'when the ring is shown, the panel adds the rav note and the ring\'s label says "without the karpef"',
      /settings\.show12mil && \(res\.mil12Regions/.test(mainJs) && /12-mil ring:<\/b> drawn 24,000 amos from the town’s own squared edge, without the 70⅔-amah karpef/.test(mainJs) &&
      /'12 mil \(d’oraisa shita\) — 24,000 amos from the town’s own squared edge, without the karpef/.test(mainJs));
  }
  pend('1.1-c', 1000, 'Is the Torah-law 12 mil measured from the squared town at all, or from the houses themselves? Minchas Chinuch 24 doubts in general whether rabbinic techum leniencies reach the Torah measure. (Part 7 Q16)');

  check('1.2-e', 54, 'default amah is 48 cm with the second comparison line off',
    SET.DEFAULTS.amahCm === 48 && SET.DEFAULTS.secondAmahCm === 0);
}

// =================================================================================
// §1.3 — beis dirah predicate and the classification table
// =================================================================================
{
  const k = (tags) => D.classify(tags).klass;
  // Line 65: houses count. 'semi' and 'dwelling_house' are Overture's own class names (rev. 21).
  for (const b of ['house', 'residential', 'apartments', 'detached', 'terrace', 'bungalow', 'dormitory', 'stilt_house', 'semi', 'dwelling_house']) {
    check('1.3-a', 69, `building=${b} is a dwelling`, k({ building: b }) === 'dwelling', k({ building: b }));
  }
  // Line 72-75, rev 14 line 712, rev 16 line 765: storage/bare structures do not count.
  for (const b of ['garage', 'shed', 'barn', 'stable', 'warehouse', 'greenhouse', 'carport', 'shrine', 'retail', 'silo']) {
    check('1.3-b', 77, `building=${b} is not a dwelling`, k({ building: b }) === 'non', k({ building: b }));
  }
  // Rev. 21 left tents and shipping containers pending (Part 7 Q14); rev. 23 answered tents
  // and rev. 24 containers (blocks below).
  // Lines 65-71, 76-81, rev 14/16: counts only with facts the map cannot show -> review.
  for (const b of ['synagogue', 'church', 'mosque', 'ruins', 'guardhouse', 'hotel', 'hospital', 'school', 'office', 'factory', 'industrial', 'commercial', 'fire_station', 'monastery']) {
    check('1.3-c', 82, `building=${b} needs beis-dirah review`, k({ building: b }) === 'review', k({ building: b }));
  }
  check('1.3-d', 75, 'abandoned structure ("habitable ruins" only with walls and roof) goes to review',
    k({ building: 'yes', abandoned: 'yes' }) === 'review');
  check('1.3-e', 70, 'an untyped place of worship goes to review (counts only with clergy quarters)',
    k({ building: 'yes', amenity: 'place_of_worship' }) === 'review');
  // Rev. 15 (lines 736-741): every remaining subtype mapping.
  const sub = (overture_subtype) => k({ building: 'yes', overture_subtype });
  for (const [s, want] of [['civic', 'non'], ['service', 'non'], ['transportation', 'non'], ['commercial', 'review'],
    ['religious', 'review'], ['education', 'review'], ['medical', 'review'], ['agricultural', 'review'], ['military', 'unknown']]) {
    check('rev15-a', 747, `Overture subtype ${s} -> ${want}`, sub(s) === want, sub(s));
  }
  check('rev15-b', 752, 'an explicit class always wins over the subtype', k({ building: 'warehouse', overture_subtype: 'residential' }) === 'non');
  // Part 2 table line 389: unknown-use included by default, flagged; review likewise (rev 15 line 744).
  check('2-unknown', 397, 'unknown-use and review structures are included by default',
    SET.DEFAULTS.includeUnknown === true && SET.DEFAULTS.includeReview === true);

  // Lines 60-67: the 4×4-amah minimum. Rev. 19 measured it by the outline's narrowest width;
  // rev. 25 replaced that with 16 square amos and, in the Mishna Berurah and Chazon Ish
  // profiles, a real 4×4 square (block "Rev. 25" below). 1.3-h, 1.3-i, 1.3-k and 1.3-m tested
  // the width rule; rev25-b, rev25-c, rev25-g and rev25-m replace them.
  const size = typeof G.dwellingSize === 'function' ? G.dwellingSize : () => 'missing';
  check('1.3-f', 62, 'the 4×4-amah size test is exported from the engine', typeof G.dwellingSize === 'function');
  const ring = (pts) => pts.map(([x, y]) => ({ x, y }));
  const rect = (w, h, deg = 0) => ring([[0, 0], [w, 0], [w, h], [0, h]].map(rotate(deg)));
  const bothRules = (r) => ['square', 'area'].map((rule) => size(r, RCN, rule));
  check('1.3-g', 61, 'exactly 4×4 amos (1.92 × 1.92 m) counts under both rules',
    bothRules(rect(4 * RCN, 4 * RCN)).every((v) => v === 'ok'), bothRules(rect(4 * RCN, 4 * RCN)).join());
  check('1.3-j', 62, 'a 3 m × 3 m structure turned 30° holds a 4×4-amah square and counts', size(rect(3, 3, 30), RCN, 'square') === 'ok');
  check('1.3-l', 62, 'a degenerate (zero-area) footprint does not count under either rule',
    bothRules(ring([[0, 0], [10, 0], [20, 0]])).every((v) => v === 'small'));
  // Rev. 19 pending 1.3-q1 (houseboat) and 1.3-q2 (caravans/cabins) — answered in rev. 20.
}

// =================================================================================
// Rev. 20 — houseboats, cabins, seasonal cottages, caravans (lines 74, 867-899, 1087)
// =================================================================================
{
  const cls = (building) => D.classify({ building });
  const boat = cls('houseboat'), van = cls('static_caravan');
  check('rev20-a', 877, 'building=houseboat goes to review, left out by default, and still counts as a house if a rav includes it',
    boat.klass === 'review' && boat.excludeByDefault === true && !boat.noCityCount, JSON.stringify(boat));
  check('rev20-b', 877, 'the houseboat review text tells the rav how to see the town with it counted',
    /include it to see the town with it counted/.test(boat.reason), boat.reason);
  check('rev20-c', 902, 'building=cabin is a full dwelling (SA 398:10, "of boards")',
    cls('cabin').klass === 'dwelling' && !cls('cabin').noCityCount);
  check('rev20-d', 902, 'seasonal cottages arrive as house/bungalow and count as dwellings all year',
    cls('house').klass === 'dwelling' && cls('bungalow').klass === 'dwelling');
  check('rev20-e', 903, 'building=static_caravan goes to review, included by default, adding 0 to the town count',
    van.klass === 'review' && van.noCityCount === true && !van.excludeByDefault, JSON.stringify(van));
  check('rev20-f', 909, 'building=caravan and building=touring_caravan are not counted',
    cls('caravan').klass === 'non' && cls('touring_caravan').klass === 'non');

  // The app's inclusion rule (main.js isIncluded) with ambiguous structures included (the default).
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const src = main.slice(main.indexOf('  function isIncluded('), main.indexOf('  // Verified-only scenario'));
  const overrides = new Map();
  const isIncluded = require('node:vm').runInNewContext(`(${src})`,
    { state: { overrides }, isTooSmall: () => false, sizeVerdict: () => 'ok', settings: { includeReview: true, includeUnknown: true } });
  const boatB = { id: 'boat', klass: 'review', excludeByDefault: true };
  const vanB = { id: 'van', klass: 'review', noCityCount: true };
  check('rev20-g', 888, 'the app leaves a houseboat out by default even with ambiguous structures included', isIncluded(boatB) === false);
  overrides.set('boat', 'include');
  check('rev20-h', 888, 'a reviewer include override counts the houseboat', isIncluded(boatB) === true);
  check('rev20-i', 903, 'the app includes a static caravan by default', isIncluded(vanB) === true);
  check('rev20-j', 903, 'the app carries both flags from the table into the engine input',
    /excludeByDefault: !!cls\.excludeByDefault, noCityCount: !!cls\.noCityCount/.test(main) &&
    /function workerSafeBuildings[\s\S]{0,250}noCityCount: !!b\.noCityCount/.test(main));

  // Town: six 10 m houses, walls x [0,50], y [0,30]. Extra footprint at x [80,90]: 30 m < 33.92 m.
  const extra = (flags) => box(80, 0, 90, 10, flags);
  const out = run(town(0, 0).concat(extra({ included: false })), {}, { x: 5, y: 5 });
  const inn = run(town(0, 0).concat(extra()), {}, { x: 5, y: 5 });
  check('rev20-k', 877, 'houseboat left out: the town ends at x = 50 and the techum at 50 + 960 = 1010',
    out.mode === 'city' && approx(span(out.cityCorners).maxX, 50) && approx(span(out.techumCorners).maxX, 1010),
    JSON.stringify(span(out.techumCorners)));
  check('rev20-l', 888, 'houseboat included by a rav: the town reaches x = 90 and the techum 90 + 960 = 1050',
    inn.mode === 'city' && approx(span(inn.cityCorners).maxX, 90) && approx(span(inn.techumCorners).maxX, 1050),
    JSON.stringify(span(inn.techumCorners)));

  const chained = run(town(0, 0).concat(extra({ noCityCount: true })), {}, { x: 5, y: 5 });
  check('rev20-m', 903, 'a static caravan 30 m from a six-house town chains on: town to x = 90, techum to 1050, count stays 6',
    chained.mode === 'city' && approx(span(chained.cityCorners).maxX, 90) && approx(span(chained.techumCorners).maxX, 1050) &&
    chained.clusters[0].houseCount === 6, JSON.stringify({ t: span(chained.techumCorners), n: chained.clusters[0].houseCount }));
  check('rev20-n', 907, 'a caravan joined to a town raises the seasonal-caravan flag, not the caravan-site flag',
    has(chained, 'static-caravan') && !has(chained, 'caravan-site'));

  const fivePlusVan = town(0, 0); fivePlusVan[5] = { ...fivePlusVan[5], noCityCount: true };
  const fpv = run(fivePlusVan, {}, { x: 5, y: 5 });
  const fpvT = span(fpv.techumCorners);
  check('rev20-o', 903, 'five houses + one static caravan is not a town: building mode from the pin\'s 10 m house, techum x [-960, 970]',
    fpv.mode === 'building' && approx(fpvT.minX, -960) && approx(fpvT.maxX, 970) && has(fpv, 'caravan-site'),
    JSON.stringify({ mode: fpv.mode, fpvT }));

  const vans = town(0, 0).map((b) => ({ ...b, noCityCount: true }));
  const site = run(vans, {}, { x: 5, y: 5 });
  check('rev20-p', 907, 'a site of six static caravans only does not form a town by count; it is flagged for a rav',
    site.mode === 'building' && site.clusters[0].houseCount === 0 && has(site, 'caravan-site') && !has(site, 'static-caravan'));
  const key = site.qualificationClusters[0].key;
  const ruled = run(vans, { cityQualificationOverrides: { [key]: true } }, { x: 5, y: 5 });
  check('rev20-q', 908, 'once a rav records the caravan site as a town, it squares as one: town x [0,50], techum x [-960, 1010]',
    ruled.mode === 'city' && approx(span(ruled.techumCorners).minX, -960) && approx(span(ruled.techumCorners).maxX, 1010) &&
    !has(ruled, 'caravan-site'), JSON.stringify(span(ruled.techumCorners)));
}

// =================================================================================
// Rev. 23 — tents and yurts (lines 76, 392, 1008-1050; Part 7 Q14)
// =================================================================================
{
  const cls = (building) => D.classify({ building });
  const tent = cls('tent'), ger = cls('ger');
  check('rev23-a', 1045, 'building=tent goes to review (always flagged), is left out by default, and gets the fixed-tent treatment if a rav includes it',
    tent.klass === 'review' && tent.excludeByDefault === true && tent.noCityCount === true && tent.noCityCountKind === 'fixed-tent', JSON.stringify(tent));
  check('rev23-b', 1048, 'building=ger (a yurt) goes to review, is included by default, and adds 0 to the town count',
    ger.klass === 'review' && !ger.excludeByDefault && ger.noCityCount === true && ger.noCityCountKind === 'fixed-tent', JSON.stringify(ger));
  check('rev23-c', 1045, 'the tent review text says a pitched tent is left out and a rav may include a fixed one',
    /pitched tent is not a dwelling/.test(tent.reason) && /a rav may include it/.test(tent.reason), tent.reason);

  // The app's inclusion rule (main.js isIncluded) with ambiguous structures included (the default).
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const src = main.slice(main.indexOf('  function isIncluded('), main.indexOf('  // Verified-only scenario'));
  const overrides = new Map();
  const isIncluded = require('node:vm').runInNewContext(`(${src})`,
    { state: { overrides }, isTooSmall: () => false, sizeVerdict: () => 'ok', settings: { includeReview: true, includeUnknown: true } });
  const tentB = { id: 'tent', ...tent }, gerB = { id: 'ger', ...ger };
  const tentOut = isIncluded(tentB);
  overrides.set('tent', 'include');
  check('rev23-d', 1046, 'the app leaves a tent out by default even with ambiguous structures included; a rav\'s include counts it',
    tentOut === false && isIncluded(tentB) === true);
  check('rev23-e', 1049, 'the app includes a yurt by default', isIncluded(gerB) === true);
  check('rev23-f', 1053, 'a footprint left out by default (tent, houseboat) is not offered as the starting building unless a rav included it',
    /if \(\(b\.klass === 'non' \|\| b\.excludeByDefault\) && state\.overrides\.get\(b\.id\) !== 'include'\) return;/.test(main));
  check('rev23-g', 1035, 'the app carries the kind of each uncounted structure into the engine, including the background worker',
    /noCityCountKind: cls\.noCityCountKind \|\| null/.test(main) &&
    /function workerSafeBuildings[\s\S]{0,300}noCityCountKind: b\.noCityCountKind \|\| null/.test(main));

  // Engine runs with the flags the table gives, so the old table (tent a plain non-dwelling,
  // ger a full dwelling) fails each of these.
  const flags = (c) => (b) => ({ ...b, noCityCount: !!c.noCityCount, noCityCountKind: c.noCityCountKind });
  const asTent = flags(tent), asGer = flags(ger);
  // Town: six 10 m houses, walls x [0,50], y [0,30]. A tent a rav included at x [80,90]: 30 m < 33.92 m.
  const withTent = run(town(0, 0).concat(asTent(box(80, 0, 90, 10))), {}, { x: 5, y: 5 });
  check('rev23-h', 1030, 'a fixed tent 30 m from a six-house town chains on: town to x = 90, techum to 1050, count stays 6, fixed-tent flag only',
    withTent.mode === 'city' && approx(span(withTent.cityCorners).maxX, 90) && approx(span(withTent.techumCorners).maxX, 1050) &&
    withTent.clusters[0].houseCount === 6 && has(withTent, 'fixed-tent') && !has(withTent, 'tent-site'),
    JSON.stringify({ t: span(withTent.techumCorners), n: withTent.clusters[0].houseCount, w: withTent.warnings.map((w) => w.type) }));
  // Six yurts alone, in the same layout: no town by count.
  const yurts = town(0, 0).map(asGer);
  const ys = run(yurts, {}, { x: 5, y: 5 });
  check('rev23-i', 1036, 'six yurts alone are not a town by count: building mode from the pin\'s yurt (techum x [-960, 970]), flagged for a rav',
    ys.mode === 'building' && ys.clusters[0].houseCount === 0 && approx(span(ys.techumCorners).minX, -960) &&
    approx(span(ys.techumCorners).maxX, 970) && has(ys, 'tent-site') && !has(ys, 'fixed-tent'),
    JSON.stringify({ mode: ys.mode, w: ys.warnings.map((w) => w.type) }));
  const ysKey = ys.qualificationClusters[0].key;
  const ysRuled = run(yurts, { cityQualificationOverrides: { [ysKey]: true } }, { x: 5, y: 5 });
  check('rev23-j', 1037, 'once a rav records the yurt site as a town, it squares as one: techum x [-960, 1010], no site flag',
    ysRuled.mode === 'city' && approx(span(ysRuled.techumCorners).minX, -960) && approx(span(ysRuled.techumCorners).maxX, 1010) &&
    !has(ysRuled, 'tent-site'), JSON.stringify(span(ysRuled.techumCorners)));
  // A camp: three courtyards of two permanent houses (the six-house town) and four tents around
  // it: x [80,90] and [110,120] on the south row (30 m and 20 m gaps), x [0,10] and [40,50] at
  // y [50,60] (20 m north of the houses). All gaps are under 70⅔ amos (33.92 m).
  const tents = [box(80, 0, 90, 10), box(110, 0, 120, 10), box(0, 50, 10, 60), box(40, 50, 50, 60)].map(asTent);
  const camp = town(0, 0).concat(tents);
  const cr = run(camp, {}, { x: 5, y: 5 });
  check('rev23-k', 1039, 'a camp with three courtyards of two houses each is a town, tents and all: town x [0,120], y [0,60]; techum x [-960, 1080]',
    cr.mode === 'city' && cr.clusters.length === 1 && cr.clusters[0].houseCount === 6 &&
    sameSpan(span(cr.cityCorners), { minX: 0, maxX: 120, minY: 0, maxY: 60 }) && approx(span(cr.techumCorners).minX, -960) &&
    approx(span(cr.techumCorners).maxX, 1080) && has(cr, 'fixed-tent') && !has(cr, 'tent-site'),
    JSON.stringify({ c: span(cr.cityCorners), n: cr.clusters[0].houseCount }));
  // Without the house at x [40,50], y [20,30] the camp has five permanent houses: 5 + 4 tents
  // would be 9 by count, but tents add 0, so it is not a town.
  const fiveCamp = camp.filter((b, i) => i !== 5);
  const fr = run(fiveCamp, {}, { x: 5, y: 5 });
  check('rev23-l', 1043, 'with five permanent houses the same tents do not make a town: building mode from the pin\'s house (techum x [-960, 970]), with both flags',
    fr.mode === 'building' && fr.clusters.length === 1 && fr.clusters[0].houseCount === 5 &&
    sameSpan(span(fr.techumCorners), { minX: -960, maxX: 970, minY: -960, maxY: 970 }) && has(fr, 'tent-site') && has(fr, 'fixed-tent'),
    JSON.stringify({ mode: fr.mode, w: fr.warnings.map((w) => w.type) }));
  // Same in every profile (line 1047): the Chazon Ish amah (40.704 m join) and the Mechaber
  // profile (no karpef) give the same town status and flags for both camps.
  const profiles = [{ amahM: CI, karpef: true }, { karpef: false, bowPolicy: 'mechaber-curve' }];
  check('rev23-m', 1054, 'the same in every profile: six houses + tents is a town and five houses + tents is not, with the same flags',
    profiles.every((p) => { const a = run(camp, p, { x: 5, y: 5 }), b = run(fiveCamp, p, { x: 5, y: 5 });
      return a.mode === 'city' && !has(a, 'tent-site') && has(a, 'fixed-tent') && b.mode === 'building' && has(b, 'tent-site'); }));
  // A static caravan and a tent in one site raise each kind's own site flag (line 1029). Four
  // houses (walls x [0,30]), a caravan at x [50,60] and a tent at x [80,90], 20 m apart.
  const mixed = town(0, 0).slice(0, 4).concat(flags(cls('static_caravan'))(box(50, 0, 60, 10)), asTent(box(80, 0, 90, 10)));
  const mr = run(mixed, {}, { x: 5, y: 5 });
  check('rev23-n', 1036, 'four houses + a static caravan + a tent: not a town by count; caravan and tent each get their own flags',
    mr.mode === 'building' && has(mr, 'caravan-site') && has(mr, 'tent-site') && has(mr, 'static-caravan') && has(mr, 'fixed-tent'),
    JSON.stringify(mr.warnings.map((w) => w.type)));
}

// =================================================================================
// Rev. 24 — shipping containers (lines 77, 393, 1055-1097; Part 7 Q14, Q17)
// =================================================================================
{
  const cls = (building) => D.classify({ building });
  const crate = cls('container');
  check('rev24-a', 1068, 'building=container stays a non-dwelling (not in review, never flagged by default) and carries the lived-in-container treatment for a rav\'s include',
    crate.klass === 'non' && !crate.excludeByDefault && crate.noCityCount === true && crate.noCityCountKind === 'lived-in-container' &&
    !cls('shed').noCityCount && !cls('warehouse').noCityCount, JSON.stringify(crate));
  check('rev24-b', 1075, 'the container text says it is not a dwelling and a rav may include one people live in',
    /not a dwelling/.test(crate.reason) && /a rav may include it/.test(crate.reason) && /SA OC 398:6/.test(crate.reason), crate.reason);

  // The app's inclusion rule (main.js isIncluded) with ambiguous structures included (the default).
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const src = main.slice(main.indexOf('  function isIncluded('), main.indexOf('  // Verified-only scenario'));
  const overrides = new Map();
  const isIncluded = require('node:vm').runInNewContext(`(${src})`,
    { state: { overrides }, isTooSmall: () => false, sizeVerdict: () => 'ok', settings: { includeReview: true, includeUnknown: true } });
  const crateB = { id: 'crate', ...crate };
  const crateOut = isIncluded(crateB);
  overrides.set('crate', 'include');
  check('rev24-c', 1087, 'the app leaves a container out by default, even with ambiguous structures included, and never queues a non-dwelling for review; a rav\'s include brings it in',
    crateOut === false && isIncluded(crateB) === true &&
    /building\.klass === 'unknown' \|\| building\.klass === 'review' \|\|\s*\(building\.klass === 'dwelling' && sizeVerdict\(building\) === 'no-square'\)\)/.test(main));
  check('rev24-d', 1090, 'a footprint a reviewer included, such as a lived-in container, can be offered as the starting building',
    /if \(\(b\.klass === 'non' \|\| b\.excludeByDefault\) && state\.overrides\.get\(b\.id\) !== 'include'\) return;/.test(main) &&
    !/if \(b\.klass === 'non'\) return;/.test(main));

  // Engine runs with the flags the table gives, so the old table (an included container
  // counted as a full house) fails each of these.
  const asCrate = (b) => ({ ...b, noCityCount: !!crate.noCityCount, noCityCountKind: crate.noCityCountKind });
  // Town: six 10 m houses, walls x [0,50], y [0,30]. A container at x [80,90]: 30 m < 33.92 m.
  const left = run(town(0, 0).concat(asCrate(box(80, 0, 90, 10, { included: false }))), {}, { x: 5, y: 5 });
  check('rev24-e', 1068, 'a storage container, left out by default, does not join: the town ends at x = 50, the techum at 1010, no container flag',
    left.mode === 'city' && approx(span(left.cityCorners).maxX, 50) && approx(span(left.techumCorners).maxX, 1010) &&
    !has(left, 'lived-in-container') && !has(left, 'container-site'), JSON.stringify(left.warnings.map((w) => w.type)));
  const lived = run(town(0, 0).concat(asCrate(box(80, 0, 90, 10))), {}, { x: 5, y: 5 });
  check('rev24-f', 1082, 'a lived-in container a rav included chains on like a static caravan: town to x = 90, techum to 1050, count stays 6, container flag only',
    lived.mode === 'city' && approx(span(lived.cityCorners).maxX, 90) && approx(span(lived.techumCorners).maxX, 1050) &&
    lived.clusters[0].houseCount === 6 && has(lived, 'lived-in-container') && !has(lived, 'container-site'),
    JSON.stringify({ t: span(lived.techumCorners), n: lived.clusters[0].houseCount, w: lived.warnings.map((w) => w.type) }));
  // Five houses and an included container in place of the sixth (x [40,50], y [20,30]).
  const five = town(0, 0); five[5] = asCrate(five[5]);
  const fr = run(five, {}, { x: 5, y: 5 });
  check('rev24-g', 1083, 'five houses + one lived-in container is not a town by count: building mode from the pin\'s house (techum x [-960, 970]), with both flags',
    fr.mode === 'building' && fr.clusters[0].houseCount === 5 &&
    sameSpan(span(fr.techumCorners), { minX: -960, maxX: 970, minY: -960, maxY: 970 }) &&
    has(fr, 'container-site') && has(fr, 'lived-in-container'), JSON.stringify({ mode: fr.mode, w: fr.warnings.map((w) => w.type) }));
  const frKey = fr.qualificationClusters[0].key;
  const frRuled = run(five, { cityQualificationOverrides: { [frKey]: true } }, { x: 5, y: 5 });
  check('rev24-h', 1085, 'once a rav records that settlement as a town, it squares as one: techum x [-960, 1010], no site flag',
    frRuled.mode === 'city' && approx(span(frRuled.techumCorners).minX, -960) && approx(span(frRuled.techumCorners).maxX, 1010) &&
    !has(frRuled, 'container-site'), JSON.stringify(span(frRuled.techumCorners)));
  // Same in every profile (line 1088): the Chazon Ish amah with the karpef, and the Mechaber profile.
  const six = town(0, 0).concat(asCrate(box(80, 0, 90, 10)));
  const profiles = [{ amahM: CI, karpef: true }, { karpef: false, bowPolicy: 'mechaber-curve' }];
  check('rev24-i', 1094, 'the same in every profile: six houses + a lived-in container is a town and five houses + one is not, with the same flags',
    profiles.every((p) => { const a = run(six, p, { x: 5, y: 5 }), b = run(five, p, { x: 5, y: 5 });
      return a.mode === 'city' && a.clusters[0].houseCount === 6 && has(a, 'lived-in-container') && !has(a, 'container-site') &&
        b.mode === 'building' && has(b, 'container-site'); }));
}

// =================================================================================
// Rev. 25 — the shape of a 4×4-amah dwelling (lines 61-67, 396, 1103-1166; Part 7 Q13, Q18)
// =================================================================================
{
  const size = typeof G.dwellingSize === 'function' ? G.dwellingSize : () => 'missing';
  const ring = (pts) => pts.map(([x, y]) => ({ x, y }));
  const turned = (pts, deg) => ring(pts.map(rotate(deg)));
  const rect = (w, h, deg = 0) => turned([[0, 0], [w, 0], [w, h], [0, h]], deg);
  const both = (r, amahM = RCN) => ['square', 'area'].map((rule) => size(r, amahM, rule));
  // An L and a U whose arms are w wide and 10 m long. Rev. 19's width test passed both: their
  // hulls are far wider than 4 amos.
  const L = (w, deg = 0) => turned([[0, 0], [10, 0], [10, w], [w, w], [w, 10], [0, 10]], deg);
  const U = (w) => ring([[0, 0], [10, 0], [10, 10], [10 - w, 10], [10 - w, w], [w, w], [w, 10], [0, 10]]);
  const circle = (radius, n) => ring(Array.from({ length: n }, (_, i) => [radius * Math.cos(2 * Math.PI * i / n), radius * Math.sin(2 * Math.PI * i / n)]));
  const triangle = (a, deg) => turned([[0, 0], [a, 0], [a / 2, a * Math.sqrt(3) / 2]], deg);

  // 16 square amos at 48 cm is 16 × 0.2304 = 3.6864 m².
  check('rev25-a', 1114, 'under 16 square amos is never a dwelling, under either rule: 1.9 × 1.9 m (3.61 m²) and 1 × 3.686 m are out; 1 × 3.6864 m is exactly 16 square amos and counts by area',
    both(rect(1.9, 1.9)).every((v) => v === 'small') && both(rect(1, 3.686)).every((v) => v === 'small') &&
    size(rect(1, 3.6864), RCN, 'area') === 'ok', JSON.stringify([both(rect(1.9, 1.9)), both(rect(1, 3.686))]));
  // A regular 64-gon of radius 1.1 m has 32 · 1.1² · sin(2π/64) = 3.795 m².
  check('rev25-b', 1118, 'Mechaber (area rule): a 1.5 × 50 m structure turned 45°, a 1.91 × 100 m one, a round one of 3.8 m² and an L with 1.5 m arms all count',
    [rect(1.5, 50, 45), rect(1.91, 100), circle(1.1, 64), L(1.5)].every((r) => size(r, RCN, 'area') === 'ok'));
  check('rev25-c', 1123, 'the reversal is for the Mechaber profile only: under the square rule the same 1.5 × 50 m and 1.91 × 100 m structures go to review, as no 1.92 m square fits',
    size(rect(1.5, 50, 45), RCN, 'square') === 'no-square' && size(rect(1.91, 100), RCN, 'square') === 'no-square');
  // The largest circle in the corner of an L with arms w wide touches both outer walls and the
  // inner corner: radius w·√2/(1+√2), 0.879 m for w = 1.5, under the 0.96 m a 1.92 m square
  // holds. The largest square in an equilateral triangle of side a has side a·√3/(2+√3):
  // 1.949 m for a = 4.2 and 1.903 m for a = 4.1.
  check('rev25-d', 1124, 'square rule, any rotation: an L with 2 m arms counts, an L or U with 1.5 m arms goes to review; an equilateral triangle of side 4.2 m counts and of 4.1 m goes to review',
    size(L(2, 33), RCN, 'square') === 'ok' && size(L(1.5, 33), RCN, 'square') === 'no-square' && size(U(1.5), RCN, 'square') === 'no-square' &&
    size(triangle(4.2, 17), RCN, 'square') === 'ok' && size(triangle(4.1, 17), RCN, 'square') === 'no-square',
    JSON.stringify([size(L(2, 33), RCN, 'square'), size(L(1.5, 33), RCN, 'square'), size(U(1.5), RCN, 'square'), size(triangle(4.2, 17), RCN, 'square'), size(triangle(4.1, 17), RCN, 'square')]));
  check('rev25-e', 1144, 'at the limit: a strip exactly 4 amos wide turned 37° holds the square, 1 mm narrower does not; exactly 4×4 amos at 57.6 cm counts',
    size(rect(1.92, 10, 37), RCN, 'square') === 'ok' && size(rect(1.919, 10, 37), RCN, 'square') === 'no-square' &&
    size(rect(2.304, 2.304, 37), CI, 'square') === 'ok');
  // A 6 × 6 m outline with a 3 × 3 m courtyard in the middle: each corner is an L with 1.5 m arms.
  const frame = (wall) => [rect(6, 6), [ring([[wall, wall], [wall, 6 - wall], [6 - wall, 6 - wall], [6 - wall, wall]])]];
  check('rev25-f', 1142, 'holes count: 6 × 6 m around a 3 × 3 m courtyard goes to review, the same outline without it counts, and with 2 m walls the square fits',
    size(frame(1.5)[0], RCN, 'square', frame(1.5)[1]) === 'no-square' && size(rect(6, 6), RCN, 'square') === 'ok' &&
    size(frame(2)[0], RCN, 'square', frame(2)[1]) === 'ok');
  // At 57.6 cm the square has 2.304 m sides and 16 square amos is 5.3084 m².
  check('rev25-g', 53, 'both tests scale with the amah: 2 × 10 m counts at 48 cm but goes to review at 57.6 cm; 2.3 × 2.3 m (5.29 m²) counts at 48 cm but is under 16 square amos at 57.6 cm',
    size(rect(2, 10), RCN, 'square') === 'ok' && size(rect(2, 10), CI, 'square') === 'no-square' &&
    size(rect(2.3, 2.3), RCN, 'square') === 'ok' && both(rect(2.3, 2.3), CI).every((v) => v === 'small'));

  // The app (main.js isIncluded and isVerifiedIncluded) with each verdict stubbed.
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const vm = require('node:vm');
  const slice = (from, to) => main.slice(main.indexOf(from), main.indexOf(to));
  const appSettings = { includeReview: true, includeUnknown: true };
  const ctx = { state: { overrides: new Map() }, settings: appSettings,
    sizeVerdict: (b) => b.size, isTooSmall: (b) => b.size === 'small' };
  const isIncluded = vm.runInNewContext(`(${slice('  function isIncluded(', '  // Verified-only scenario')})`, ctx);
  const isVerified = vm.runInNewContext(`(${slice('  function isVerifiedIncluded(', '  // ---------------- pipeline + render')})`, ctx);
  const house = (sizeVerdict, klass = 'dwelling') => ({ id: `${klass}-${sizeVerdict}`, klass, size: sizeVerdict });
  const withReview = isIncluded(house('no-square'));
  appSettings.includeReview = false;
  const withoutReview = isIncluded(house('no-square'));
  appSettings.includeReview = true; appSettings.includeUnknown = false;
  const unknownNoSquare = isIncluded(house('no-square', 'unknown'));
  appSettings.includeUnknown = true;
  ctx.state.overrides.set('dwelling-small', 'include');
  check('rev25-h', 1139, 'the app treats a house with no 4×4 square like an ambiguous building: in by default, out when ambiguous buildings are off, out of the verified-dwellings line; under 16 square amos is out unless a rav includes it',
    withReview === true && withoutReview === false && unknownNoSquare === false && isIncluded(house('ok')) === true &&
    isVerified(house('no-square')) === false && isVerified(house('ok')) === true && isIncluded(house('small')) === true &&
    (ctx.state.overrides.clear(), isIncluded(house('small')) === false),
    JSON.stringify({ withReview, withoutReview, unknownNoSquare }));
  check('rev25-i', 1139, 'such a house is listed in the review queue, drawn in the review colour and explained on the map',
    /building\.klass === 'dwelling' && sizeVerdict\(building\) === 'no-square'/.test(main) &&
    /KLASS_STYLE\[noSquare \? 'review' : b\.klass\]/.test(main) && /noSquare \? `<br><b>Size:<\/b> \$\{NO_SQUARE_REASON\}`/.test(main));

  // Profiles and saved settings (Part 2 line 396; rev. 25 lines 1154-1159).
  const mb = SET.PROFILES['mishna-berura'], ci = SET.PROFILES['chazon-ish'], mech = SET.PROFILES.mechaber;
  const mechNow = SET.applyProfile({ ...SET.DEFAULTS }, 'mechaber');
  check('rev25-j', 398, 'profiles: Mishna Berurah and Chazon Ish use the square rule, Mechaber the area rule; choosing the other rule makes the profile Custom',
    mb.sizeRule === 'square' && ci.sizeRule === 'square' && mech.sizeRule === 'area' && SET.DEFAULTS.sizeRule === 'square' &&
    mechNow.sizeRule === 'area' && SET.effectiveProfile(mechNow) === 'mechaber' &&
    SET.effectiveProfile({ ...mechNow, sizeRule: 'square' }) === 'custom');
  const store = new Map();
  const fake = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  require('../js/settings.js').localStorage = fake;
  const loadWith = (saved) => { store.set('techum-settings-v1', JSON.stringify(saved)); return SET.load(); };
  // A save from before rev. 25: its profile's values and no size rule.
  const oldSave = (profile) => { const s = { ...SET.DEFAULTS, profile, ...SET.PROFILES[profile] }; delete s.sizeRule; return s; };
  const oldMech = loadWith({ ...oldSave('mechaber'), minSizeFilter: false });
  check('rev25-k', 1159, 'a save from before rev. 25 takes its own profile\'s rule: an unchanged Mechaber save moves to the area rule and still shows as Mechaber; Mishna Berurah and Chazon Ish saves get the square rule; the size filter switch keeps its saved value',
    oldMech.sizeRule === 'area' && SET.effectiveProfile(oldMech) === 'mechaber' && oldMech.minSizeFilter === false &&
    loadWith(oldSave('mishna-berura')).sizeRule === 'square' && loadWith(oldSave('chazon-ish')).sizeRule === 'square',
    JSON.stringify({ rule: oldMech.sizeRule, profile: SET.effectiveProfile(oldMech) }));
  check('rev25-l', 1161, 'a rule a user chose is kept: a Mechaber save with the square rule keeps it and shows as Custom',
    (() => { const l = loadWith({ ...oldSave('mechaber'), sizeRule: 'square' }); return l.sizeRule === 'square' && SET.effectiveProfile(l) === 'custom'; })());
  delete globalThis.localStorage;
  check('rev25-m', 1164, 'the app runs the engine\'s test with the amah and the rule, and an older snapshot\'s settings take its profile\'s rule when loaded',
    /function sizeVerdict[\s\S]{0,300}G\.dwellingSize\(b\.ring, settings\.amahCm \/ 100, settings\.sizeRule\)/.test(main) &&
    /settings = S\.normalize\(snap\.settings\)/.test(main) &&
    SET.normalize({ profile: 'mechaber', amahCm: 48 }).sizeRule === 'area' && SET.normalize({ profile: 'chazon-ish' }).sizeRule === 'square');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  check('rev25-n', 1156, 'the settings show the size rule with both choices, and the app wires it',
    /<select id="size-rule">[\s\S]*value="square"[\s\S]*value="area"/.test(html) &&
    /\$\('size-rule'\)\.value = settings\.sizeRule/.test(main) && /\$\('size-rule'\)\.addEventListener\('change'/.test(main));
}

// =================================================================================
// Rev. 26 — a pin in the street between a town's houses is in that town (§1.10a)
// =================================================================================
{
  // X: two rows of ten 10 m houses, 10 m apart: walls x [0, 190], y [0, 30]. 20 houses.
  // Y: an L of houses (a row at y [200, 210] from x -190 to 20, a column at x [-190, -180] from
  // y -100 up), so Y squares to x [-190, 20], y [-100, 210] and that square covers X's west end.
  // Y's nearest house is 170 m from X's (> 141⅓ amos = 67.84 m): two separate no-join towns.
  const X = [];
  for (let i = 0; i < 10; i++) X.push(box(i * 20, 0, i * 20 + 10, 10), box(i * 20, 20, i * 20 + 10, 30));
  const Y = [];
  for (let x = -190; x <= 10; x += 20) Y.push(box(x, 200, x + 10, 210));
  for (let y = -100; y <= 180; y += 20) Y.push(box(-190, y, -180, y + 10));
  const both = X.concat(Y);
  const homeHouses = (r) => (r.homeCluster >= 0 ? r.clusters[r.homeCluster].houseCount : 0);
  // Pin (15, 5): in the street between X's houses [0,10] and [20,30], 5 m from each, on no
  // footprint, and inside both towns' squares. X's own walls: techum x [0 - 960, 190 + 960].
  const street = run(both, {}, { x: 15, y: 5 });
  const st = span(street.techumCorners);
  check('rev26-a', 321, 'a pin in the street between a town\'s houses (5 m from them) is in that town, even where another town\'s square covers it: 20 houses, techum x [-960, 1150], y [-960, 990]',
    street.mode === 'city' && homeHouses(street) === 20 && !has(street, 'multiple-home-candidates') &&
    street.homeCandidates.length === 1 && sameSpan(st, { minX: -960, maxX: 1150, minY: -960, maxY: 990 }),
    JSON.stringify({ home: homeHouses(street), candidates: street.homeCandidates.length, st }));
  // Karpef on (MB): X's starting area is its walls + 33.92 m, the techum that + 960 m.
  const streetMb = run(both, { karpef: true }, { x: 15, y: 5 });
  check('rev26-b', 321, 'the same with the Rema karpef: techum x [-993.92, 1183.92], y [-993.92, 1023.92]',
    homeHouses(streetMb) === 20 && sameSpan(span(streetMb.techumCorners), { minX: -993.92, maxX: 1183.92, minY: -993.92, maxY: 1023.92 }),
    JSON.stringify(span(streetMb.techumCorners)));
  // Rev. 27 (review of rev. 26): the strip beside a town's outermost houses. Rev. 26 also gave X a pin
  // up to 16.96 m (half the 70⅔-amah gap) outside X's squared walls, in X's karpef, though Y's square
  // holds it too. Whether a person in that strip, which may be open field, rests in X is a question for
  // a rav (Part 7 Q20), so the common area of both towns stays, with a review note. X's walls are
  // x [0, 190], y [0, 30]; with the karpef (33.92 m) X's techum is x [-993.92, 1183.92],
  // y [-993.92, 1023.92] and Y's (walls x [-190, 20], y [-100, 210]) is x [-1183.92, 1013.92],
  // y [-1093.92, 1203.92]; the common area is x [-993.92, 1013.92], y [-993.92, 1023.92]. Pins 10 m and
  // 16.96 m above X's house [0,10]x[20,30] get it with the note; 16.97 m gets it without the note.
  const common = { minX: -993.92, maxX: 1013.92, minY: -993.92, maxY: 1023.92 };
  const strip = [40, 46.96].map((y) => run(both, { karpef: true }, { x: 5, y }));
  const beyond = run(both, { karpef: true }, { x: 5, y: 46.97 });
  check('rev27-d', 1276, 'a pin 10 m and 16.96 m outside a town\'s squared walls, in its karpef and in another town\'s square, gets the common area of both (x [-993.92, 1013.92], y [-993.92, 1023.92]) with a review note; 16.97 m gets it without the note',
    strip.every((r) => r.mode === 'city' && r.homeCandidates.length === 2 && has(r, 'multiple-home-candidates') &&
      has(r, 'pin-beside-town') && sameSpan(span(r.techumCorners), common)) &&
    beyond.homeCandidates.length === 2 && has(beyond, 'multiple-home-candidates') && !has(beyond, 'pin-beside-town') &&
    sameSpan(span(beyond.techumCorners), common),
    JSON.stringify({ strip: strip.map((r) => [r.homeCandidates.length, has(r, 'pin-beside-town'), span(r.techumCorners)]), beyond: beyond.homeCandidates.length }));
  // Inside X's walls the street rule stands: a pin at (5, 15), between X's two rows and 5 m from each.
  const between = run(both, { karpef: true }, { x: 5, y: 15 });
  check('rev27-d2', 1276, 'a pin in the street between a town\'s two rows, inside its squared walls, is in that town: 20 houses, techum x [-993.92, 1183.92]',
    homeHouses(between) === 20 && !has(between, 'pin-beside-town') && approx(span(between.techumCorners).maxX, 1183.92, 1e-6),
    JSON.stringify({ home: homeHouses(between) }));
  pend('rev27-q20', 1539, 'Is a person within half of 70⅔ amos of a town\'s outermost house, outside its squared walls but in its karpef, and inside another town\'s squared area, resting in the first town? The engine gives the common area of both and a review note.');
  // The rule only chooses among towns whose final starting area already holds the pin; it never
  // adds a town. Without karpef, a pin 5 m north of X's walls (y = 35) is outside X's square:
  // it rests in Y only, as before (rev. 12: membership follows the profile's starting area).
  const outside = run(both, {}, { x: 15, y: 35 });
  check('rev26-d', 316, 'without karpef, a pin 5 m outside the town\'s squared walls is not made a resident of it: it is in the other town\'s square only',
    outside.mode === 'city' && homeHouses(outside) === Y.length && sameSpan(span(outside.cityCorners), { minX: -190, maxX: 20, minY: -100, maxY: 210 }),
    JSON.stringify({ home: homeHouses(outside), city: span(outside.cityCorners) }));
}

// =================================================================================
// Rev. 26 — loading enough map data; one outline; a middle village wider than the gap
// =================================================================================
{
  // The app's widening loop (main.js calculate) on a made-up map. Each pass loads every building
  // whose centre is in the loaded box, runs the engine and adds the box dataFrontier asks for,
  // until it asks for nothing. The app has no pass limit; 40 here only keeps a bug from hanging.
  const proj = G.makeProjection(41, -74);
  const toDegrees = (b) => {
    const pts = [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]].map(([x, y]) => proj.toLatLon(x, y));
    return { south: Math.min(...pts.map((p) => p.lat)), north: Math.max(...pts.map((p) => p.lat)),
      west: Math.min(...pts.map((p) => p.lon)), east: Math.max(...pts.map((p) => p.lon)) };
  };
  const centreIn = (deg, b) => {
    const g = proj.toLatLon((b.bbox.minX + b.bbox.maxX) / 2, (b.bbox.minY + b.bbox.maxY) / 2);
    return g.lat >= deg.south && g.lat <= deg.north && g.lon >= deg.west && g.lon <= deg.east;
  };
  const widen = (world, pin, startM, settings) => {
    let loaded = toDegrees({ minX: pin.x - startM, maxX: pin.x + startM, minY: pin.y - startM, maxY: pin.y + startM });
    const passes = [];
    for (let pass = 1; pass <= 40; pass++) {
      const result = run(world.filter((b) => centreIn(loaded, b)), settings, pin);
      passes.push(result);
      const more = G.dataFrontier(result, proj, loaded, pin);
      if (!more) return { result, passes };
      loaded = { south: Math.min(loaded.south, more.south), north: Math.max(loaded.north, more.north),
        west: Math.min(loaded.west, more.west), east: Math.max(loaded.east, more.east) };
    }
    return { result: null, passes };
  };
  const homeOf = (r) => (r && r.homeCluster >= 0 ? r.clusters[r.homeCluster].houseCount : 0);
  const rect = (minX, minY, maxX, maxY) => [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];

  // An 8 km chain of 200 houses: house i is x [40i, 40i + 10], y [0, 10]; 30 m gaps (< 33.92 m)
  // make one town, walls x [0, 7970], techum x [-960, 8930], y [-960, 970]. Each widening reaches
  // about 2000 amos and 3 margins (1377 m) past the loaded town, so from the app's 1200 m start
  // the town needs more than the old limit of 4 widenings. From 190 m the first pass holds 5
  // houses, too few for a city, so rule 3 widens.
  const chain = [];
  for (let i = 0; i < 200; i++) chain.push(box(i * 40, 0, i * 40 + 10, 10));
  const chainRuns = [190, 1200, 3000].map((startM) => widen(chain, { x: 5, y: 5 }, startM));
  check('rev26-e', 1186, 'the result does not depend on where the search started: from 190, 1200 and 3000 m an 8 km chain ends as one 200-house town, techum x [-960, 8930], y [-960, 970]; from 1200 m it takes more than 4 widenings, and from 190 m the first pass has 5 houses',
    chainRuns.every(({ result }) => result && result.mode === 'city' && homeOf(result) === 200 &&
      sameSpan(span(result.techumCorners), { minX: -960, maxX: 8930, minY: -960, maxY: 970 })) &&
    chainRuns[1].passes.length - 1 > 4 && chainRuns[0].passes[0].mode === 'building' &&
    chainRuns[0].passes[0].clusters.some((cluster) => cluster.members.length === 5),
    JSON.stringify(chainRuns.map(({ result, passes }) => ({ home: homeOf(result), passes: passes.length }))));

  // Three villages (§1.4): A walls x [0, 50], y [0, 30]; C x [220, 270]; B x [110, 160], y [500, 530].
  // A and C are 170 m apart (> 67.84). B is 474 m from each (<= 960); lowered onto y = 15 it
  // leaves 60 m (<= 67.84) on each side, so all three are one town of 18 houses: walls x [0, 270],
  // y [0, 530], techum x [-960, 1230], y [-960, 1490]. From 200 m only A is loaded, and the old
  // look-ahead (141⅓ amos + 60 m past the town) stopped there with A's 6 houses.
  const villages = town(0, 0).concat(town(220, 0), town(110, 500));
  const villageRuns = [200, 600, 3000].map((startM) => widen(villages, { x: 5, y: 5 }, startM));
  const firstPass = villageRuns[0].passes[0], fp = span(firstPass.cityCorners), look = T2 + 60;
  const oldStopped = fp.minX - look >= -200 && fp.maxX + look <= 200 && fp.minY - look >= -200 && fp.maxY + look <= 200;
  check('rev26-f', 1188, 'a town joined by three villages to a village 474 m away is loaded whole from any start: 18 houses, walls x [0, 270], y [0, 530], techum x [-960, 1230], y [-960, 1490]; the old look-ahead stopped at 6 houses',
    villageRuns.every(({ result }) => result && homeOf(result) === 18 && has(result, 'three-villages') &&
      sameSpan(span(result.cityCorners), { minX: 0, maxX: 270, minY: 0, maxY: 530 }) &&
      sameSpan(span(result.techumCorners), { minX: -960, maxX: 1230, minY: -960, maxY: 1490 })) &&
    homeOf(firstPass) === 6 && oldStopped,
    JSON.stringify(villageRuns.map(({ result, passes }) => ({ home: homeOf(result), passes: passes.length }))));
  // The three villages above join in one step with no earlier join, so each three-villages note
  // records round 1; rule 2 (later rounds) does not apply to them.
  const villageJoins = villageRuns[2].result.warnings.filter((w) => w.type === 'three-villages');
  check('rev26-f2', 1189, 'each three-villages join records the round it was made in: the villages above join in round 1',
    villageJoins.length > 0 && villageJoins.every((w) => w.round === 1),
    JSON.stringify(villageJoins.map((w) => w.round)));

  // Rule 2, by hand on a result: home town of parts h, m, p, walls x [0, 950], y [0, 30]; p
  // (x [900, 950]) joined it by three villages. Loaded: x [-1500, 2500], y [-1500, 1500], which
  // holds the town's walls + 33.92 + 960 m with the 127.84 m margin. Town N, x [1800, 2600], is
  // 850 m from p (<= 960) and runs past the loaded edge, so the loader must reach past 2600 m by
  // at least the margin. Not for a first-round join, and not for a town 961 m from p.
  const handResult = (round, nMinX) => ({
    mode: 'city', homeCluster: 0, homeCandidates: [[0]], homeBuilding: -1,
    thresholds: { joinM: JOIN, t2: T2, techumM: TECHUM, karpefM: JOIN },
    clusters: [
      { members: [0], key: 'h', componentKeys: ['h', 'm', 'p'], qualifiesAsCity: true, corners: rect(0, 0, 950, 30) },
      { members: [1], key: 'n', componentKeys: ['n'], qualifiesAsCity: true, corners: rect(nMinX, 0, 2600, 30) },
    ],
    qualificationClusters: [{ key: 'h', corners: rect(0, 0, 50, 30) }, { key: 'm', corners: rect(450, 400, 500, 430) },
      { key: 'p', corners: rect(900, 0, 950, 30) }],
    techumRegions: [rect(-960, -960, 1910, 990)],
    warnings: [{ type: 'three-villages', round, middleComponentKeys: ['m'], outerComponentKeys: [['h'], ['p']] }],
  });
  const handLoaded = toDegrees({ minX: -1500, maxX: 2500, minY: -1500, maxY: 1500 });
  const later = G.dataFrontier(handResult(2, 1800), proj, handLoaded, { x: 5, y: 5 });
  const eastM = later && proj.toXY(41, later.east).x;
  check('rev26-g', 1189, 'a town 850 m from a part joined by three villages after an earlier join is loaded in full (the loader reaches 2600 m + 127.84 m or more); a first-round join, or a town 961 m away, asks for nothing',
    later && eastM >= 2600 + look && eastM <= 2600 + 3 * look * 1.02 &&
    G.dataFrontier(handResult(1, 1800), proj, handLoaded, { x: 5, y: 5 }) === null &&
    G.dataFrontier(handResult(2, 1911), proj, handLoaded, { x: 5, y: 5 }) === null,
    JSON.stringify({ eastM }));

  // Rev. 27: a town's three-villages partner can be two 2000-amah steps away. H, walls x [0, 50],
  // y [0, 30]; B, a chain of 59 houses x [110 + 40k, 120 + 40k], y [900, 910] (30 m gaps, < 33.92 m),
  // walls x [110, 2440]; C, walls x [2500, 2550], y [0, 30]. B is 872 m from H and from C (<= 960 m).
  // Lowered onto y = 15, B is 2330 m wide in a 2450 m gap and leaves 60 m (<= 67.84 m) on each side,
  // so H, B and C are one town of 6 + 59 + 6 = 71 houses, walls x [0, 2550], y [0, 910], techum (no
  // karpef) x [-960, 3510], y [-960, 1870]. From 1200 m, C is 1300 m outside the loaded area and the
  // rev. 26 rule stopped after one pass with H's 6 houses; from 3000 m it found all 71.
  const longB = town(0, 0);
  for (let k = 0; k <= 58; k++) longB.push(box(110 + 40 * k, 900, 120 + 40 * k, 910));
  longB.push(...town(2500, 0));
  const longRun = widen(longB, { x: 5, y: 5 }, 3000);
  const allSpan = (regions) => span(regions.flat());
  check('rev27-a', 1244, 'a middle village 872 m from the town whose far end is 872 m from a town 2.5 km away: from 3000 m one 71-house town, walls x [0, 2550], y [0, 910], techum x [-960, 3510], y [-960, 1870]',
    longRun.result && homeOf(longRun.result) === 71 && has(longRun.result, 'three-villages') &&
      sameSpan(allSpan(longRun.result.cityRegions), { minX: 0, maxX: 2550, minY: 0, maxY: 910 }) &&
      sameSpan(allSpan(longRun.result.techumRegions), { minX: -960, maxX: 3510, minY: -960, maxY: 1870 }),
    JSON.stringify({ home: homeOf(longRun.result), passes: longRun.passes.length }));
  pend('rev27-a2', 1251, 'Open (engineering, not halacha): from a 1200 m start the loader stops with the home town\'s 6 houses, because the far town is 1300 m outside the loaded area; the result is too small and depends on where the search started. Loading every possible partner two 2000-amah steps out fixes it but passes the 40,000-building limit around New Square and Monsey.');

  // One outline per layer (display only). Signed area: + counter-clockwise, - a hole.
  const area = (loop) => loop.reduce((sum, p, i) => { const q = loop[(i + 1) % loop.length]; return sum + p.x * q.y - q.x * p.y; }, 0) / 2;
  const sameCorners = (loop, expected) => loop.length === expected.length &&
    expected.every(([x, y]) => loop.some((p) => approx(p.x, x) && approx(p.y, y)));
  const turn = rotate(30), turned = (ring) => ring.map((p) => { const [x, y] = turn([p.x, p.y]); return { x, y }; });
  const Lcorners = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
  const Lshape = G.unionOutline([rect(0, 0, 10, 4), rect(0, 0, 4, 10)]);
  const Lturned = G.unionOutline([turned(rect(0, 0, 10, 4)), turned(rect(0, 0, 4, 10))]);
  const frame = G.unionOutline([rect(0, 0, 9, 3), rect(0, 6, 9, 9), rect(0, 0, 3, 9), rect(6, 0, 9, 9)]);
  const outer = frame.find((loop) => area(loop) > 0), hole = frame.find((loop) => area(loop) < 0);
  const diagonal = G.unionOutline([rect(0, 0, 1, 1), rect(1, 1, 2, 2)]);
  const triangle = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 5 }];
  const mixed = G.unionOutline([rect(0, 0, 2, 2), turned(rect(0, 0, 2, 2)), triangle]);
  check('rev26-h', 1228, 'one outline: an L of two overlapping rectangles has 6 corners and 64 m² (also turned 30°); a ring of four has a 9 × 9 outer edge (81 m²) and a 3 × 3 hole; corner-touching squares stay two; another direction and a triangle are drawn as they are',
    Lshape.length === 1 && sameCorners(Lshape[0], Lcorners) && approx(area(Lshape[0]), 64) &&
    Lturned.length === 1 && sameCorners(Lturned[0], Lcorners.map(turn)) && approx(area(Lturned[0]), 64) &&
    frame.length === 2 && sameCorners(outer, [[0, 0], [9, 0], [9, 9], [0, 9]]) && approx(area(outer), 81) &&
    sameCorners(hole, [[3, 3], [6, 3], [6, 6], [3, 6]]) && approx(area(hole), -9) &&
    diagonal.length === 2 && diagonal.every((loop) => loop.length === 4 && approx(area(loop), 1)) &&
    mixed.length === 3 && mixed.includes(triangle),
    JSON.stringify({ L: Lshape.map((l) => l.length), frame: frame.map(area), diagonal: diagonal.length, mixed: mixed.length }));
  // An unfilled U town (amah 1 cm, as in 1.6-b): its techum pieces overlap. The outline's area
  // equals their union's, summed strip by strip here, so it adds and removes nothing. Corners are
  // rounded to a micrometre, so on this ~700 m outline the areas agree to 0.001 m².
  const unionArea = (rings) => {
    const boxes = rings.map(span), xs = [...new Set(boxes.flatMap((b) => [b.minX, b.maxX]))].sort((a, b) => a - b);
    let total = 0;
    for (let i = 0; i + 1 < xs.length; i++) {
      const mid = (xs[i] + xs[i + 1]) / 2;
      let covered = 0, top = -Infinity;
      for (const [lo, hi] of boxes.filter((b) => b.minX < mid && b.maxX > mid).map((b) => [b.minY, b.maxY]).sort((a, b) => a[0] - b[0])) {
        if (hi > top) { covered += hi - Math.max(lo, top); top = hi; }
      }
      total += covered * (xs[i + 1] - xs[i]);
    }
    return total;
  };
  const uTown = [];
  for (let n = 0; n <= 10; n++) { uTown.push(house(0, n * 10), house(100, n * 10)); if (n > 0 && n < 10) uTown.push(house(n * 10, 0)); }
  const u = run(uTown, { amahM: 0.01, karpef: true }, { x: 0, y: 50 });
  const uLoops = G.unionOutline(u.techumRegions);
  const uArea = uLoops.reduce((sum, loop) => sum + area(loop), 0);
  check('rev26-h2', 1228, 'the outline of an unfilled bow town\'s overlapping techum pieces is one loop with their union\'s area (to 0.001 m²)',
    u.calculationStatus === 'provisional-no-fill' && u.techumRegions.length > 1 && uLoops.length === 1 &&
    approx(uArea, unionArea(u.techumRegions), 1e-3),
    JSON.stringify({ pieces: u.techumRegions.length, loops: uLoops.length, uArea, union: unionArea(u.techumRegions) }));

  // A middle village wider than the gap (Part 7 Q19). A: x [0, 50]; C: x [150, 200], 100 m apart.
  // B: two rows of 8 houses, x [25, 175], y [400, 430], 370 m from each. Lowered onto y = 15 it is
  // 150 m wide in a 100 m gap and overlaps each by 25 m: as §1.4 words the rule it does not fit, so
  // the home town is A alone (6 houses) and the case is listed for review. With 4 houses a row,
  // x [60, 130], B leaves 10 m and 20 m and fits: one town of 20 houses, walls x [0, 200], y [0, 430].
  const rows = (x0, n, y0) => {
    const out = [];
    for (let k = 0; k < n; k++) out.push(box(x0 + k * 20, y0, x0 + k * 20 + 10, y0 + 10), box(x0 + k * 20, y0 + 20, x0 + k * 20 + 10, y0 + 30));
    return out;
  };
  const wideB = run(town(0, 0).concat(town(150, 0), rows(25, 8, 400)), {}, { x: 5, y: 5 });
  const narrowB = run(town(0, 0).concat(town(150, 0), rows(60, 4, 400)), {}, { x: 5, y: 5 });
  const flag = wideB.warnings.find((w) => w.type === 'three-villages-wider-middle');
  const placed = flag && flag.projectedPlacementM;
  check('rev26-i', 1220, 'a middle village 150 m wide in a 100 m gap does not join (6 houses, walls x [0, 50]) and is flagged with gaps of -25 m; 70 m wide, it joins: 20 houses, walls x [0, 200], y [0, 430]',
    homeOf(wideB) === 6 && sameSpan(span(wideB.cityCorners), { minX: 0, maxX: 50, minY: 0, maxY: 30 }) &&
    !has(wideB, 'three-villages') && placed && approx(placed.outerGap, 100) && approx(placed.middleWidth, 150) &&
    approx(placed.leftGap, -25) && approx(placed.rightGap, -25) &&
    homeOf(narrowB) === 20 && has(narrowB, 'three-villages') && !has(narrowB, 'three-villages-wider-middle') &&
    sameSpan(span(narrowB.cityCorners), { minX: 0, maxX: 200, minY: 0, maxY: 430 }),
    JSON.stringify({ wide: homeOf(wideB), placed, narrow: homeOf(narrowB) }));
  pend('rev26-q19', 1530, 'Three villages: does a middle village wider than the gap between the outer two (or reaching over an outer village once lowered) still join them? The engine keeps the stricter reading and lists each case for review.');

  // The app: no widening limit, the incomplete answer, the dashed line, one outline, the review note.
  const appMain = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const appDesign = fs.readFileSync(path.join(__dirname, '..', 'js', 'design-experience.js'), 'utf8');
  check('rev26-j', 1195, 'the app widens until dataFrontier asks for nothing, with only the building-count limit; when that is reached the answer says incomplete, larger or smaller, and draws the pink line dashed',
    /const needed = G\.dataFrontier\(state\.result, state\.proj, bbox, state\.proj\.toXY\(state\.pin\.lat, state\.pin\.lon\)\);\s*if \(!needed\) break;/.test(appMain) &&
    !/maxExpandIterations|neededExpansion/.test(appMain) && !('maxExpandIterations' in SET.DEFAULTS) &&
    /class="warn accuracy-status data-limit"><b>Incomplete: the map data ran out<\/b>/.test(appMain) &&
    /could be larger or smaller/.test(appMain) && !/inner \(machmir\) bound|is an inner bound/.test(appMain) &&
    /state\.dataCapHit \? \{ dashArray: '10 7' \} : \{\}/.test(appMain) &&
    /classList\.contains\('data-limit'\)/.test(appDesign) && /'This result is incomplete'/.test(appDesign));
  check('rev26-k', 1228, 'the map draws each layer\'s stepped regions as one outline with the even-odd fill; the provisional note and the wider-village review note are shown',
    /G\.unionOutline\(list\)/.test(appMain) && /fillRule: 'evenodd'/.test(appMain) &&
    /<div class="warn accuracy-status"><b>Provisional smaller boundary<\/b>/.test(appMain) &&
    /if \(w\.type === 'three-villages-wider-middle'\) \{[\s\S]{0,260}homeComponentKeys\.has\(key\)/.test(appMain));

  // A re-analysis of the loaded buildings (a changed setting or profile) runs main.js recompute
  // with the engine and calculate stubbed: when dataFrontier asks for more, a live result runs the
  // whole search again; a snapshot is marked incomplete and never refetched; a result that was
  // already stopped at the data limit stays marked; a result that needs nothing more is complete.
  const vmRecompute = require('node:vm');
  const recomputeSource = appMain.slice(appMain.indexOf('  async function recompute(skipRender) {'), appMain.indexOf('  function cornersToLatLngs(corners) {'));
  const replay = async ({ more, fromSnapshot = false, dataCapHit = false, fetchBBox = { south: 0, west: 0, north: 1, east: 1 } }) => {
    const calls = { calculate: 0, render: 0 };
    const ctx = {
      state: { pin: { lat: 41, lon: -74 }, proj: { toXY: () => ({ x: 0, y: 0 }) }, buildings: [], fetchBBox,
        fromSnapshot, dataCapHit, dataCapReason: dataCapHit ? 'buildings' : null, result: null },
      latestAnalysisId: 0, isIncluded: () => true, geometrySettings: () => ({}),
      runPipelineAsync: async () => ({ mode: 'city' }), G: { dataFrontier: () => more },
      calculate: () => { calls.calculate++; }, render: () => { calls.render++; }, setRetryVisible: () => {}, setStatus: () => {},
    };
    await vmRecompute.runInNewContext(`(${recomputeSource.trim()})()`, ctx);
    return { ...calls, dataCapHit: ctx.state.dataCapHit, reason: ctx.state.dataCapReason };
  };
  const wider = { south: -1, west: -1, north: 2, east: 2 };
  asyncChecks.push(Promise.all([replay({ more: wider }), replay({ more: wider, fromSnapshot: true }), replay({ more: wider, dataCapHit: true }), replay({ more: null, dataCapHit: true })])
    .then(([live, snapshot, capped, complete]) => {
      check('rev26-l', 1197, 'after a changed setting needs more map data, a live result searches again, a snapshot is marked incomplete without refetching, a result already at the data limit stays marked, and one needing nothing more is complete',
        live.calculate === 1 && live.render === 0 &&
        snapshot.calculate === 0 && snapshot.render === 1 && snapshot.dataCapHit === true && snapshot.reason === 'snapshot' &&
        capped.calculate === 0 && capped.render === 1 && capped.dataCapHit === true &&
        complete.calculate === 0 && complete.render === 1 && complete.dataCapHit === false,
        JSON.stringify({ live, snapshot, capped, complete }));
    }));
  // Rev. 27: a snapshot that does not say which area its buildings cover cannot be checked, so it is
  // marked incomplete (before, the check was skipped and its saved flag, often "complete", stood).
  asyncChecks.push(replay({ more: null, fromSnapshot: true, fetchBBox: null }).then((unknown) => {
    check('rev27-g', 1285, 'a snapshot with no recorded loaded area is marked incomplete and not refetched',
      unknown.calculate === 0 && unknown.render === 1 && unknown.dataCapHit === true && unknown.reason === 'snapshot-area-unknown',
      JSON.stringify(unknown));
  }));

  // Rev. 27: the comparison-amah line and the verified-dwellings line are separate results on the same
  // loaded buildings. A larger amah makes a larger town, so either can need map data the main result
  // did not load; it is then labelled incomplete on the map and in the answer, never drawn as finished.
  check('rev27-e', 1285, 'the comparison and verified-dwellings lines are checked with dataFrontier and labelled incomplete on the map and in the answer when the loaded data does not cover them',
    /const res2Incomplete = scenarioIncomplete\(res2\)/.test(appMain) && /const resVIncomplete = scenarioIncomplete\(resV\)/.test(appMain) &&
    /G\.dataFrontier\(scenario, state\.proj, state\.fetchBBox/.test(appMain) &&
    /Comparison line incomplete/.test(appMain) && /Verified-dwellings line incomplete/.test(appMain) &&
    /INCOMPLETE: needs map data that was not loaded/.test(appMain));
  // Rev. 27: a PNG caption names an incomplete result; the map's dashed line alone does not say why.
  const mapExport = require('../js/map-export.js');
  const plainCaption = mapExport.exportCaptionLines({ label: 'Town', profileLabel: 'Mishna Berurah', amahCm: 48 });
  const cutCaption = mapExport.exportCaptionLines({ label: 'Town', profileLabel: 'Mishna Berurah', amahCm: 48, incomplete: true });
  check('rev27-f', 1285, 'an exported PNG of an incomplete result says so in its caption; a complete one keeps its three lines',
    plainCaption.length === 3 && !plainCaption.some((line) => /INCOMPLETE/.test(line)) &&
    cutCaption.length === 4 && /^INCOMPLETE/.test(cutCaption[2]) && /incomplete: state\.dataCapHit/.test(appMain),
    JSON.stringify(cutCaption));
}

// =================================================================================
// §1.4 — ibur ha'ir: the 70⅔-amah chain
// =================================================================================
{
  const pair = (gap, amahM = RCN) => run([box(-10, 0, 0, 10), box(gap, 0, gap + 10, 10)], { amahM }, { x: -5, y: 5 }).clusters.length;
  check('1.4-a', 100, 'two houses exactly 70⅔ amos (33.92 m) apart join ("within")', pair(JOIN) === 1);
  check('1.4-b', 100, 'two houses 1 mm beyond 70⅔ amos stay separate', pair(JOIN + 0.001) === 2);
  check('1.4-c', 100, 'two houses 1 mm inside 70⅔ amos join', pair(JOIN - 0.001) === 1);
  check('1.4-d', 53, 'Chazon Ish: 40.704 m joins and 40.705 m does not', pair(40.704, CI) === 1 && pair(40.705, CI) === 2);

  // Line 118-119: buffer each footprint by half the gap (a round buffer), so corner-to-corner
  // distance is straight-line. Corner gap dx = dy = 23.5 -> 33.234 m joins; 24.5 -> 34.648 m does not.
  const diag = (d) => run([box(-10, -10, 0, 0), box(d, d, d + 10, d + 10)]).clusters.length;
  check('1.4-e', 124, 'diagonal corner gap is straight-line: 33.23 m joins', diag(23.5) === 1);
  check('1.4-f', 124, 'diagonal corner gap 34.65 m does not join, though each axis is only 24.5 m', diag(24.5) === 2);

  // Line 95-96: the chain runs on "even several days' walk long". 400 houses, 10 m wide,
  // 33.9 m gaps: 400·10 + 399·33.9 = 17,526 m (about 36,500 amos), one city.
  const chain = [];
  for (let i = 0; i < 400; i++) chain.push(box(i * 43.9, 0, i * 43.9 + 10, 10));
  const long = run(chain, {}, { x: 5, y: 5 });
  check('1.4-g', 102, 'a 17.5 km chain with every gap under 70⅔ amos is one city', long.clusters.length === 1 &&
    long.mode === 'city' && approx(span(long.cityCorners).w, 399 * 43.9 + 10, 1e-6), `clusters=${long.clusters.length}`);
  check('2-nocap', 366, 'no halachic maximum size: the 17.5 km city is not capped', approx(span(long.techumCorners).w, 399 * 43.9 + 10 + 2 * TECHUM, 1e-6));

  // Line 99-100: a lone house joins anything only within a single 70⅔.
  const lone = (gap) => run(town(0, 0).concat(box(50 + gap, 0, 60 + gap, 10)), {}, { x: 5, y: 5 }).clusters.length;
  check('1.4-h', 106, 'a lone house exactly 70⅔ amos from a city joins it', lone(JOIN) === 1);
  check('1.4-i', 106, 'a lone house 33.93 m away does not join', lone(JOIN + 0.01) === 2);
  check('1.4-j', 106, 'a lone house 67 m away (inside 141⅓ but outside 70⅔) does not join', lone(67) === 2);
}

// =================================================================================
// §1.4 / §1.6.3 / §1.9a — the 141⅓-amah settlement merge and full-width breaks
// =================================================================================
{
  const two = (gap, settings) => run(town(0, 0).concat(town(50 + gap, 0)), settings, { x: 5, y: 5 });
  check('1.4-k', 104, 'two cities exactly 141⅓ amos (67.84 m) apart merge', two(T2).clusters.length === 1);
  check('1.4-l', 104, 'two cities 1 mm beyond 141⅓ amos stay separate', two(T2 + 0.001).clusters.length === 2);
  check('1.4-m', 104, 'merged pair is squared as one city: 50 + 67.84 + 50 = 167.84 m wide', approx(span(two(T2).cityCorners).w, 167.84, 1e-6));
  // §1.6.3 line 237: the 141⅓ allowance is always applied, in every profile.
  check('1.6-c', 243, '141⅓ merge is the same with karpef on (MB) and off (Mechaber)',
    two(60, { karpef: true }).clusters.length === 1 && two(60, { karpef: false, bowPolicy: 'mechaber-curve' }).clusters.length === 1 &&
    two(T2 + 0.001, { karpef: true }).clusters.length === 2);
  // Rev 2 line 354-357: the 141⅓ merge is a city-level rule; a 3-house hamlet joins only within 70⅔.
  const hamlet = [box(100, 0, 110, 10), box(120, 0, 130, 10), box(100, 20, 110, 30)]; // 50 m from the town
  check('2-hamlet', 361, 'a city and a 3-house hamlet 50 m apart do not merge', run(town(0, 0).concat(hamlet), {}, { x: 5, y: 5 }).clusters.length === 2);
  // §1.9a line 288-294: a full-width strip wider than 141⅓ divides; a qualifying house bridging it within 70⅔ does not.
  const strip = town(0, 0).concat(town(120, 0)); // 70 m empty strip (a river)
  check('1.9a-a', 294, 'a 70 m empty strip (a river) across the whole settlement divides it', run(strip, {}, { x: 5, y: 5 }).clusters.length === 2);
  const bridged = run(strip.concat(box(80, 10, 90, 20)), {}, { x: 5, y: 5 });
  check('1.9a-b', 298, 'a house in the strip 30 m from each side bridges it: one city', bridged.clusters.length === 1);
  const divided = run(strip, {}, { x: 5, y: 5 });
  check('1.9-a', 282, 'an empty strip (water) adds nothing to the city: the western city\'s ribua ends at its own east wall (x = 50)',
    approx(span(divided.cityCorners).maxX, 50, 1e-9));
}

// =================================================================================
// §1.4 — three villages (SA HaRav 398:12; rev 14)
// =================================================================================
{
  // Outer A walls x [-50, 0], outer C walls start at x = c0; middle B is 300 m north so that
  // no 141⅓ merge applies. The lowering axis is the line through the outer bbox centers (y = 15).
  const triple = (bMinX, bWidth, c0, bY = 300, extra) => {
    const A = town(-50, 0), C = town(c0, 0), B = [];
    for (let x = bMinX; x + 10 <= bMinX + bWidth + 1e-9; x += 20) B.push(box(x, bY, x + 10, bY + 10), box(x, bY + 20, x + 10, bY + 30));
    // make the last house end exactly at bMinX + bWidth
    B.push(box(bMinX + bWidth - 10, bY, bMinX + bWidth, bY + 10));
    return run(A.concat(C, B, extra || []), {}, { x: -45, y: 5 });
  };
  // Left projected gap exactly 141⅓ amos, right gap 10 m.
  const exact = triple(T2, 50, T2 + 50 + 10);
  check('1.4-n', 110, 'middle village leaving exactly 141⅓ amos to an outer village: all three merge',
    exact.clusters.length === 1 && has(exact, 'three-villages'), `clusters=${exact.clusters.length}`);
  const over = triple(T2 + 0.01, 50, T2 + 0.01 + 50 + 10);
  check('1.4-o', 110, 'leaving 141⅓ amos + 1 cm on one side: no merge', over.clusters.length === 3 && !has(over, 'three-villages'));
  // Middle village wider than the outer gap overlaps an outer village's projection: it does not "fit".
  const wide = triple(-20, 170, 130);
  check('1.4-p', 109, 'a middle village that does not fit inside the projected outer gap does not merge them',
    !has(wide, 'three-villages'), `clusters=${wide.clusters.length}`);
  // Line 102: the middle village within 2000 amos of each outer, "equality included". The
  // geometry.test.js equality case is a diagonal whose rounding lands just inside 960 m, so a
  // strict "<" passed it too. Here the distance is exactly 960 m, straight north: A walls
  // x [-50,0], C walls x [70,120] (70 m apart, too far to merge directly), and B (x [0,70],
  // y [990,1020]) fills the 70 m outer gap, leaving 0 m on each side (rev. 21).
  {
    const A = town(-50, 0), C = town(70, 0), B = [];
    for (const x of [0, 30, 60]) B.push(box(x, 990, x + 10, 1000), box(x, 1010, x + 10, 1020));
    const r = run(A.concat(C, B), {}, { x: -45, y: 5 });
    check('1.4-q2', 108, 'middle village exactly 2000 amos (960 m) from each outer village: all three merge',
      has(r, 'three-villages') && r.clusters.length === 1, `clusters=${r.clusters.length}`);
  }
  // Here B is 2000 amos + 1 cm from both outers (corner-to-corner).
  {
    const A = town(-50, 0), C = town(130, 0); // outer gap 130, B 50 wide leaves 40 each side
    const v = Math.sqrt(TECHUM * TECHUM - 40 * 40) + 0.01; // just beyond 960 m from each corner
    const B = town(40, 30 + v);
    const r = run(A.concat(C, B), {}, { x: -45, y: 5 });
    check('1.4-q', 108, 'middle village 2000 amos + 1 cm from each outer village: no merge', !has(r, 'three-villages') && r.clusters.length === 3);
  }
  // Part 2 table line 386 / rev 2 line 354: three villages is a city-level rule.
  {
    const A = town(-50, 0), C = town(130, 0), hamlet = [box(40, 300, 50, 310), box(60, 300, 70, 310), box(80, 300, 90, 310)];
    check('2-three-hamlet', 394, 'a 3-house middle hamlet cannot be the middle village', !has(run(A.concat(C, hamlet), {}, { x: -45, y: 5 }), 'three-villages'));
    const smallOuter = [box(130, 0, 140, 10), box(150, 0, 160, 10)];
    check('2-three-outer', 394, 'a 2-house outer hamlet cannot be an outer village', !has(run(A.concat(smallOuter, town(40, 300)), {}, { x: -45, y: 5 }), 'three-villages'));
  }
}

// =================================================================================
// §1.4 / rev 14 — city status (provisional six-footprint proxy and reviewer basis)
// =================================================================================
{
  const five = town(0, 0).slice(0, 5), six = town(0, 0);
  check('1.4-r', 121, 'five footprints are not a city: the pin\'s house uses building mode', run(five, {}, { x: 5, y: 5 }).mode === 'building');
  check('1.4-s', 121, 'six footprints are a provisional city, labelled provisional',
    (() => { const r = run(six, {}, { x: 5, y: 5 }); return r.mode === 'city' && r.clusters[0].qualificationProvisional === true &&
      r.clusters[0].qualificationSource === 'provisional-six-footprint-proxy'; })());
  const oneExcluded = town(0, 0); oneExcluded[5] = { ...oneExcluded[5], included: false };
  check('1.4-t', 130, 'an excluded footprint does not count toward the six', run(oneExcluded, {}, { x: 5, y: 5 }).mode === 'building');
  check('2-six-all', 394, 'every profile uses the same six-footprint fallback',
    Object.values(SET.PROFILES).every((p) => p.minCityHouses === 6));
  const base = run(five, {}, { x: 5, y: 5 });
  const fifty = run(five, { cityQualificationOverrides: { [base.qualificationClusters[0].key]: { decision: true, basis: 'fifty-residents', evidence: 'census 2026', memberIds: base.qualificationClusters[0].memberIds } } }, { x: 5, y: 5 });
  check('1.4-u', 122, 'a reviewer\'s 50-resident basis makes five footprints a city and is kept in the audit',
    fifty.mode === 'city' && fifty.qualificationClusters[0].qualificationBasis === 'fifty-residents' &&
    fifty.qualificationClusters[0].qualificationEvidence === 'census 2026' && fifty.qualificationClusters[0].qualificationProvisional === false);
}

// =================================================================================
// §1.4 lines 121-125 / rev 11 — lone (sub-city) building shevisa
// =================================================================================
{
  const lone = [box(0, 0, 10, 10)];
  const k = run(lone, { karpef: true }, { x: 5, y: 5 });
  const t = span(k.techumCorners);
  check('1.4-v', 129, 'a lone building gets no city karpef even with karpef on: techum = walls ± 960 m exactly',
    k.mode === 'building' && k.karpefRegions.length === 0 && approx(t.minX, -960, 1e-9) && approx(t.maxX, 970, 1e-9) &&
    approx(t.minY, -960, 1e-9) && approx(t.maxY, 970, 1e-9), JSON.stringify(t));
  check('1.4-w', 128, 'a pin exactly on the house wall counts as resting in it', run(lone, {}, { x: 10, y: 5 }).mode === 'building');
  const yard = [box(0, 0, 40, 40, { joinOnly: true })];
  check('rev13-a', 685, 'a validated yard alone is join geometry, not a house: a pin in it stays in point mode', run(yard, {}, { x: 20, y: 20 }).mode === 'point');
  // A rotated rectangular footprint is already squared in its own orientation (§1.5 line 155).
  const rot = polygonHouse([[0, 0], [20, 0], [20, 10], [0, 10]].map(rotate(30)));
  const rr = run([rot], {}, rotate(30)([10, 5]).reduce((p, v, i) => (i ? { ...p, y: v } : { x: v }), {}));
  const rc = rr.techumCorners, side = Math.hypot(rc[1].x - rc[0].x, rc[1].y - rc[0].y), side2 = Math.hypot(rc[2].x - rc[1].x, rc[2].y - rc[1].y);
  check('1.4-x', 129, 'a 20 × 10 m house turned 30° is measured from its own walls: techum 1940 × 1930 m',
    rr.mode === 'building' && approx(Math.max(side, side2), 1940, 1e-6) && approx(Math.min(side, side2), 1930, 1e-6), `${side} ${side2}`);
  check('1.4-y', 130, 'building mode always warns that the walls and dwelling status need confirming', has(k, 'building-mode'));
}

// =================================================================================
// §1.5 — ribua (squaring)
// =================================================================================
{
  const sq = G._internals.deriveSquaring;
  const pts = (arr) => arr.map(([x, y]) => ({ x, y }));
  // Step 3 (line 197): preserve the minimum-area rectangle only when the hull fills >= 94% of it.
  // A 40 × 30 rectangle with all four corners cut by 6 m legs: area 1200 − 4·18 = 1128 = 94.0% exactly.
  const chamfer = (w, h, c) => [[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]];
  const at94 = sq(pts(chamfer(40, 30, 6)));
  check('1.5-a', 203, 'convex hull filling exactly 94% keeps the rectangle (equality is enough)',
    at94.method === 'preserved-rectangle' && approx(at94.rectangularity, 0.94, 1e-12), JSON.stringify(at94));
  const below = sq(pts(chamfer(40, 30, 6.01)));
  check('1.5-b', 203, 'a hull filling 93.99% falls back to world directions', below.method === 'world-aligned', below.method);
  // The same shapes turned 30°: 95% keeps 30°, 92% squares to the compass bounding box.
  const r30 = (arr) => pts(arr.map(rotate(30)));
  const keep = sq(r30(chamfer(40, 30, Math.sqrt(30))));   // 1 − 60/1200 = 95%
  check('1.5-c', 140, 'a 95%-rectangular town turned 30° keeps its own 30° orientation',
    keep.method === 'preserved-rectangle' && approx(Math.abs(keep.angleRad * 180 / Math.PI), 30, 1e-6), JSON.stringify(keep));
  const drop = sq(r30(chamfer(40, 30, Math.sqrt(48))));   // 1 − 96/1200 = 92%
  check('1.5-d', 142, 'a 92%-rectangular town turned 30° is squared to the compass', drop.method === 'world-aligned' && drop.angleRad === 0);

  // Line 157: trapezoid -> short side extended to match the long side, along the parallel pair.
  const trap = (deltaDeg) => {
    const t = Math.tan(deltaDeg * Math.PI / 180);
    return pts([[-100, -50], [100, -50], [60, 50], [-60, 50 + 120 * t]].map(rotate(25)));
  };
  const exactTrap = sq(trap(0));
  check('1.5-e', 163, 'a trapezoid turned 25° is squared on its own axis to long side × height = 200 × 100 m',
    exactTrap.method === 'trapezoid-extended' && approx(exactTrap.rect.maxX - exactTrap.rect.minX, 200, 1e-6) &&
    approx(exactTrap.rect.maxY - exactTrap.rect.minY, 100, 1e-6), JSON.stringify(exactTrap.rect));
  check('1.5-f', 204, 'sides 0.9° off parallel are still a trapezoid (1° classifier)', sq(trap(0.9)).method === 'trapezoid-extended');
  check('1.5-g', 204, 'sides 1.1° off parallel are an irregular shape: world directions', sq(trap(1.1)).method === 'world-aligned');

  // Step 3 (line 199): "everything else uses true world directions". Line 151 alone does not
  // decide this triangle, because it has a right angle (line 146 leaves that to a rav).
  const tri = sq(pts([[0, 0], [300, 0], [0, 200]].map(rotate(20))));
  check('1.5-h', 205, 'a right-angled triangular town turned 20° is squared to the compass bounding box by default', tri.method === 'world-aligned' && tri.angleRad === 0);

  // Line 158-159 + step 4: one jutting house pulls its whole side out.
  const houses = town(0, 0);
  for (let y = 40; y <= 400; y += 40) houses.push(box(20, y, 30, y + 10)); // a street running north to y = 410
  const r = run(houses, {}, { x: 5, y: 5 });
  const c = span(r.cityCorners);
  check('1.5-i', 164, 'a single street jutting north moves the entire north side to its last wall (y = 410)',
    approx(c.maxY, 410, 1e-9) && approx(c.minX, 0, 1e-9) && approx(c.maxX, 50, 1e-9), JSON.stringify(c));
}

// =================================================================================
// §1.5 step 5 / rev 16-17 — bows, L shapes and their endpoints
// =================================================================================
{
  // U-shaped city whose mouth (house-to-house) is exactly 4000 amos: equality is in the >= branch.
  const uCity = (mouth, depth) => {
    const out = [], rightX = 10 + mouth, steps = Math.ceil(depth / 30);
    for (let k = 0; k <= steps; k++) { out.push(house(0, (depth * k) / steps)); out.push(house(rightX, (depth * k) / steps)); }
    for (let x = 30; x < rightX - 5; x += 30) out.push(house(x, 0));
    return out;
  };
  const bows = (r) => r.concavityAudit.filter((a) => a.shapeKind === 'bow');
  const eq = run(uCity(BOW, 2083 * RCN));
  check('1.5-j', 214, 'a bow whose mouth is exactly 4000 amos is not filled (equality belongs to >=)',
    bows(eq).length === 1 && eq.calculationStatus === 'provisional-no-fill', `bows=${bows(eq).length}`);

  // Reviewer endpoints with a chord of exactly 4000 amos (tiny amah: 4000 amos = 40 m, 2000 = 20 m).
  const tiny = 0.01, bowT = 40;
  const shallow = [];
  for (let n = 0; n <= 10; n++) shallow.push(house(n * 10, 0));
  shallow.push(house(0, 10), house(100, 10));
  const draft = run(shallow, { amahM: tiny });
  const key = bows(draft)[0] && bows(draft)[0].reviewKey;
  const withChord = (chord, bowPolicy) => run(shallow, { amahM: tiny, bowPolicy,
    concavityReviews: { [key]: { endpoints: [{ x: 0, y: 15 }, { x: chord, y: 15 }] } } });
  const status = (r) => bows(r)[0] && bows(r)[0].reviewStatus;
  check('1.5-k', 168, 'Mechaber: a reviewed chord of exactly 4000 amos is not filled', status(withChord(bowT, 'mechaber-curve')) === 'reviewed-no-fill-applied', status(withChord(bowT, 'mechaber-curve')));
  check('1.5-l', 168, 'Mechaber: a reviewed chord just under 4000 amos is filled', status(withChord(bowT - 1e-6, 'mechaber-curve')) === 'reviewed-fill-applied');
  const filled = withChord(bowT - 1e-6, 'mechaber-curve');
  check('1.5-m', 168, 'a filled bow leaves one starting region covering the whole squared city (walls x -5 to 105)',
    filled.cityRegions.length === 1 && approx(span(filled.cityRegions[0]).w, 110, 1e-6), JSON.stringify(span(filled.cityRegions[0])));
  check('1.5-n', 169, 'Rema: the same 4000-amah chord fills because the pocket is under 2000 amos deep', status(withChord(bowT, 'rema-majority')) === 'reviewed-fill-applied');

  // The Rashba/Ritva exigency setting (line 167, 210) fills a confirmed wide, deep bow.
  const deep = [];
  for (let n = 0; n <= 10; n++) { deep.push(house(0, n * 10), house(100, n * 10)); if (n > 0 && n < 10) deep.push(house(n * 10, 0)); }
  const deepDraft = run(deep, { amahM: tiny }, { x: 0, y: 50 });
  const deepKey = bows(deepDraft)[0].reviewKey;
  const ends = { [deepKey]: { endpoints: [{ x: 0, y: 100 }, { x: 100, y: 100 }] } };
  const emergency = run(deep, { amahM: tiny, bowPolicy: 'emergency-fill', concavityReviews: ends }, { x: 0, y: 50 });
  check('1.5-o', 216, 'the exigency setting fills a reviewed 4000+ wide, 2000+ deep bow', status(emergency) === 'reviewed-fill-applied' && emergency.cityRegions.length === 1);
  check('1.5-p', 212, 'without reviewer endpoints even the exigency setting stays provisional no-fill',
    run(deep, { amahM: tiny, bowPolicy: 'emergency-fill' }, { x: 0, y: 50 }).calculationStatus === 'provisional-no-fill');

  // Line 207-208: Rema fills when the chord is < 4000 OR the depth is < 2000; "equality belongs
  // to the >= branch" for both. 1.5-n alone cannot tell "<" from "<=" (rev. 21).
  const deepChord = run(deep, { amahM: tiny, concavityReviews: { [deepKey]: { endpoints: [{ x: 0, y: 100 }, { x: bowT, y: 100 }] } } }, { x: 0, y: 50 });
  check('1.5-n2', 214, 'Rema: a reviewed chord of exactly 4000 amos over a pocket 9500 amos deep stays unfilled',
    status(deepChord) === 'reviewed-no-fill-applied', status(deepChord));
  // Bottom houses' walls end at y = 5; the arms end at y = 25: the pocket is exactly 20 m
  // (2000 amos) deep under a 100 m (10,000-amah) chord along y = 25.
  const twoThousand = [];
  for (let n = 0; n <= 10; n++) twoThousand.push(house(n * 10, 0));
  twoThousand.push(house(0, 10), house(0, 20), house(100, 10), house(100, 20));
  const ttDraft = run(twoThousand, { amahM: tiny });
  const ttKey = bows(ttDraft)[0] && bows(ttDraft)[0].reviewKey;
  const tt = run(twoThousand, { amahM: tiny, concavityReviews: { [ttKey]: { endpoints: [{ x: 0, y: 25 }, { x: 100, y: 25 }] } } });
  check('1.5-n3', 214, 'Rema: a reviewed pocket exactly 2000 amos deep under a wide chord stays unfilled',
    status(tt) === 'reviewed-no-fill-applied' && approx(bows(tt)[0].depthM, 20, 1e-9),
    JSON.stringify({ status: status(tt), depth: bows(tt)[0] && bows(tt)[0].depthM }));

  // §1.10a lines 310-313: a pin is in a city only inside its FINAL starting area. The empty
  // middle of an unfilled pocket is not part of it, though it lies inside the squared
  // rectangle (rev. 21). Before rev. 21 this pin was called a resident and its drawn techum
  // did not even reach it.
  const pocketPin = run(deep, { amahM: tiny, karpef: true }, { x: 50, y: 70 });
  check('1.10a-l', 316, 'a pin in the empty middle of an unfilled bow pocket rests outside the city: 4004-amah square, pocket review still shown',
    pocketPin.mode === 'point' && has(pocketPin, 'pin-in-excluded-pocket') && has(pocketPin, 'large-concavity') &&
    pocketPin.calculationStatus === 'provisional-no-fill' && approx(span(pocketPin.techumCorners).w, 4004 * tiny, 1e-9),
    JSON.stringify({ mode: pocketPin.mode, w: pocketPin.techumCorners && span(pocketPin.techumCorners).w }));
  const pocketFilled = run(deep, { amahM: tiny, karpef: true, bowPolicy: 'emergency-fill', concavityReviews: ends }, { x: 50, y: 70 });
  check('1.10a-m', 316, 'once a reviewer fills that pocket, the same pin is a resident', pocketFilled.mode === 'city' && !has(pocketFilled, 'pin-in-excluded-pocket'));
  const nearWall = run(deep, { amahM: tiny, karpef: true }, { x: 5.5, y: 50 }); // 0.5 m from the arm, karpef 0.71 m
  check('1.10a-n', 318, 'a pin in the pocket but inside the Rema karpef of its houses is still a resident', nearWall.mode === 'city' && !has(nearWall, 'pin-in-excluded-pocket'));

  // Step 7 + §1.6.2: one karpef and then 2000 amos around EVERY region of a multi-region result.
  const multi = run(deep, { amahM: tiny, karpef: true }, { x: 0, y: 50 });
  const k = (70 + 2 / 3) * tiny, t = 2000 * tiny;
  const ok = multi.cityRegions.length > 1 && multi.cityRegions.length === multi.karpefRegions.length &&
    multi.cityRegions.every((ring, i) => { const c = span(ring), kk = span(multi.karpefRegions[i]), tt = span(multi.techumRegions[i]);
      return approx(kk.minX, c.minX - k) && approx(kk.maxY, c.maxY + k) && approx(tt.minX, c.minX - k - t) && approx(tt.maxY, c.maxY + k + t); });
  check('1.6-b', 239, 'a no-fill result keeps separate regions; each gets one karpef then 2000 amos', ok, `regions=${multi.cityRegions.length}`);
}

// =================================================================================
// §1.9a — wholly enclosed holes
// =================================================================================
{
  const tiny = 0.01; // 4000 amos = 40 m
  const ringTown = (w, h) => {
    const out = [];
    for (let x = 0; x <= w; x += 10) out.push(house(x, 0), house(x, h));
    for (let y = 10; y < h; y += 10) out.push(house(0, y), house(w, y));
    return out;
  };
  // Inner void of a 100 × 40 ring: x 5-95 (90 m), y 5-35 (30 m). 30 m < 40 m in one axis.
  const narrow = run(ringTown(100, 40), { amahM: tiny }, { x: 0, y: 0 });
  check('1.9a-c', 306, 'a hole reaching 4000 amos in only one axis gets no hole warning', !has(narrow, 'large-interior-hole'));
  // Inner void of a 100 × 50 ring: 90 × 40 m: exactly 4000 amos in the short axis reaches the threshold.
  const reach = run(ringTown(100, 50), { amahM: tiny }, { x: 0, y: 0 });
  check('1.9a-d', 305, 'a hole of 9000 × exactly 4000 amos triggers the mandatory review warning but stays included',
    has(reach, 'large-interior-hole') && reach.cityRegions.length === 1, JSON.stringify(reach.warnings.map((w) => w.type)));
  check('2-hole', 396, 'every profile includes a large hole by default',
    Object.values(SET.PROFILES).every((p) => p.largeHolePolicy === 'include-with-warning'));
}

// =================================================================================
// §1.5 step 6 / rev 13 — overlap policies; karpef never feeds back into a join
// =================================================================================
{
  const L = (x0, y0, len, corner) => {
    const out = [];
    for (let t = 0; t <= len; t += 30) {
      if (corner === 'bl') { out.push(house(x0, y0 + t)); if (t) out.push(house(x0 + t, y0)); }
      else { out.push(house(x0 + len, y0 + t)); if (t < len) out.push(house(x0 + t, y0 + len)); }
    }
    return out;
  };
  // P squares to [-5,395]², Q to [440,840]²: 45 m apart, so their 33.92 m karpefs overlap.
  const P = L(0, 0, 390, 'bl'), Q = L(445, 445, 390, 'tr');
  for (const overlapPolicy of ['join-no-redraw', 'join-redraw']) {
    const r = run(P.concat(Q), { karpef: true, overlapPolicy }, { x: 0, y: 0 });
    const t = span(r.techumCorners);
    check('1.5-q', 201, `${overlapPolicy}: overlapping karpefs do not join the two cities ("karpef never feeds backward")`,
      r.homeCandidates.length === 1 && r.homeCandidates[0].length === 1 && r.techumRegions.length === 1 &&
      approx(t.maxX, 395 + 33.92 + 960, 1e-6), JSON.stringify({ c: r.homeCandidates, t }));
  }
  // no-join: an overlapping city does not change the home city's own rectangle.
  const A = [];
  for (let i = 0; i <= 10; i++) A.push(house(i * 30, 0));
  for (let i = 0; i <= 10; i++) A.push(house(305, i * 30 - 5));
  const B = town(95, 145);
  const alone = run(A, {}, { x: 0, y: 0 }), both = run(A.concat(B), {}, { x: 0, y: 0 });
  check('1.5-r', 192, 'no-join: the home city keeps exactly its own rectangle and techum, with an overlap warning',
    regionSig(alone.techumRegions) === regionSig(both.techumRegions) && has(both, 'overlap-detected'));
  // §1.10a line 315: a pin in a house of the inner city B (inside A's rectangle) belongs to B only.
  const inB = run(A.concat(B), {}, { x: 100, y: 150 });
  check('1.10a-a', 321, 'a pin inside a house picks that house\'s city first, not the rectangle it sits in',
    inB.homeCandidates.length === 1 && !has(inB, 'multiple-home-candidates') &&
    sameSpan(span(inB.cityCorners), { minX: 95, maxX: 145, minY: 145, maxY: 175 }), JSON.stringify(span(inB.cityCorners)));
  check('2-overlap', 393, 'MB and Mechaber default to no join', SET.PROFILES['mishna-berura'].overlapPolicy === 'no-join' && SET.PROFILES.mechaber.overlapPolicy === 'no-join');
  // Rev. 19 pending 2-ci-overlap — answered in rev. 20 (lines 385, 901-910).
  const ci = SET.PROFILES['chazon-ish'];
  check('rev20-r', 393, 'the Chazon Ish profile defaults to no join, matching the table', ci.overlapPolicy === 'no-join');
  // A is an L of houses: walls x [-5,310], y [-10,300]; B (inside A's square) is 60+ m from every house of A.
  const ciS = { amahM: CI, karpef: ci.karpef, overlapPolicy: ci.overlapPolicy, bowPolicy: ci.bowPolicy, largeHolePolicy: ci.largeHolePolicy };
  const ciAlone = run(A, ciS, { x: 0, y: 0 }), ciBoth = run(A.concat(B), ciS, { x: 0, y: 0 });
  const ciEdge = 310 + 40.704 + 1152; // walls + 70⅔ and 2000 amos at 57.6 cm = 1502.704 m
  check('rev20-s', 911, 'Chazon Ish profile: an overlapping city leaves the home techum unchanged (x max 1502.704 m), with the overlap warning',
    regionSig(ciAlone.techumRegions) === regionSig(ciBoth.techumRegions) && has(ciBoth, 'overlap-detected') &&
    approx(span(ciBoth.techumCorners).maxX, ciEdge, 1e-6) && approx(ciEdge, 1502.704, 1e-3),
    JSON.stringify(span(ciBoth.techumCorners)));
  const ciRedraw = run(A.concat(B), { ...ciS, overlapPolicy: 'join-redraw' }, { x: 0, y: 0 });
  check('rev20-t', 917, 'joint redraw stays available as an explicit option', has(ciRedraw, 'overlap-merge-redraw'));
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  check('rev20-u', 917, 'the joint-redraw option and the Chazon Ish description say turning it on is a rav\'s decision',
    /value="join-redraw">[^<]*a rav's decision/.test(html) && /'chazon-ish':[^\n]*a rav\\'s decision/.test(mainJs));

  // A browser that saved the old Chazon Ish profile unchanged follows the new default once.
  const store = new Map();
  const fake = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  require('../js/settings.js').localStorage = fake;
  const oldCi = { ...SET.DEFAULTS, profile: 'chazon-ish', ...ci, overlapPolicy: 'join-redraw', dataSourceVersion: 2 };
  delete oldCi.profileRevision;
  const loadWith = (saved) => { store.set('techum-settings-v1', JSON.stringify(saved)); return SET.load(); };
  check('rev20-v', 919, 'saved old Chazon Ish profile, unchanged: loads with no join and still shows as the Chazon Ish profile',
    (() => { const l = loadWith(oldCi); return l.overlapPolicy === 'no-join' && SET.effectiveProfile(l) === 'chazon-ish' && l.profileRevision === 20; })());
  check('rev20-w', 920, 'saved custom Chazon Ish settings (karpef off) keep the joint redraw the user chose',
    loadWith({ ...oldCi, karpef: false }).overlapPolicy === 'join-redraw');
  check('rev20-x', 920, 'joint redraw chosen after rev. 20 is kept', loadWith({ ...oldCi, profileRevision: 20 }).overlapPolicy === 'join-redraw');
  // Before rev. 13 (2026-07-14) the profile stored a yes/no overlapMerge switch and had no bow
  // or hole setting; the Chazon Ish default was overlapMerge: true (rev. 21).
  const preRev13 = { profile: 'chazon-ish', amahCm: 57.6, karpef: true, squaringAngleDeg: 0, overlapMerge: true, minCityHouses: 6, dataSourceVersion: 2 };
  check('rev21-a', 948, 'an unchanged Chazon Ish profile saved before rev. 13 (old yes/no overlap switch) follows the new default too',
    (() => { const l = loadWith(preRev13); return l.overlapPolicy === 'no-join' && SET.effectiveProfile(l) === 'chazon-ish' && !('overlapMerge' in l); })());
  check('rev21-b', 948, 'the same old save with karpef turned off keeps the joint redraw the user had', loadWith({ ...preRev13, karpef: false }).overlapPolicy === 'join-redraw');
  check('rev21-c', 948, 'a save marked with any later revision is never switched again', loadWith({ ...oldCi, profileRevision: 21 }).overlapPolicy === 'join-redraw');
  delete globalThis.localStorage;
}

// =================================================================================
// §1.6 — karpef
// =================================================================================
{
  const city = town(0, 0); // walls x [0,50], y [0,30]
  const on = run(city, { karpef: true }, { x: 5, y: 5 }), off = run(city, { karpef: false }, { x: 5, y: 5 });
  const k = span(on.karpefCorners), t = span(on.techumCorners), t0 = span(off.techumCorners);
  check('1.6-a', 236, 'Rema karpef: 70⅔ amos beyond every wall, then 2000 amos beyond that (exact on all four sides)',
    sameSpan(k, { minX: -33.92, maxX: 83.92, minY: -33.92, maxY: 63.92 }) &&
    sameSpan(t, { minX: -993.92, maxX: 1043.92, minY: -993.92, maxY: 1023.92 }), JSON.stringify({ k, t }));
  check('1.6-d', 235, 'Mechaber (karpef off): 2000 amos straight from the walls, and no karpef region',
    off.karpefRegions.length === 0 && sameSpan(t0, { minX: -960, maxX: 1010, minY: -960, maxY: 990 }), JSON.stringify(t0));
  check('2-karpef', 391, 'karpef is on for MB and Chazon Ish, off for Mechaber',
    SET.PROFILES['mishna-berura'].karpef === true && SET.PROFILES['chazon-ish'].karpef === true && SET.PROFILES.mechaber.karpef === false);
  // A pin exactly on the karpef's outer edge rests inside it (MB), and is outside the city under Mechaber.
  check('1.10a-b', 316, 'a pin exactly on the karpef edge is a city resident with karpef on', run(city, { karpef: true }, { x: 83.92, y: 15 }).mode === 'city');
  check('1.10a-c', 319, 'the same pin is in point mode without karpef', run(city, { karpef: false }, { x: 83.92, y: 15 }).mode === 'point');
  check('1.10a-d', 317, 'a pin exactly on the squared city edge but not in a house is a resident', run(city, {}, { x: 50, y: 15 }).mode === 'city');
}

// =================================================================================
// §1.7 — square corners and the 4004-amah point square
// =================================================================================
{
  const r = run(town(0, 0), {}, { x: 5, y: 5 });
  check('1.7-a', 251, 'the techum is a 4-corner rectangle, not a rounded buffer', r.techumRegions.length === 1 && r.techumCorners.length === 4);
  const cityC = r.cityCorners, techC = r.techumCorners;
  const cornerReach = Math.min(...techC.map((p) => Math.min(...cityC.map((q) => Math.hypot(p.x - q.x, p.y - q.y)))));
  check('1.7-b', 250, 'each techum corner is 2000·√2 amos (1357.6 m) from the city corner', approx(cornerReach, 960 * Math.SQRT2, 1e-6), String(cornerReach));
  const pin = { x: 1234.5, y: -987.25 };
  const p = span(run([], {}, pin).techumCorners);
  check('1.7-c', 256, 'open field: 4004 × 4004 amos (1921.92 m) square centred on the pin',
    approx(p.w, 1921.92, 1e-9) && approx(p.h, 1921.92, 1e-9) && approx((p.minX + p.maxX) / 2, pin.x, 1e-9) && approx((p.minY + p.maxY) / 2, pin.y, 1e-9), JSON.stringify(p));
  const turned = span(run([], { pointRotationDeg: 45 }, pin).techumCorners);
  check('1.7-d', 257, 'turned 45° toward a destination, the square reaches 4004·√2/2 amos along each axis',
    approx(turned.w, 1921.92 * Math.SQRT2, 1e-6), String(turned.w));
}

// =================================================================================
// §1.8 — horizontal plan-view measurement, no automatic terrain factor
// =================================================================================
{
  const flat = town(0, 0);
  const hilly = flat.map((b, i) => ({ ...b, ring: b.ring.map((p) => ({ ...p, z: 100 * i })) }));
  check('1.8-a', 272, 'elevation on the footprints changes nothing (no automatic slope adjustment)',
    regionSig(run(flat, {}, { x: 5, y: 5 }).techumRegions) === regionSig(run(hilly, {}, { x: 5, y: 5 }).techumRegions));
}

// =================================================================================
// §1.10a — ir muvla'at: a whole city swallowed by the reach is flagged, never drawn
// =================================================================================
{
  const home = town(0, 0), small = town(400, 400); // walls [400,450]x[400,430]: wholly inside home's 960 m reach
  const withSmall = run(home.concat(small), {}, { x: 5, y: 5 }), homeOnly = run(home, {}, { x: 5, y: 5 });
  check('1.10a-e', 331, 'city mode: a city wholly inside the techum is flagged and the techum is not extended',
    has(withSmall, 'ir-muvlaas') && regionSig(withSmall.techumRegions) === regionSig(homeOnly.techumRegions));
  const straddle = run(home.concat(town(980, 0)), {}, { x: 5, y: 5 }); // reach ends at x = 1010, inside it
  check('1.10a-f', 329, 'a city the reach merely ends inside is not flagged as swallowed', !has(straddle, 'ir-muvlaas'));
  // Point mode: the person rests outside every city (line 321-332).
  const open = run(town(300, 300), {}, { x: 0, y: 0 });
  check('1.10a-g', 337, 'point mode: a city wholly inside the 2000-amah square is flagged as swallowed', open.mode === 'point' && has(open, 'ir-muvlaas'),
    JSON.stringify(open.warnings.map((w) => w.type)));
  check('1.10a-h', 338, 'point mode: the square itself is not extended (still 4004 amos)', approx(span(open.techumCorners).w, 1921.92, 1e-9));
  // The point square reaches 2 + 2000 amos = 960.96 m from the pin on each side.
  const edge = run(town(900, 0), {}, { x: 0, y: 0 }); // walls x [900,950], y [0,30]: inside
  const beyond = run(town(940, 0), {}, { x: 0, y: 0 }); // walls to x = 990: crosses the 960.96 m edge
  check('1.10a-i', 329, 'point mode: a city crossing the edge of the reach is not flagged', !has(beyond, 'ir-muvlaas') && has(edge, 'ir-muvlaas'));
  const fromHouse = run([box(-5, -5, 5, 5)].concat(town(300, 300)), {}, { x: 0, y: 0 });
  check('1.10a-j', 337, 'building mode: a city wholly inside the reach is flagged too', fromHouse.mode === 'building' && has(fromHouse, 'ir-muvlaas'));
  // Rev. 17 line 816: the point square ignores the reviewer's city-squaring angle, so the city
  // must be compared in the square's own (compass) frame. town(850, 850) turned 30° into the
  // engine's working frame would reach x' = 1219 m and look outside the 960.96 m square.
  const turned = run(town(850, 850), { squaringAngleDeg: 30 }, { x: 0, y: 0 });
  check('1.10a-k', 826, 'point mode with a 30° reviewer squaring angle: the square stays 4004 amos and a city inside it is still flagged',
    turned.mode === 'point' && has(turned, 'ir-muvlaas') && approx(span(turned.techumCorners).w, 1921.92, 1e-9),
    JSON.stringify(turned.warnings.map((w) => w.type)));
  // A city resident inside a rav-validated enclosure (line 1019) gets the same flag (rev. 21).
  const enclosure = [{ x: -10, y: -10 }, { x: 60, y: -10 }, { x: 60, y: 40 }, { x: -10, y: 40 }];
  const enclosed = run(home.concat(small), { validatedCityPerimeter: enclosure }, { x: 5, y: 5 });
  check('1.10a-o', 331, 'validated-enclosure city mode: another city wholly inside the techum is flagged too',
    enclosed.validatedPerimeterActive && has(enclosed, 'ir-muvlaas'), JSON.stringify(enclosed.warnings.map((w) => w.type)));
}

// =================================================================================
// Determinism and numeric robustness (rev 3 line 419; rev 17 line 773)
// =================================================================================
{
  const scene = town(0, 0).concat(town(50 + 60, 0), [box(200, 0, 210, 10), box(230, 0, 240, 10)], town(-50, 400), town(130, 400));
  const pin = { x: 5, y: 5 };
  const a = run(scene, { karpef: true }, pin);
  const shuffled = scene.map((b, i) => [((i * 7919) % 101), b]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const b = run(shuffled, { karpef: true }, pin);
  check('det-a', 429, 'same buildings in a different order give the same regions and warnings',
    regionSig(a.techumRegions) === regionSig(b.techumRegions) && regionSig(a.cityRegions) === regionSig(b.cityRegions) &&
    a.warnings.map((w) => w.type).sort().join() === b.warnings.map((w) => w.type).sort().join());
  // Translation by 500 km: thresholds still decided to the millimetre.
  const far = (dx, dy, gap) => run([box(dx - 10, dy, dx, dy + 10), box(dx + gap, dy, dx + gap + 10, dy + 10)], {}, { x: dx - 5, y: dy + 5 }).clusters.length;
  check('det-b', 100, 'far from the origin (500 km) a 1 mm-over gap still separates and 1 mm-under still joins',
    far(5e5, -3e5, JOIN + 0.001) === 2 && far(5e5, -3e5, JOIN - 0.001) === 1);
  // Projection: two houses at latitude 41 whose real gap is 33.91 m vs 33.93 m.
  const proj = G.makeProjection(41, -74);
  const mPerLon = 111412.84 * Math.cos(41 * Math.PI / 180) - 93.5 * Math.cos(123 * Math.PI / 180);
  const fromLon = (lon0, lon1, lat0, lat1) => { const ring = [proj.toXY(lat0, lon0), proj.toXY(lat0, lon1), proj.toXY(lat1, lon1), proj.toXY(lat1, lon0)]; return { id: `p${nextId++}`, ring, bbox: G._internals.bboxOfRing(ring), included: true }; };
  const dLat = 10 / proj.mPerDegLat, w = 10 / mPerLon;
  const projPair = (gapM) => run([fromLon(-74, -74 + w, 41, 41 + dLat), fromLon(-74 + w + gapM / mPerLon, -74 + 2 * w + gapM / mPerLon, 41, 41 + dLat)], {}, { x: 5, y: 5 }).clusters.length;
  check('det-c', 227, 'through the lat/lon projection, a 33.91 m gap joins and a 33.93 m gap does not', projPair(33.91) === 1 && projPair(33.93) === 2);
}

// =================================================================================
// Empty and tiny inputs
// =================================================================================
{
  const allOut = run(town(0, 0).map((b) => ({ ...b, included: false })), {}, { x: 5, y: 5 });
  check('tiny-a', 130, 'every footprint excluded: open-field point shevisa with no clusters', allOut.mode === 'point' && allOut.clusters.length === 0);
  const tri = run([polygonHouse([[0, 0], [12, 0], [0, 9]])], {}, { x: 2, y: 2 });
  check('tiny-b', 157, 'a lone triangular house is squared to its compass box (12 × 9 m)', tri.mode === 'building' &&
    approx(span(tri.cityCorners).w, 12, 1e-9) && approx(span(tri.cityCorners).h, 9, 1e-9));
  let threw = null;
  try { run([polygonHouse([[0, 0], [10, 0], [20, 0]])], {}, { x: 5, y: 0 }); } catch (e) { threw = e; }
  check('tiny-c', 61, 'a zero-area footprint does not crash the engine', threw === null, threw && threw.message);
}

// =================================================================================
// Part 2 — profile table
// =================================================================================
{
  const mb = SET.PROFILES['mishna-berura'], ci = SET.PROFILES['chazon-ish'], mech = SET.PROFILES.mechaber;
  check('2-amah', 390, 'amah: MB 48 cm, Chazon Ish 57.6 cm, Mechaber 48 cm', mb.amahCm === 48 && ci.amahCm === 57.6 && mech.amahCm === 48);
  check('2-squaring', 392, 'every profile uses the automatic shape rule (no fixed reviewer angle)',
    [mb, ci, mech].every((p) => p.squaringAngleDeg === 0));
  check('2-bow', 395, 'bow rule: MB and CI Rema-majority, Mechaber curved edge', mb.bowPolicy === 'rema-majority' && ci.bowPolicy === 'rema-majority' && mech.bowPolicy === 'mechaber-curve');
  check('2-default', 388, 'the default profile is Mishna Berurah', SET.DEFAULTS.profile === 'mishna-berura' && SET.DEFAULTS.karpef === true && SET.DEFAULTS.overlapPolicy === 'no-join');
  check('2-eruv', 400, 'eruv-as-city is off unless a rav-validated perimeter is supplied', SET.DEFAULTS.useValidatedPerimeter === false);
  check('2-12mil', 401, 'the 12-mil ring and second-shita line are hidden by default', SET.DEFAULTS.show12mil === false && SET.DEFAULTS.secondAmahCm === 0);
}

pend('7-q11', 1485, 'Citation only: §1.5 cites Minchas Yitzchak 8:32 for the joint redraw; other sources give 8:33.');
pend('7-q12', 1488, 'Citation only: §1.3 cites Chazon Ish 110:28 for counting factories with a lunch room; two secondary sources report him as not counting a factory (or only buildings with sleeping quarters).');

Promise.all(asyncChecks).catch((error) => { failed++; console.error('FAIL  an async check threw: ' + error.message); }).then(() => {
  console.log(`\n${passed} passed, ${failed} failed, ${pending.length} pending`);
  for (const p of pending) console.log('  PENDING ' + p);
  process.exit(failed ? 1 : 0);
});
