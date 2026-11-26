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
const S = { amahM: RCN, karpef: false, minCityHouses: 6, overlapPolicy: 'no-join',
  largeHolePolicy: 'include-with-warning', bowPolicy: 'rema-majority', squaringAngleDeg: 0 };
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
  // A lone city has nothing to join, so the joining policy must not change how its squaring is reported.
  const alone = G.runPipeline(houses, { ...S, overlapPolicy: 'join-redraw' }, { x: 0, y: 0 });
  assert('rotated rectangle: a lone city under join-redraw still reports its own squaring',
    alone.squaring.method === 'preserved-rectangle' && alone.squaring.rectangularity != null,
    JSON.stringify(alone.squaring));
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

// 6b. A footprint is not a city, but shevisa is measured from its walls -------
{
  const loneHouse = [squareHouse(0, 0)];
  const res = G.runPipeline(loneHouse, S, { x: 0, y: 0 });
  assert('sub-city footprint at the pin uses building mode without becoming a city',
    res.mode === 'building' && res.homeBuilding === 0 && res.clusters[0].qualifiesAsCity === false,
    `mode=${res.mode}`);
  const base = rectSpan(res.cityCorners), techum = rectSpan(res.techumCorners);
  assert('lone building starts from its mapped 10m walls',
    approx(base.w, 10) && approx(base.h, 10), JSON.stringify(base));
  assert('lone building techum expands 2000 amos from its walls',
    approx(techum.w, 10 + 2 * TECHUM) && approx(techum.h, 10 + 2 * TECHUM), JSON.stringify(techum));

  const outside = G.runPipeline(loneHouse, S, { x: 20, y: 0 });
  assert('pin outside a non-city footprint remains open-field point shevisa',
    outside.mode === 'point' && outside.homeBuilding === -1, `mode=${outside.mode}`);

  const excluded = [{ ...squareHouse(0, 0), included: false }];
  const excludedResult = G.runPipeline(excluded, S, { x: 0, y: 0 });
  assert('excluded footprint under pin does not become building shevisa',
    excludedResult.mode === 'point' && excludedResult.homeBuilding === -1, `mode=${excludedResult.mode}`);
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
  const threeAudit = res.warnings.find((w) => w.type === 'three-villages');
  assert('three villages records its canonical lowering-axis audit',
    threeAudit && threeAudit.axis && threeAudit.projectedPlacementM.leftGap <= T2 &&
      threeAudit.projectedPlacementM.rightGap <= T2, JSON.stringify(threeAudit));

  // The middle village is lowered perpendicular to the outer-center axis; it is not
  // silently slid sideways. A same-width village whose projected interval is outside the
  // outer gap therefore is not the canonical three-legged-jug construction.
  const offsetMiddle = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++)
    offsetMiddle.push(squareHouse(210 + i * 18, 300 + j * 18));
  const offset = G.runPipeline(A.concat(C, offsetMiddle), S, { x: 0, y: 0 });
  assert('three villages does not slide an offset middle village sideways',
    offset.clusters.length === 3 && !offset.warnings.some((w) => w.type === 'three-villages'),
    `clusters=${offset.clusters.length}`);

  // Exactly 2000 amos from each outer remains within the rule.
  const equalA = grid6(0, 0), equalC = grid6(180, 0);
  const projectedSideGap = 40;
  const verticalEdgeGap = Math.sqrt(TECHUM * TECHUM - projectedSideGap * projectedSideGap);
  const equalB = grid6(90, 30 + verticalEdgeGap);
  const equality = G.runPipeline(equalA.concat(equalC, equalB), S, { x: 0, y: 0 });
  assert('three villages includes equality at 2000 amos from both outers',
    equality.clusters.length === 1 && equality.warnings.some((w) => w.type === 'three-villages'),
    `clusters=${equality.clusters.length}`);

  // SA HaRav 398:12 explicitly says that an outer span beyond 4000 amos is immaterial
  // when a sufficiently wide middle village fits and is within 2000 of both.
  const farA = grid6(0, 0), farC = grid6(2200, 0), wideB = [];
  for (let x = 108; x <= 2148; x += 30) wideB.push(squareHouse(x, 500));
  const far = G.runPipeline(farA.concat(farC, wideB), S, { x: 0, y: 0 });
  const farAudit = far.warnings.find((w) => w.type === 'three-villages');
  assert('three villages has no 4000-amah outer-span cap',
    far.clusters.length === 1 && farAudit && farAudit.projectedPlacementM.outerDistance > 4000 * RCN,
    JSON.stringify(farAudit && farAudit.projectedPlacementM));
}

