const assert = require('node:assert/strict');
const M = require('../js/map-export.js');

assert.equal(M.normalizedLeafletSvgViewBox('-151 -82 1812 985'), '0 0 1812 985');
assert.equal(M.normalizedLeafletSvgViewBox('0, 0, 1030, 866'), '0 0 1030 866');
assert.equal(M.normalizedLeafletSvgViewBox('invalid'), null);
assert.equal(M.normalizedLeafletSvgViewBox('0 0 -10 100'), null);

// A map that fits 2 x 2 images keeps its own zoom: full sharpness.
const small = M.staticMapPlan({ zoom: 13, width: 1100, height: 800 });
assert.equal(small.requestZoom, 13);
assert.equal(small.divisor, 1);
assert.equal(small.images.length, 4);
assert.deepEqual(small.images.map((i) => [i.width, i.height]), [[550, 400], [550, 400], [550, 400], [550, 400]]);
assert.deepEqual(small.images.map((i) => [i.left, i.top]), [[0, 0], [550, 0], [0, 400], [550, 400]]);
assert.deepEqual(small.images.map((i) => [i.offsetX, i.offsetY]), [[-275, -200], [275, -200], [-275, 200], [275, 200]]);
assert.deepEqual(small.images.map((i) => i.bottomRow), [false, false, true, true]);
// Odd sizes round up to even images; the grid is centred across and flush with the bottom.
const odd = M.staticMapPlan({ zoom: 13, width: 1101, height: 801 });
assert.deepEqual(odd.images.map((i) => [i.width, i.height]), [[552, 402], [550, 402], [552, 400], [550, 400]]);
assert.equal(odd.images[0].left, -0.5);
assert.equal(odd.images[0].top, -1);
assert.equal(odd.images[3].top + odd.images[3].cssHeight, 801);
// A phone-sized map is one image.
const phone = M.staticMapPlan({ zoom: 8, width: 420, height: 300 });
assert.equal(phone.images.length, 1);
assert.equal(phone.requestZoom, 8);
assert.deepEqual([phone.images[0].offsetX, phone.images[0].offsetY], [0, 0]);
// A laptop-wide map would need 6 images at its own zoom, so it uses one zoom out (2 images, twice today's sharpness).
const laptop = M.staticMapPlan({ zoom: 13, width: 1500, height: 850 });
assert.equal(laptop.requestZoom, 12);
assert.equal(laptop.images.length, 2);
assert.deepEqual(laptop.images.map((i) => [i.width, i.height]), [[376, 426], [374, 426]]);
const large = M.staticMapPlan({ zoom: 13, width: 1920, height: 1080 });
assert.equal(large.requestZoom, 12);
assert.equal(large.images.length, 2);
assert.equal(large.attributionHeight, 36);
assert.ok(large.images.every((i) => i.width <= 640 && i.height <= 640 && i.width % 2 === 0 && i.height % 2 === 0));
// Images tile the view with no gaps.
const covered = large.images.reduce((sum, i) => sum + i.cssWidth * i.cssHeight, 0);
assert.ok(covered >= 1920 * 1080);
assert.equal(M.staticMapPlan({ zoom: 13, width: 1920, height: 1080, maxImages: 1 }).requestZoom, 11);
assert.equal(M.staticMapPlan({ zoom: 0, width: 3000, height: 800 }), null);

console.log('Map export viewport plan: assertions passed');
