/*
 * Golden tests for the techum geometry engine, built from the Gemara/SA's own
 * canonical cases (circle, rotated square, ibur chains, two-cities merge,
 * three villages, karpef, point mode). Run: node tests/geometry.test.js
 */
const G = require('../js/geometry.js');

let passed = 0, failed = 0;
function assert(name, cond, detail) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}
function approx(a, b, tol = 1e-6) { return Math.abs(a - b) <= tol; }

// helpers -----------------------------------------------------------------
function squareHouse(cx, cy, size = 10) {
  const h = size / 2;
  const ring = [
    { x: cx - h, y: cy - h }, { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h }, { x: cx - h, y: cy + h },
  ];
  return { ring, bbox: G._internals.bboxOfRing(ring), included: true, id: 'h', klass: 'dwelling' };
}
function rotatedSquareHouse(cx, cy, size, angleDeg) {
  const h = size / 2, a = (angleDeg * Math.PI) / 180;
  const pts = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => ({
    x: cx + x * Math.cos(a) - y * Math.sin(a),
    y: cy + x * Math.sin(a) + y * Math.cos(a),
  }));
  return { ring: pts, bbox: G._internals.bboxOfRing(pts), included: true, id: 'r', klass: 'dwelling' };
}
const RCN = 0.48; // R' Chaim Naeh amah in meters
const S = { amahM: RCN, karpef: false, minCityHouses: 6, overlapMerge: false, squaringAngleDeg: 0 };
const JOIN = (70 + 2 / 3) * RCN;    // 33.92 m
const T2 = (141 + 1 / 3) * RCN;    // 67.84 m
const TECHUM = 2000 * RCN;         // 960 m

function grid6(cx, cy, gap = 20) {
  // 6 houses in a 3x2 grid, well within joining distance of each other
  const out = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) out.push(squareHouse(cx + i * gap, cy + j * gap));
  return out;
}
function rectSpan(corners) {
  const xs = corners.map((p) => p.x), ys = corners.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
           minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// 1. Circle city -> squared (SA 398:1): bbox side = diameter -----------------
{
  const houses = [];
  const R = 300;
  for (let k = 0; k < 24; k++) {
    houses.push(squareHouse(R * Math.cos((k * 2 * Math.PI) / 24), R * Math.sin((k * 2 * Math.PI) / 24)));
  }
  // ring of houses 300m radius: adjacent houses ~78m apart > JOIN -> they would split!
  // densify: 60 houses -> spacing ~31m < 33.92 ok
  houses.length = 0;
  for (let k = 0; k < 64; k++) {
    houses.push(squareHouse(R * Math.cos((k * 2 * Math.PI) / 64), R * Math.sin((k * 2 * Math.PI) / 64)));
  }
  const res = G.runPipeline(houses, S, { x: R, y: 0 });
  assert('circle: city mode', res.mode === 'city');
  assert('circle: irregular shape uses world-direction squaring',
    res.squaring.method === 'world-aligned' && approx(res.squaring.angleDeg, 0, 0.01),
    JSON.stringify(res.squaring));
  const span = rectSpan(res.cityCorners);
  assert('circle: squared to ~diameter', approx(span.w, 2 * R + 10, 1) && approx(span.h, 2 * R + 10, 1),
    JSON.stringify(span));
  const t = rectSpan(res.techumCorners);
  assert('circle: techum = city + 2*960', approx(t.w, span.w + 2 * TECHUM, 0.5), `w=${t.w}`);
  // corner reach (square corners, me'aber es hapinos): corner of techum is at
  // sqrt(960^2+960^2) ~ 1357.6m from city corner
  const diag = Math.hypot(t.maxX - span.maxX, t.maxY - span.maxY);
  assert('circle: square corners give 2000*sqrt(2) reach', approx(diag, TECHUM * Math.SQRT2, 0.5), `diag=${diag}`);
}

// 2. Existing rotated rectangle keeps its own orientation (SA/MB 398:1) ------
{
  // one big diamond-oriented block of houses: build a 200m square of houses rotated 45deg
  const houses = [];
  for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
    const x = i * 20, y = j * 20;
    const rx = (x - y) * Math.SQRT1_2, ry = (x + y) * Math.SQRT1_2;
    houses.push(squareHouse(rx, ry));
  }
  const res = G.runPipeline(houses, S, { x: 0, y: 0 });
  const c = res.cityCorners;
  const side = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y);
  assert('rotated rectangle: its existing orientation is preserved',
    approx(side, 200 + 10 * Math.SQRT2, 0.5), `side=${side}`);
  assert('rotated rectangle: automatic squaring is auditable',
    res.squaring.method === 'preserved-rectangle' && approx(Math.abs(res.squaring.angleDeg), 45, 0.1),
    JSON.stringify(res.squaring));
  const t = res.techumCorners;
  const techumSide = Math.hypot(t[1].x - t[0].x, t[1].y - t[0].y);
  assert('rotated rectangle: techum expands in the preserved frame',
    approx(techumSide, side + 2 * TECHUM, 0.5), `techumSide=${techumSide}`);
}

