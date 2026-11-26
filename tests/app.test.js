const assert = require('node:assert/strict');
const D = require('../js/data.js').TechumData;
const S = require('../js/settings.js').TechumSettings;
const K = require('../js/kml.js').TechumKML;
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + ' — ' + e.message); process.exitCode = 1; }
}

test('classification table separates dwelling/non/review/unknown', () => {
  assert.equal(D.classify({ building: 'house' }).klass, 'dwelling');
  assert.equal(D.classify({ building: 'warehouse' }).klass, 'non');
  assert.equal(D.classify({ building: 'hotel' }).klass, 'review');
  for (const building of ['office', 'industrial', 'commercial', 'factory']) {
    assert.equal(D.classify({ building }).klass, 'review', `${building} needs factual beis-dirah review`);
  }
  assert.equal(D.classify({ building: 'retail' }).klass, 'non');
  for (const building of ['church', 'chapel', 'cathedral', 'mosque', 'temple', 'fire_station']) {
    assert.equal(D.classify({ building }).klass, 'review', `${building} may have a resident dirah (SA 398:6)`);
  }
  assert.equal(D.classify({ building: '<img onerror=alert(1)>' }).klass, 'unknown');
});

test('unlabeled Overture subtypes follow the equivalent class', () => {
  const sub = (overture_subtype) => D.classify({ building: 'yes', overture_subtype }).klass;
  assert.equal(sub('outbuilding'), 'non', 'sheds/garages are not a beis dirah');
  assert.equal(sub('residential'), 'dwelling');
  assert.equal(sub('agricultural'), 'review', 'may be a farmhouse');
  assert.equal(sub('industrial'), 'review');
  assert.equal(sub('military'), 'unknown', 'barracks can be dwellings');
  assert.equal(sub('constructor'), 'unknown', 'unmapped/prototype keys stay unknown');
  assert.equal(D.classify({ building: 'house', overture_subtype: 'outbuilding' }).klass, 'dwelling',
    'an explicit class wins over the broad subtype');
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

test('Photon autocomplete labels are readable and deduplicated', () => {
  assert.equal(D._internals.photonLabel({
    housenumber: '10', street: 'Downing Street', city: 'London', state: 'London',
    postcode: 'SW1A 2AA', country: 'United Kingdom',
  }), '10 Downing Street, London, SW1A 2AA, United Kingdom');
  assert.deepEqual(D._internals.dedupeAutocompleteResults([
    { lat: 1, lon: 2, label: '437 State Highway 42, Woodbourne, New York' },
    { lat: 1.0001, lon: 2.0001, label: '  437 State Highway 42,  Woodbourne, New York  ' },
    { lat: 3, lon: 4, label: 'Woodbourne, New York' },
  ]).map((result) => result.label), [
    '437 State Highway 42, Woodbourne, New York',
    'Woodbourne, New York',
  ]);
});

test('address entry requires choosing an autocomplete suggestion and location fills the address', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.doesNotMatch(html, /id=["']btn-search["']/);
  assert.doesNotMatch(main, /function onSearch\s*\(/);
  assert.match(main, /Choose one of the suggested addresses before continuing/);
  assert.match(main, /const result = await D\.reverseGeocode\(lat, lon\)/);
  assert.match(main, /document\.getElementById\('address'\)\.value = label/);
  assert.match(main, /scheduleAutomaticCalculation\(\)/);
  assert.match(main, /function reviewPinPlacementCandidate\(\)/);
  assert.doesNotMatch(main, /function snapPinToFootprint\(\)/);
  assert.match(main, /The calculator has <b>not moved it<\/b>/);
  assert.match(main, /id="btn-use-mapped-pin"/);
  assert.match(main, /id="btn-keep-exact-pin"/);
  assert.equal(typeof D.reverseGeocode, 'function');
});

test('accuracy uncertainty is prominent and review work is impact-ranked', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const experience = fs.readFileSync(path.join(__dirname, '..', 'js', 'design-experience.js'), 'utf8');
  assert.match(main, /City status needs rav review/);
  assert.match(main, /Building classification can move this boundary/);
  assert.match(main, /Review required before relying/);
  assert.match(main, /highest boundary impact first/);
  assert.match(main, /items\.slice\(0, 20\)/);
  assert.match(main, /starting place.*outer edge.*home city.*nearby/);
  assert.match(experience, /accuracyNotes\.forEach\(\(node\) => card\.append\(node\)\)/);
  assert.match(experience, /Your draft techum is ready/);
});

test('calm map defaults keep only the home audit label and collapse the mobile key', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const experience = fs.readFileSync(path.join(__dirname, '..', 'js', 'design-experience.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'design-experience.css'), 'utf8');
  assert.match(main, /if \(isHome\) L\.marker/);
  assert.match(experience, /class="map-key-toggle"/);
  assert.match(experience, /mapKey\.classList\.toggle\('open'\)/);
  assert.match(css, /#simple-map-key\.open \.map-key-items/);
});

test('simplified design directions calculate automatically and keep advanced controls progressive', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const experience = fs.readFileSync(path.join(__dirname, '..', 'js', 'design-experience.js'), 'utf8');
  assert.match(html, /\(\?:\[1-9\]\|10\)/);
  assert.match(html, /: '10';/);
  assert.match(main, /const isSimplifiedDirection = \/\^\(9\|10\)\$\//);
  assert.match(main, /scheduleAutomaticCalculation\(\)/);
  assert.match(main, /params\.has\('draftLat'\) && params\.has\('draftLon'\)/);
  assert.match(main, /realistic\.addTo\(map\)/);
  assert.match(main, /'Original satellite map': realistic/);
  assert.match(main, /'Original illustrated map': illustrated/);
  assert.match(experience, /quickSettings\.id = 'simple-quick-settings'/);
  assert.match(experience, /simple-settings-summary/);
  assert.match(experience, /mapKey\.id = 'simple-map-key'/);
  assert.match(experience, /Starting place \(city, building, or 4 amos\)/);
  assert.match(experience, /simple-review-notes/);
  assert.match(experience, /Calculation details/);
  assert.match(experience, /document\.body\.append\(drawer\)/);
  assert.match(experience, /const design = isDesignPreview \? requestedDesign : '10'/);
  assert.match(experience, /nav\.classList\.add\('production-review-nav'\)/);
  assert.match(experience, /Review controls/);
});

test('reference pink and green palette is shared by map, UI, PNG, and PDF exports', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const experience = fs.readFileSync(path.join(__dirname, '..', 'js', 'design-experience.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const baseCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'design-experience.css'), 'utf8');
  assert.match(main, /pink: '#F0A1B7'/);
  assert.match(main, /green: '#C8DF97'/);
  assert.match(main, /fillColor: MAP_PALETTE\.pink/);
  assert.match(main, /fillColor: MAP_PALETTE\.green/);
  assert.match(main, /pdf\.setFillColor\(240, 161, 183\)/);
  assert.match(main, /pdf\.setFillColor\(200, 223, 151\)/);
  assert.match(experience, /Pink area = the current draft/);
  assert.match(html, /<strong>Pink:<\/strong>/);
  assert.match(html, /<strong>Pale green dashed:<\/strong>/);
  assert.match(baseCss, /\.ln\.techum \{ border-color: #a94364/);
  assert.match(css, /--dx-pink:#f0a1b7/);
  assert.match(css, /--dx-green:#c8df97/);
});

test('reverse geocoding is proxied and validated by the Worker', () => {
  const worker = fs.readFileSync(path.join(__dirname, '..', 'worker', 'index.ts'), 'utf8');
  const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
  assert.match(worker, /async function reverseGeocode\(request: Request, env: Env\)/);
  assert.match(worker, /url\.pathname === '\/api\/reverse-geocode'/);
  assert.match(worker, /reverse:\$\{lat\.toFixed\(5\)\},\$\{lon\.toFixed\(5\)\}/);
  assert.match(data, /'\/api\/reverse-geocode\?' \+ params\.toString\(\)/);
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

test('automatic result keeps messages, exposes a retry, and keeps the audit toggle reachable', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const design = fs.readFileSync(path.join(__dirname, '..', 'js', 'design-experience.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'design-experience.css'), 'utf8');
  assert.match(html, /id="btn-retry"/);
  assert.match(main, /setRetryVisible\(!succeeded\)/);
  assert.match(main, /btn-retry'\)\.addEventListener\('click', \(\) => calculate\(false\)\)/);
  assert.doesNotMatch(css, /body\.has-result #status[^{]*\{[^}]*display:none/s);
  assert.match(css, /body\.has-result #status[^{]*\{[^}]*display:block/s);
  assert.match(design, /mapDisplayDetails\.prepend\(methodCallout\)/);
  assert.match(design, /location\.hostname === 'localhost'/);
});

test('a forced map-data refresh drops force after the first fill retry', () => {
  const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
  assert.match(data, /activeForce = force/);
  assert.match(data, /if \(activeForce\) \{ activeForce = false; params\.delete\('force'\); \}/);
});

test('analytics drops the empty address-search views and reports every export format and mode', () => {
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'analytics.html'), 'utf8');
  assert.doesNotMatch(analytics, /Address searches|Top address searches/);
  assert.match(analytics, /Exports \(all formats\)/);
  assert.match(analytics, /agg\.modes\.building/);
  const worker = fs.readFileSync(path.join(__dirname, '..', 'worker', 'index.ts'), 'utf8');
  assert.match(worker, /strftime\('%Y-%m-%d', \(t \/ 1000\) - \(\?1 \* 60\)/);
  assert.match(worker, /json_extract\(payload, '\$\.mode'\) = 'building'/);
});

test('audit map and city-status controls use the correct merge stage', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.match(main, /const settlementClusters = res\.clusters/);
  assert.match(main, /const qualificationClusters = res\.qualificationClusters/);
  assert.match(main, /visibleSettlements\.slice\(0, 40\)/);
  assert.match(main, /qualificationClusters\.forEach/);
  assert.match(main, /Use provisional six-footprint proxy/);
  assert.match(main, /Qualifies: 3 courtyards × 2 houses/);
  assert.match(main, /Qualifies: at least 50 residents/);
  assert.match(main, /qualification evidence/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /Six mapped footprints are only a provisional fallback/);
  assert.doesNotMatch(html, /City threshold: 6 houses/);
  for (const asset of ['style.css', 'geometry.js', 'data.js', 'settings.js', 'map-export.js', 'main.js']) {
    assert.match(html, new RegExp(asset.replace('.', '\\.') + '\\?v=(?:202607(?:14-(?:2|3)|15-[1-6]|20-1)|2026100[56]-[12]|20261023-[12]|20261109-[12]|20261110-[12]|20261125-[6-8])'));
  }
});

test('Google Maps is preferred with a metered same-site config and original-map fallback', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const worker = fs.readFileSync(path.join(__dirname, '..', 'worker', 'index.ts'), 'utf8');
  const config = fs.readFileSync(path.join(__dirname, '..', 'worker', 'map-config.ts'), 'utf8');
  assert.match(main, /fetch\('\/api\/map-config'/);
  assert.match(main, /maps\.googleapis\.com\/maps\/api\/js/);
  assert.match(main, /gm_authFailure/);
  assert.match(main, /disableGoogleMap/);
  assert.match(main, /switchBaseLayer\(originalMapLayer\)/);
  assert.match(main, /if \(!userSelectedBaseLayer\) switchBaseLayer\(googleBaseLayer\)/);
  assert.match(main, /prepareGoogleExportUnderlay/);
  assert.doesNotMatch(main, /restoreLayer === googleBaseLayer/);
  assert.match(main, /maps\.googleapis\.com\/maps\/api\/staticmap/);
  assert.match(main, /crossOrigin = 'anonymous'/);
  assert.match(main, /The map or calculation changed during export/);
  assert.match(main, /mapExportInProgress/);
  assert.match(main, /waitForBaseLayerReady\(originalMapLayer\)/);
  assert.match(main, /fallbackBasemap = 'original satellite map'/);
  assert.match(main, /calculated boundaries are unchanged/);
  assert.match(main, /leaflet-tile-loaded/);
  assert.match(main, /originalBaseLayer === googleBaseLayer/);
  assert.match(main, /app\.inert = true/);
  assert.match(main, /activeBaseLayer !== original\.baseLayer/);
  assert.match(main, /state\.result !== original\.result/);
  assert.doesNotMatch(main, /exportLock = lockMapExportState\(\);[\s\S]{0,120}map\.invalidateSize\(\)/);
  assert.match(main, /normalizeLeafletExportSvg/);
  assert.match(main, /onclone: normalizeLeafletExportSvg/);
  assert.match(main, /leaflet-overlay-pane > svg\.leaflet-zoom-animated/);
  assert.doesNotMatch(main, /\/api\/map-export-tile/);
  assert.match(worker, /issueGoogleMapConfig/);
  assert.match(config, /DEFAULT_GOOGLE_MAPS_DAILY_CAP = 30;/);
  assert.match(config, /ON CONFLICT\(usage_date\) DO UPDATE/);
  assert.match(config, /MAP_CONFIG_RATE_LIMITER\.limit/);
});

test('settings profile and non-default analytics stay deterministic', () => {
  const ci = S.applyProfile({ ...S.DEFAULTS }, 'chazon-ish');
  assert.equal(S.effectiveProfile(ci), 'chazon-ish');
  assert.equal(ci.overlapPolicy, 'join-redraw');
  ci.karpef = false;
  assert.equal(S.effectiveProfile(ci), 'custom');
  assert.equal(S.diffFromDefaults(ci).karpef, false);
});

test('snapshot replay preserves legacy overlap choices and explicit modern policies', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const source = main.slice(main.indexOf('  function applySnapshot('), main.indexOf('  async function browseRegistry('));
  for (const [saved, expected] of [
    [{ overlapMerge: true }, 'join-redraw'],
    [{ overlapMerge: false }, 'no-join'],
    [{ overlapMerge: true, overlapPolicy: 'join-no-redraw' }, 'join-no-redraw'],
  ]) {
    let persisted;
    let computed;
    const context = {
      state: {}, settings: {}, S: { ...S, save: (value) => { persisted = value; } },
      G: { makeProjection: () => ({}) }, map: { setView() {} },
      setPin() {}, prepareBuildings() {}, setStatus() {}, track() {},
      clearTimeout() {}, automaticCalculationTimer: null, cancelCalculation() {}, cancelMapMode() {}, refreshSettingsInputs() {},
      saveSettings: () => context.S.save(context.settings),
      document: { getElementById: () => ({ value: '' }) },
      recompute: () => { computed = context.settings; },
    };
    const apply = vm.runInNewContext(`(${source})`, context);
    apply({ format: 'techum-snapshot', version: '1.1.0 (2026-07-10)',
      pin: { lat: 41, lon: -74 }, rawBuildings: [],
      settings: { ...saved, maxBuildings: 30000, showVerifiedOnly: true },
    });
    assert.equal(computed.overlapPolicy, expected);
    assert.equal(persisted.overlapPolicy, expected);
    assert.equal(Object.hasOwn(persisted, 'overlapMerge'), false);
    assert.equal(persisted.maxBuildings, 30000, 'snapshot replay must retain unrelated settings');
    assert.equal(persisted.showVerifiedOnly, true);
  }
});

test('the public overlap default is one choice while rav mode preserves all three sourced approaches', () => {
  assert.equal(S.DEFAULTS.overlapPolicy, 'no-join');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /value="no-join"/);
  assert.match(html, /value="join-no-redraw"/);
  assert.match(html, /value="join-redraw"/);
});

test('multi-region ribua and techum survive KML and GeoJSON export', () => {
  const square = (west, south, east, north) => [
    { lat: south, lon: west }, { lat: south, lon: east },
    { lat: north, lon: east }, { lat: north, lon: west },
  ];
  const layers = {
    cityRegions: [square(-74, 41, -73.9, 41.1), square(-73.95, 41.05, -73.85, 41.15)],
    techumRegions: [square(-74.1, 40.9, -73.8, 41.2), square(-74.05, 40.95, -73.75, 41.25)],
  };
  const kml = K.buildKML(layers, 'three-valued overlap');
  assert.match(kml, /City starting area \(ribua ha’ir\) — region 2 of 2/);
  assert.match(kml, /TECHUM boundary \(2000 amos\) — region 2 of 2/);
  const geojson = K.buildGeoJSON(layers, {});
  assert.equal(geojson.features.filter((feature) => feature.properties.layer === 'city-ribua').length, 2);
  assert.equal(geojson.features.filter((feature) => feature.properties.layer === 'techum').length, 2);
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

test('rav-validated residential perimeters are separate zero-house joining inputs', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.match(html, /id="btn-draw-join-perimeter"/);
  assert.match(mainJs, /startDrawing\('join-perimeter'\)/);
  assert.match(mainJs, /joinOnly: true/);
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

// Spec rev. 18.3: the search loads whole server tiles (0.02°), asked for block by block.
test('wanted tiles are asked for as one tile-aligned box when they fit one request, else one box per 0.1° block, and an answer is split into its tiles', () => {
  const near = D._internals.tileRequests(['2055/-3700', '2056/-3699', '2060/-3700']);
  assert.equal(near.length, 1, 'tiles that fit one server request (6 × 6) make one request');
  assert.equal(near[0].tiles.length, 12);
  const requests = D._internals.tileRequests(['2055/-3700', '2055/-3699', '2056/-3700', '2062/-3700']);
  assert.equal(requests.length, 2, 'a wider set in two 0.1° blocks makes two requests');
  const [first, second] = requests;
  assert.deepEqual(first.tiles, ['2055/-3700', '2055/-3699', '2056/-3700', '2056/-3699'], 'the box of a block\'s wanted tiles');
  assert.ok(Math.abs(first.bbox.south - 41.1) < 1e-9 && Math.abs(first.bbox.north - 41.14) < 1e-9 &&
    Math.abs(first.bbox.west + 74) < 1e-9 && Math.abs(first.bbox.east + 73.96) < 1e-9, JSON.stringify(first.bbox));
  assert.deepEqual(second.tiles, ['2062/-3700']);
  for (const request of requests) assert.ok(request.tiles.length <= 25, 'within the server\'s 36 tiles');
  // A footprint on a tile edge belongs to both tiles, as on the server.
  const edge = { id: 'e', ringLatLon: [{ lat: 41.119, lon: -73.99 }, { lat: 41.121, lon: -73.99 }, { lat: 41.121, lon: -73.989 }] };
  const inside = { id: 'i', ringLatLon: [{ lat: 41.105, lon: -73.99 }, { lat: 41.106, lon: -73.99 }, { lat: 41.106, lon: -73.989 }] };
  const split = D._internals.splitIntoTiles([edge, inside], first.tiles);
  assert.deepEqual(split.get('2055/-3700').map((b) => b.id), ['e', 'i']);
  assert.deepEqual(split.get('2056/-3700').map((b) => b.id), ['e']);
  assert.deepEqual(split.get('2055/-3699'), []);
});

test('loaded tiles combine into one footprint set: the largest copy of a footprint wins in any order; corrections count once', () => {
  const small = [{ lat: 1, lon: 1 }, { lat: 1, lon: 1.001 }, { lat: 1.001, lon: 1 }];
  const large = [{ lat: 1, lon: 1 }, { lat: 1, lon: 1.002 }, { lat: 1.002, lon: 1 }];
  const tileA = { buildings: [{ id: 'a', ringLatLon: small }, { id: 'b', ringLatLon: small }], fetchedAt: '2026-10-02T00:00:00Z',
    checkedAt: '2026-10-02T00:00:00Z', fromCache: true, source: 'local-overture', release: '2026-06-17.0',
    correctionsApplied: 1, correctionIds: ['c1'] };
  const tileB = { buildings: [{ id: 'b', ringLatLon: large }, { id: 'c', ringLatLon: small }], fetchedAt: '2026-10-01T00:00:00Z',
    checkedAt: '2026-10-03T00:00:00Z', fromCache: false, source: 'overture-tiles', release: '2026-06-17.0 + 2026-09-23.1',
    correctionsApplied: 2, correctionIds: ['c1', 'c2'] };
  const ab = D.combineTiles([tileA, tileB]), ba = D.combineTiles([tileB, tileA]);
  assert.deepEqual(ab.buildings.map((b) => b.id).sort(), ['a', 'b', 'c']);
  assert.equal(ab.buildings.find((b) => b.id === 'b').ringLatLon, large);
  assert.equal(ba.buildings.find((b) => b.id === 'b').ringLatLon, large, 'the same copy whichever tile came first');
  assert.equal(ab.fetchedAt, '2026-10-01T00:00:00Z');
  assert.equal(ab.fromCache, false);
  assert.equal(ab.source, 'overture-tiles');
  assert.equal(ab.release, '2026-06-17.0 + 2026-09-23.1');
  assert.equal(ab.correctionsApplied, 2, 'a correction in two tiles is counted once');
});

test('only brief Worker fill contention is retried automatically', () => {
  assert.ok(D._internals.retryDelayMs(429, '1', 0) >= 1000);
  assert.equal(D._internals.retryDelayMs(429, '60', 0), null, 'per-network rate limits surface to the user');
  assert.equal(D._internals.retryDelayMs(429, '1', 3), null, 'retries are bounded');
  assert.equal(D._internals.retryDelayMs(502, '1', 0), null);
});

test('snapshots record and restore the shared-correction count used in the audit', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.match(main, /correctionsApplied: state\.correctionsApplied \|\| 0/);
  assert.match(main, /state\.correctionsApplied = Number\(snap\.correctionsApplied\) \|\| 0/);
});

test('a failed wider expansion pass keeps the completed pass, flagged as incomplete (spec rev. 18.1)', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.match(main, /if \(iteration > 0 && state\.result\) \{[\s\S]{0,400}state\.dataCapHit = true;\s*state\.dataCapReason = 'failed';/);
  assert.doesNotMatch(main, /the boundary is an inner bound/);
});

test('background engine loads the same geometry.js build as the page', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'analysis-worker.js'), 'utf8');
  const imported = [];
  const self = { location: { search: '?v=page-build' } };
  vm.runInNewContext(source, { self, importScripts: (url) => imported.push(url), performance: { now: () => 0 } });
  assert.deepEqual(imported, ['geometry.js?v=page-build']);
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.match(main, /new Worker\('js\/analysis-worker\.js' \+ geometryAssetVersion\(\)\)/);
  assert.match(main, /querySelector\('script\[src\*="js\/geometry\.js"\]'\)/);
});

test('a failed re-analysis clears the old boundary instead of leaving it looking current', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.match(main, /if \(skipRender\) throw error;[\s\S]{0,120}state\.result = null;\s*render\(\);\s*setStatus\('Recalculation failed: /);
});

test('analytics non-defaults never carry reviewer records, only their counts', () => {
  const stored = S.normalize(JSON.parse(JSON.stringify(S.DEFAULTS)));
  assert.deepEqual(S.diffFromDefaults(stored), {}, 'JSON-roundtripped empty review objects are not reported');
  stored.cityQualificationOverrides = { 'cluster:v2:7:abc': { decision: true, basis: 'rav-attestation',
    evidence: 'Private note from the rav', memberIds: ['w1@0,0,1,1'] } };
  const diff = S.diffFromDefaults(stored);
  assert.deepEqual(diff, { cityQualificationOverridesCount: 1 });
  assert.doesNotMatch(JSON.stringify(diff), /Private note|w1@/);
});

test('settings save failures are reported and a stored perimeter flag is not restored', () => {
  const saved = globalThis.localStorage;
  try {
    globalThis.localStorage = { setItem() { throw new Error('quota'); },
      getItem: () => JSON.stringify({ useValidatedPerimeter: true, dataSourceVersion: 2 }) };
    assert.equal(S.save({}), false);
    assert.equal(S.load().useValidatedPerimeter, false, 'the perimeter itself is never persisted');
  } finally { globalThis.localStorage = saved; }
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.match(main, /settingsSaveFailed = !S\.save\(settings\)/);
  assert.doesNotMatch(main, /[^!]S\.save\(settings\)/, 'every save goes through saveSettings()');
  assert.match(main, /\$\('use-perimeter'\)\.checked = !!settings\.useValidatedPerimeter && !!state\.validatedPerimeter/);
});

test('browser building cache keys are versioned with the pinned Overture release', () => {
  const overture = fs.readFileSync(path.join(__dirname, '..', 'worker', 'overture.ts'), 'utf8');
  const release = overture.match(/OVERTURE_RELEASE = '([^']+)'/)[1];
  assert.ok(D._internals.CACHE_VERSION.startsWith(release + '#'),
    'bump CACHE_VERSION in js/data.js when worker/overture.ts adopts a new release');
  assert.equal(D._internals.tileCacheKey('2085/-3730'), `${D._internals.CACHE_VERSION}|tile|2085/-3730`);
});

test('PDF summary, recalculation, and race guards follow the current result', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.doesNotMatch(main, /getElementById\('results'\)\.innerText/, 'collapsed review notes must reach the PDF');
  assert.match(main, /'CALCULATION SUMMARY\\n' \+ resultSummaryText/);
  assert.match(main, /const onChange = \(\) => \{ saveSettings\(\); if \(state\.result\) recompute\(\); \}/);
  assert.match(main, /state\.manualBuildings = \[\]; if \(state\.result\) \{ prepareBuildings\(\); recompute\(\); \}/);
  assert.match(main, /if \(!state\.pin \|\| !state\.proj\) return null;/);
  const calc = main.slice(main.indexOf('  async function calculate('), main.indexOf('  function renderPerformanceReport('));
  assert.ok(calc.indexOf('state.proj = proj') > calc.indexOf('D.fetchTilesCached'), 'frame switches only after a fetch succeeds');
  assert.match(calc, /const startPin = state\.pin;/);
  assert.match(calc, /await nextPaint\(\);\s*if \(isStale\(\)\) return;\s*const renderStarted/);
  assert.match(main, /function invalidateCalculationForMovedPin\(\) \{\s*latestAnalysisId\+\+;/);
  assert.match(main, /if \(state\.validatedPerimeter\) \{\s*L\.polygon/);
  const geojson = main.slice(main.indexOf('  function exportGeoJSON('), main.indexOf('  function exportKMZ('));
  assert.doesNotMatch(geojson, /L\.polygon/, 'export must not draw map layers');
  const kml = main.slice(main.indexOf('  function buildKmlText('), main.indexOf('  function exportKML('));
  assert.match(kml, /if \(!state\.dataCapHit && canRunComparisonAmah\(\)\)/);
  assert.match(main, /K\.buildKMZ\(buildKmlText\(res\)\)/, 'KMZ carries the same layers as KML');
});

test('snapshot and registry loads refresh settings, label, and in-flight work', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const apply = main.slice(main.indexOf('  function applySnapshot('), main.indexOf('  async function browseRegistry('));
  assert.match(apply, /cancelCalculation\(\);/);
  assert.match(apply, /refreshSettingsInputs\(\);/);
  assert.match(apply, /document\.getElementById\('address'\)\.value = label/);
  assert.match(main, /if \(!detail\.ok\) throw new Error/);
  const experience = fs.readFileSync(path.join(__dirname, '..', 'js', 'design-experience.js'), 'utf8');
  assert.match(experience, /addEventListener\('techum:settings-refreshed', updateSettingsSummary\)/);
});

test('map draw modes stay reachable and the drawer manages focus', () => {
  const experience = fs.readFileSync(path.join(__dirname, '..', 'js', 'design-experience.js'), 'utf8');
  assert.match(experience, /mapModeBar\.id = 'map-mode-bar'/);
  assert.match(experience, /\['btn-finish-building', 'btn-cancel-map-mode'\]/);
  assert.match(experience, /disableClickPropagation\(mapModeBar\)/);
  assert.match(experience, /classList\.contains\('map-mode-active'\) && document\.body\.classList\.contains\('design-settings-open'\)/);
  assert.match(experience, /getElementById\('design-drawer-close'\)\?\.focus\(\)/);
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.match(main, /select\.dataset\.clusterKey = cluster\.key/);
  assert.match(main, /target\.focus\(\{ preventScroll: true \}\)/);
});

test('export libraries load lazily with subresource integrity and PNGs carry a caption', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.doesNotMatch(html, /html2canvas|jspdf/, 'not loaded on every page view');
  assert.match(main, /html2canvas@1\.4\.1\/dist\/html2canvas\.min\.js[\s\S]{0,120}integrity: 'sha384-/);
  assert.match(main, /jspdf@2\.5\.2\/dist\/jspdf\.umd\.min\.js[\s\S]{0,120}integrity: 'sha384-/);
  assert.match(main, /script\.crossOrigin = 'anonymous'/);
  assert.match(main, /captureMapCanvas\(\{ caption: true \}\)/);
  assert.match(main, /\.leaflet-control-zoom, \.leaflet-control-layers/);
  const lines = require('../js/map-export.js').exportCaptionLines({ label: 'Woodbourne, NY', profileLabel: 'Chazon Ish', amahCm: 57.6 });
  assert.equal(lines[0], 'Woodbourne, NY');
  assert.match(lines[1], /Chazon Ish · amah 22\.68 in \(57\.6 cm\)/);
  assert.match(lines[2], /DRAFT .* not a psak/);
  assert.match(html, /<main id="app">/);
  assert.match(html, /rel="icon"/);
});

test('public guides name Overture as the footprint source', () => {
  for (const file of ['guide.html', path.join('he', 'index.html')]) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(html, /footprints from OpenStreetMap|מ־OpenStreetMap/);
    assert.match(html, /Overture Maps/);
  }
});

// Spec rev. 18.3: load the tiles a result needs; a result the data limit stops draws no boundary.
test('the loader adds the tiles dataNeeds names until the result is complete, with only the building-count limit, and an incomplete result draws no boundary', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const experience = fs.readFileSync(path.join(__dirname, '..', 'js', 'design-experience.js'), 'utf8');
  const worker = fs.readFileSync(path.join(__dirname, '..', 'js', 'analysis-worker.js'), 'utf8');
  assert.doesNotMatch(main, /maxExpandIterations|neededExpansion|dataFrontier/);
  assert.equal('maxExpandIterations' in S.DEFAULTS, false);
  assert.match(main, /let wanted = G\.tilesForDegrees\(bboxAround\(state\.pin, settings\.fetchRadiusM\)\);/);
  assert.match(main, /const needs = state\.needs;\s*if \(needs && needs\.complete\) break;/);
  assert.match(main, /wanted = needs\.tiles;/);
  assert.match(worker, /self\.TechumGeo\.dataNeeds\(buildings, result,/);
  assert.match(main, /Incomplete — the towns within 2000 amos of one another go on past the/);
  assert.match(main, /const drawBoundary = !state\.dataCapHit;/);
  assert.match(main, /if \(drawBoundary && document\.getElementById\('layer-techum'\)\.checked\)/);
  assert.match(main, /if \(drawBoundary && document\.getElementById\('layer-city'\)\.checked\)/);
  // The not-finished note is first in the answer, before every other note, and says what is known.
  const panel = main.slice(main.indexOf('    const lines = [];'));
  assert.ok(panel.indexOf('data-limit') >= 0 && panel.indexOf('data-limit') < panel.indexOf('Provisional smaller boundary'));
  assert.match(main, /Incomplete: no boundary drawn/);
  assert.match(main, /Not known: whether the three-villages rule joins it to more towns/);
  assert.match(experience, /incomplete \? 'Incomplete: no boundary drawn'/);
  assert.match(experience, /The map shows no techum\./);
});

test('an incomplete result says what is known for a pin on a house and a pin in a field', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const source = main.slice(main.indexOf('  function incompleteText('), main.indexOf('  function renderPanel('));
  const incompleteText = vm.runInNewContext(`(${source.trim()})`, {});
  const chain = { towns: 215, buildings: 22707, openTowns: 72, widthM: 13500, heightM: 9000 };
  const onHouse = incompleteText({}, { basis: 'building', ownTown: { buildings: 2820, whole: true }, chain });
  assert.match(onHouse, /^Known: the pin's building is in a town of 2,820 footprints/);
  assert.match(onHouse, /every place within 2000 amos of them is inside the techum\. Not known: whether the three-villages rule joins it to more towns\./);
  assert.match(onHouse, /followed 215 towns so far, across about 13\.5 km\./);
  for (const needs of [{ basis: 'none', ownTown: null, chain }, { basis: 'building', ownTown: { buildings: 40, whole: false }, chain }, null]) {
    const text = incompleteText({}, needs);
    assert.match(text, /^Known: every place within 2000 amos of the pin is inside the techum, whatever else the map holds\. Not known: whether the three-villages rule joins the towns near the pin to more towns\./);
    assert.doesNotMatch(text, /pin's building/);
  }
});

test('an incomplete result exports no boundary in KML or GeoJSON; a comparison line is exported only when the map would draw it', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const exportsSource = main.slice(main.indexOf('  // An incomplete result has no proven boundary (spec rev. 18.3), so its KML'), main.indexOf('  function exportKMZ() {'));
  const auditSource = main.slice(main.indexOf('  function exportAuditLayers('), main.indexOf('  // Export libraries load on first use'));
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const res = { techumCorners: square, cityCorners: square, karpefCorners: square, techumRegions: [square], cityRegions: [square],
    karpefRegions: [square], clusters: [{ corners: square }], concavityAudit: [] };
  const run = ({ dataCapHit, comparisonComplete }) => {
    const files = {};
    const ctx = {
      state: { dataCapHit, pin: { lat: 41, lon: -74 }, proj: { toXY: () => ({ x: 0, y: 0 }), toLatLon: (x, y) => ({ lat: 41 + y / 1e5, lon: -74 + x / 1e5 }) },
        buildings: [{ ring: square }], result: res },
      settings: { secondAmahCm: 57.6 }, K, D: { computeDataConfidence: () => null },
      G: { runPipeline: () => res }, canRunComparisonAmah: () => true, geometrySettings: () => ({}),
      loadedView: () => ({ tiles: ['1/1'] }), needsOf: () => ({ complete: comparisonComplete }),
      cornersToLatLngs: (corners) => corners.map((p) => [41 + p.y / 1e5, -74 + p.x / 1e5]),
      configText: () => 'config', setStatus() {}, track() {},
    };
    ctx.K = { ...K, download: (name, text) => { files[name] = text; } };
    vm.runInNewContext(auditSource + exportsSource + '; exportKML(); exportGeoJSON();', ctx);
    return { kml: files['techum-draft.kml'], layers: JSON.parse(files['techum-draft.geojson']).features.map((feature) => feature.properties.layer) };
  };
  const cut = run({ dataCapHit: true, comparisonComplete: true });
  for (const name of ['TECHUM boundary', 'City starting area', 'Karpef', 'Comparison shita techum', 'Derived settlement']) assert.ok(!cut.kml.includes(name), name);
  assert.ok(cut.kml.includes('Shevisa point') && cut.kml.includes('Mapped building 1'));
  assert.deepEqual([...new Set(cut.layers)].sort(), ['mapped-building', 'shevisa-point']);
  const done = run({ dataCapHit: false, comparisonComplete: true });
  for (const name of ['TECHUM boundary', 'City starting area', 'Karpef', 'Comparison shita techum', 'Derived settlement']) assert.ok(done.kml.includes(name), name);
  assert.ok(done.layers.includes('techum') && done.layers.includes('derived-settlement'));
  const comparisonCut = run({ dataCapHit: false, comparisonComplete: false });
  assert.ok(comparisonCut.kml.includes('TECHUM boundary') && !comparisonCut.kml.includes('Comparison shita techum'));
});

test('extra lines are checked with dataNeeds and not drawn when the loaded data does not cover them', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  assert.match(main, /const res2Incomplete = scenarioIncomplete\(res2, state\.buildings\)/);
  assert.match(main, /const resVIncomplete = scenarioIncomplete\(resV, verifiedB\)/);
  assert.match(main, /!needsOf\(used, scenario, state\.proj\.toXY\(state\.pin\.lat, state\.pin\.lon\), loaded\)\.complete/);
  assert.match(main, /if \(!res2Incomplete\)\s*addRegions/);
  assert.match(main, /if \(resV\.techumCorners && !resVIncomplete\)/);
  assert.match(main, /Comparison line not drawn/);
  assert.match(main, /Verified-dwellings line not drawn/);
});

test('an exported PNG of an incomplete result says so in its caption; a complete one keeps its three lines', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const mapExport = require('../js/map-export.js');
  const plain = mapExport.exportCaptionLines({ label: 'Town', profileLabel: 'Mishna Berurah', amahCm: 48 });
  const cut = mapExport.exportCaptionLines({ label: 'Town', profileLabel: 'Mishna Berurah', amahCm: 48, incomplete: true });
  assert.equal(plain.length, 3);
  assert.equal(plain.some((line) => /INCOMPLETE/.test(line)), false);
  assert.equal(cut.length, 4);
  assert.match(cut[2], /^INCOMPLETE/);
  assert.match(main, /incomplete: state\.dataCapHit/);
});

// A re-analysis of the loaded buildings (a changed setting or profile) runs main.js recompute
// with the engine and calculate stubbed.
const pendingTests = [];
{
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const source = main.slice(main.indexOf('  async function recompute(skipRender) {'), main.indexOf('  function cornersToLatLngs(corners) {'));
  const replay = async ({ more, fromSnapshot = false, dataCapHit = false, fetchBBox = { south: 0, west: 0, north: 1, east: 1 } }) => {
    const calls = { calculate: 0, render: 0 };
    const ctx = {
      state: { pin: { lat: 41, lon: -74 }, proj: { toXY: () => ({ x: 0, y: 0 }) }, buildings: [], fetchBBox,
        fromSnapshot, dataCapHit, dataCapReason: dataCapHit ? 'buildings' : null, result: null },
      latestAnalysisId: 0, isIncluded: () => true, geometrySettings: () => ({}),
      loadedView: () => (fetchBBox ? { bbox: fetchBBox } : null),
      runPipelineAsync: async () => ({ result: { mode: 'city' }, needs: { complete: !more, tiles: more ? ['1/1'] : [] } }),
      calculate: () => { calls.calculate++; }, render: () => { calls.render++; }, setRetryVisible: () => {}, setStatus: () => {},
    };
    await vm.runInNewContext(`(${source.trim()})()`, ctx);
    return { ...calls, dataCapHit: ctx.state.dataCapHit, reason: ctx.state.dataCapReason };
  };
  const wider = { south: -1, west: -1, north: 2, east: 2 };
  const name = 'after a changed setting needs more map data, a live result searches again, a snapshot is marked incomplete without refetching, a result already at the data limit stays marked, one needing nothing more is complete, and a snapshot with no recorded area is marked incomplete';
  pendingTests.push(Promise.all([replay({ more: wider }), replay({ more: wider, fromSnapshot: true }),
    replay({ more: wider, dataCapHit: true }), replay({ more: null, dataCapHit: true }), replay({ more: null, fromSnapshot: true, fetchBBox: null })])
    .then(([live, snapshot, capped, complete, unknown]) => {
      assert.deepEqual([live.calculate, live.render], [1, 0]);
      assert.deepEqual([snapshot.calculate, snapshot.render, snapshot.dataCapHit, snapshot.reason], [0, 1, true, 'snapshot']);
      assert.deepEqual([capped.calculate, capped.render, capped.dataCapHit], [0, 1, true]);
      assert.deepEqual([complete.calculate, complete.render, complete.dataCapHit], [0, 1, false]);
      assert.deepEqual([unknown.calculate, unknown.render, unknown.dataCapHit, unknown.reason], [0, 1, true, 'snapshot-area-unknown']);
      passed++; console.log('  ok  ' + name);
    })
    .catch((e) => { console.error('FAIL  ' + name + ' — ' + e.message); process.exitCode = 1; }));
}

test('typed coordinates go to that point, not to a street named after the numbers', () => {
  const point = D.parseCoordinates('39.5, -117.0');
  assert.deepEqual([point.lat, point.lon], [39.5, -117]);
  assert.deepEqual([D.parseCoordinates('41.117991 -74.059432').lon], [-74.059432]);
  for (const text of ['117 Main Street', '95, 20', '12, 200', 'Monsey']) assert.equal(D.parseCoordinates(text), null, text);
});

{
  // A tile the server answers from its own store keeps the server's cache flag and date, so the
  // status line says how old the data is instead of calling it fresh.
  const name = "a tile the server answers from its own store keeps the server's cache flag and date";
  const realFetch = globalThis.fetch;
  const asked = [];
  const run = async (serverCached) => {
    globalThis.fetch = async (url) => {
      asked.push(String(url));
      return { ok: true, status: 200, headers: { get: () => null },
        json: async () => ({ buildings: [], fetchedAt: '2026-07-13T00:00:00Z', checkedAt: '2026-07-13T00:00:00Z',
          fromCache: serverCached, source: 'overture-tiles', release: '2026-06-17.0', correctionIds: [] }) };
    };
    const { tiles, requests } = await D.fetchTilesCached(['2055/-3703', '2055/-3702']);
    assert.equal(requests, 1, 'two neighbouring tiles come in one request');
    assert.equal(tiles.size, 2);
    for (const record of tiles.values()) {
      assert.equal(record.fromCache, serverCached);
      assert.equal(record.fetchedAt, '2026-07-13T00:00:00Z');
    }
    assert.equal(D.combineTiles([...tiles.values()]).fromCache, serverCached);
    assert.equal(D.combineTiles([...tiles.values()]).source, 'overture-tiles', 'a server answer is labelled as one, cached there or not');
  };
  pendingTests.push(run(true).then(() => run(false))
    .then(() => {
      assert.match(asked[0], /^\/api\/buildings\?south=41\.1&west=-74\.06&north=41\.12&east=-74\.02$/);
      passed++; console.log('  ok  ' + name);
    })
    .catch((e) => { console.error('FAIL  ' + name + ' — ' + e.message); process.exitCode = 1; })
    .finally(() => { globalThis.fetch = realFetch; }));
}

Promise.all(pendingTests).then(() => console.log(`\n${passed} app tests passed`));
