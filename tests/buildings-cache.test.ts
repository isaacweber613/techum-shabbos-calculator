import assert from 'node:assert/strict';
import {
  TILE_DEG,
  MAX_TILES_PER_REQUEST,
  tileIndex,
  tileKey,
  tileBBox,
  tilesForBBox,
  mergeBuildings,
  filterBuildingsToBBox,
  oldestIso,
  isValidBBox,
  parseTileKey,
  bboxForTiles,
  parseBBoxParams,
  releasesForBuildings,
  overtureFetchGroups,
} from '../worker/buildings.ts';
import {
  OVERTURE_RELEASE,
  overtureFeatureToBuildings,
  preferLargestDuplicate,
  tilesForOvertureBBox,
  overtureArchiveUrl,
  resolveOvertureRelease,
  OVERTURE_STAC_CATALOG,
  _resetOvertureReleaseCache,
  MAX_OVERTURE_TILES,
} from '../worker/overture.ts';
import { validateCorrectionInput } from '../worker/corrections.ts';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const clientData = require('../js/data.js').TechumData;

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
  assert.equal(tileKey(2037, -3701), `v2/2037/-3701`);
  assert.deepEqual(parseTileKey('v2/2037/-3701'), { i: 2037, j: -3701, key: 'v2/2037/-3701' });
  assert.equal(parseTileKey('v1/1/2'), null);
});

test('high-latitude cold fills split into Overture-sized fetch groups covering every tile', () => {
  for (const [lat, lon] of [[51.5, -0.12], [53.48, -2.24], [59.9, 10.75], [41.7, -74.6]]) {
    const tiles = tilesForBBox({ south: lat, west: lon, north: lat + 0.12, east: lon + 0.12 });
    const groups = overtureFetchGroups(tiles);
    assert.deepEqual(groups.flat().map((t) => t.key).sort(), tiles.map((t) => t.key).sort());
    for (const group of groups) assert.ok(tilesForOvertureBBox(bboxForTiles(group)).length <= MAX_OVERTURE_TILES);
    if (lat < 45) assert.equal(groups.length, 1);
  }
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
  assert.ok(tiles.every((t) => t.key.startsWith('v2/')));
});

test('bboxForTiles covers the complete cold tile group in one upstream query', () => {
  const tiles = [
    { i: 10, j: -5, key: tileKey(10, -5) },
    { i: 12, j: -3, key: tileKey(12, -3) },
  ];
  assert.deepEqual(bboxForTiles(tiles), {
    south: 10 * TILE_DEG,
    west: -5 * TILE_DEG,
    north: 13 * TILE_DEG,
    east: -2 * TILE_DEG,
  });
  assert.throws(() => bboxForTiles([]), /at least one tile/);
});

test('isValidBBox rejects oversized spans', () => {
  assert.equal(isValidBBox({ south: 0, west: 0, north: 0.05, east: 0.05 }), true);
  assert.equal(isValidBBox({ south: 0, west: 0, north: 1, east: 1 }), false);
  assert.equal(isValidBBox({ south: 1, west: 0, north: 0, east: 1 }), false);
});

