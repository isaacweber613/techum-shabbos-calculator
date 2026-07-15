const assert = require('node:assert/strict');
const M = require('../js/map-export.js');

assert.deepEqual(M.staticMapPlan({ zoom: 13, width: 1100, height: 800 }), {
  requestWidth: 550, requestHeight: 400, requestZoom: 12, scale: 2,
  cssWidth: 1100, cssHeight: 800, left: 0, top: 0, attributionHeight: 36,
});
assert.deepEqual(M.staticMapPlan({ zoom: 13, width: 1101, height: 801 }), {
  requestWidth: 550, requestHeight: 400, requestZoom: 12, scale: 2,
  cssWidth: 1100, cssHeight: 800, left: 0.5, top: 0.5, attributionHeight: 36,
});
assert.deepEqual(M.staticMapPlan({ zoom: 8, width: 420, height: 300 }), {
  requestWidth: 420, requestHeight: 300, requestZoom: 8, scale: 2,
  cssWidth: 420, cssHeight: 300, left: 0, top: 0, attributionHeight: 36,
});
const large = M.staticMapPlan({ zoom: 13, width: 1920, height: 1080 });
assert.equal(large.requestWidth, 480);
assert.equal(large.requestHeight, 270);
assert.equal(large.requestZoom, 11);
assert.equal(large.attributionHeight, 72);
assert.ok(large.requestWidth <= 640 && large.requestHeight <= 640);
assert.equal(M.staticMapPlan({ zoom: 0, width: 1000, height: 800 }), null);

console.log('Map export viewport plan: 15 assertions passed');