// 9. Overlapping squares: all three sourced approaches ------------------------
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
  const middle = G.runPipeline(A.concat(B), { ...S, overlapPolicy: 'join-no-redraw' }, { x: 0, y: 0 });
  assert('R. Shlomo Miller overlap joins without redraw as stepped regions',
    middle.warnings.some((w) => w.type === 'overlap-merge-no-redraw') &&
      middle.cityRegions.length > 1 && middle.techumRegions.length > 1,
    JSON.stringify({ warnings: middle.warnings.map((w) => w.type), regions: middle.cityRegions.length }));
  const res2 = G.runPipeline(A.concat(B), { ...S, overlapPolicy: 'join-redraw' }, { x: 0, y: 0 });
  assert('expansive overlap joins and redraws one rectangle',
    res2.warnings.some((w) => w.type === 'overlap-merge-redraw') && res2.cityRegions.length === 1);
  // Spec rev. 18.1: (120, 160) was used here as an "empty" overlap, but it lies 5 m from four of
  // B's houses, in the street between them and inside B's squared walls, so §1.10a priority (1)
  // gives it to B. The empty overlap is 20 m below B's houses, inside B's Rema karpef and A's square.
  const inStreet = G.runPipeline(A.concat(B), S, { x: 120, y: 160 });
  assert('a pin in the street between the inner city\'s houses belongs to that city, not the intersection',
    inStreet.homeCandidates.length === 1 && !inStreet.warnings.some((w) => w.type === 'multiple-home-candidates') &&
      inStreet.clusters[inStreet.homeCluster].houseCount === 6);
  const emptyOverlap = G.runPipeline(A.concat(B), { ...S, karpef: true }, { x: 120, y: 125 });
  assert('empty overlap of unrelated no-join cities uses the conservative candidate intersection',
    emptyOverlap.homeBuilding === -1 && emptyOverlap.homeCandidates.length > 1 &&
      emptyOverlap.squaring.method === 'candidate-intersection' &&
      emptyOverlap.warnings.some((w) => w.type === 'multiple-home-candidates'));
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
  const res = G.runPipeline(A.concat(B), { ...S, overlapPolicy: 'join-redraw' }, { x: 0, y: 0 });
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
      c.qualifiesAsCity === false && c.qualificationSource === 'provisional-six-footprint-proxy' &&
      c.qualificationProvisional));
  const reviewed = G.runPipeline(houses, {
    ...S,
    cityQualificationOverrides: Object.fromEntries(ordinary.qualificationClusters.map((c) => [c.key, {
      decision: true, basis: 'three-courtyards', evidence: 'Three documented courtyard groups', memberIds: c.memberIds,
    }])),
  }, { x: 0, y: 0 });
  assert('reviewer-qualified small settlements participate in 141-amah merge',
    reviewed.clusters.length === 1, `clusters=${reviewed.clusters.length}`);
  assert('merged audit preserves source cluster keys',
    ordinary.qualificationClusters.every((c) => reviewed.clusters[0].componentKeys.includes(c.key)));
  assert('city qualification audit preserves its factual basis and evidence',
    reviewed.qualificationClusters.every((c) => c.qualificationBasis === 'three-courtyards' &&
      c.qualificationEvidence === 'Three documented courtyard groups' && !c.qualificationProvisional));
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

// 14. Bow endpoints drive a conservative/reviewed boundary --------------------
{
  const cluster = { members: [], bbox: { minX: 0, maxX: 2500, minY: 0, maxY: 2500 } };
  const detected = G._internals.concavityWarnings(cluster, [], S);
  const reviewKey = detected[0].reviewKey;
  const endpointSettings = {
    ...S,
    concavityReviews: { [reviewKey]: { endpoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] } },
  };
  const warnings = G._internals.concavityWarnings(cluster, [], endpointSettings);
  assert('large concavity exposes reviewer endpoint record',
    warnings.length === 1 && warnings[0].reviewerEndpoints.length === 2 &&
      warnings[0].reviewStatus === 'endpoints-confirmed');
  const invalid = G._internals.concavityWarnings(cluster, [], {
    ...S, concavityReviews: { [reviewKey]: { endpoints: [{ x: 10, y: 20 }] } },
  });
  assert('invalid bow endpoint record leaves provisional no-fill review',
    invalid[0].reviewerEndpoints === null && invalid[0].reviewStatus === 'provisional-no-fill-needs-endpoints');
}

// 8b. A confirmed trapezoid extends the short side along its own parallel axis -
{
  const angle = 25 * Math.PI / 180;
  const rotate = ({ x, y }) => ({ x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) });
  const trapezoid = [
    { x: -100, y: -50 }, { x: 100, y: -50 }, { x: 60, y: 50 }, { x: -60, y: 50 },
  ].map(rotate);
  const result = G.runPipeline([], { ...S, validatedCityPerimeter: trapezoid }, rotate({ x: 0, y: 0 }));
  assert('trapezoid preserves its parallel-side axis and extends the short side',
    result.squaring.method === 'trapezoid-extended' && approx(Math.abs(result.squaring.angleDeg), 25, 0.1),
    JSON.stringify(result.squaring));
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

// 15. A material U/bow is never silently filled -------------------------------
{
  const tinyAmah = 0.01; // bow threshold 40m, depth threshold 20m
  const houses = [];
  for (let n = 0; n <= 10; n++) {
    houses.push(squareHouse(0, n * 10));
    houses.push(squareHouse(100, n * 10));
    if (n > 0 && n < 10) houses.push(squareHouse(n * 10, 0));
  }
  const baseSettings = { ...S, amahM: tinyAmah };
  const provisional = G.runPipeline(houses, baseSettings, { x: 0, y: 50 });
  assert('unreviewed >=4000-amah bow uses a provisional no-fill multi-region result',
    provisional.calculationStatus === 'provisional-no-fill' && provisional.cityRegions.length > 1 &&
      provisional.concavityAudit.some((a) => a.shapeKind === 'bow' && a.appliedToBoundary));
  const bow = provisional.concavityAudit.find((a) => a.shapeKind === 'bow');
  const reviewed = G.runPipeline(houses, {
    ...baseSettings,
    concavityReviews: { [bow.reviewKey]: { endpoints: [{ x: 0, y: 100 }, { x: 100, y: 100 }] } },
  }, { x: 0, y: 50 });
  assert('reviewed wide/deep bow remains unfilled under the Rema-majority default',
    reviewed.calculationStatus === 'complete-default' && reviewed.cityRegions.length > 1 &&
      reviewed.concavityAudit.some((a) => a.reviewStatus === 'reviewed-no-fill-applied'));

  const shallow = [];
  for (let n = 0; n <= 10; n++) shallow.push(squareHouse(n * 10, 0));
  shallow.push(squareHouse(0, 10), squareHouse(100, 10));
  const shallowDraft = G.runPipeline(shallow, baseSettings, { x: 0, y: 0 });
  const shallowBow = shallowDraft.concavityAudit.find((a) => a.shapeKind === 'bow');
  const endpoints = [{ x: 0, y: 15 }, { x: 100, y: 15 }];
  const rema = G.runPipeline(shallow, {
    ...baseSettings, concavityReviews: { [shallowBow.reviewKey]: { endpoints } },
  }, { x: 0, y: 0 });
  const mechaber = G.runPipeline(shallow, {
    ...baseSettings, bowPolicy: 'mechaber-curve',
    concavityReviews: { [shallowBow.reviewKey]: { endpoints } },
  }, { x: 0, y: 0 });
  assert('Rema-majority fills a confirmed wide but less-than-2000-amah-deep bow',
    rema.concavityAudit.some((a) => a.reviewStatus === 'reviewed-fill-applied'));
  assert('Mechaber/Rambam leaves that same >=4000-amah chord unfilled',
    mechaber.concavityAudit.some((a) => a.reviewStatus === 'reviewed-no-fill-applied'));
}

