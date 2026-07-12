const assert = require('node:assert/strict');
const D = require('../js/data.js').TechumData;
const S = require('../js/settings.js').TechumSettings;
const K = require('../js/kml.js').TechumKML;

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

console.log(`\n${passed} app tests passed`);
