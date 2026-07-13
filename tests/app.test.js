const assert = require('node:assert/strict');
const D = require('../js/data.js').TechumData;
const S = require('../js/settings.js').TechumSettings;
const K = require('../js/kml.js').TechumKML;
const fs = require('node:fs');
const path = require('node:path');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + ' — ' + e.message); process.exitCode = 1; }
}

test('classification table separates dwelling/non/review/unknown', () => {
  assert.equal(D.classify({ building: 'house' }).klass, 'dwelling');
  assert.equal(D.classify({ building: 'warehouse' }).klass, 'non');
  assert.equal(D.classify({ building: 'hotel' }).klass, 'review');
  assert.equal(D.classify({ building: '<img onerror=alert(1)>' }).klass, 'unknown');
});

test('data confidence is deterministic and does not claim map completeness', () => {
  const report = D.computeDataConfidence([
    { tags: { building: 'house' }, ringLatLon: [{}, {}, {}] },
    { tags: { building: 'hotel' }, ringLatLon: [{}, {}, {}] },
    { tags: { building: 'yes' }, ringLatLon: [{}, {}, {}] },
    { tags: { building: 'warehouse' }, ringLatLon: [] },
  ]);
  assert.equal(report.total, 4);
  assert.deepEqual(report.counts, { dwelling: 1, non: 1, review: 1, unknown: 1, invalidGeometry: 1 });
  assert.equal(report.taggedRate, 0.75);
  assert.equal(report.needsReview, 3);
  assert.match(report.limitations[0], /not whether every real building/i);
});

test('multipolygon outers become stable pseudo-buildings', () => {
  const geometry = [{ lat: 1, lon: 2 }, { lat: 1, lon: 3 }, { lat: 2, lon: 3 }];
  const parsed = D._internals.parseOverpass({ elements: [{
    type: 'relation', id: 7, tags: { building: 'apartments' }, members: [
      { role: 'outer', geometry }, { role: 'inner', geometry }, { role: 'outer', geometry },
    ],
  }] });
  assert.deepEqual(parsed.map((b) => b.id), ['r7_0', 'r7_1']);
  assert.equal(parsed[0].tags.building, 'apartments');
});

test('Photon autocomplete labels are readable and deduplicated', () => {
  assert.equal(D._internals.photonLabel({
    housenumber: '10', street: 'Downing Street', city: 'London', state: 'London',
    postcode: 'SW1A 2AA', country: 'United Kingdom',
  }), '10 Downing Street, London, SW1A 2AA, United Kingdom');
});

test('address entry requires choosing an autocomplete suggestion', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.doesNotMatch(html, /id=["']btn-search["']/);
  assert.doesNotMatch(main, /function onSearch\s*\(/);
  assert.match(main, /Choose one of the suggested addresses before continuing/);
  assert.doesNotMatch(main, /\.value\s*=\s*["']My location["']/);
});

test('agent performance reports stay out of the public calculator UI', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'analytics.html'), 'utf8');
  assert.doesNotMatch(main, /Copy agent report|btn-copy-performance|paste it into an agent task/);
  assert.match(analytics, /Calculation performance reports/);
  assert.match(analytics, /Copy report/);
});

test('ordinary users get one automatic Overture result with optional corrections', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.doesNotMatch(html, /Compare Overture GeoJSON|btn-import-overture/);
  assert.match(html, /Two-click rectangle/);
  assert.match(main, /Automatic building map ready/);
  assert.match(main, /submitBuildingCorrection/);
  assert.equal(S.DEFAULTS.showVerifiedOnly, false);
});

test('settings profile and non-default analytics stay deterministic', () => {
  const ci = S.applyProfile({ ...S.DEFAULTS }, 'chazon-ish');
  assert.equal(S.effectiveProfile(ci), 'chazon-ish');
  ci.karpef = false;
  assert.equal(S.effectiveProfile(ci), 'custom');
  assert.equal(S.diffFromDefaults(ci).karpef, false);
});

test('KML escapes dynamic description and names', () => {
  const kml = K.buildKML({
    pin: { lat: 1, lon: 2 },
    city: [{ lat: 1, lon: 2 }, { lat: 1, lon: 3 }, { lat: 2, lon: 3 }],
  }, '<script>alert(1)</script>&');
  assert.ok(!kml.includes('<script>'));
  assert.ok(kml.includes('&lt;script&gt;alert(1)&lt;/script&gt;&amp;'));
});