// 3. Ibur chain: gaps just under/over 70 2/3 amos ----------------------------
{
  const houses = grid6(0, 0);
  // chain three more houses eastward, each edge-to-edge gap 33m < 33.92
  let edge = 45; // east edge of grid (house centered at 40, half-size 5)
  for (const g of [33, 33, 33]) {
    const center = edge + g + 5;
    houses.push(squareHouse(center, 0));
    edge = center + 5;
  }
  const res = G.runPipeline(houses, S, { x: 0, y: 0 });
  assert('chain joins at 33m gaps', res.clusters.length === 1, `clusters=${res.clusters.length}`);

  const houses2 = grid6(0, 0);
  houses2.push(squareHouse(45 + 35 + 5, 0)); // gap 35m > 33.92 -> separate
  const res2 = G.runPipeline(houses2, S, { x: 0, y: 0 });
  assert('35m gap does NOT join (RCN)', res2.clusters.length === 2, `clusters=${res2.clusters.length}`);

  // ...but WOULD join under Chazon Ish amah (threshold 40.7m)
  const res3 = G.runPipeline(houses2, { ...S, amahM: 0.576 }, { x: 0, y: 0 });
  assert('35m gap joins under CI amah', res3.clusters.length === 1, `clusters=${res3.clusters.length}`);
}

// 4. Two-cities 141 1/3 merge; lone house asymmetry (SA 398:5, MB 398:38) ----
{
  // two 6-house cities with a 60m gap (< 67.84) -> merge
  const a = grid6(0, 0);
  const cityBEdge = 45 + 60; // east edge of A at x=45, gap 60
  const b = grid6(cityBEdge + 5, 0);
  const res = G.runPipeline(a.concat(b), S, { x: 0, y: 0 });
  assert('two cities merge at 60m', res.clusters.length === 1, `clusters=${res.clusters.length}`);
  assert('city-status audit preserves the two pre-merge qualification components',
    res.qualificationClusters.length === 2 && res.qualificationClusters.every((c) => c.qualifiesAsCity),
    `qualificationClusters=${res.qualificationClusters.length}`);

  // lone house at 60m: NOT merged (only 70 2/3 for a house, and 60 > 33.92)
  const c = grid6(0, 0);
  c.push(squareHouse(45 + 60 + 5, 0));
  const res2 = G.runPipeline(c, S, { x: 0, y: 0 });
  assert('lone house at 60m stays separate', res2.clusters.length === 2, `clusters=${res2.clusters.length}`);

  // two 3-house hamlets (below 6-house city minimum) at 60m: NOT merged
  const d = [squareHouse(0, 0), squareHouse(0, 20), squareHouse(20, 0)];
  const e = [squareHouse(85, 0), squareHouse(85, 20), squareHouse(105, 0)]; // gap 85-5-5=75? edge gap = 85-5 - 5 = 75... keep > JOIN
  const res3 = G.runPipeline(d.concat(e), { ...S }, { x: 0, y: 0 });
  assert('3-house hamlets do not get the 141 1/3 merge', res3.clusters.length === 2, `clusters=${res3.clusters.length}`);
}