// Candidate-city intersections preserve every piece of a masked starting area.
{
  const left = squareHouse(0, 0, 20).ring, right = squareHouse(40, 0, 20).ring;
  const clip = squareHouse(20, 0, 60).ring;
  const pieces = G._internals.intersectPolygonSets([[left, right], [clip]]);
  assert('common permission intersects unions without discarding later regions', pieces.length === 2);
}

// 16. A fully enclosed >=4000x4000 void follows the selected psak --------------
{
  const tinyAmah = 0.01;
  const houses = [];
  for (let n = 0; n <= 10; n++) {
    houses.push(squareHouse(n * 10, 0), squareHouse(n * 10, 100));
    if (n > 0 && n < 10) houses.push(squareHouse(0, n * 10), squareHouse(100, n * 10));
  }
  const included = G.runPipeline(houses, { ...S, amahM: tinyAmah }, { x: 0, y: 50 });
  assert('default includes a large enclosed hole but warns',
    included.cityRegions.length === 1 && included.warnings.some((w) => w.type === 'large-interior-hole'));
  const excluded = G.runPipeline(houses, { ...S, amahM: tinyAmah, largeHolePolicy: 'exclude' }, { x: 0, y: 50 });
  assert('strict large-hole policy preserves the void as multiple starting regions',
    excluded.cityRegions.length > 1 && excluded.concavityAudit.some((a) => a.reviewStatus === 'strict-exclusion-applied'));
}

// 17. City membership uses the selected profile's final starting area ----------
{
  const houses = grid6(0, 0);
  const outsideWalls = { x: 60, y: 0 }; // east wall is 45m; 15m is inside Rema karpef, not the city itself
  const mb = G.runPipeline(houses, { ...S, karpef: true }, outsideWalls);
  const mechaber = G.runPipeline(houses, { ...S, karpef: false }, outsideWalls);
  assert('Rema karpef can make an outside pin a city resident', mb.mode === 'city');
  assert('without single-city karpef the same outside pin remains point shevisa', mechaber.mode === 'point');
}

// 18. Validated yard/perimeter geometry joins but does not count as a house -----
{
  const houses = grid6(0, 0);
  const yard = squareHouse(70, 0, 40); yard.id = 'validated-yard'; yard.joinOnly = true;
  const remote = squareHouse(110, 0); remote.id = 'remote-house';
  const result = G.runPipeline(houses.concat(yard, remote), S, { x: 0, y: 0 });
  assert('validated join-only perimeter participates in the 70-amah chain', result.clusters.length === 1);
  assert('validated perimeter never inflates the six-house count', result.clusters[0].houseCount === 7,
    `houseCount=${result.clusters[0].houseCount}`);
}

// --- unfilled bow (SA 398:4): measured from the houses; houses inside the pocket stay city
{
  const uTown = (withArm) => {
    const houses = [];
    for (let x = 0; x <= 3000; x += 20) houses.push(squareHouse(x, 0));
    for (let y = 20; y <= 3000; y += 20) { houses.push(squareHouse(0, y)); houses.push(squareHouse(3000, y)); }
    if (withArm) for (let x = 2980; x >= 1800; x -= 20) houses.push(squareHouse(x, 1500));
    return houses;
  };
  const pieceBoxes = (result) => result.cityRegions.map((ring) => G._internals.bboxOfRing(ring));
  const insidePiece = (house, boxes) => boxes.some((p) => house.ring.every((q) =>
    q.x >= p.minX - 1e-6 && q.x <= p.maxX + 1e-6 && q.y >= p.minY - 1e-6 && q.y <= p.maxY + 1e-6));

  const plain = G.runPipeline(uTown(false), S, { x: 0, y: 0 });
  const left = pieceBoxes(plain).find((p) => p.minX < 0);
  assert('unfilled bow: starting city stops at the houses facing the pocket',
    left && approx(left.maxX, 5, 1e-6), left && `left arm maxX=${left.maxX.toFixed(2)}`);

  const houses = uTown(true);
  const withArm = G.runPipeline(houses, S, { x: 0, y: 0 });
  const missing = houses.filter((house) => !insidePiece(house, pieceBoxes(withArm)));
  assert('unfilled bow: houses reaching into the pocket stay in the starting city', missing.length === 0,
    `${missing.length} houses outside`);

  const armPin = { x: 1800, y: 1500 };
  const fromArm = G.runPipeline(houses, { ...S, karpef: true }, armPin);
  assert('unfilled bow: a resident of a house in the pocket is inside his own techum',
    fromArm.techumRegions.some((ring) => G._internals.pointInRing(armPin, ring)));
}

