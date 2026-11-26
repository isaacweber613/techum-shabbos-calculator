// The review's random made-up maps, loaded tile by tile the way the app loads (spec rev. 18.3):
// does the home town or the boundary depend on where the pin is in the town, where loading
// started, or which profile ran first? Each map is a home town, 8 to 25 villages, 1 to 5 chains
// of single houses and 2 to 6 rows of houses that a three-villages join can use. Every run is
// compared with the answer from the whole map. Prints any run that differs, then a summary.
// node scripts/loading-proof.cjs [trials=300] [seed=1] [--quick]   (300 maps: about 15 minutes)
const path = require('node:path');
const G = require(path.join(__dirname, '..', 'js', 'geometry.js'));
const args = process.argv.slice(2).filter((arg) => arg !== '--quick');
const trials = Number(args[0] || 300);
let seed = Number(args[1] || 1);
const quick = process.argv.includes('--quick');
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

let nextId = 0;
const box = (minX, minY, maxX, maxY) => {
  const ring = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
  return { id: `b${nextId++}`, ring, bbox: G._internals.bboxOfRing(ring), included: true };
};
const town = (x0, y0) => { const out = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) out.push(box(x0 + i * 20, y0 + j * 20, x0 + i * 20 + 10, y0 + j * 20 + 10)); return out; };
const chain = (x0, y0, angle, n) => { const out = []; for (let k = 0; k < n; k++) { const x = x0 + Math.cos(angle) * 40 * k, y = y0 + Math.sin(angle) * 40 * k; out.push(box(x, y, x + 10, y + 10)); } return out; };

const proj = G.makeProjection(41, -74);
const TILE = G.TILE_DEG;
const tileIndex = (deg) => Math.floor(deg / TILE + 1e-12);
const degreesOf = (b) => {
  const pts = [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]].map(([x, y]) => proj.toLatLon(x, y));
  return { south: Math.min(...pts.map((p) => p.lat)), north: Math.max(...pts.map((p) => p.lat)),
    west: Math.min(...pts.map((p) => p.lon)), east: Math.max(...pts.map((p) => p.lon)) };
};
// The tiles a footprint is stored in (worker/buildings.ts: every tile its ring's box touches).
const tilesOfBuilding = (b) => {
  const d = degreesOf(b.bbox), out = [];
  for (let i = tileIndex(d.south); i <= tileIndex(d.north); i++) for (let j = tileIndex(d.west); j <= tileIndex(d.east); j++) out.push(`${i}/${j}`);
  return out;
};

const PROFILES = {
  'mishna-berura': { amahM: 0.48, karpef: true, minCityHouses: 6, overlapPolicy: 'no-join', largeHolePolicy: 'include-with-warning', bowPolicy: 'rema-majority', squaringAngleDeg: 0 },
  'chazon-ish': { amahM: 0.576, karpef: true, minCityHouses: 6, overlapPolicy: 'join-redraw', largeHolePolicy: 'include-with-warning', bowPolicy: 'rema-majority', squaringAngleDeg: 0 },
  'mechaber': { amahM: 0.48, karpef: false, minCityHouses: 6, overlapPolicy: 'no-join', largeHolePolicy: 'include-with-warning', bowPolicy: 'mechaber-curve', squaringAngleDeg: 0 },
};