// 5. Karpef toggle (MB 398:36) ------------------------------------------------
{
  const houses = grid6(0, 0);
  const off = G.runPipeline(houses, S, { x: 0, y: 0 });
  const on = G.runPipeline(houses, { ...S, karpef: true }, { x: 0, y: 0 });
  const wOff = rectSpan(off.techumCorners).w, wOn = rectSpan(on.techumCorners).w;
  assert('karpef adds 2 x 70 2/3 amos to techum width', approx(wOn - wOff, 2 * JOIN, 0.01), `${wOn - wOff}`);
}

// 6. Point mode (open field): 4-amos square + 2000 each way -------------------
{
  const res = G.runPipeline([], S, { x: 0, y: 0 });
  assert('point mode when no buildings', res.mode === 'point');
  const t = rectSpan(res.techumCorners);
  assert('point techum = 4 amos + 2*2000 amos', approx(t.w, 4 * RCN + 2 * TECHUM, 0.01), `w=${t.w}`);
}

// 6b. A footprint is not automatically a qualifying city ---------------------
{
  const loneHouse = [squareHouse(0, 0)];
  const res = G.runPipeline(loneHouse, S, { x: 0, y: 0 });
  assert('sub-city cluster at the pin does not become a city',
    res.mode === 'point' && res.clusters[0].qualifiesAsCity === false,
    `mode=${res.mode}`);
}

// 7. Natural-edge squaring (rotation) -----------------------------------------
{
  // same rotated-diamond city as #2, but squared to its own 45deg edge:
  const houses = [];
  for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
    const x = i * 20, y = j * 20;
    const rx = (x - y) * Math.SQRT1_2, ry = (x + y) * Math.SQRT1_2;
    houses.push(squareHouse(rx, ry));
  }
  const res = G.runPipeline(houses, { ...S, squaringAngleDeg: 45 }, { x: 0, y: 0 });
  // corners come back rotated; rect side ~ city's own side: 200 centers + 10*sqrt2
  // (axis-aligned houses become diamonds in the rotated frame), NOT ~293 (compass bbox)
  const c = res.cityCorners;
  const side = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y);
  assert('natural-edge squaring hugs the city (side ~214 not ~293)',
    approx(side, 200 + 10 * Math.SQRT2, 0.5), `side=${side}`);
}

// 8. Three villages (SA 398:8) -------------------------------------------------
{
  // outer A at x~[0,45], outer C at x~[145,190] (gap 100m), middle B offset north,
  // width 60m -> gap 100 - 60 = 40 <= 2*67.84 -> merge all three
  const A = grid6(0, 0);
  const C = grid6(150, 0);
  const B = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) B.push(squareHouse(60 + i * 18, 300 + j * 18));
  // B has 8 houses (city), within 2000 amos of both, projected width ~ 64m
  const res = G.runPipeline(A.concat(C, B), S, { x: 0, y: 0 });
  assert('three villages merge', res.clusters.length === 1, `clusters=${res.clusters.length}`);
  assert('three villages flagged for review', res.warnings.some((w) => w.type === 'three-villages'));
}