// --- rev. 17 determinism and measurement regressions ------------------------------
const withIds = (houses, prefix) => houses.map((h, i) => ({ ...h, id: `${prefix}-${i}` }));
const shiftHouses = (houses, dx, dy) => houses.map((h) => {
  const ring = h.ring.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  return { ...h, ring, bbox: G._internals.bboxOfRing(ring) };
});
const regionSig = (regions) => regions.map((ring) => ring.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).sort().join(';')).sort().join('|');

// City-status review keys follow stable building ids, not the projection origin or angle.
{
  const town = withIds(grid6(0, 0), 'gers');
  const first = G.runPipeline(town, S, { x: 0, y: 0 });
  const record = { decision: false, basis: 'does-not-qualify', memberIds: first.qualificationClusters[0].memberIds };
  const overrides = { [first.qualificationClusters[0].key]: record };
  const moved = G.runPipeline(shiftHouses(town, 37, -12), { ...S, cityQualificationOverrides: overrides }, { x: 37, y: -12 });
  const angled = G.runPipeline(town, { ...S, squaringAngleDeg: 10, cityQualificationOverrides: overrides }, { x: 0, y: 0 });
  assert('rev17: cluster key is unchanged when the pin (projection origin) moves',
    moved.qualificationClusters[0].key === first.qualificationClusters[0].key);
  assert('rev17: reviewer "not a city" survives a moved pin and a reviewer squaring angle',
    [moved, angled].every((r) => r.qualificationClusters[0].qualificationSource === 'reviewer' &&
      r.qualificationClusters[0].qualifiesAsCity === false && r.mode === 'building'));

  // Legacy (v2) records embed the projected bbox in each member id and in the key hash.
  const legacyIds = town.map((h) => `${h.id}@${[h.bbox.minX, h.bbox.minY, h.bbox.maxX, h.bbox.maxY]
    .map((v) => v.toFixed(3)).join(',')}`).sort();
  let hash = 2166136261;
  for (const ch of legacyIds.join('\u001f')) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
  const legacyKey = `cluster:v2:${legacyIds.length}:${hash.toString(16).padStart(8, '0')}`;
  const legacy = { [legacyKey]: { decision: false, basis: 'does-not-qualify', memberIds: legacyIds } };
  const sameOrigin = G.runPipeline(town, { ...S, cityQualificationOverrides: legacy }, { x: 0, y: 0 });
  const boolOnly = G.runPipeline(town, { ...S, cityQualificationOverrides: { [legacyKey]: false } }, { x: 0, y: 0 });
  const legacyMoved = G.runPipeline(shiftHouses(town, 37, -12), { ...S, cityQualificationOverrides: legacy }, { x: 37, y: -12 });
  assert('rev17: a legacy v2 key still matches exactly at its original origin',
    [sameOrigin, boolOnly].every((r) => r.qualificationClusters[0].qualificationSource === 'reviewer' &&
      r.qualificationClusters[0].qualifiesAsCity === false));
  assert('rev17: a legacy v2 record remaps by the ids embedded in its member ids after the pin moves',
    legacyMoved.qualificationClusters[0].qualificationSource === 'reviewer-remapped' &&
    legacyMoved.qualificationClusters[0].qualificationRemapScore === 1 &&
    legacyMoved.qualificationClusters[0].qualifiesAsCity === false);
}

// Bow detection and the Rema depth test measure from the houses (SA 398:3-4; spec §1.5 step 5).
{
  const uCity = (mouthAmos, depthAmos) => {
    const mouth = mouthAmos * RCN, rightX = 10 + mouth, top = depthAmos * RCN, out = [];
    const steps = Math.ceil(top / 30);
    for (let k = 0; k <= steps; k++) { out.push(squareHouse(0, (top * k) / steps)); out.push(squareHouse(rightX, (top * k) / steps)); }
    for (let x = 30; x < rightX - 5; x += 30) out.push(squareHouse(x, 0));
    return { houses: out, rightX, top };
  };
  const bows = (r) => r.concavityAudit.filter((a) => a.shapeKind === 'bow');
  const narrow = uCity(3990, 2083), wide = uCity(4010, 2083);
  assert('rev17: a bow with a 3990-amah house-to-house mouth is filled without review',
    bows(G.runPipeline(narrow.houses, S, { x: 0, y: 0 })).length === 0);
  const wideResult = G.runPipeline(wide.houses, S, { x: 0, y: 0 });
  assert('rev17: a bow with a 4010-amah house-to-house mouth is flagged (was filled silently)',
    bows(wideResult).length === 1 && wideResult.calculationStatus === 'provisional-no-fill');

  // Chord >= 4000 and a house depth of 2030 amos: the empty cells alone read < 2000.
  const deep = uCity(4400, 2030);
  const detected = bows(G.runPipeline(deep.houses, S, { x: 0, y: 0 }));
  const endpoints = [{ x: 5, y: deep.top + 5 }, { x: deep.rightX - 5, y: deep.top + 5 }];
  const reviewed = G.runPipeline(deep.houses, {
    ...S, concavityReviews: detected.length ? { [detected[0].reviewKey]: { endpoints } } : {},
  }, { x: 0, y: 0 });
  const audit = bows(reviewed)[0];
  assert('rev17: Rema depth is measured to the houses, so a 2030-amah-deep wide bow stays unfilled',
    audit && audit.reviewStatus === 'reviewed-no-fill-applied' && audit.depthM >= TECHUM,
    audit && `status=${audit.reviewStatus} depth=${(audit.depthM / RCN).toFixed(1)} amos`);
}