test('validated enclosures can be drawn easily but remain inactive by default', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.match(html, /id="btn-draw-perimeter"/);
  assert.match(mainJs, /startDrawing\('enclosure'\)/);
  assert.match(mainJs, /settings\.useValidatedPerimeter = false/);
});

test('Overture GeoJSON parser preserves source identity without guessing dwelling status', () => {
  const parsed = D.parseOvertureGeoJSON({ type: 'FeatureCollection', features: [{
    type: 'Feature', id: 'abc', properties: { subtype: 'residential' },
    geometry: { type: 'Polygon', coordinates: [[[-74, 40], [-73.9, 40], [-73.9, 40.1], [-74, 40]]] },
  }] });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, 'ovt:abc');
  assert.equal(parsed[0].source, 'overture');
  assert.equal(parsed[0].klass, 'unknown');
  assert.deepEqual(parsed[0].tags, {});
});

test('Overture comparison reports intersecting and unmatched review candidates', () => {
  const ring = (west, south, east, north) => [
    { lon: west, lat: south }, { lon: east, lat: south },
    { lon: east, lat: north }, { lon: west, lat: north }, { lon: west, lat: south },
  ];
  const osm = [{ id: 'w1', ringLatLon: ring(0, 0, 1, 1) }];
  const overture = [
    { id: 'ovt:match', ringLatLon: ring(0.5, 0.5, 1.5, 1.5) },
    { id: 'ovt:review', ringLatLon: ring(3, 3, 4, 4) },
  ];
  const report = D.compareBuildingSources(osm, overture);
  assert.equal(report.matchedOverture, 1);
  assert.deepEqual(report.unmatchedOverture.map((b) => b.id), ['ovt:review']);
  assert.match(report.limitations[0], /not proof/i);
});

test('KML can carry advanced audit footprints and measurement lines', () => {
  const triangle = [{ lat: 1, lon: 2 }, { lat: 1, lon: 3 }, { lat: 2, lon: 3 }];
  const kml = K.buildKML({
    buildings: [triangle], settlements: [triangle],
    auditLines: [{ name: '70 2/3 amah gap', description: '<review>', path: triangle.slice(0, 2) }],
  }, 'audit');
  assert.match(kml, /Mapped building 1/);
  assert.match(kml, /Derived settlement 1/);
  assert.match(kml, /70 2\/3 amah gap/);
  assert.ok(kml.includes('&lt;review&gt;'));
});

test('GeoJSON audit export is closed, structured, and review-labelled', () => {
  const triangle = [{ lat: 1, lon: 2 }, { lat: 1, lon: 3 }, { lat: 2, lon: 3 }];
  const geojson = K.buildGeoJSON({
    pin: triangle[0], techum: triangle, buildings: [triangle],
    auditLines: [{ name: 'join', kind: 'threshold', path: triangle.slice(0, 2) }],
  }, { engineVersion: 'test' });
  assert.equal(geojson.properties.draft, true);
  assert.equal(geojson.properties.engineVersion, 'test');
  assert.deepEqual(geojson.features[1].geometry.coordinates[0][0],
    geojson.features[1].geometry.coordinates[0].at(-1));
  assert.ok(geojson.features.some((f) => f.properties.layer === 'audit-measurement'));
});

test('KMZ export is a valid single-file ZIP containing doc.kml', () => {
  const bytes = K.buildKMZ('<?xml version="1.0"?><kml/>');
  assert.equal(Buffer.from(bytes).readUInt32LE(0), 0x04034b50);
  assert.equal(Buffer.from(bytes).readUInt32LE(bytes.length - 22), 0x06054b50);
  assert.ok(Buffer.from(bytes).includes(Buffer.from('doc.kml')));
});

test('manual footprint import accepts Polygon and MultiPolygon without polygon holes', () => {
  const footprints = K.parseGeoJSONFootprints({ type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [
      [[2, 1], [3, 1], [3, 2], [2, 1]], [[2.1, 1.1], [2.2, 1.1], [2.1, 1.2], [2.1, 1.1]],
    ] } },
    { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [
      [[[4, 3], [5, 3], [5, 4], [4, 3]]], [[[6, 5], [7, 5], [7, 6], [6, 5]]],
    ] } },
  ] });
  assert.equal(footprints.length, 3);
  assert.deepEqual(footprints[0][0], { lat: 1, lon: 2 });
  assert.equal(footprints[0].length, 3, 'closing coordinate is removed');
});

console.log(`\n${passed} app tests passed`);