// 9. Overlapping squares: warn when off, merge when on ------------------------
{
  // two cities whose houses are 200m apart (no 141 merge) but rectangles+techum overlap:
  // actually city RECTANGLES themselves must overlap for the rule; build an L-arrangement
  // where bboxes overlap: city A spans x[0,300] via a chain, city B sits at x[250,295] y=200,
  // far from A's houses (>67.84 edge gap) but inside A's bbox x-range... need actual bbox overlap:
  const A = [];
  for (let i = 0; i <= 10; i++) A.push(squareHouse(i * 30, 0));       // spans x[-5,305], y[-5,5]
  for (let i = 0; i <= 10; i++) A.push(squareHouse(305, i * 30 - 5)); // east arm north: bbox y up to ~300
  A.push(...grid6(0, 0)); // ensure >=6 near pin
  const B = grid6(100, 150); // inside A's bbox (x 100-145, y 150-170), houses ~100m+ from A's arms? A east arm at x=305; A south row at y=0; edge gap ~ 150-5-5=140 > 67.84 ok
  const res = G.runPipeline(A.concat(B), S, { x: 0, y: 0 });
  assert('overlap detected (setting off)', res.warnings.some((w) => w.type === 'overlap-detected'),
    JSON.stringify(res.warnings.map((w) => w.type)));
  const res2 = G.runPipeline(A.concat(B), { ...S, overlapMerge: true }, { x: 0, y: 0 });
  assert('overlap merged (setting on)', res2.warnings.some((w) => w.type === 'overlap-merge'));
}

// 10. Projection sanity ---------------------------------------------------------
{
  const proj = G.makeProjection(41.0, -74.0);
  const p1 = proj.toXY(41.0, -74.0);
  assert('projection origin at 0,0', approx(p1.x, 0) && approx(p1.y, 0));
  const north1km = proj.toXY(41.0 + 1000 / proj.mPerDegLat, -74.0);
  assert('1km north maps to ~1000m', approx(north1km.y, 1000, 0.01), `y=${north1km.y}`);
  const back = proj.toLatLon(500, 800);
  const fwd = proj.toXY(back.lat, back.lon);
  assert('round-trip projection', approx(fwd.x, 500, 0.01) && approx(fwd.y, 800, 0.01));
}

// 11. Point rotation changes only the established point square -----------------
{
  const farCity = grid6(200, 0);
  const base = G.runPipeline(farCity, { ...S, pointRotationDeg: 0 }, { x: 0, y: 0 });
  const rotated = G.runPipeline(farCity, { ...S, pointRotationDeg: 45 }, { x: 0, y: 0 });
  assert('point rotation does not change point/city mode', base.mode === 'point' && rotated.mode === 'point');
  assert('point rotation does not change clusters', JSON.stringify(base.clusters.map((c) => c.members)) ===
    JSON.stringify(rotated.clusters.map((c) => c.members)));
  const edgeAngle = Math.atan2(rotated.techumCorners[1].y - rotated.techumCorners[0].y,
    rotated.techumCorners[1].x - rotated.techumCorners[0].x) * 180 / Math.PI;
  assert('point techum square rotates 45 degrees after classification', approx(edgeAngle, 45, 0.01), `angle=${edgeAngle}`);
}

// 12. Overlap redraw keeps audit membership/count consistent -------------------
{
  const A = [];
  for (let i = 0; i <= 10; i++) A.push(squareHouse(i * 30, 0));
  for (let i = 0; i <= 10; i++) A.push(squareHouse(305, i * 30 - 5));
  A.push(...grid6(0, 0));
  const B = grid6(100, 150);
  const res = G.runPipeline(A.concat(B), { ...S, overlapMerge: true }, { x: 0, y: 0 });
  const home = res.clusters[res.homeCluster];
  assert('overlap redraw includes both settlements in home audit membership',
    home.members.length === A.length + B.length, `members=${home.members.length}`);
}

// 13. Reviewer city qualification overrides -----------------------------------
{
  // Two one-house settlements are too small for the six-footprint approximation,
  // but a reviewer may attest that each represents a qualifying city/courtyard.
  const houses = [squareHouse(0, 0), squareHouse(55, 0)]; // gap 45m: > JOIN, < T2
  const ordinary = G.runPipeline(houses, S, { x: 0, y: 0 });
  assert('qualification audit exposes default count decision',
    ordinary.clusters.length === 2 && ordinary.clusters.every((c) =>
      c.qualifiesAsCity === false && c.qualificationSource === 'footprint-count'));
  const reviewed = G.runPipeline(houses, {
    ...S,
    cityQualificationOverrides: Object.fromEntries(ordinary.qualificationClusters.map((c) => [c.key, true])),
  }, { x: 0, y: 0 });
  assert('reviewer-qualified small settlements participate in 141-amah merge',
    reviewed.clusters.length === 1, `clusters=${reviewed.clusters.length}`);
  assert('merged audit preserves source cluster keys',
    ordinary.qualificationClusters.every((c) => reviewed.clusters[0].componentKeys.includes(c.key)));
}