// join-redraw closures are unioned, so input order cannot pick a different city.
{
  const L = (x0, y0, len, corner) => {
    const out = [];
    for (let t = 0; t <= len; t += 30) {
      if (corner === 'bl') { out.push(squareHouse(x0, y0 + t)); if (t) out.push(squareHouse(x0 + t, y0)); }
      else { out.push(squareHouse(x0 + len, y0 + t)); if (t < len) out.push(squareHouse(x0 + t, y0 + len)); }
    }
    return out;
  };
  const A = L(0, 0, 390, 'bl'), B = L(330, 330, 390, 'tr'), C = grid6(500, 50);
  const settings = { ...S, overlapPolicy: 'join-redraw' };
  const pin = { x: 520, y: 50 };
  const abc = G.runPipeline(A.concat(B, C), settings, pin);
  const cab = G.runPipeline(C.concat(A, B), settings, pin);
  assert('rev17: join-redraw result is independent of input order',
    regionSig(abc.cityRegions) === regionSig(cab.cityRegions) && regionSig(abc.techumRegions) === regionSig(cab.techumRegions));
  assert('rev17: a city reached only by a joint redraw joins it from either side',
    cab.homeCandidates.length === 1 && cab.homeCandidates[0].length === 3 &&
    approx(rectSpan(cab.cityRegions[0]).w, 730, 1e-6));

  // Pin in the karpef overlap of two separate closures: every policy takes the common area.
  const P = L(0, 0, 390, 'bl'), Q = L(445, 445, 390, 'tr');
  const karpefPin = { x: 418, y: 418 };
  const sigs = ['no-join', 'join-no-redraw', 'join-redraw'].flatMap((overlapPolicy) => [P.concat(Q), Q.concat(P)].map((houses) => {
    const r = G.runPipeline(houses, { ...S, karpef: true, overlapPolicy }, karpefPin);
    return r.warnings.some((w) => w.type === 'multiple-home-candidates') && r.squaring.method === 'candidate-intersection'
      ? regionSig(r.techumRegions) : 'no-intersection';
  }));
  assert('rev17: a pin only in two separate karpefs gets the conservative intersection under every policy',
    sigs.every((sig) => sig === sigs[0] && sig !== 'no-intersection'), JSON.stringify(sigs.map((s) => s.slice(0, 30))));
}

// Three villages: every qualifying triple is united, independent of input order.
{
  const V1 = grid6(0, 0), V3 = grid6(220, 0), V2 = grid6(110, 500), V4 = grid6(110, -500);
  const pin = { x: 130, y: -490 };
  const one = G.runPipeline(V1.concat(V2, V3, V4), S, pin);
  const two = G.runPipeline(V1.concat(V4, V3, V2), S, pin);
  assert('rev17: two middle villages between the same outers both join, in any input order',
    [one, two].every((r) => r.clusters.length === 1 &&
      r.warnings.filter((w) => w.type === 'three-villages').length === 2) &&
    regionSig(one.cityRegions) === regionSig(two.cityRegions));
}

// Three-villages pruning keeps a 900-village field practical (it took ~38 s before), and
// the many overlapping triples in such a field give the same result in any input order.
{
  const houses = [];
  for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) houses.push(...grid6(i * 130, j * 130));
  const started = Date.now();
  const r = G.runPipeline(houses, S, { x: 0, y: 0 });
  const ms = Date.now() - started;
  assert('rev17: a 900-village field finishes within the practical 5-second bound', ms < 5000, `${ms} ms`);
  const reversed = G.runPipeline(houses.slice().reverse(), S, { x: 0, y: 0 });
  assert('rev17: a 900-village field with many three-village triples is input-order independent',
    r.warnings.some((w) => w.type === 'three-villages') && r.clusters.length === reversed.clusters.length &&
    regionSig(r.cityRegions) === regionSig(reversed.cityRegions));
}

// Point mode follows pointRotationDeg only, never the city squaring angle.
{
  const r = G.runPipeline([], { ...S, squaringAngleDeg: 30, pointRotationDeg: 0 }, { x: 0, y: 0 });
  const edge = Math.atan2(r.techumCorners[1].y - r.techumCorners[0].y, r.techumCorners[1].x - r.techumCorners[0].x) * 180 / Math.PI;
  assert('rev17: point square ignores the reviewer city-squaring angle', r.mode === 'point' && approx(edge, 0, 1e-9) &&
    r.squaring.angleDeg === 0, `edge=${edge}`);
  const turned = G.runPipeline([], { ...S, squaringAngleDeg: 30, pointRotationDeg: 45 }, { x: 0, y: 0 });
  const edge2 = Math.atan2(turned.techumCorners[1].y - turned.techumCorners[0].y, turned.techumCorners[1].x - turned.techumCorners[0].x) * 180 / Math.PI;
  assert('rev17: point square uses exactly pointRotationDeg', approx(edge2, 45, 1e-9), `edge=${edge2}`);
}

// Projection wraps longitude across the antimeridian.
{
  const proj = G.makeProjection(65, 179.99);
  const east = proj.toXY(65, -179.99);
  assert('rev17: a point 0.02 degrees east across ±180 projects ~0.94 km east, not across the globe',
    east.x > 0 && approx(east.x, 0.02 * (111412.84 * Math.cos(65 * Math.PI / 180) - 93.5 * Math.cos(195 * Math.PI / 180)), 0.01),
    `x=${east.x}`);
}

