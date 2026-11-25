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
const SPEC_AMOS = { JOIN: 70 + 2 / 3, JOIN2: 141 + 1 / 3, KARPEF: 70 + 2 / 3, TECHUM: 2000, BOW: 4000, MIL12: 24000, PERSON: 4 };
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
  check('1.2-a', 43, 'R\' Chaim Naeh 48 cm: 70⅔ = 33.92 m, 141⅓ = 67.84 m, 2000 = 960 m, karpef = 33.92 m',
    approx(r.joinM, 33.92, 1e-9) && approx(r.t2, 67.84, 1e-9) && approx(r.techumM, 960, 1e-9) && approx(r.karpefM, 33.92, 1e-9), JSON.stringify(r));
  check('1.2-b', 45, 'Chazon Ish 57.6 cm: 70⅔ = 40.704 m, 141⅓ = 81.408 m, 2000 = 1,152 m',
    approx(c.joinM, 40.704, 1e-9) && approx(c.t2, 81.408, 1e-9) && approx(c.techumM, 1152, 1e-9), JSON.stringify(c));
  check('1.2-c', 44, 'R\' Moshe 54 cm: 70⅔ = 38.16 m, 141⅓ = 76.32 m, 2000 = 1,080 m',
    approx(m.joinM, 38.16, 1e-9) && approx(m.t2, 76.32, 1e-9) && approx(m.techumM, 1080, 1e-9), JSON.stringify(m));
  check('1.2-f', 52, 'every engine threshold in amos is the spec value (70⅔, 141⅓, karpef 70⅔, 2000, 4000, 24,000, 4)',
    Object.entries(SPEC_AMOS).every(([key, amos]) => G.AMOS[key] === amos), JSON.stringify(G.AMOS));

  // §1.2 line 52: every threshold (4, 70⅔, 141⅓, 2000, 4000, 24,000) scales from the amah.
  const ciPoint = span(run([], { amahM: CI }).techumCorners);
  check('1.2-d', 52, 'the 4-amah point square scales too: CI point techum = 4·0.576 + 2·1152 = 2306.304 m',
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
    check('rev22-a', 975, 'karpef on (MB): the 12-mil ring is the squared town + 11,520 m on every side, not + 11,553.92 m',
      onTown.mode === 'city' && sameSpan(ring(onTown), { minX: -11520, maxX: 50 + 11520, minY: -11520, maxY: 30 + 11520 }),
      JSON.stringify(ring(onTown)));
    check('rev22-b', 980, 'the 2000-amah techum still keeps its karpef: walls ± (33.92 + 960) m',
      sameSpan(span(onTown.techumCorners), { minX: -993.92, maxX: 1043.92, minY: -993.92, maxY: 1023.92 }),
      JSON.stringify(span(onTown.techumCorners)));
    // Chazon Ish amah: 24,000 · 0.576 = 13,824 m (before: + 40.704 = 13,864.704 m).
    const ciTown = run(town(0, 0), { amahM: CI, karpef: true }, { x: 5, y: 5 });
    check('rev22-c', 978, 'Chazon Ish amah (57.6 cm) with karpef: ring = squared town + 13,824 m',
      sameSpan(ring(ciTown), { minX: -13824, maxX: 50 + 13824, minY: -13824, maxY: 30 + 13824 }), JSON.stringify(ring(ciTown)));
    // Two towns exactly 141⅓ amos (67.84 m) apart are one town: walls x [0, 167.84].
    const joined = run(town(0, 0).concat(town(50 + T2, 0)), { karpef: true }, { x: 5, y: 5 });
    check('rev22-d', 979, 'two towns joined at 141⅓ amos: the ring is measured from the merged town: x [-11,520, 11,687.84]',
      joined.clusters.length === 1 && sameSpan(ring(joined), { minX: -11520, maxX: 167.84 + 11520, minY: -11520, maxY: 30 + 11520 }),
      JSON.stringify(ring(joined)));
    const mech = run(town(0, 0), { karpef: false, bowPolicy: 'mechaber-curve' }, { x: 5, y: 5 });
    check('rev22-e', 987, 'Mechaber (karpef off): ring = squared town + 11,520 m, unchanged',
      sameSpan(ring(mech), { minX: -11520, maxX: 50 + 11520, minY: -11520, maxY: 30 + 11520 }));
    check('rev22-f', 978, 'with karpef on and off the ring is identical (it never depends on the karpef)',
      regionSig(onTown.mil12Regions) === regionSig(mech.mil12Regions));
    // A rav-validated enclosure x [-10,60], y [-10,40] is the town's edge (§3.2 line 1019).
    const enclosure = [{ x: -10, y: -10 }, { x: 60, y: -10 }, { x: 60, y: 40 }, { x: -10, y: 40 }];
    const enc = run(town(0, 0), { karpef: true, validatedCityPerimeter: enclosure }, { x: 5, y: 5 });
    check('rev22-g', 978, 'validated enclosure with karpef: ring = enclosure + 11,520 m: x [-11,530, 11,580]',
      enc.validatedPerimeterActive && sameSpan(ring(enc), { minX: -11530, maxX: 11580, minY: -11530, maxY: 11560 }), JSON.stringify(ring(enc)));
    // A lone house never had a karpef: walls x [0,10] -> ring x [-11,520, 11,530].
    const lone = run([box(0, 0, 10, 10)], { karpef: true }, { x: 5, y: 5 });
    check('rev22-h', 978, 'building mode: ring = the house walls + 11,520 m',
      lone.mode === 'building' && sameSpan(ring(lone), { minX: -11520, maxX: 11530, minY: -11520, maxY: 11530 }));
    // A town split into regions by an unfilled pocket: each region gets 24,000 amos, no karpef.
    // Tiny amah 0.01 m: 24,000 amos = 240 m, karpef 0.70667 m.
    const deepU = [];
    for (let n = 0; n <= 10; n++) { deepU.push(house(0, n * 10), house(100, n * 10)); if (n > 0 && n < 10) deepU.push(house(n * 10, 0)); }
    const multi = run(deepU, { amahM: 0.01, karpef: true }, { x: 0, y: 50 });
    check('rev22-i', 978, 'a town of several regions: each region\'s ring is that region + 240 m (24,000 amos at 1 cm), no karpef',
      multi.cityRegions.length > 1 && multi.mil12Regions.length === multi.cityRegions.length &&
      multi.cityRegions.every((region, i) => { const c = span(region), m = span(multi.mil12Regions[i]);
        return approx(m.minX, c.minX - 240) && approx(m.maxX, c.maxX + 240) && approx(m.minY, c.minY - 240) && approx(m.maxY, c.maxY + 240); }),
      `regions=${multi.cityRegions.length}`);
    const mainJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
    check('rev22-j', 988, 'when the ring is shown, the panel adds the rav note and the ring\'s label says "without the karpef"',
      /settings\.show12mil && \(res\.mil12Regions/.test(mainJs) && /12-mil ring:<\/b> drawn 24,000 amos from the town’s own squared edge, without the 70⅔-amah karpef/.test(mainJs) &&
      /'12 mil \(d’oraisa shita\) — 24,000 amos from the town’s own squared edge, without the karpef/.test(mainJs));
  }
  pend('1.1-c', 991, 'Is the Torah-law 12 mil measured from the squared town at all, or from the houses themselves? Minchas Chinuch 24 doubts in general whether rabbinic techum leniencies reach the Torah measure. (Part 7 Q16)');

  check('1.2-e', 53, 'default amah is 48 cm with the second comparison line off',
    SET.DEFAULTS.amahCm === 48 && SET.DEFAULTS.secondAmahCm === 0);
}

// =================================================================================
// §1.3 — beis dirah predicate and the classification table
// =================================================================================
{
  const k = (tags) => D.classify(tags).klass;
  // Line 65: houses count. 'semi' and 'dwelling_house' are Overture's own class names (rev. 21).
  for (const b of ['house', 'residential', 'apartments', 'detached', 'terrace', 'bungalow', 'dormitory', 'stilt_house', 'semi', 'dwelling_house']) {
    check('1.3-a', 65, `building=${b} is a dwelling`, k({ building: b }) === 'dwelling', k({ building: b }));
  }
  // Line 72-75, rev 14 line 712, rev 16 line 765: storage/bare structures do not count.
  for (const b of ['garage', 'shed', 'barn', 'stable', 'warehouse', 'greenhouse', 'carport', 'shrine', 'retail', 'silo']) {
    check('1.3-b', 73, `building=${b} is not a dwelling`, k({ building: b }) === 'non', k({ building: b }));
  }
  // The table also treats tents and shipping containers as non-dwellings; the spec says
  // nothing about either (both can be lived in), so they are pending, not checks (rev. 21).
  pend('1.3-b2', 73, 'The table classifies building=tent and building=container as not dwellings; the spec does not cover either. (Part 7 Q14)');
  // Lines 65-71, 76-81, rev 14/16: counts only with facts the map cannot show -> review.
  for (const b of ['synagogue', 'church', 'mosque', 'ruins', 'guardhouse', 'hotel', 'hospital', 'school', 'office', 'factory', 'industrial', 'commercial', 'fire_station', 'monastery']) {
    check('1.3-c', 76, `building=${b} needs beis-dirah review`, k({ building: b }) === 'review', k({ building: b }));
  }
  check('1.3-d', 71, 'abandoned structure ("habitable ruins" only with walls and roof) goes to review',
    k({ building: 'yes', abandoned: 'yes' }) === 'review');
  check('1.3-e', 66, 'an untyped place of worship goes to review (counts only with clergy quarters)',
    k({ building: 'yes', amenity: 'place_of_worship' }) === 'review');
  // Rev. 15 (lines 736-741): every remaining subtype mapping.
  const sub = (overture_subtype) => k({ building: 'yes', overture_subtype });
  for (const [s, want] of [['civic', 'non'], ['service', 'non'], ['transportation', 'non'], ['commercial', 'review'],
    ['religious', 'review'], ['education', 'review'], ['medical', 'review'], ['agricultural', 'review'], ['military', 'unknown']]) {
    check('rev15-a', 737, `Overture subtype ${s} -> ${want}`, sub(s) === want, sub(s));
  }
  check('rev15-b', 742, 'an explicit class always wins over the subtype', k({ building: 'warehouse', overture_subtype: 'residential' }) === 'non');
  // Part 2 table line 389: unknown-use included by default, flagged; review likewise (rev 15 line 744).
  check('2-unknown', 389, 'unknown-use and review structures are included by default',
    SET.DEFAULTS.includeUnknown === true && SET.DEFAULTS.includeReview === true);

  // Line 60-62 + rev 3 line 408: a structure under 4 amos wide is not a dwelling "even if very long".
  const tooSmall = G.belowMinDwellingSize;
  check('1.3-f', 61, 'the 4×4-amah size test is exported from the engine', typeof tooSmall === 'function');
  if (typeof tooSmall === 'function') {
    const ring = (pts) => pts.map(([x, y]) => ({ x, y }));
    const rect = (w, h, deg = 0) => ring([[0, 0], [w, 0], [w, h], [0, h]].map(rotate(deg)));
    check('1.3-g', 60, 'exactly 4×4 amos (1.92 × 1.92 m) counts', tooSmall(rect(4 * RCN, 4 * RCN), RCN) === false);
    check('1.3-h', 61, '1.91 m wide (just under 4 amos) does not count, even 100 m long', tooSmall(rect(1.91, 100), RCN) === true);
    check('1.3-i', 61, 'a 1.5 m × 50 m structure turned 45° is still under 4 amos wide',
      tooSmall(rect(1.5, 50, 45), RCN) === true);
    check('1.3-j', 61, 'a 3 m × 3 m structure turned 30° is wider than 4 amos and counts', tooSmall(rect(3, 3, 30), RCN) === false);
    check('1.3-k', 408, 'the size test scales with the amah: 2.0 m wide counts at 48 cm (1.92) but not at 57.6 cm (2.304)',
      tooSmall(rect(2, 10), RCN) === false && tooSmall(rect(2, 10), CI) === true);
    check('1.3-l', 61, 'a degenerate (zero-width) footprint does not count', tooSmall(ring([[0, 0], [10, 0], [20, 0]]), RCN) === true);
    const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
    check('1.3-m', 408, 'the app\'s size filter uses the engine\'s width test, not the footprint\'s north-south/east-west box',
      /function isTooSmall[\s\S]{0,200}G\.belowMinDwellingSize\(/.test(main));
  }
  // Rev. 19 pending 1.3-q1 (houseboat) and 1.3-q2 (caravans/cabins) — answered in rev. 20.
}

// =================================================================================
// Rev. 20 — houseboats, cabins, seasonal cottages, caravans (lines 74, 867-899, 1087)
// =================================================================================
{
  const cls = (building) => D.classify({ building });
  const boat = cls('houseboat'), van = cls('static_caravan');
  check('rev20-a', 867, 'building=houseboat goes to review, left out by default, and still counts as a house if a rav includes it',
    boat.klass === 'review' && boat.excludeByDefault === true && !boat.noCityCount, JSON.stringify(boat));
  check('rev20-b', 867, 'the houseboat review text tells the rav how to see the town with it counted',
    /include it to see the town with it counted/.test(boat.reason), boat.reason);
  check('rev20-c', 892, 'building=cabin is a full dwelling (SA 398:10, "of boards")',
    cls('cabin').klass === 'dwelling' && !cls('cabin').noCityCount);
  check('rev20-d', 892, 'seasonal cottages arrive as house/bungalow and count as dwellings all year',
    cls('house').klass === 'dwelling' && cls('bungalow').klass === 'dwelling');
  check('rev20-e', 893, 'building=static_caravan goes to review, included by default, adding 0 to the town count',
    van.klass === 'review' && van.noCityCount === true && !van.excludeByDefault, JSON.stringify(van));
  check('rev20-f', 899, 'building=caravan and building=touring_caravan are not counted',
    cls('caravan').klass === 'non' && cls('touring_caravan').klass === 'non');

  // The app's inclusion rule (main.js isIncluded) with ambiguous structures included (the default).
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const src = main.slice(main.indexOf('  function isIncluded('), main.indexOf('  // Verified-only scenario'));
  const overrides = new Map();
  const isIncluded = require('node:vm').runInNewContext(`(${src})`,
    { state: { overrides }, isTooSmall: () => false, settings: { includeReview: true, includeUnknown: true } });
  const boatB = { id: 'boat', klass: 'review', excludeByDefault: true };
  const vanB = { id: 'van', klass: 'review', noCityCount: true };
  check('rev20-g', 878, 'the app leaves a houseboat out by default even with ambiguous structures included', isIncluded(boatB) === false);
  overrides.set('boat', 'include');
  check('rev20-h', 878, 'a reviewer include override counts the houseboat', isIncluded(boatB) === true);
  check('rev20-i', 893, 'the app includes a static caravan by default', isIncluded(vanB) === true);
  check('rev20-j', 893, 'the app carries both flags from the table into the engine input',
    /excludeByDefault: !!cls\.excludeByDefault, noCityCount: !!cls\.noCityCount/.test(main) &&
    /function workerSafeBuildings[\s\S]{0,250}noCityCount: !!b\.noCityCount/.test(main));

  // Town: six 10 m houses, walls x [0,50], y [0,30]. Extra footprint at x [80,90]: 30 m < 33.92 m.
  const extra = (flags) => box(80, 0, 90, 10, flags);
  const out = run(town(0, 0).concat(extra({ included: false })), {}, { x: 5, y: 5 });
  const inn = run(town(0, 0).concat(extra()), {}, { x: 5, y: 5 });
  check('rev20-k', 867, 'houseboat left out: the town ends at x = 50 and the techum at 50 + 960 = 1010',
    out.mode === 'city' && approx(span(out.cityCorners).maxX, 50) && approx(span(out.techumCorners).maxX, 1010),
    JSON.stringify(span(out.techumCorners)));
  check('rev20-l', 878, 'houseboat included by a rav: the town reaches x = 90 and the techum 90 + 960 = 1050',
    inn.mode === 'city' && approx(span(inn.cityCorners).maxX, 90) && approx(span(inn.techumCorners).maxX, 1050),
    JSON.stringify(span(inn.techumCorners)));

  const chained = run(town(0, 0).concat(extra({ noCityCount: true })), {}, { x: 5, y: 5 });
  check('rev20-m', 893, 'a static caravan 30 m from a six-house town chains on: town to x = 90, techum to 1050, count stays 6',
    chained.mode === 'city' && approx(span(chained.cityCorners).maxX, 90) && approx(span(chained.techumCorners).maxX, 1050) &&
    chained.clusters[0].houseCount === 6, JSON.stringify({ t: span(chained.techumCorners), n: chained.clusters[0].houseCount }));
  check('rev20-n', 897, 'a caravan joined to a town raises the seasonal-caravan flag, not the caravan-site flag',
    has(chained, 'static-caravan') && !has(chained, 'caravan-site'));

  const fivePlusVan = town(0, 0); fivePlusVan[5] = { ...fivePlusVan[5], noCityCount: true };
  const fpv = run(fivePlusVan, {}, { x: 5, y: 5 });
  const fpvT = span(fpv.techumCorners);
  check('rev20-o', 893, 'five houses + one static caravan is not a town: building mode from the pin\'s 10 m house, techum x [-960, 970]',
    fpv.mode === 'building' && approx(fpvT.minX, -960) && approx(fpvT.maxX, 970) && has(fpv, 'caravan-site'),
    JSON.stringify({ mode: fpv.mode, fpvT }));

  const vans = town(0, 0).map((b) => ({ ...b, noCityCount: true }));
  const site = run(vans, {}, { x: 5, y: 5 });
  check('rev20-p', 897, 'a site of six static caravans only does not form a town by count; it is flagged for a rav',
    site.mode === 'building' && site.clusters[0].houseCount === 0 && has(site, 'caravan-site') && !has(site, 'static-caravan'));
  const key = site.qualificationClusters[0].key;
  const ruled = run(vans, { cityQualificationOverrides: { [key]: true } }, { x: 5, y: 5 });
  check('rev20-q', 898, 'once a rav records the caravan site as a town, it squares as one: town x [0,50], techum x [-960, 1010]',
    ruled.mode === 'city' && approx(span(ruled.techumCorners).minX, -960) && approx(span(ruled.techumCorners).maxX, 1010) &&
    !has(ruled, 'caravan-site'), JSON.stringify(span(ruled.techumCorners)));
}

// =================================================================================
// §1.4 — ibur ha'ir: the 70⅔-amah chain
// =================================================================================
{
  const pair = (gap, amahM = RCN) => run([box(-10, 0, 0, 10), box(gap, 0, gap + 10, 10)], { amahM }, { x: -5, y: 5 }).clusters.length;
  check('1.4-a', 94, 'two houses exactly 70⅔ amos (33.92 m) apart join ("within")', pair(JOIN) === 1);
  check('1.4-b', 94, 'two houses 1 mm beyond 70⅔ amos stay separate', pair(JOIN + 0.001) === 2);
  check('1.4-c', 94, 'two houses 1 mm inside 70⅔ amos join', pair(JOIN - 0.001) === 1);
  check('1.4-d', 52, 'Chazon Ish: 40.704 m joins and 40.705 m does not', pair(40.704, CI) === 1 && pair(40.705, CI) === 2);

  // Line 118-119: buffer each footprint by half the gap (a round buffer), so corner-to-corner
  // distance is straight-line. Corner gap dx = dy = 23.5 -> 33.234 m joins; 24.5 -> 34.648 m does not.
  const diag = (d) => run([box(-10, -10, 0, 0), box(d, d, d + 10, d + 10)]).clusters.length;
  check('1.4-e', 118, 'diagonal corner gap is straight-line: 33.23 m joins', diag(23.5) === 1);
  check('1.4-f', 118, 'diagonal corner gap 34.65 m does not join, though each axis is only 24.5 m', diag(24.5) === 2);

  // Line 95-96: the chain runs on "even several days' walk long". 400 houses, 10 m wide,
  // 33.9 m gaps: 400·10 + 399·33.9 = 17,526 m (about 36,500 amos), one city.
  const chain = [];
  for (let i = 0; i < 400; i++) chain.push(box(i * 43.9, 0, i * 43.9 + 10, 10));
  const long = run(chain, {}, { x: 5, y: 5 });
  check('1.4-g', 96, 'a 17.5 km chain with every gap under 70⅔ amos is one city', long.clusters.length === 1 &&
    long.mode === 'city' && approx(span(long.cityCorners).w, 399 * 43.9 + 10, 1e-6), `clusters=${long.clusters.length}`);
  check('2-nocap', 360, 'no halachic maximum size: the 17.5 km city is not capped', approx(span(long.techumCorners).w, 399 * 43.9 + 10 + 2 * TECHUM, 1e-6));

  // Line 99-100: a lone house joins anything only within a single 70⅔.
  const lone = (gap) => run(town(0, 0).concat(box(50 + gap, 0, 60 + gap, 10)), {}, { x: 5, y: 5 }).clusters.length;
  check('1.4-h', 100, 'a lone house exactly 70⅔ amos from a city joins it', lone(JOIN) === 1);
  check('1.4-i', 100, 'a lone house 33.93 m away does not join', lone(JOIN + 0.01) === 2);
  check('1.4-j', 100, 'a lone house 67 m away (inside 141⅓ but outside 70⅔) does not join', lone(67) === 2);
}

// =================================================================================
// §1.4 / §1.6.3 / §1.9a — the 141⅓-amah settlement merge and full-width breaks
// =================================================================================
{
  const two = (gap, settings) => run(town(0, 0).concat(town(50 + gap, 0)), settings, { x: 5, y: 5 });
  check('1.4-k', 98, 'two cities exactly 141⅓ amos (67.84 m) apart merge', two(T2).clusters.length === 1);
  check('1.4-l', 98, 'two cities 1 mm beyond 141⅓ amos stay separate', two(T2 + 0.001).clusters.length === 2);
  check('1.4-m', 98, 'merged pair is squared as one city: 50 + 67.84 + 50 = 167.84 m wide', approx(span(two(T2).cityCorners).w, 167.84, 1e-6));
  // §1.6.3 line 237: the 141⅓ allowance is always applied, in every profile.
  check('1.6-c', 237, '141⅓ merge is the same with karpef on (MB) and off (Mechaber)',
    two(60, { karpef: true }).clusters.length === 1 && two(60, { karpef: false, bowPolicy: 'mechaber-curve' }).clusters.length === 1 &&
    two(T2 + 0.001, { karpef: true }).clusters.length === 2);
  // Rev 2 line 354-357: the 141⅓ merge is a city-level rule; a 3-house hamlet joins only within 70⅔.
  const hamlet = [box(100, 0, 110, 10), box(120, 0, 130, 10), box(100, 20, 110, 30)]; // 50 m from the town
  check('2-hamlet', 355, 'a city and a 3-house hamlet 50 m apart do not merge', run(town(0, 0).concat(hamlet), {}, { x: 5, y: 5 }).clusters.length === 2);
  // §1.9a line 288-294: a full-width strip wider than 141⅓ divides; a qualifying house bridging it within 70⅔ does not.
  const strip = town(0, 0).concat(town(120, 0)); // 70 m empty strip (a river)
  check('1.9a-a', 288, 'a 70 m empty strip (a river) across the whole settlement divides it', run(strip, {}, { x: 5, y: 5 }).clusters.length === 2);
  const bridged = run(strip.concat(box(80, 10, 90, 20)), {}, { x: 5, y: 5 });
  check('1.9a-b', 292, 'a house in the strip 30 m from each side bridges it: one city', bridged.clusters.length === 1);
  const divided = run(strip, {}, { x: 5, y: 5 });
  check('1.9-a', 276, 'an empty strip (water) adds nothing to the city: the western city\'s ribua ends at its own east wall (x = 50)',
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
  check('1.4-n', 104, 'middle village leaving exactly 141⅓ amos to an outer village: all three merge',
    exact.clusters.length === 1 && has(exact, 'three-villages'), `clusters=${exact.clusters.length}`);
  const over = triple(T2 + 0.01, 50, T2 + 0.01 + 50 + 10);
  check('1.4-o', 104, 'leaving 141⅓ amos + 1 cm on one side: no merge', over.clusters.length === 3 && !has(over, 'three-villages'));
  // Middle village wider than the outer gap overlaps an outer village's projection: it does not "fit".
  const wide = triple(-20, 170, 130);
  check('1.4-p', 103, 'a middle village that does not fit inside the projected outer gap does not merge them',
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
    check('1.4-q2', 102, 'middle village exactly 2000 amos (960 m) from each outer village: all three merge',
      has(r, 'three-villages') && r.clusters.length === 1, `clusters=${r.clusters.length}`);
  }
  // Here B is 2000 amos + 1 cm from both outers (corner-to-corner).
  {
    const A = town(-50, 0), C = town(130, 0); // outer gap 130, B 50 wide leaves 40 each side
    const v = Math.sqrt(TECHUM * TECHUM - 40 * 40) + 0.01; // just beyond 960 m from each corner
    const B = town(40, 30 + v);
    const r = run(A.concat(C, B), {}, { x: -45, y: 5 });
    check('1.4-q', 102, 'middle village 2000 amos + 1 cm from each outer village: no merge', !has(r, 'three-villages') && r.clusters.length === 3);
  }
  // Part 2 table line 386 / rev 2 line 354: three villages is a city-level rule.
  {
    const A = town(-50, 0), C = town(130, 0), hamlet = [box(40, 300, 50, 310), box(60, 300, 70, 310), box(80, 300, 90, 310)];
    check('2-three-hamlet', 386, 'a 3-house middle hamlet cannot be the middle village', !has(run(A.concat(C, hamlet), {}, { x: -45, y: 5 }), 'three-villages'));
    const smallOuter = [box(130, 0, 140, 10), box(150, 0, 160, 10)];
    check('2-three-outer', 386, 'a 2-house outer hamlet cannot be an outer village', !has(run(A.concat(smallOuter, town(40, 300)), {}, { x: -45, y: 5 }), 'three-villages'));
  }
}

// =================================================================================
// §1.4 / rev 14 — city status (provisional six-footprint proxy and reviewer basis)
// =================================================================================
{
  const five = town(0, 0).slice(0, 5), six = town(0, 0);
  check('1.4-r', 115, 'five footprints are not a city: the pin\'s house uses building mode', run(five, {}, { x: 5, y: 5 }).mode === 'building');
  check('1.4-s', 115, 'six footprints are a provisional city, labelled provisional',
    (() => { const r = run(six, {}, { x: 5, y: 5 }); return r.mode === 'city' && r.clusters[0].qualificationProvisional === true &&
      r.clusters[0].qualificationSource === 'provisional-six-footprint-proxy'; })());
  const oneExcluded = town(0, 0); oneExcluded[5] = { ...oneExcluded[5], included: false };
  check('1.4-t', 124, 'an excluded footprint does not count toward the six', run(oneExcluded, {}, { x: 5, y: 5 }).mode === 'building');
  check('2-six-all', 386, 'every profile uses the same six-footprint fallback',
    Object.values(SET.PROFILES).every((p) => p.minCityHouses === 6));
  const base = run(five, {}, { x: 5, y: 5 });
  const fifty = run(five, { cityQualificationOverrides: { [base.qualificationClusters[0].key]: { decision: true, basis: 'fifty-residents', evidence: 'census 2026', memberIds: base.qualificationClusters[0].memberIds } } }, { x: 5, y: 5 });
  check('1.4-u', 116, 'a reviewer\'s 50-resident basis makes five footprints a city and is kept in the audit',
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
  check('1.4-v', 123, 'a lone building gets no city karpef even with karpef on: techum = walls ± 960 m exactly',
    k.mode === 'building' && k.karpefRegions.length === 0 && approx(t.minX, -960, 1e-9) && approx(t.maxX, 970, 1e-9) &&
    approx(t.minY, -960, 1e-9) && approx(t.maxY, 970, 1e-9), JSON.stringify(t));
  check('1.4-w', 122, 'a pin exactly on the house wall counts as resting in it', run(lone, {}, { x: 10, y: 5 }).mode === 'building');
  const yard = [box(0, 0, 40, 40, { joinOnly: true })];
  check('rev13-a', 675, 'a validated yard alone is join geometry, not a house: a pin in it stays in point mode', run(yard, {}, { x: 20, y: 20 }).mode === 'point');
  // A rotated rectangular footprint is already squared in its own orientation (§1.5 line 155).
  const rot = polygonHouse([[0, 0], [20, 0], [20, 10], [0, 10]].map(rotate(30)));
  const rr = run([rot], {}, rotate(30)([10, 5]).reduce((p, v, i) => (i ? { ...p, y: v } : { x: v }), {}));
  const rc = rr.techumCorners, side = Math.hypot(rc[1].x - rc[0].x, rc[1].y - rc[0].y), side2 = Math.hypot(rc[2].x - rc[1].x, rc[2].y - rc[1].y);
  check('1.4-x', 123, 'a 20 × 10 m house turned 30° is measured from its own walls: techum 1940 × 1930 m',
    rr.mode === 'building' && approx(Math.max(side, side2), 1940, 1e-6) && approx(Math.min(side, side2), 1930, 1e-6), `${side} ${side2}`);
  check('1.4-y', 124, 'building mode always warns that the walls and dwelling status need confirming', has(k, 'building-mode'));
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
  check('1.5-a', 197, 'convex hull filling exactly 94% keeps the rectangle (equality is enough)',
    at94.method === 'preserved-rectangle' && approx(at94.rectangularity, 0.94, 1e-12), JSON.stringify(at94));
  const below = sq(pts(chamfer(40, 30, 6.01)));
  check('1.5-b', 197, 'a hull filling 93.99% falls back to world directions', below.method === 'world-aligned', below.method);
  // The same shapes turned 30°: 95% keeps 30°, 92% squares to the compass bounding box.
  const r30 = (arr) => pts(arr.map(rotate(30)));
  const keep = sq(r30(chamfer(40, 30, Math.sqrt(30))));   // 1 − 60/1200 = 95%
  check('1.5-c', 134, 'a 95%-rectangular town turned 30° keeps its own 30° orientation',
    keep.method === 'preserved-rectangle' && approx(Math.abs(keep.angleRad * 180 / Math.PI), 30, 1e-6), JSON.stringify(keep));
  const drop = sq(r30(chamfer(40, 30, Math.sqrt(48))));   // 1 − 96/1200 = 92%
  check('1.5-d', 136, 'a 92%-rectangular town turned 30° is squared to the compass', drop.method === 'world-aligned' && drop.angleRad === 0);

  // Line 157: trapezoid -> short side extended to match the long side, along the parallel pair.
  const trap = (deltaDeg) => {
    const t = Math.tan(deltaDeg * Math.PI / 180);
    return pts([[-100, -50], [100, -50], [60, 50], [-60, 50 + 120 * t]].map(rotate(25)));
  };
  const exactTrap = sq(trap(0));
  check('1.5-e', 157, 'a trapezoid turned 25° is squared on its own axis to long side × height = 200 × 100 m',
    exactTrap.method === 'trapezoid-extended' && approx(exactTrap.rect.maxX - exactTrap.rect.minX, 200, 1e-6) &&
    approx(exactTrap.rect.maxY - exactTrap.rect.minY, 100, 1e-6), JSON.stringify(exactTrap.rect));
  check('1.5-f', 198, 'sides 0.9° off parallel are still a trapezoid (1° classifier)', sq(trap(0.9)).method === 'trapezoid-extended');
  check('1.5-g', 198, 'sides 1.1° off parallel are an irregular shape: world directions', sq(trap(1.1)).method === 'world-aligned');

  // Step 3 (line 199): "everything else uses true world directions". Line 151 alone does not
  // decide this triangle, because it has a right angle (line 146 leaves that to a rav).
  const tri = sq(pts([[0, 0], [300, 0], [0, 200]].map(rotate(20))));
  check('1.5-h', 199, 'a right-angled triangular town turned 20° is squared to the compass bounding box by default', tri.method === 'world-aligned' && tri.angleRad === 0);

  // Line 158-159 + step 4: one jutting house pulls its whole side out.
  const houses = town(0, 0);
  for (let y = 40; y <= 400; y += 40) houses.push(box(20, y, 30, y + 10)); // a street running north to y = 410
  const r = run(houses, {}, { x: 5, y: 5 });
  const c = span(r.cityCorners);
  check('1.5-i', 158, 'a single street jutting north moves the entire north side to its last wall (y = 410)',
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
  check('1.5-j', 208, 'a bow whose mouth is exactly 4000 amos is not filled (equality belongs to >=)',
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
  check('1.5-k', 162, 'Mechaber: a reviewed chord of exactly 4000 amos is not filled', status(withChord(bowT, 'mechaber-curve')) === 'reviewed-no-fill-applied', status(withChord(bowT, 'mechaber-curve')));
  check('1.5-l', 162, 'Mechaber: a reviewed chord just under 4000 amos is filled', status(withChord(bowT - 1e-6, 'mechaber-curve')) === 'reviewed-fill-applied');
  const filled = withChord(bowT - 1e-6, 'mechaber-curve');
  check('1.5-m', 162, 'a filled bow leaves one starting region covering the whole squared city (walls x -5 to 105)',
    filled.cityRegions.length === 1 && approx(span(filled.cityRegions[0]).w, 110, 1e-6), JSON.stringify(span(filled.cityRegions[0])));
  check('1.5-n', 163, 'Rema: the same 4000-amah chord fills because the pocket is under 2000 amos deep', status(withChord(bowT, 'rema-majority')) === 'reviewed-fill-applied');

  // The Rashba/Ritva exigency setting (line 167, 210) fills a confirmed wide, deep bow.
  const deep = [];
  for (let n = 0; n <= 10; n++) { deep.push(house(0, n * 10), house(100, n * 10)); if (n > 0 && n < 10) deep.push(house(n * 10, 0)); }
  const deepDraft = run(deep, { amahM: tiny }, { x: 0, y: 50 });
  const deepKey = bows(deepDraft)[0].reviewKey;
  const ends = { [deepKey]: { endpoints: [{ x: 0, y: 100 }, { x: 100, y: 100 }] } };
  const emergency = run(deep, { amahM: tiny, bowPolicy: 'emergency-fill', concavityReviews: ends }, { x: 0, y: 50 });
  check('1.5-o', 210, 'the exigency setting fills a reviewed 4000+ wide, 2000+ deep bow', status(emergency) === 'reviewed-fill-applied' && emergency.cityRegions.length === 1);
  check('1.5-p', 206, 'without reviewer endpoints even the exigency setting stays provisional no-fill',
    run(deep, { amahM: tiny, bowPolicy: 'emergency-fill' }, { x: 0, y: 50 }).calculationStatus === 'provisional-no-fill');

  // Line 207-208: Rema fills when the chord is < 4000 OR the depth is < 2000; "equality belongs
  // to the >= branch" for both. 1.5-n alone cannot tell "<" from "<=" (rev. 21).
  const deepChord = run(deep, { amahM: tiny, concavityReviews: { [deepKey]: { endpoints: [{ x: 0, y: 100 }, { x: bowT, y: 100 }] } } }, { x: 0, y: 50 });
  check('1.5-n2', 208, 'Rema: a reviewed chord of exactly 4000 amos over a pocket 9500 amos deep stays unfilled',
    status(deepChord) === 'reviewed-no-fill-applied', status(deepChord));
  // Bottom houses' walls end at y = 5; the arms end at y = 25: the pocket is exactly 20 m
  // (2000 amos) deep under a 100 m (10,000-amah) chord along y = 25.
  const twoThousand = [];
  for (let n = 0; n <= 10; n++) twoThousand.push(house(n * 10, 0));
  twoThousand.push(house(0, 10), house(0, 20), house(100, 10), house(100, 20));
  const ttDraft = run(twoThousand, { amahM: tiny });
  const ttKey = bows(ttDraft)[0] && bows(ttDraft)[0].reviewKey;
  const tt = run(twoThousand, { amahM: tiny, concavityReviews: { [ttKey]: { endpoints: [{ x: 0, y: 25 }, { x: 100, y: 25 }] } } });
  check('1.5-n3', 208, 'Rema: a reviewed pocket exactly 2000 amos deep under a wide chord stays unfilled',
    status(tt) === 'reviewed-no-fill-applied' && approx(bows(tt)[0].depthM, 20, 1e-9),
    JSON.stringify({ status: status(tt), depth: bows(tt)[0] && bows(tt)[0].depthM }));

  // §1.10a lines 310-313: a pin is in a city only inside its FINAL starting area. The empty
  // middle of an unfilled pocket is not part of it, though it lies inside the squared
  // rectangle (rev. 21). Before rev. 21 this pin was called a resident and its drawn techum
  // did not even reach it.
  const pocketPin = run(deep, { amahM: tiny, karpef: true }, { x: 50, y: 70 });
  check('1.10a-l', 310, 'a pin in the empty middle of an unfilled bow pocket rests outside the city: 4004-amah square, pocket review still shown',
    pocketPin.mode === 'point' && has(pocketPin, 'pin-in-excluded-pocket') && has(pocketPin, 'large-concavity') &&
    pocketPin.calculationStatus === 'provisional-no-fill' && approx(span(pocketPin.techumCorners).w, 4004 * tiny, 1e-9),
    JSON.stringify({ mode: pocketPin.mode, w: pocketPin.techumCorners && span(pocketPin.techumCorners).w }));
  const pocketFilled = run(deep, { amahM: tiny, karpef: true, bowPolicy: 'emergency-fill', concavityReviews: ends }, { x: 50, y: 70 });
  check('1.10a-m', 310, 'once a reviewer fills that pocket, the same pin is a resident', pocketFilled.mode === 'city' && !has(pocketFilled, 'pin-in-excluded-pocket'));
  const nearWall = run(deep, { amahM: tiny, karpef: true }, { x: 5.5, y: 50 }); // 0.5 m from the arm, karpef 0.71 m
  check('1.10a-n', 312, 'a pin in the pocket but inside the Rema karpef of its houses is still a resident', nearWall.mode === 'city' && !has(nearWall, 'pin-in-excluded-pocket'));

  // Step 7 + §1.6.2: one karpef and then 2000 amos around EVERY region of a multi-region result.
  const multi = run(deep, { amahM: tiny, karpef: true }, { x: 0, y: 50 });
  const k = (70 + 2 / 3) * tiny, t = 2000 * tiny;
  const ok = multi.cityRegions.length > 1 && multi.cityRegions.length === multi.karpefRegions.length &&
    multi.cityRegions.every((ring, i) => { const c = span(ring), kk = span(multi.karpefRegions[i]), tt = span(multi.techumRegions[i]);
      return approx(kk.minX, c.minX - k) && approx(kk.maxY, c.maxY + k) && approx(tt.minX, c.minX - k - t) && approx(tt.maxY, c.maxY + k + t); });
  check('1.6-b', 233, 'a no-fill result keeps separate regions; each gets one karpef then 2000 amos', ok, `regions=${multi.cityRegions.length}`);
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
  check('1.9a-c', 300, 'a hole reaching 4000 amos in only one axis gets no hole warning', !has(narrow, 'large-interior-hole'));
  // Inner void of a 100 × 50 ring: 90 × 40 m: exactly 4000 amos in the short axis reaches the threshold.
  const reach = run(ringTown(100, 50), { amahM: tiny }, { x: 0, y: 0 });
  check('1.9a-d', 299, 'a hole of 9000 × exactly 4000 amos triggers the mandatory review warning but stays included',
    has(reach, 'large-interior-hole') && reach.cityRegions.length === 1, JSON.stringify(reach.warnings.map((w) => w.type)));
  check('2-hole', 388, 'every profile includes a large hole by default',
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
    check('1.5-q', 195, `${overlapPolicy}: overlapping karpefs do not join the two cities ("karpef never feeds backward")`,
      r.homeCandidates.length === 1 && r.homeCandidates[0].length === 1 && r.techumRegions.length === 1 &&
      approx(t.maxX, 395 + 33.92 + 960, 1e-6), JSON.stringify({ c: r.homeCandidates, t }));
  }
  // no-join: an overlapping city does not change the home city's own rectangle.
  const A = [];
  for (let i = 0; i <= 10; i++) A.push(house(i * 30, 0));
  for (let i = 0; i <= 10; i++) A.push(house(305, i * 30 - 5));
  const B = town(95, 145);
  const alone = run(A, {}, { x: 0, y: 0 }), both = run(A.concat(B), {}, { x: 0, y: 0 });
  check('1.5-r', 186, 'no-join: the home city keeps exactly its own rectangle and techum, with an overlap warning',
    regionSig(alone.techumRegions) === regionSig(both.techumRegions) && has(both, 'overlap-detected'));
  // §1.10a line 315: a pin in a house of the inner city B (inside A's rectangle) belongs to B only.
  const inB = run(A.concat(B), {}, { x: 100, y: 150 });
  check('1.10a-a', 315, 'a pin inside a house picks that house\'s city first, not the rectangle it sits in',
    inB.homeCandidates.length === 1 && !has(inB, 'multiple-home-candidates') &&
    sameSpan(span(inB.cityCorners), { minX: 95, maxX: 145, minY: 145, maxY: 175 }), JSON.stringify(span(inB.cityCorners)));
  check('2-overlap', 385, 'MB and Mechaber default to no join', SET.PROFILES['mishna-berura'].overlapPolicy === 'no-join' && SET.PROFILES.mechaber.overlapPolicy === 'no-join');
  // Rev. 19 pending 2-ci-overlap — answered in rev. 20 (lines 385, 901-910).
  const ci = SET.PROFILES['chazon-ish'];
  check('rev20-r', 385, 'the Chazon Ish profile defaults to no join, matching the table', ci.overlapPolicy === 'no-join');
  // A is an L of houses: walls x [-5,310], y [-10,300]; B (inside A's square) is 60+ m from every house of A.
  const ciS = { amahM: CI, karpef: ci.karpef, overlapPolicy: ci.overlapPolicy, bowPolicy: ci.bowPolicy, largeHolePolicy: ci.largeHolePolicy };
  const ciAlone = run(A, ciS, { x: 0, y: 0 }), ciBoth = run(A.concat(B), ciS, { x: 0, y: 0 });
  const ciEdge = 310 + 40.704 + 1152; // walls + 70⅔ and 2000 amos at 57.6 cm = 1502.704 m
  check('rev20-s', 901, 'Chazon Ish profile: an overlapping city leaves the home techum unchanged (x max 1502.704 m), with the overlap warning',
    regionSig(ciAlone.techumRegions) === regionSig(ciBoth.techumRegions) && has(ciBoth, 'overlap-detected') &&
    approx(span(ciBoth.techumCorners).maxX, ciEdge, 1e-6) && approx(ciEdge, 1502.704, 1e-3),
    JSON.stringify(span(ciBoth.techumCorners)));
  const ciRedraw = run(A.concat(B), { ...ciS, overlapPolicy: 'join-redraw' }, { x: 0, y: 0 });
  check('rev20-t', 907, 'joint redraw stays available as an explicit option', has(ciRedraw, 'overlap-merge-redraw'));
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  check('rev20-u', 907, 'the joint-redraw option and the Chazon Ish description say turning it on is a rav\'s decision',
    /value="join-redraw">[^<]*a rav's decision/.test(html) && /'chazon-ish':[^\n]*a rav\\'s decision/.test(mainJs));

  // A browser that saved the old Chazon Ish profile unchanged follows the new default once.
  const store = new Map();
  const fake = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  require('../js/settings.js').localStorage = fake;
  const oldCi = { ...SET.DEFAULTS, profile: 'chazon-ish', ...ci, overlapPolicy: 'join-redraw', dataSourceVersion: 2 };
  delete oldCi.profileRevision;
  const loadWith = (saved) => { store.set('techum-settings-v1', JSON.stringify(saved)); return SET.load(); };
  check('rev20-v', 909, 'saved old Chazon Ish profile, unchanged: loads with no join and still shows as the Chazon Ish profile',
    (() => { const l = loadWith(oldCi); return l.overlapPolicy === 'no-join' && SET.effectiveProfile(l) === 'chazon-ish' && l.profileRevision === 20; })());
  check('rev20-w', 910, 'saved custom Chazon Ish settings (karpef off) keep the joint redraw the user chose',
    loadWith({ ...oldCi, karpef: false }).overlapPolicy === 'join-redraw');
  check('rev20-x', 910, 'joint redraw chosen after rev. 20 is kept', loadWith({ ...oldCi, profileRevision: 20 }).overlapPolicy === 'join-redraw');
  // Before rev. 13 (2026-07-14) the profile stored a yes/no overlapMerge switch and had no bow
  // or hole setting; the Chazon Ish default was overlapMerge: true (rev. 21).
  const preRev13 = { profile: 'chazon-ish', amahCm: 57.6, karpef: true, squaringAngleDeg: 0, overlapMerge: true, minCityHouses: 6, dataSourceVersion: 2 };
  check('rev21-a', 938, 'an unchanged Chazon Ish profile saved before rev. 13 (old yes/no overlap switch) follows the new default too',
    (() => { const l = loadWith(preRev13); return l.overlapPolicy === 'no-join' && SET.effectiveProfile(l) === 'chazon-ish' && !('overlapMerge' in l); })());
  check('rev21-b', 938, 'the same old save with karpef turned off keeps the joint redraw the user had', loadWith({ ...preRev13, karpef: false }).overlapPolicy === 'join-redraw');
  check('rev21-c', 938, 'a save marked with any later revision is never switched again', loadWith({ ...oldCi, profileRevision: 21 }).overlapPolicy === 'join-redraw');
  delete globalThis.localStorage;
}

// =================================================================================
// §1.6 — karpef
// =================================================================================
{
  const city = town(0, 0); // walls x [0,50], y [0,30]
  const on = run(city, { karpef: true }, { x: 5, y: 5 }), off = run(city, { karpef: false }, { x: 5, y: 5 });
  const k = span(on.karpefCorners), t = span(on.techumCorners), t0 = span(off.techumCorners);
  check('1.6-a', 230, 'Rema karpef: 70⅔ amos beyond every wall, then 2000 amos beyond that (exact on all four sides)',
    sameSpan(k, { minX: -33.92, maxX: 83.92, minY: -33.92, maxY: 63.92 }) &&
    sameSpan(t, { minX: -993.92, maxX: 1043.92, minY: -993.92, maxY: 1023.92 }), JSON.stringify({ k, t }));
  check('1.6-d', 229, 'Mechaber (karpef off): 2000 amos straight from the walls, and no karpef region',
    off.karpefRegions.length === 0 && sameSpan(t0, { minX: -960, maxX: 1010, minY: -960, maxY: 990 }), JSON.stringify(t0));
  check('2-karpef', 383, 'karpef is on for MB and Chazon Ish, off for Mechaber',
    SET.PROFILES['mishna-berura'].karpef === true && SET.PROFILES['chazon-ish'].karpef === true && SET.PROFILES.mechaber.karpef === false);
  // A pin exactly on the karpef's outer edge rests inside it (MB), and is outside the city under Mechaber.
  check('1.10a-b', 310, 'a pin exactly on the karpef edge is a city resident with karpef on', run(city, { karpef: true }, { x: 83.92, y: 15 }).mode === 'city');
  check('1.10a-c', 313, 'the same pin is in point mode without karpef', run(city, { karpef: false }, { x: 83.92, y: 15 }).mode === 'point');
  check('1.10a-d', 311, 'a pin exactly on the squared city edge but not in a house is a resident', run(city, {}, { x: 50, y: 15 }).mode === 'city');
}

// =================================================================================
// §1.7 — square corners and the 4004-amah point square
// =================================================================================
{
  const r = run(town(0, 0), {}, { x: 5, y: 5 });
  check('1.7-a', 245, 'the techum is a 4-corner rectangle, not a rounded buffer', r.techumRegions.length === 1 && r.techumCorners.length === 4);
  const cityC = r.cityCorners, techC = r.techumCorners;
  const cornerReach = Math.min(...techC.map((p) => Math.min(...cityC.map((q) => Math.hypot(p.x - q.x, p.y - q.y)))));
  check('1.7-b', 244, 'each techum corner is 2000·√2 amos (1357.6 m) from the city corner', approx(cornerReach, 960 * Math.SQRT2, 1e-6), String(cornerReach));
  const pin = { x: 1234.5, y: -987.25 };
  const p = span(run([], {}, pin).techumCorners);
  check('1.7-c', 250, 'open field: 4004 × 4004 amos (1921.92 m) square centred on the pin',
    approx(p.w, 1921.92, 1e-9) && approx(p.h, 1921.92, 1e-9) && approx((p.minX + p.maxX) / 2, pin.x, 1e-9) && approx((p.minY + p.maxY) / 2, pin.y, 1e-9), JSON.stringify(p));
  const turned = span(run([], { pointRotationDeg: 45 }, pin).techumCorners);
  check('1.7-d', 251, 'turned 45° toward a destination, the square reaches 4004·√2/2 amos along each axis',
    approx(turned.w, 1921.92 * Math.SQRT2, 1e-6), String(turned.w));
}

// =================================================================================
// §1.8 — horizontal plan-view measurement, no automatic terrain factor
// =================================================================================
{
  const flat = town(0, 0);
  const hilly = flat.map((b, i) => ({ ...b, ring: b.ring.map((p) => ({ ...p, z: 100 * i })) }));
  check('1.8-a', 266, 'elevation on the footprints changes nothing (no automatic slope adjustment)',
    regionSig(run(flat, {}, { x: 5, y: 5 }).techumRegions) === regionSig(run(hilly, {}, { x: 5, y: 5 }).techumRegions));
}

// =================================================================================
// §1.10a — ir muvla'at: a whole city swallowed by the reach is flagged, never drawn
// =================================================================================
{
  const home = town(0, 0), small = town(400, 400); // walls [400,450]x[400,430]: wholly inside home's 960 m reach
  const withSmall = run(home.concat(small), {}, { x: 5, y: 5 }), homeOnly = run(home, {}, { x: 5, y: 5 });
  check('1.10a-e', 325, 'city mode: a city wholly inside the techum is flagged and the techum is not extended',
    has(withSmall, 'ir-muvlaas') && regionSig(withSmall.techumRegions) === regionSig(homeOnly.techumRegions));
  const straddle = run(home.concat(town(980, 0)), {}, { x: 5, y: 5 }); // reach ends at x = 1010, inside it
  check('1.10a-f', 323, 'a city the reach merely ends inside is not flagged as swallowed', !has(straddle, 'ir-muvlaas'));
  // Point mode: the person rests outside every city (line 321-332).
  const open = run(town(300, 300), {}, { x: 0, y: 0 });
  check('1.10a-g', 331, 'point mode: a city wholly inside the 2000-amah square is flagged as swallowed', open.mode === 'point' && has(open, 'ir-muvlaas'),
    JSON.stringify(open.warnings.map((w) => w.type)));
  check('1.10a-h', 332, 'point mode: the square itself is not extended (still 4004 amos)', approx(span(open.techumCorners).w, 1921.92, 1e-9));
  // The point square reaches 2 + 2000 amos = 960.96 m from the pin on each side.
  const edge = run(town(900, 0), {}, { x: 0, y: 0 }); // walls x [900,950], y [0,30]: inside
  const beyond = run(town(940, 0), {}, { x: 0, y: 0 }); // walls to x = 990: crosses the 960.96 m edge
  check('1.10a-i', 323, 'point mode: a city crossing the edge of the reach is not flagged', !has(beyond, 'ir-muvlaas') && has(edge, 'ir-muvlaas'));
  const fromHouse = run([box(-5, -5, 5, 5)].concat(town(300, 300)), {}, { x: 0, y: 0 });
  check('1.10a-j', 331, 'building mode: a city wholly inside the reach is flagged too', fromHouse.mode === 'building' && has(fromHouse, 'ir-muvlaas'));
  // Rev. 17 line 816: the point square ignores the reviewer's city-squaring angle, so the city
  // must be compared in the square's own (compass) frame. town(850, 850) turned 30° into the
  // engine's working frame would reach x' = 1219 m and look outside the 960.96 m square.
  const turned = run(town(850, 850), { squaringAngleDeg: 30 }, { x: 0, y: 0 });
  check('1.10a-k', 816, 'point mode with a 30° reviewer squaring angle: the square stays 4004 amos and a city inside it is still flagged',
    turned.mode === 'point' && has(turned, 'ir-muvlaas') && approx(span(turned.techumCorners).w, 1921.92, 1e-9),
    JSON.stringify(turned.warnings.map((w) => w.type)));
  // A city resident inside a rav-validated enclosure (line 1019) gets the same flag (rev. 21).
  const enclosure = [{ x: -10, y: -10 }, { x: 60, y: -10 }, { x: 60, y: 40 }, { x: -10, y: 40 }];
  const enclosed = run(home.concat(small), { validatedCityPerimeter: enclosure }, { x: 5, y: 5 });
  check('1.10a-o', 325, 'validated-enclosure city mode: another city wholly inside the techum is flagged too',
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
  check('det-a', 419, 'same buildings in a different order give the same regions and warnings',
    regionSig(a.techumRegions) === regionSig(b.techumRegions) && regionSig(a.cityRegions) === regionSig(b.cityRegions) &&
    a.warnings.map((w) => w.type).sort().join() === b.warnings.map((w) => w.type).sort().join());
  // Translation by 500 km: thresholds still decided to the millimetre.
  const far = (dx, dy, gap) => run([box(dx - 10, dy, dx, dy + 10), box(dx + gap, dy, dx + gap + 10, dy + 10)], {}, { x: dx - 5, y: dy + 5 }).clusters.length;
  check('det-b', 94, 'far from the origin (500 km) a 1 mm-over gap still separates and 1 mm-under still joins',
    far(5e5, -3e5, JOIN + 0.001) === 2 && far(5e5, -3e5, JOIN - 0.001) === 1);
  // Projection: two houses at latitude 41 whose real gap is 33.91 m vs 33.93 m.
  const proj = G.makeProjection(41, -74);
  const mPerLon = 111412.84 * Math.cos(41 * Math.PI / 180) - 93.5 * Math.cos(123 * Math.PI / 180);
  const fromLon = (lon0, lon1, lat0, lat1) => { const ring = [proj.toXY(lat0, lon0), proj.toXY(lat0, lon1), proj.toXY(lat1, lon1), proj.toXY(lat1, lon0)]; return { id: `p${nextId++}`, ring, bbox: G._internals.bboxOfRing(ring), included: true }; };
  const dLat = 10 / proj.mPerDegLat, w = 10 / mPerLon;
  const projPair = (gapM) => run([fromLon(-74, -74 + w, 41, 41 + dLat), fromLon(-74 + w + gapM / mPerLon, -74 + 2 * w + gapM / mPerLon, 41, 41 + dLat)], {}, { x: 5, y: 5 }).clusters.length;
  check('det-c', 221, 'through the lat/lon projection, a 33.91 m gap joins and a 33.93 m gap does not', projPair(33.91) === 1 && projPair(33.93) === 2);
}

// =================================================================================
// Empty and tiny inputs
// =================================================================================
{
  const allOut = run(town(0, 0).map((b) => ({ ...b, included: false })), {}, { x: 5, y: 5 });
  check('tiny-a', 124, 'every footprint excluded: open-field point shevisa with no clusters', allOut.mode === 'point' && allOut.clusters.length === 0);
  const tri = run([polygonHouse([[0, 0], [12, 0], [0, 9]])], {}, { x: 2, y: 2 });
  check('tiny-b', 151, 'a lone triangular house is squared to its compass box (12 × 9 m)', tri.mode === 'building' &&
    approx(span(tri.cityCorners).w, 12, 1e-9) && approx(span(tri.cityCorners).h, 9, 1e-9));
  let threw = null;
  try { run([polygonHouse([[0, 0], [10, 0], [20, 0]])], {}, { x: 5, y: 0 }); } catch (e) { threw = e; }
  check('tiny-c', 60, 'a zero-area footprint does not crash the engine', threw === null, threw && threw.message);
}

// =================================================================================
// Part 2 — profile table
// =================================================================================
{
  const mb = SET.PROFILES['mishna-berura'], ci = SET.PROFILES['chazon-ish'], mech = SET.PROFILES.mechaber;
  check('2-amah', 382, 'amah: MB 48 cm, Chazon Ish 57.6 cm, Mechaber 48 cm', mb.amahCm === 48 && ci.amahCm === 57.6 && mech.amahCm === 48);
  check('2-squaring', 384, 'every profile uses the automatic shape rule (no fixed reviewer angle)',
    [mb, ci, mech].every((p) => p.squaringAngleDeg === 0));
  check('2-bow', 387, 'bow rule: MB and CI Rema-majority, Mechaber curved edge', mb.bowPolicy === 'rema-majority' && ci.bowPolicy === 'rema-majority' && mech.bowPolicy === 'mechaber-curve');
  check('2-default', 380, 'the default profile is Mishna Berurah', SET.DEFAULTS.profile === 'mishna-berura' && SET.DEFAULTS.karpef === true && SET.DEFAULTS.overlapPolicy === 'no-join');
  check('2-eruv', 390, 'eruv-as-city is off unless a rav-validated perimeter is supplied', SET.DEFAULTS.useValidatedPerimeter === false);
  check('2-12mil', 391, 'the 12-mil ring and second-shita line are hidden by default', SET.DEFAULTS.show12mil === false && SET.DEFAULTS.secondAmahCm === 0);
}

pend('7-q11', 1194, 'Citation only: §1.5 cites Minchas Yitzchak 8:32 for the joint redraw; other sources give 8:33.');
pend('7-q12', 1197, 'Citation only: §1.3 cites Chazon Ish 110:28 for counting factories with a lunch room; two secondary sources report him as not counting a factory (or only buildings with sleeping quarters).');

console.log(`\n${passed} passed, ${failed} failed, ${pending.length} pending`);
for (const p of pending) console.log('  PENDING ' + p);
process.exit(failed ? 1 : 0);