// The app's loop: start with the tiles around the pin, add the tiles dataNeeds asks for.
function load(world, tilesOf, settings, pin, startTiles) {
  const loaded = new Set(startTiles);
  for (let pass = 1; pass <= 400; pass++) {
    const sub = world.filter((b, k) => tilesOf[k].some((key) => loaded.has(key)));
    const result = G.runPipeline(sub, settings, pin);
    const needs = G.dataNeeds(sub, result, { proj, tiles: loaded, pin });
    if (needs.complete) return { result, sub, passes: pass, loaded };
    if (!needs.tiles.length) return { result, sub, passes: pass, loaded, stuck: true };
    for (const key of needs.tiles) loaded.add(key);
  }
  return null;
}
const startTilesAround = (pin, r) => {
  const d = degreesOf({ minX: pin.x - r, maxX: pin.x + r, minY: pin.y - r, maxY: pin.y + r });
  return G.tilesForDegrees(d);
};
const answer = (r, sub) => {
  const ids = r.homeCluster >= 0 ? r.clusters[r.homeCluster].members.map((i) => sub[i].id).sort() : [];
  const regions = (r.techumRegions || []).map((ring) => ring.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')).sort();
  return { mode: r.mode, ids: ids.join(','), houses: ids.length, regions: regions.join('|'), candidates: (r.homeCandidates || []).length };
};
const same = (a, b) => a.mode === b.mode && a.ids === b.ids && a.regions === b.regions;

let maps = 0, mapsDisagree = 0, runs = 0, runsDisagree = 0, stuck = 0, maxPasses = 0, totalPasses = 0;
const kinds = {};
const started = Date.now();
for (let t = 0; t < trials; t++) {
  nextId = 0; const trialSeed = seed;
  const world = town(0, 0);
  const villages = 8 + Math.floor(rand() * 18), chains = 1 + Math.floor(rand() * 5), span = 2500 + rand() * 4000;
  for (let v = 0; v < villages; v++) world.push(...town((rand() - 0.5) * 2 * span, (rand() - 0.5) * 2 * span));
  for (let c = 0; c < chains; c++) world.push(...chain((rand() - 0.5) * 2 * span, (rand() - 0.5) * 2 * span, rand() * Math.PI * 2, 10 + Math.floor(rand() * 70)));
  const fits = 2 + Math.floor(rand() * 5);
  const anchors = [[25, 15]];
  for (let f = 0; f < fits; f++) {
    const [ax, ay] = anchors[Math.floor(rand() * anchors.length)];
    const ang = rand() * Math.PI * 2, ux = Math.cos(ang), uy = Math.sin(ang), off = (rand() < 0.5 ? -1 : 1) * (200 + rand() * 750);
    const n = 3 + Math.floor(rand() * 60), g1 = 20 + rand() * 47, g2 = 20 + rand() * 47;
    const start = 30 + g1, len = 40 * (n - 1) + 10;
    for (let k = 0; k < n; k++) {
      const tt = start + 40 * k, x = ax + ux * tt - uy * off, y = ay + uy * tt + ux * off;
      world.push(box(x - 5, y - 5, x + 5, y + 5));
    }
    const far = start + len + g2 + 30;
    const cx = ax + ux * far, cy = ay + uy * far;
    world.push(...town(cx - 25, cy - 15));
    anchors.push([cx, cy]);
  }
  const tilesOf = world.map(tilesOfBuilding);
  maps++;
  let disagree = false;
  // Pins: the reviewer's pin on the first house; a pin on one house of every town in the home
  // town; a pin in the street between two houses; a pin beside the town, outside its walls.
  const profileKeys = Object.keys(PROFILES);
  const truthHome = G.runPipeline(world, PROFILES['mishna-berura'], { x: 5, y: 5 });
  const pins = [{ x: 5, y: 5, kind: 'house' }, { x: 15, y: 5, kind: 'street' }, { x: -12, y: 5, kind: 'beside' }];
  if (truthHome.homeCluster >= 0) {
    for (const townRec of truthHome.towns) {
      const member = townRec.members[0];
      if (!truthHome.clusters[truthHome.homeCluster].members.includes(member)) continue;
      const b = world[member].bbox;
      if (b.minX === 0 && b.minY === 0) continue;
      pins.push({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, kind: 'house-elsewhere' });
    }
  }
  const usePins = quick ? pins.slice(0, 3) : pins;
  const starts = quick ? [1200] : [300, 1200, 3000];
  for (const pin of usePins) {
    const truth = Object.fromEntries(profileKeys.map((key) => [key, answer(G.runPipeline(world, PROFILES[key], pin), world)]));
    for (const r of starts) {
      // Each profile alone, then every second profile on the tiles the first one loaded.
      for (const first of profileKeys) {
        const a = load(world, tilesOf, PROFILES[first], pin, startTilesAround(pin, r));
        if (!a) { stuck++; continue; }
        if (a.stuck) stuck++;
        runs++; totalPasses += a.passes; maxPasses = Math.max(maxPasses, a.passes);
        const got = answer(a.result, a.sub);
        if (!same(got, truth[first])) {
          runsDisagree++; disagree = true;
          const kind = got.houses < truth[first].houses ? 'smaller' : got.houses > truth[first].houses ? 'larger' : 'same-houses-other-line';
          kinds[kind] = (kinds[kind] || 0) + 1;
          if (runsDisagree <= 20) console.log(JSON.stringify({ t, seedAtStart: trialSeed, pin, start: r, profile: first, got: { mode: got.mode, houses: got.houses }, truth: { mode: truth[first].mode, houses: truth[first].houses }, loaded: a.sub.length, world: world.length }));
        }
        for (const second of profileKeys) {
          if (second === first) continue;
          const b = load(world, tilesOf, PROFILES[second], pin, a.loaded);
          if (!b) { stuck++; continue; }
          runs++; totalPasses += b.passes;
          const got2 = answer(b.result, b.sub);
          if (!same(got2, truth[second])) {
            runsDisagree++; disagree = true;
            const kind = 'after-' + first + ':' + (got2.houses < truth[second].houses ? 'smaller' : got2.houses > truth[second].houses ? 'larger' : 'same-houses-other-line');
            kinds[kind] = (kinds[kind] || 0) + 1;
            if (runsDisagree <= 20) console.log(JSON.stringify({ t, pin, start: r, order: [first, second], got: { mode: got2.mode, houses: got2.houses }, truth: { mode: truth[second].mode, houses: truth[second].houses } }));
          }
        }
      }
    }
  }
  if (disagree) mapsDisagree++;
}
console.log(JSON.stringify({ maps, mapsDisagree, runs, runsDisagree, kinds, stuck, avgPasses: +(totalPasses / Math.max(runs, 1)).toFixed(2), maxPasses, seconds: (Date.now() - started) / 1000 }));