{
  const houses = grid6(0, 0).concat(grid6(100, 0)); // distinct chains, gap < T2
  const baseline = G.runPipeline(houses, S, { x: 0, y: 0 });
  const blocked = G.runPipeline(houses, {
    ...S,
    cityQualificationOverrides: { [baseline.qualificationClusters[0].key]: false },
  }, { x: 0, y: 0 });
  assert('reviewer disqualification prevents count-based city merge',
    blocked.clusters.length === 2 && blocked.clusters.some((c) =>
      c.qualificationSource === 'reviewer' && c.qualifiesAsCity === false));
}

{
  const houses = [squareHouse(0, 0), squareHouse(15, 0), squareHouse(30, 0), squareHouse(45, 0)];
  houses.forEach((h, i) => { h.id = `way/${100 + i}`; });
  const initial = G.runPipeline(houses, S, { x: 0, y: 0 });
  const reviewedKey = initial.qualificationClusters[0].key;
  const record = { decision: false, memberIds: initial.qualificationClusters[0].memberIds };
  const added = squareHouse(60, 0); added.id = 'way/104';
  const refreshed = G.runPipeline([added, houses[2], houses[0], houses[3], houses[1]], {
    ...S, cityQualificationOverrides: { [reviewedKey]: record },
  }, { x: 0, y: 0 });
  assert('review decision remaps across OSM ordering and a small membership change',
    refreshed.qualificationClusters[0].qualifiesAsCity === false &&
    refreshed.qualificationClusters[0].qualificationSource === 'reviewer-remapped' &&
    refreshed.qualificationClusters[0].qualificationRemapScore >= 0.8);
}

// 14. Bow endpoints are review metadata only ----------------------------------
{
  const cluster = { members: [], bbox: { minX: 0, maxX: 2500, minY: 0, maxY: 2500 } };
  const endpointSettings = {
    ...S,
    concavityReviews: { 'concavity:0': { endpoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] } },
  };
  const warnings = G._internals.concavityWarnings(cluster, [], endpointSettings);
  assert('large concavity exposes reviewer endpoint record',
    warnings.length === 1 && warnings[0].reviewerEndpoints.length === 2 &&
      warnings[0].reviewStatus === 'endpoints-recorded-not-applied');
  const invalid = G._internals.concavityWarnings(cluster, [], {
    ...S, concavityReviews: { 'concavity:0': { endpoints: [{ x: 10, y: 20 }] } },
  });
  assert('invalid bow endpoint record remains unapplied and needs review',
    invalid[0].reviewerEndpoints === null && invalid[0].reviewStatus === 'needs-endpoints');
}

{
  const perimeter = [
    { x: -100, y: -80 }, { x: 100, y: -80 }, { x: 100, y: 80 }, { x: -100, y: 80 },
  ];
  const res = G.runPipeline([], { ...S, validatedCityPerimeter: perimeter }, { x: 0, y: 0 });
  const span = rectSpan(res.cityCorners);
  assert('explicit validated perimeter supplies city edge without inferred buildings',
    res.mode === 'city' && res.validatedPerimeterActive && Math.abs(span.w - 200) < 0.01 &&
    res.warnings.some((w) => w.type === 'validated-perimeter'));
  const outside = G.runPipeline([], { ...S, validatedCityPerimeter: perimeter }, { x: 500, y: 0 });
  assert('validated perimeter is inactive when the shevisa point is outside it',
    outside.mode === 'point' && !outside.validatedPerimeterActive);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
