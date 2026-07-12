const assert = require('node:assert/strict');
const G = require('../js/geometry.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + ' — ' + e.message); process.exitCode = 1; }
}

test('projection round-trips metro-scale coordinates', () => {
  for (const origin of [[0, 0], [40.7, -74], [51.5, -0.1], [69, 18]]) {
    const p = G.makeProjection(origin[0], origin[1]);
    for (const offset of [[0.15, 0.2], [-0.15, -0.2], [0.08, -0.18]]) {
      const expected = { lat: origin[0] + offset[0], lon: origin[1] + offset[1] };
      const xy = p.toXY(expected.lat, expected.lon);
      const actual = p.toLatLon(xy.x, xy.y);
      assert.ok(Math.abs(actual.lat - expected.lat) < 1e-10);
      assert.ok(Math.abs(actual.lon - expected.lon) < 1e-10);
    }
  }
});

test('grid index keeps a 20,000-footprint sparse clustering pass practical', () => {
  const buildings = [];
  for (let i = 0; i < 20000; i++) {
    const x = (i % 200) * 100;
    const y = Math.floor(i / 200) * 100;
    buildings.push({ id: String(i), ring: [{ x, y }, { x: x + 8, y }, { x: x + 8, y: y + 8 }, { x, y: y + 8 }] });
  }
  const started = Date.now();
  const clusters = G._internals.clusterBuildings(buildings, 34);
  assert.equal(clusters.length, buildings.length);
  assert.ok(Date.now() - started < 10000, '20k clustering exceeded 10 seconds');
});

test('three-villages analysis skips thousands of non-city singleton clusters', () => {
  const buildings = [];
  for (let i = 0; i < 3000; i++) {
    const x = (i % 100) * 100, y = Math.floor(i / 100) * 100;
    buildings.push({ id: String(i), included: true, klass: 'dwelling', bbox: { minX: x, minY: y, maxX: x + 8, maxY: y + 8 }, ring: [{ x, y }, { x: x + 8, y }, { x: x + 8, y: y + 8 }, { x, y: y + 8 }] });
  }
  const started = Date.now();
  const result = G.runPipeline(buildings, { amahM: 0.48, karpef: true, minCityHouses: 6, overlapMerge: false, squaringAngleDeg: 0 }, { x: 0, y: 0 });
  assert.equal(result.clusters.length, buildings.length);
  assert.ok(Date.now() - started < 3000, 'non-city filtering exceeded 3 seconds');
});

test('engine reports actionable per-stage timings', () => {
  const buildings = [];
  for (let i = 0; i < 100; i++) {
    const x = (i % 10) * 20, y = Math.floor(i / 10) * 20;
    buildings.push({ id: String(i), included: true, bbox: { minX: x, minY: y, maxX: x + 8, maxY: y + 8 },
      ring: [{ x, y }, { x: x + 8, y }, { x: x + 8, y: y + 8 }, { x, y: y + 8 }] });
  }
  const result = G.runPipeline(buildings, { amahM: 0.48, karpef: true, minCityHouses: 6, overlapMerge: false, squaringAngleDeg: 0 }, { x: 5, y: 5 });
  assert.ok(result.engineTimings.total >= 0);
  for (const stage of ['iburClustering', 'clusterAssembly', 'cityQualification', 'cityMerges', 'threeVillages', 'homeSelection', 'boundaryAndWarnings']) {
    assert.equal(typeof result.engineTimings[stage], 'number', `missing timing for ${stage}`);
  }
});

test('spatially pruned city merges and three-villages stay practical', () => {
  const buildings = [];
  let id = 0;
  for (let city = 0; city < 80; city++) {
    const baseX = (city % 10) * 180, baseY = Math.floor(city / 10) * 180;
    for (let house = 0; house < 6; house++) {
      const x = baseX + (house % 3) * 14, y = baseY + Math.floor(house / 3) * 14;
      buildings.push({ id: String(id++), included: true, bbox: { minX: x, minY: y, maxX: x + 8, maxY: y + 8 },
        ring: [{ x, y }, { x: x + 8, y }, { x: x + 8, y: y + 8 }, { x, y: y + 8 }] });
    }
  }
  const started = Date.now();
  const result = G.runPipeline(buildings, { amahM: 0.48, karpef: true, minCityHouses: 6, overlapMerge: false, squaringAngleDeg: 0 }, { x: 5, y: 5 });
  assert.equal(result.mode, 'city');
  assert.ok(Date.now() - started < 5000, 'city merge/three-villages fixture exceeded 5 seconds');
});

console.log(`\n${passed} projection/performance tests passed`);
