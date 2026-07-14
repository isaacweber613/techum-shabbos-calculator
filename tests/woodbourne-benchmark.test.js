const assert = require('node:assert/strict');
const benchmark = require('../benchmarks/woodbourne-vaad-2023.json');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (error) { console.error('FAIL  ' + name + ' — ' + error.message); process.exitCode = 1; }
}

function pointInPolygon([x, y], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

test('Woodbourne fixture identifies the issuing source and Chazon Ish scenario', () => {
  assert.equal(benchmark.issuer, "Va'ad Le'Tchum Shabbos");
  assert.equal(benchmark.publishedYear, 2023);
  assert.equal(benchmark.profileLabel, 'Chazon Ish');
  assert.equal(benchmark.calculatorScenario.amahCm, 57.6);
  assert.match(benchmark.source.pdf, /^https:\/\/www\.catskillseruv\.com\//);
  assert.match(benchmark.source.sha256, /^[a-f0-9]{64}$/);
});

test('Woodbourne source vectors are complete, bounded, and deterministic', () => {
  const { width, height } = benchmark.source.pageSizePoints;
  const { cityRibuaGreen: green, techumPink: pink } = benchmark.digitization;
  assert.equal(green.length, 13);
  assert.equal(pink.length, 12);
  for (const polygon of [green, pink]) {
    for (const [x, y] of polygon) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x >= 0 && x <= width && y >= 0 && y <= height);
    }
  }
  assert.deepEqual(green[0], [397.8167, 347.8173]);
  assert.deepEqual(pink[0], [515.5389, 249.7104]);
});

test('published techum encloses every published city-ribua vertex', () => {
  const { cityRibuaGreen: green, techumPink: pink } = benchmark.digitization;
  assert.ok(green.every((point) => pointInPolygon(point, pink)));
  assert.ok(benchmark.publishedRoadCheckpoints.length >= 7);
});

test('benchmark states that output reproduction is not hidden-method parity', () => {
  assert.ok(benchmark.limitations.some((line) => /not proof of hidden-method parity/i.test(line)));
  assert.ok(benchmark.validationScope.some((line) => /published.*paths exactly/i.test(line)));
});

if (!process.exitCode) console.log(`\n${passed} passed, 0 failed`);