test('bbox parsing rejects missing and blank coordinates instead of treating them as zero', () => {
  assert.equal(parseBBoxParams(new URLSearchParams('west=1&north=2&east=2')), null);
  assert.equal(parseBBoxParams(new URLSearchParams('south=&west=1&north=2&east=2')), null);
  assert.deepEqual(parseBBoxParams(new URLSearchParams('south=0&west=1&north=2&east=2')),
    { south: 0, west: 1, north: 2, east: 2 });
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

test('Overture bbox resolves to a bounded z14 tile set', () => {
  const tiles = tilesForOvertureBBox({ south: 41.724, west: -74.585, north: 41.735, east: -74.560 });
  assert.ok(tiles.length >= 1 && tiles.length <= 4, `tiles=${tiles.length}`);
  assert.ok(tiles.every((tile) => tile.z === 14));
});

test('Overture feature preserves source identity and residential class', () => {
  const buildings = overtureFeatureToBuildings({
    geometry: { type: 'Polygon', coordinates: [[[-74.58, 41.72], [-74.57, 41.72], [-74.57, 41.73], [-74.58, 41.72]]] },
    properties: { id: 'abc', class: 'detached', subtype: 'residential', '@geometry_source': 'OpenStreetMap' },
  });
  assert.equal(buildings.length, 1);
  assert.equal(buildings[0].id, 'ovt:abc');
  assert.equal(buildings[0].tags.building, 'detached');
  assert.equal(buildings[0].tags.geometry_source, 'OpenStreetMap');
  assert.equal(buildings[0].tags.overture_release, OVERTURE_RELEASE);
});

test('Overture duplicate fragments keep the largest geometry', () => {
  const small = { id: 'ovt:x', tags: {}, ringLatLon: [
    { lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 0 },
  ] };
  const large = { id: 'ovt:x', tags: {}, ringLatLon: [
    { lat: 0, lon: 0 }, { lat: 0, lon: 2 }, { lat: 2, lon: 2 }, { lat: 2, lon: 0 },
  ] };
  assert.equal(preferLargestDuplicate([small, large])[0].ringLatLon.length, 4);
});

test('shared correction validation requires a local bounded source ring', () => {
  const ring = [{ lat: 41.72, lon: -74.58 }, { lat: 41.72, lon: -74.579 }, { lat: 41.721, lon: -74.579 }];
  const valid = validateCorrectionInput({ sourceId: 'ovt:abc', decision: 'exclude', sourceRing: ring });
  assert.equal(valid?.sourceId, 'ovt:abc');
  assert.equal(validateCorrectionInput({ sourceId: 'ovt:abc', decision: 'exclude' }), null);
  assert.equal(validateCorrectionInput({ decision: 'include', ringLatLon: [{ lat: 0, lon: 0 }] }), null);
});

test('client request splitting always produces bboxes this Worker accepts', () => {
  const areas = [
    { south: 40.55, west: -74.08, north: 40.79, east: -73.83 },
    { south: 41.0013, west: -74.2077, north: 41.2391, east: -73.9409 },
    { south: -33.99, west: 18.37, north: -33.81, east: 18.61 },
    { south: 51.43, west: -0.31, north: 51.6, east: 0.02 },
  ];
  for (const area of areas) {
    const parts = clientData._internals.splitServerBBox(area);
    assert.ok(parts.length > 1, 'test areas exceed one request');
    for (const part of parts) {
      assert.ok(isValidBBox(part), `invalid part ${JSON.stringify(part)}`);
      assert.ok(tilesForBBox(part).length <= MAX_TILES_PER_REQUEST, `too many tiles ${JSON.stringify(part)}`);
    }
    const covered = new Set(parts.flatMap((part) => tilesForBBox(part).map((tile) => tile.key)));
    for (const tile of tilesForBBox(area)) assert.ok(covered.has(tile.key), `tile ${tile.key} not requested`);
  }
});

test('response release names every Overture release actually present', () => {
  const ring = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 0 }];
  const old = { id: 'ovt:a', tags: { overture_release: '2026-06-17.0' }, ringLatLon: ring };
  const fresh = { id: 'ovt:b', tags: { overture_release: '2026-09-23.1' }, ringLatLon: ring };
  const shared = { id: 'shared:1', tags: { building: 'yes' }, ringLatLon: ring };
  assert.deepEqual(releasesForBuildings([fresh, old, shared, fresh], ['x']), ['2026-06-17.0', '2026-09-23.1']);
  assert.deepEqual(releasesForBuildings([], ['2026-09-23.1', '2026-09-23.1']), ['2026-09-23.1']);
});

test('Overture archive URLs only accept release-shaped names', () => {
  assert.match(overtureArchiveUrl('2026-09-23.1'), /\/tiles\/2026-09-23\.1\/buildings\.pmtiles$/);
  assert.throws(() => overtureArchiveUrl('../evil'));
});

const asyncTests: Promise<void>[] = [];
function testAsync(name: string, fn: () => Promise<void>) {
  asyncTests.push(fn().then(() => { passed++; console.log('  ok  ' + name); }, (e) => {
    console.error('FAIL  ' + name + ' — ' + (e instanceof Error ? e.message : e));
    process.exitCode = 1;
  }));
}

function fakeFetch(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const impl = async (input: string, init?: RequestInit) => {
    calls.push(`${init?.method || 'GET'} ${input}`);
    const route = routes[`${init?.method || 'GET'} ${input}`];
    return route ? route() : new Response('missing', { status: 404 });
  };
  return { impl, calls };
}

testAsync('a deleted pinned Overture release falls back to the catalog latest release', async () => {
  _resetOvertureReleaseCache();
  const { impl, calls } = fakeFetch({
    [`GET ${OVERTURE_STAC_CATALOG}`]: () => Response.json({ latest: '2099-01-01.0' }),
    [`HEAD ${overtureArchiveUrl('2099-01-01.0')}`]: () => new Response(null, { status: 200 }),
  });
  assert.equal(await resolveOvertureRelease(impl, 1000), '2099-01-01.0');
  assert.equal(calls[0], `HEAD ${overtureArchiveUrl(OVERTURE_RELEASE)}`);
  const before = calls.length;
  assert.equal(await resolveOvertureRelease(impl, 2000), '2099-01-01.0', 'resolution is cached');
  assert.equal(calls.length, before);
  _resetOvertureReleaseCache();
});

testAsync('a published pinned release is used without consulting the catalog', async () => {
  _resetOvertureReleaseCache();
  const { impl, calls } = fakeFetch({
    [`HEAD ${overtureArchiveUrl(OVERTURE_RELEASE)}`]: () => new Response(null, { status: 200 }),
  });
  assert.equal(await resolveOvertureRelease(impl, 1000), OVERTURE_RELEASE);
  assert.deepEqual(calls, [`HEAD ${overtureArchiveUrl(OVERTURE_RELEASE)}`]);
  _resetOvertureReleaseCache();
});

testAsync('transient archive failures surface instead of silently switching releases', async () => {
  _resetOvertureReleaseCache();
  const { impl } = fakeFetch({
    [`HEAD ${overtureArchiveUrl(OVERTURE_RELEASE)}`]: () => new Response(null, { status: 503 }),
  });
  await assert.rejects(resolveOvertureRelease(impl, 1000), /HTTP 503/);
  _resetOvertureReleaseCache();
});

await Promise.all(asyncTests);
console.log(`building tile cache: ${passed} tests passed`);
