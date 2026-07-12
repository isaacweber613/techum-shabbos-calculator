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

console.log(`\n${passed} projection/performance tests passed`);