// Spec rev. 18.1: a pin in a town's street. Rev. 18.3: loading all the map data a result needs ----------
let boxId = 0;
function box(minX, minY, maxX, maxY) {
  const ring = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
  return { id: `b${boxId++}`, ring, bbox: G._internals.bboxOfRing(ring), included: true };
}
// Six 10 m houses, 3 x 2, 20 m apart: walls x [x0, x0 + 50], y [y0, y0 + 30].
function town6(x0, y0) {
  const out = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) out.push(box(x0 + i * 20, y0 + j * 20, x0 + i * 20 + 10, y0 + j * 20 + 10));
  return out;
}
function span(ring) {
  const xs = ring.map((p) => p.x), ys = ring.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
const sameSpan = (a, b, tol = 1e-6) => ['minX', 'maxX', 'minY', 'maxY'].every((k) => approx(a[k], b[k], tol));
const has = (r, type) => r.warnings.some((w) => w.type === type);
const homeOf = (r) => (r && r.homeCluster >= 0 ? r.clusters[r.homeCluster].houseCount : 0);
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
  // Pin (15, 5): in the street between X's houses [0,10] and [20,30], 5 m from each, on no
  // footprint, inside X's walls and Y's square. X's techum: x [0 - 960, 190 + 960], y [-960, 990].
  const street = G.runPipeline(both, S, { x: 15, y: 5 });
  assert('rev18.1: a pin in the street between a town\'s houses is in that town, though another town\'s square covers it: 20 houses, techum x [-960, 1150], y [-960, 990]',
    street.mode === 'city' && homeOf(street) === 20 && !has(street, 'multiple-home-candidates') &&
      sameSpan(span(street.techumCorners), { minX: -960, maxX: 1150, minY: -960, maxY: 990 }),
    JSON.stringify({ home: homeOf(street), candidates: street.homeCandidates.length }));
  const streetMb = G.runPipeline(both, { ...S, karpef: true }, { x: 15, y: 5 });
  assert('rev18.1: the same with the Rema karpef: techum x [-993.92, 1183.92], y [-993.92, 1023.92]',
    homeOf(streetMb) === 20 && sameSpan(span(streetMb.techumCorners), { minX: -993.92, maxX: 1183.92, minY: -993.92, maxY: 1023.92 }),
    JSON.stringify(span(streetMb.techumCorners)));
  // Between X's two rows at (5, 15), 5 m from each row, inside X's walls.
  const between = G.runPipeline(both, { ...S, karpef: true }, { x: 5, y: 15 });
  assert('rev18.1: a pin between a town\'s two rows, inside its squared walls, is in that town: 20 houses, techum maxX 1183.92',
    homeOf(between) === 20 && !has(between, 'pin-beside-town') && approx(span(between.techumCorners).maxX, 1183.92),
    JSON.stringify({ home: homeOf(between) }));
  // The strip beside a town's outermost houses: 10 m and 16.96 m (half of 70⅔ amos) above X's house
  // [0,10]x[20,30], outside X's walls, in X's karpef and inside Y's square. Whether a person there
  // rests in X is open, so the common area of both stays, with a review note: X's techum with the
  // karpef is x [-993.92, 1183.92], y [-993.92, 1023.92], Y's x [-1183.92, 1013.92],
  // y [-1093.92, 1203.92]; the common area is x [-993.92, 1013.92], y [-993.92, 1023.92].
  // 16.97 m gets the same area without the note.
  const common = { minX: -993.92, maxX: 1013.92, minY: -993.92, maxY: 1023.92 };
  const strip = [40, 46.96].map((y) => G.runPipeline(both, { ...S, karpef: true }, { x: 5, y }));
  const beyond = G.runPipeline(both, { ...S, karpef: true }, { x: 5, y: 46.97 });
  assert('rev18.1: a pin 10 m or 16.96 m outside a town\'s walls, also in another town\'s square, gets the common area x [-993.92, 1013.92], y [-993.92, 1023.92] with a review note; 16.97 m without the note',
    strip.every((r) => r.mode === 'city' && r.homeCandidates.length === 2 && has(r, 'multiple-home-candidates') &&
      has(r, 'pin-beside-town') && sameSpan(span(r.techumCorners), common)) &&
      beyond.homeCandidates.length === 2 && !has(beyond, 'pin-beside-town') && sameSpan(span(beyond.techumCorners), common),
    JSON.stringify(strip.map((r) => [r.homeCandidates.length, has(r, 'pin-beside-town')])));
  // The rule only chooses among towns whose starting area already holds the pin. Without the
  // karpef, a pin 5 m north of X's walls (y = 35) is outside X's square: it rests in Y only.
  const outside = G.runPipeline(both, S, { x: 15, y: 35 });
  assert('rev18.1: without the karpef, a pin 5 m outside a town\'s walls is not made a resident of it',
    outside.mode === 'city' && homeOf(outside) === Y.length && sameSpan(span(outside.cityCorners), { minX: -190, maxX: 20, minY: -100, maxY: 210 }),
    JSON.stringify({ home: homeOf(outside) }));
}
{
  // Spec rev. 18.3: the app's loader (main.js calculate) on made-up maps. A footprint is stored in
  // every 0.02° map tile its box touches (worker/buildings.ts); each pass loads the tiles
  // G.dataNeeds names and runs the engine again, until the result needs nothing. Every answer is
  // compared with the engine run on the whole made-up map. The app has no pass limit; 60 here
  // only keeps a bug from hanging the test.
  const proj = G.makeProjection(41, -74);
  const tileIndex = (deg) => Math.floor(deg / G.TILE_DEG + 1e-12);
  const degreesOf = (b) => {
    const pts = [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]].map(([x, y]) => proj.toLatLon(x, y));
    return { south: Math.min(...pts.map((p) => p.lat)), north: Math.max(...pts.map((p) => p.lat)),
      west: Math.min(...pts.map((p) => p.lon)), east: Math.max(...pts.map((p) => p.lon)) };
  };
  const tilesOf = (b) => {
    const d = degreesOf(b.bbox), out = [];
    for (let i = tileIndex(d.south); i <= tileIndex(d.north); i++) for (let j = tileIndex(d.west); j <= tileIndex(d.east); j++) out.push(`${i}/${j}`);
    return out;
  };
  const around = (pin, r) => G.tilesForDegrees(degreesOf({ minX: pin.x - r, maxX: pin.x + r, minY: pin.y - r, maxY: pin.y + r }));
  const load = (world, settings, pin, startTiles) => {
    const stored = world.map(tilesOf);
    const loaded = new Set(startTiles);
    const passes = [];
    for (let pass = 1; pass <= 60; pass++) {
      const sub = world.filter((b, k) => stored[k].some((key) => loaded.has(key)));
      const result = G.runPipeline(sub, settings, pin);
      const needs = G.dataNeeds(sub, result, { proj, tiles: loaded, pin });
      passes.push({ result, needs, buildings: sub.length });
      if (needs.complete) return { result, sub, passes, loaded };
      for (const key of needs.tiles) loaded.add(key);
    }
    return { result: null, sub: [], passes, loaded };
  };
  const answer = (r, list) => r ? { mode: r.mode, home: r.homeCluster >= 0 ? r.clusters[r.homeCluster].members.map((i) => list[i].id).sort().join(',') : '',
    techum: (r.techumRegions || []).map((ring) => ring.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).join(' ')).sort().join('|') } : null;
  const sameAsWhole = (run, world, settings, pin) => {
    const whole = answer(G.runPipeline(world, settings, pin), world), got = answer(run.result, run.sub);
    return !!got && got.mode === whole.mode && got.home === whole.home && got.techum === whole.techum;
  };
  const CI = { ...S, amahM: 0.576, karpef: true, overlapPolicy: 'join-redraw' };
  const MB = { ...S, karpef: true };

  // An 8 km chain of 200 houses: house i is x [40i, 40i + 10], y [0, 10]; 30 m gaps (< 33.92 m)
  // make one town, walls x [0, 7970], techum x [-960, 8930], y [-960, 970]. The first tiles hold
  // part of it; the loader follows the town tile by tile to its far end.
  const chain = [];
  for (let i = 0; i < 200; i++) chain.push(box(i * 40, 0, i * 40 + 10, 10));
  const chainRuns = [190, 1200, 3000].map((startM) => load(chain, S, { x: 5, y: 5 }, around({ x: 5, y: 5 }, startM)));
  assert('rev18.3: from 190, 1200 and 3000 m an 8 km chain ends as one 200-house town, techum x [-960, 8930], y [-960, 970]',
    chainRuns.every(({ result }) => result && result.mode === 'city' && homeOf(result) === 200 &&
      sameSpan(span(result.techumCorners), { minX: -960, maxX: 8930, minY: -960, maxY: 970 })) &&
      chainRuns.every(({ passes }) => passes.length > 1 && homeOf(passes[0].result) < 200),
    JSON.stringify(chainRuns.map(({ result, passes }) => ({ home: homeOf(result), passes: passes.length }))));

  // Three villages (§1.4): A walls x [0, 50], y [0, 30]; C x [220, 270]; B x [110, 160], y [500, 530].
  // A and C are 170 m apart (> 67.84). B is 474 m from each (<= 960); lowered onto y = 15 it
  // leaves 60 m (<= 67.84) on each side, so all three are one town of 18 houses: walls x [0, 270],
  // y [0, 530], techum x [-960, 1230], y [-960, 1490].
  const villages = town6(0, 0).concat(town6(220, 0), town6(110, 500));
  const villageRuns = [200, 600, 3000].map((startM) => load(villages, S, { x: 5, y: 5 }, around({ x: 5, y: 5 }, startM)));
  assert('rev18.3: a town joined by three villages to a village 474 m away is loaded whole from any start: 18 houses, walls x [0, 270], y [0, 530], techum x [-960, 1230], y [-960, 1490]',
    villageRuns.every(({ result }) => result && homeOf(result) === 18 && has(result, 'three-villages') &&
      sameSpan(span(result.cityCorners), { minX: 0, maxX: 270, minY: 0, maxY: 530 }) &&
      sameSpan(span(result.techumCorners), { minX: -960, maxX: 1230, minY: -960, maxY: 1490 })),
    JSON.stringify(villageRuns.map(({ result, passes }) => ({ home: homeOf(result), passes: passes.length }))));
  assert('rev18.3: each three-villages join records the round it was made in (the villages above join in round 1)',
    villageRuns[2].result.warnings.filter((w) => w.type === 'three-villages').every((w) => w.round === 1),
    JSON.stringify(villageRuns[2].result.warnings.filter((w) => w.type === 'three-villages').map((w) => w.round)));

  // A cut middle village: H x [0, 50] and C x [2000, 2050] (1950 m apart); the middle village is a
  // row of 49 houses 40 m apart at y [900, 910], x [60, 1990]. Lowered onto H and C it leaves 10 m
  // on each side, and it is 870 m from each, so the three are one town of 61 houses. From 1200 m
  // the row is cut by the loaded edge and C is not loaded; the cut row must be followed whole.
  const cut = town6(0, 0).concat(town6(2000, 0), (() => { const out = []; for (let x = 60; x + 10 <= 1990; x += 40) out.push(box(x, 900, x + 10, 910)); return out; })());
  const cutRuns = [300, 1200].map((startM) => load(cut, S, { x: 5, y: 5 }, around({ x: 5, y: 5 }, startM)));
  assert('rev18.3: a middle village cut by the loaded edge is loaded whole, and with it the outer village 1950 m away: 61 houses from 300 and 1200 m',
    cutRuns.every((run) => homeOf(run.result) === 61 && sameAsWhole(run, cut, S, { x: 5, y: 5 })),
    JSON.stringify(cutRuns.map(({ result, passes }) => ({ home: homeOf(result), passes: passes.length }))));

  // Cascades: a far village changes the home town through joins made one after another, so no
  // fixed reach is enough. H x [0, 50]; C x [2000, 2050]; B a row x [300, 1950] at y 900 (250 m
  // left of it, so (H, B, C) fails); B' x [110, 160] at y 900. Level 2: M x [200, 250] at y 1500
  // fits between B' and B (40 m and 50 m), so (B', M, B) joins in round 1 and (H, B'+M+B, C) in
  // round 2: 66 houses; without M, 6. M is two 2000-amah steps from H (H to B', B' to M).
  // Level 3: instead of M, two columns Ma x [200, 210] and Mb x [280, 290], y [1500, 1710], that
  // fit between B' and B only together; X x [240, 250], y [2400, 2610], joins them in round 1,
  // then (B', Ma+X+Mb, B) in round 2 and (H, ..., C) in round 3: 78 houses; without X, 6. X is
  // three steps from H, so a rule of two steps would stop before it.
  const row = (x0, x1, y0) => { const out = []; for (let x = x0; x + 10 <= x1 + 1e-9; x += 40) out.push(box(x, y0, x + 10, y0 + 10)); return out; };
  const column = (x0, y0) => { const out = []; for (let k = 0; k < 6; k++) out.push(box(x0, y0 + 40 * k, x0 + 10, y0 + 40 * k + 10)); return out; };
  const base = () => town6(0, 0).concat(town6(2000, 0), row(300, 1950, 900), town6(110, 900));
  const level2 = base().concat(town6(200, 1500));
  const level3 = base().concat(column(200, 1500), column(280, 1500), column(240, 2400));
  const pin = { x: 5, y: 5 };
  const level2Run = load(level2, S, pin, around(pin, 1200)), level3Run = load(level3, S, pin, around(pin, 1200));
  const rounds = (r) => r.warnings.filter((w) => w.type === 'three-villages').map((w) => w.round);
  assert('rev18.3: level-2 cascade: the village 1.5 km out that joins B\' and B is loaded, and the home town is 66 houses (6 without it), joined in rounds 1 and 2',
    homeOf(level2Run.result) === 66 && sameAsWhole(level2Run, level2, S, pin) && rounds(level2Run.result).join() === '1,2' &&
      homeOf(G.runPipeline(base(), S, pin)) === 6,
    JSON.stringify({ home: homeOf(level2Run.result), rounds: rounds(level2Run.result), passes: level2Run.passes.length }));
  assert('rev18.3: level-3 cascade: the village three 2000-amah steps out is loaded, and the home town is 78 houses (6 without it), joined in rounds 1, 2 and 3',
    homeOf(level3Run.result) === 78 && sameAsWhole(level3Run, level3, S, pin) && rounds(level3Run.result).join() === '1,2,3' &&
      homeOf(G.runPipeline(base().concat(column(200, 1500), column(280, 1500)), S, pin)) === 6,
    JSON.stringify({ home: homeOf(level3Run.result), rounds: rounds(level3Run.result), passes: level3Run.passes.length }));

  // Every pin in the town and either profile first: a pin on a house of each joined village, in
  // the street between two houses, and beside the town; Mishna Berura, then Chazon Ish on the tiles
  // the first one loaded, and the other way round. Each answer is the whole map's answer.
  const pins = [{ x: 5, y: 5 }, { x: 225, y: 5 }, { x: 115, y: 505 }, { x: 15, y: 5 }, { x: -12, y: 5 }];
  const orders = [[MB, CI], [CI, MB]];
  const pinOrderOk = pins.every((p) => orders.every(([first, second]) => {
    const a = load(villages, first, p, around(p, 600));
    const b = load(villages, second, p, a.loaded);
    return sameAsWhole(a, villages, first, p) && sameAsWhole(b, villages, second, p);
  }));
  assert('rev18.3: from a house of each village, the street, and beside the town, with either profile first, every answer is the whole map\'s answer', pinOrderOk);

  // dataNeeds itself: a lone town is complete once the tiles around it are loaded; a cut chain is
  // not, and it names the missing tiles as 'i/j' keys, nearest steps of the chain first. An older
  // snapshot's single box is complete only when the box holds what the result needs.
  const lone = town6(0, 0);
  const loneRun = load(lone, S, pin, around(pin, 1200));
  const cutNeeds = chainRuns[1].passes[0].needs;
  assert('rev18.3: a lone town is complete after the first pass; a cut chain names missing tiles as i/j keys',
    loneRun.passes.length === 1 && loneRun.passes[0].needs.complete && loneRun.passes[0].needs.chain.towns === 1 &&
      !cutNeeds.complete && cutNeeds.tiles.length > 0 && cutNeeds.tiles.every((key) => /^-?\d+\/-?\d+$/.test(key)),
    JSON.stringify({ lone: loneRun.passes.length, cut: cutNeeds.tiles.slice(0, 3) }));
  const loneResult = G.runPipeline(lone, S, pin);
  const wide = degreesOf({ minX: -2500, maxX: 2500, minY: -2500, maxY: 2500 }), narrow = degreesOf({ minX: -500, maxX: 500, minY: -500, maxY: 500 });
  assert('rev18.3: an older snapshot box is complete only when it holds the town\'s techum and its 2000 amos',
    G.dataNeeds(lone, loneResult, { proj, bbox: wide, pin }).complete && !G.dataNeeds(lone, loneResult, { proj, bbox: narrow, pin }).complete);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
