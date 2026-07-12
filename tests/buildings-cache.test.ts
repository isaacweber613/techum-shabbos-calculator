import assert from 'node:assert/strict';
import {
  TILE_DEG,
  MAX_TILES_PER_REQUEST,
  tileIndex,
  tileKey,
  tileBBox,
  tilesForBBox,
  parseOverpass,
  mergeBuildings,
  filterBuildingsToBBox,
  oldestIso,
  isValidBBox,
  parseTileKey,
} from '../worker/buildings.ts';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) {
    console.error('FAIL  ' + name + ' — ' + (e instanceof Error ? e.message : e));
    process.exitCode = 1;
  }
}

test('tile index and key round-trip', () => {
  assert.equal(tileIndex(40.74), Math.floor(40.74 / TILE_DEG));
  assert.equal(tileKey(2037, -3701), `v1/2037/-3701`);
  assert.deepEqual(parseTileKey('v1/2037/-3701'), { i: 2037, j: -3701, key: 'v1/2037/-3701' });
  assert.equal(parseTileKey('v0/1/2'), null);
});

test('tile bbox is half-open degree cell', () => {
  const box = tileBBox(10, -5);
  assert.equal(box.south, 10 * TILE_DEG);
  assert.equal(box.north, 11 * TILE_DEG);
  assert.equal(box.west, -5 * TILE_DEG);
  assert.equal(box.east, -4 * TILE_DEG);
});

test('tilesForBBox covers pin-sized radius with a few cells', () => {
  // ~1.2 km at mid-lat is under one tile; still at least one cell.
  const bbox = { south: 40.74, west: -74.01, north: 40.76, east: -73.99 };
  const tiles = tilesForBBox(bbox);
  assert.ok(tiles.length >= 1);
  assert.ok(tiles.length <= MAX_TILES_PER_REQUEST);
  assert.ok(tiles.every((t) => t.key.startsWith('v1/')));
});

test('isValidBBox rejects oversized spans', () => {
  assert.equal(isValidBBox({ south: 0, west: 0, north: 0.05, east: 0.05 }), true);
  assert.equal(isValidBBox({ south: 0, west: 0, north: 1, east: 1 }), false);
  assert.equal(isValidBBox({ south: 1, west: 0, north: 0, east: 1 }), false);
});

test('parseOverpass matches client multipolygon pseudo-ids', () => {
  const geometry = [{ lat: 1, lon: 2 }, { lat: 1, lon: 3 }, { lat: 2, lon: 3 }];
  const parsed = parseOverpass({ elements: [{
    type: 'relation', id: 7, tags: { building: 'apartments' }, members: [
      { role: 'outer', geometry }, { role: 'inner', geometry }, { role: 'outer', geometry },
    ],
  }, {
    type: 'way', id: 9, tags: { building: 'house' }, geometry,
  }] });
  assert.deepEqual(parsed.map((b) => b.id), ['r7_0', 'r7_1', 'w9']);
});

test('mergeBuildings dedupes by id across tiles', () => {
  const a = [{ id: 'w1', tags: {}, ringLatLon: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 0 }] }];
  const b = [{ id: 'w1', tags: { building: 'yes' }, ringLatLon: a[0].ringLatLon },
    { id: 'w2', tags: {}, ringLatLon: a[0].ringLatLon }];
  const merged = mergeBuildings([a, b]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((x) => x.id).sort(), ['w1', 'w2']);
});

test('filterBuildingsToBBox keeps intersecting footprints', () => {
  const ring = (west: number, south: number, east: number, north: number) => [
    { lon: west, lat: south }, { lon: east, lat: south },
    { lon: east, lat: north }, { lon: west, lat: north },
  ];
  const buildings = [
    { id: 'in', tags: {}, ringLatLon: ring(0.1, 0.1, 0.2, 0.2) },
    { id: 'out', tags: {}, ringLatLon: ring(5, 5, 6, 6) },
  ];
  const kept = filterBuildingsToBBox(buildings, { south: 0, west: 0, north: 1, east: 1 });
  assert.deepEqual(kept.map((b) => b.id), ['in']);
});

test('oldestIso picks earliest timestamp', () => {
  assert.equal(oldestIso(['2026-07-12T12:00:00.000Z', '2026-07-10T12:00:00.000Z']), '2026-07-10T12:00:00.000Z');
});

console.log(`building tile cache: ${passed} tests passed`);
