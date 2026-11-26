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
// Each image is 26 px taller than the part it shows, to hide Google's own logo strip.
assert.deepEqual(small.images.map((i) => [i.width, i.height, i.contentCssHeight]),
  [[550, 426, 400], [550, 426, 400], [550, 426, 400], [550, 426, 400]]);
assert.deepEqual(small.images.map((i) => [i.left, i.top]), [[0, 0], [550, 0], [0, 400], [550, 400]]);
assert.deepEqual(small.images.map((i) => [i.offsetX, i.offsetY]), [[-275, -187], [275, -187], [-275, 213], [275, 213]]);
// The top row's strip sits under the bottom row; the bottom row's strip falls below the view.
assert.equal(small.images[0].top + small.images[0].cssHeight, small.images[2].top + 26);
assert.equal(small.images[2].top + small.images[2].contentCssHeight, 800);
// One logo from the bottom-left image, one "Map data" line from the bottom-right image.
assert.deepEqual(small.attribution, { height: 26, boxes: [
  { image: 2, left: 0, width: 80 }, { image: 3, left: 825, width: 275 },
] });
// Odd sizes round up to even images; the grid is centred across and flush with the bottom.
const odd = M.staticMapPlan({ zoom: 13, width: 1101, height: 801 });
assert.deepEqual(odd.images.map((i) => [i.width, i.height]), [[552, 428], [550, 428], [552, 426], [550, 426]]);
assert.equal(odd.images[0].left, -0.5);
assert.equal(odd.images[0].top, -1);
assert.equal(odd.images[3].top + odd.images[3].contentCssHeight, 801);
// A phone-sized map is one image, centred on the view's visible part.
const phone = M.staticMapPlan({ zoom: 8, width: 420, height: 300 });
assert.equal(phone.images.length, 1);
assert.equal(phone.requestZoom, 8);
assert.deepEqual([phone.images[0].width, phone.images[0].height], [420, 326]);
assert.deepEqual([phone.images[0].offsetX, phone.images[0].offsetY], [0, 13]);
assert.deepEqual(phone.attribution.boxes.map((b) => b.image), [0, 0]);
// A laptop-wide map would need 6 images at its own zoom, so it uses one zoom out (2 images, twice the old sharpness).
const laptop = M.staticMapPlan({ zoom: 13, width: 1500, height: 850 });
assert.equal(laptop.requestZoom, 12);
assert.equal(laptop.images.length, 2);
assert.deepEqual(laptop.images.map((i) => [i.width, i.height]), [[376, 452], [374, 452]]);
assert.deepEqual(laptop.attribution.height, 52);
const large = M.staticMapPlan({ zoom: 13, width: 1920, height: 1080 });
assert.equal(large.requestZoom, 12);
assert.equal(large.images.length, 2);
assert.ok(large.images.every((i) => i.width <= 640 && i.height <= 640 && i.width % 2 === 0 && i.height % 2 === 0));
// A 1280 x 1228 view fits 4 images at its own zoom (each at most 640 tall with the hidden strip).
const tall = M.staticMapPlan({ zoom: 13, width: 1280, height: 1228 });
assert.equal(tall.requestZoom, 13);
assert.ok(tall.images.every((i) => i.height <= 640));
assert.equal(M.staticMapPlan({ zoom: 13, width: 1280, height: 1230 }).requestZoom, 12);
assert.equal(M.staticMapPlan({ zoom: 13, width: 1920, height: 1080, maxImages: 1 }).requestZoom, 11);
assert.equal(M.staticMapPlan({ zoom: 0, width: 3000, height: 800 }), null);

console.log('Map export viewport plan: assertions passed');
