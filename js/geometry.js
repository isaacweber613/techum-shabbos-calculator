/*
 * Techum geometry engine — dependency-free, halachically load-bearing code.
 * Works entirely in a local projected plane (meters, +x = east, +y = true north).
 * Rules implemented per TECHUM-SPEC.md Part 1; every rule cites its source there.
 *
 * UMD-lite: usable as a classic <script> (window.TechumGeo) and via require() in node tests.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.TechumGeo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Halachic constants (in amos; scaled by settings.amahM) ----------
  const AMOS = {
    JOIN: 70 + 2 / 3,        // ibur ha'ir gap — SA OC 398:5-7
    JOIN2: 141 + 1 / 3,      // two-cities merge (2 x 70 2/3) — SA OC 398:5
    KARPEF: 70 + 2 / 3,      // Rema's single-city karpef — MB 398:36
    TECHUM: 2000,            // SA OC 397:1
    BOW: 4000,               // bow-endpoint limit — SA OC 398:3
    MIL12: 24000,            // 12 mil d'oraisa view — Rambam
    PERSON: 4,               // 4 amos of a person in a field
  };

  // ---------- Local projection (lat/lon <-> local meters, true-north aligned) ----------
  // Per-point longitude scaling (sinusoidal-style) keeps short distances accurate
  // everywhere; residual meridian-convergence skew over a metro-sized area is < ~10 m
  // and only affects the bounding box (a kula) — documented in spec Part 4.
  function makeProjection(lat0, lon0) {
    const rad = Math.PI / 180;
    const mPerDegLat =
      111132.92 - 559.82 * Math.cos(2 * lat0 * rad) + 1.175 * Math.cos(4 * lat0 * rad);
    const mPerDegLon = (lat) =>
      111412.84 * Math.cos(lat * rad) - 93.5 * Math.cos(3 * lat * rad);
    return {
      lat0, lon0, mPerDegLat,
      toXY(lat, lon) {
        return { x: (lon - lon0) * mPerDegLon(lat), y: (lat - lat0) * mPerDegLat };
      },
      toLatLon(x, y) {
        const lat = lat0 + y / mPerDegLat;
        return { lat, lon: lon0 + x / mPerDegLon(lat) };
      },
    };
  }

  // ---------- Basic geometry ----------
  function bboxOfRing(ring) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }
  function bboxUnion(a, b) {
    return {
      minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY),
    };
  }
  function bboxGap(a, b) {
    const dx = Math.max(a.minX - b.maxX, b.minX - a.maxX, 0);
    const dy = Math.max(a.minY - b.maxY, b.minY - a.maxY, 0);
    return Math.hypot(dx, dy);
  }
  function expandRect(r, d) {
    return { minX: r.minX - d, minY: r.minY - d, maxX: r.maxX + d, maxY: r.maxY + d };
  }
  function rectsOverlap(a, b) {
    return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
  }
  function rectContains(outer, inner) {
    return inner.minX >= outer.minX && inner.maxX <= outer.maxX &&
           inner.minY >= outer.minY && inner.maxY <= outer.maxY;
  }

  function pointSegDist(p, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    let t = len2 === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
  }
  function segsIntersect(a, b, c, d) {
    const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    return false; // collinear touching handled by distance ~ 0 anyway
  }
  function segSegDist(a, b, c, d) {
    if (segsIntersect(a, b, c, d)) return 0;
    return Math.min(
      pointSegDist(a, c, d), pointSegDist(b, c, d),
      pointSegDist(c, a, b), pointSegDist(d, a, b)
    );
  }
  function pointInRing(p, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a.y > p.y) !== (b.y > p.y) &&
          p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside;
      }
    }
    return inside;
  }
  // Minimum edge-to-edge distance between two polygon rings (0 if touching/overlapping).
  function ringDist(r1, r2) {
    if (pointInRing(r1[0], r2) || pointInRing(r2[0], r1)) return 0;
    let best = Infinity;
    for (let i = 0; i < r1.length; i++) {
      const a = r1[i], b = r1[(i + 1) % r1.length];
      for (let j = 0; j < r2.length; j++) {
        const c = r2[j], d = r2[(j + 1) % r2.length];
        const dd = segSegDist(a, b, c, d);
        if (dd < best) best = dd;
        if (best === 0) return 0;
      }
    }
    return best;
  }
  function ringDistToPoint(p, ring) {
    if (pointInRing(p, ring)) return 0;
    let best = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const d = pointSegDist(p, ring[i], ring[(i + 1) % ring.length]);
      if (d < best) best = d;
    }
    return best;
  }

  // ---------- Ring buffer contour (audit/display aid — no psak math depends on it) ----------
  // Traces the closed curve of points exactly `dist` meters from a footprint ring
  // (interior counts as 0), by marching squares over the same ringDistToPoint field the
  // clustering uses. That keeps the audit semantics EXACT:
  //   - building B touches/enters buffer(A, 70⅔ amos)  ⇔  ringDist(A,B) ≤ 70⅔  ⇔ same chain;
  //   - buffer(A, 70⅔) touches buffer(B, 70⅔)          ⇔  ringDist(A,B) ≤ 141⅓ ⇔ city merge
  //     (each settlement contributes its own 70⅔ — SA 398:5).
  // Returns an array of closed loops [{x,y},...]; a simple footprint yields one loop.
  function bufferRing(ring, dist, cellM) {
    const cell = cellM || Math.max(1.25, dist / 20);
    const bb = bboxOfRing(ring);
    const x0 = bb.minX - dist - 2 * cell, y0 = bb.minY - dist - 2 * cell;
    const nx = Math.ceil((bb.maxX + dist + 2 * cell - x0) / cell) + 2;
    const ny = Math.ceil((bb.maxY + dist + 2 * cell - y0) / cell) + 2;
    const f = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const p = { x: x0 + i * cell, y: y0 + j * cell };
        // bbox distance is a lower bound on ring distance — skip exact eval far outside
        const dx = Math.max(bb.minX - p.x, p.x - bb.maxX, 0);
        const dy = Math.max(bb.minY - p.y, p.y - bb.maxY, 0);
        const lb = Math.hypot(dx, dy);
        f[j * nx + i] = (lb > dist + 2 * cell ? lb : ringDistToPoint(p, ring)) - dist;
      }
    }
    const at = (i, j) => f[j * nx + i];
    const pt = (i, j) => ({ x: x0 + i * cell, y: y0 + j * cell });
    const inside = (v) => v < 0;
    // Crossing points are cached per grid EDGE and shared by both adjacent cells, so
    // loop stitching works by object identity — no floating-point key matching.
    const hPts = new Map(), vPts = new Map(); // edge (i,j)->(i+1,j) / (i,j)->(i,j+1)
    function cross(cache, idx, pa, pb, va, vb) {
      let p = cache.get(idx);
      if (!p) {
        const t = va / (va - vb);
        p = { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t };
        cache.set(idx, p);
      }
      return p;
    }
    const out = new Map(); // contour point -> next contour point (inside kept on the left)
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const vA = at(i, j), vB = at(i + 1, j), vC = at(i + 1, j + 1), vD = at(i, j + 1);
        const code = (inside(vA) ? 1 : 0) | (inside(vB) ? 2 : 0) |
                     (inside(vC) ? 4 : 0) | (inside(vD) ? 8 : 0);
        if (code === 0 || code === 15) continue;
        const eAB = () => cross(hPts, j * nx + i, pt(i, j), pt(i + 1, j), vA, vB);
        const eBC = () => cross(vPts, j * nx + i + 1, pt(i + 1, j), pt(i + 1, j + 1), vB, vC);
        const eCD = () => cross(hPts, (j + 1) * nx + i, pt(i, j + 1), pt(i + 1, j + 1), vD, vC);
        const eDA = () => cross(vPts, j * nx + i, pt(i, j), pt(i, j + 1), vA, vD);
        const seg = (a, b) => out.set(a, b);
        switch (code) {
          case 1: seg(eAB(), eDA()); break;
          case 2: seg(eBC(), eAB()); break;
          case 4: seg(eCD(), eBC()); break;
          case 8: seg(eDA(), eCD()); break;
          case 14: seg(eDA(), eAB()); break;
          case 13: seg(eAB(), eBC()); break;
          case 11: seg(eBC(), eCD()); break;
          case 7: seg(eCD(), eDA()); break;
          case 3: seg(eBC(), eDA()); break;
          case 12: seg(eDA(), eBC()); break;
          case 6: seg(eCD(), eAB()); break;
          case 9: seg(eAB(), eCD()); break;
          case 5: // saddle — disambiguate with the cell-center value
            if (inside((vA + vB + vC + vD) / 4)) { seg(eAB(), eBC()); seg(eCD(), eDA()); }
            else { seg(eAB(), eDA()); seg(eCD(), eBC()); }
            break;
          case 10:
            if (inside((vA + vB + vC + vD) / 4)) { seg(eDA(), eAB()); seg(eBC(), eCD()); }
            else { seg(eBC(), eAB()); seg(eDA(), eCD()); }
            break;
        }
      }
    }
    const visited = new Set();
    const loops = [];
    for (const start of out.keys()) {
      if (visited.has(start)) continue;
      const loop = [];
      let p = start;
      while (p && !visited.has(p)) { visited.add(p); loop.push(p); p = out.get(p); }
      if (p === start && loop.length >= 8) loops.push(loop);
    }
    return loops;
  }

  // ---------- Spatial grid index over building bboxes ----------
  function GridIndex(cellSize) {
    const cells = new Map();
    const key = (cx, cy) => cx + ':' + cy;
    return {
      insert(id, bbox) {
        const x0 = Math.floor(bbox.minX / cellSize), x1 = Math.floor(bbox.maxX / cellSize);
        const y0 = Math.floor(bbox.minY / cellSize), y1 = Math.floor(bbox.maxY / cellSize);
        for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
          const k = key(cx, cy);
          if (!cells.has(k)) cells.set(k, []);
          cells.get(k).push(id);
        }
      },
      query(bbox) {
        const out = new Set();
        const x0 = Math.floor(bbox.minX / cellSize), x1 = Math.floor(bbox.maxX / cellSize);
        const y0 = Math.floor(bbox.minY / cellSize), y1 = Math.floor(bbox.maxY / cellSize);
        for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
          const arr = cells.get(key(cx, cy));
          if (arr) for (const id of arr) out.add(id);
        }
        return out;
      },
    };
  }

  // ---------- Union-find ----------
  function UnionFind(n) {
    const parent = new Array(n).fill(0).map((_, i) => i);
    function find(i) {
      while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
      return i;
    }
    return {
      find,
      union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; },
    };
  }

  // ---------- Stage 1: ibur clustering (SA 398:5-7) ----------
  // buildings: [{ring, bbox, included}]; threshold in meters (70 2/3 amos).
  function clusterBuildings(buildings, threshold) {
    const n = buildings.length;
    const uf = UnionFind(n);
    const grid = GridIndex(Math.max(threshold, 25));
    buildings.forEach((b, i) => { if (b.included) grid.insert(i, b.bbox); });
    for (let i = 0; i < n; i++) {
      if (!buildings[i].included) continue;
      const cand = grid.query(expandRect(buildings[i].bbox, threshold));
      for (const j of cand) {
        if (j <= i || !buildings[j].included) continue;
        if (bboxGap(buildings[i].bbox, buildings[j].bbox) > threshold) continue;
        if (ringDist(buildings[i].ring, buildings[j].ring) <= threshold) uf.union(i, j);
      }
    }
    const labelMap = new Map();
    const labels = new Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      if (!buildings[i].included) continue;
      const r = uf.find(i);
      if (!labelMap.has(r)) labelMap.set(r, labelMap.size);
      labels[i] = labelMap.get(r);
    }
    return labels; // -1 = excluded
  }

  function buildClusters(buildings, labels) {
    const map = new Map();
    labels.forEach((lab, i) => {
      if (lab < 0) return;
      if (!map.has(lab)) map.set(lab, { members: [], bbox: null });
      const c = map.get(lab);
      c.members.push(i);
      c.bbox = c.bbox ? bboxUnion(c.bbox, buildings[i].bbox) : { ...buildings[i].bbox };
    });
    return [...map.values()];
  }

  function stableClusterKey(memberIds) {
    let hash = 2166136261;
    for (const ch of memberIds.join('\u001f')) {
      hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619) >>> 0;
    }
    return `cluster:v2:${memberIds.length}:${hash.toString(16).padStart(8, '0')}`;
  }

  function annotateCityQualification(clusters, buildings, minCityHouses, overrides) {
    const configured = overrides && typeof overrides === 'object' ? overrides : {};
    for (const cluster of clusters) {
      cluster.memberIds = cluster.members.map((i) => {
        const b = buildings[i], id = b.id == null ? 'missing-id' : String(b.id), box = b.bbox;
        return `${id}@${box.minX.toFixed(3)},${box.minY.toFixed(3)},${box.maxX.toFixed(3)},${box.maxY.toFixed(3)}`;
      }).sort();
      cluster.key = stableClusterKey(cluster.memberIds);
      let record = configured[cluster.key];
      let remapScore = null;
      if (record == null) {
        const current = new Set(cluster.memberIds);
        for (const candidate of Object.values(configured)) {
          if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.memberIds) || typeof candidate.decision !== 'boolean') continue;
          const old = new Set(candidate.memberIds.map(String));
          let shared = 0; for (const id of current) if (old.has(id)) shared++;
          const score = shared / Math.max(1, current.size + old.size - shared);
          if (score >= 0.8 && (remapScore == null || score > remapScore)) { record = candidate; remapScore = score; }
        }
      }
      const decision = typeof record === 'boolean' ? record : record && typeof record.decision === 'boolean' ? record.decision : null;
      cluster.qualifiesAsCity = typeof decision === 'boolean'
        ? decision
        : cluster.members.length >= minCityHouses;
      cluster.qualificationSource = typeof decision === 'boolean' ? (remapScore == null ? 'reviewer' : 'reviewer-remapped') : 'footprint-count';
      cluster.qualificationRemapScore = remapScore;
      cluster.componentKeys = [cluster.key];
    }
  }

  function clusterGap(cA, cB, buildings, upperBound) {
    if (bboxGap(cA.bbox, cB.bbox) > upperBound) return Infinity;
    let best = Infinity;
    for (const i of cA.members) {
      for (const j of cB.members) {
        if (bboxGap(buildings[i].bbox, buildings[j].bbox) > Math.min(best, upperBound)) continue;
        const d = ringDist(buildings[i].ring, buildings[j].ring);
        if (d < best) best = d;
      }
    }
    return best;
  }

  // ---------- Stage 2: city-to-city 141 1/3 merge (SA 398:5; MB 398:38 six-house min) ----------
  function mergeCities(clusters, buildings, t2, minCityHouses) {
    let merged = true;
    const notes = [];
    while (merged) {
      merged = false;
      outer:
      for (let a = 0; a < clusters.length; a++) {
        for (let b = a + 1; b < clusters.length; b++) {
          const bothCities = clusters[a].qualifiesAsCity == null
            ? clusters[a].members.length >= minCityHouses && clusters[b].members.length >= minCityHouses
            : clusters[a].qualifiesAsCity && clusters[b].qualifiesAsCity;
          if (!bothCities) continue;
          const gap = clusterGap(clusters[a], clusters[b], buildings, t2);
          if (gap <= t2) {
            notes.push({ type: 'city-merge', gapM: gap });
            clusters[a] = {
              members: clusters[a].members.concat(clusters[b].members),
              bbox: bboxUnion(clusters[a].bbox, clusters[b].bbox),
              key: `merged:${clusters[a].componentKeys.concat(clusters[b].componentKeys).sort().join('|')}`,
              qualifiesAsCity: true,
              qualificationSource: 'merged-qualified-cities',
              componentKeys: clusters[a].componentKeys.concat(clusters[b].componentKeys),
            };
            clusters.splice(b, 1);
            merged = true;
            break outer;
          }
        }
      }
    }
    return notes;
  }

  // ---------- Stage 3: three-villages rule (SA 398:6-8 / SA HaRav 398:12) ----------
  // Middle village B "placed on the line" between outer A and C: merge all three if the
  // gap A-C minus B's width along the A->C axis leaves <= 141 1/3 on each side, B is within
  // 2000 of each outer, and B is not wider than the A-C gap. Always flagged for review.
  function threeVillages(clusters, buildings, settings) {
    const t2 = AMOS.JOIN2 * settings.amahM;
    const techum = AMOS.TECHUM * settings.amahM;
    const warnings = [];
    let acted = true;
    while (acted) {
      acted = false;
      const n = clusters.length;
      outer:
      for (let b = 0; b < n; b++) {
        for (let a = 0; a < n; a++) {
          if (a === b) continue;
          for (let c = a + 1; c < n; c++) {
            if (c === b) continue;
            const A = clusters[a], B = clusters[b], C = clusters[c];
            if ([A, B, C].some((cl) => cl.qualifiesAsCity == null
              ? cl.members.length < settings.minCityHouses
              : !cl.qualifiesAsCity)) continue;
            const dAB = clusterGap(A, B, buildings, techum);
            const dCB = clusterGap(C, B, buildings, techum);
            if (dAB > techum || dCB > techum) continue;
            const dAC = clusterGap(A, C, buildings, Infinity);
            if (!isFinite(dAC)) continue;
            // width of B along the A->C direction
            const ax = (A.bbox.minX + A.bbox.maxX) / 2, ay = (A.bbox.minY + A.bbox.maxY) / 2;
            const cx = (C.bbox.minX + C.bbox.maxX) / 2, cy = (C.bbox.minY + C.bbox.maxY) / 2;
            const ux = cx - ax, uy = cy - ay;
            const ulen = Math.hypot(ux, uy) || 1;
            let minP = Infinity, maxP = -Infinity;
            for (const i of B.members) {
              for (const p of buildings[i].ring) {
                const proj = (p.x * ux + p.y * uy) / ulen;
                if (proj < minP) minP = proj;
                if (proj > maxP) maxP = proj;
              }
            }
            const widthB = maxP - minP;
            if (widthB <= dAC && dAC - widthB <= 2 * t2) {
              warnings.push({
                type: 'three-villages',
                text: 'Three-villages rule (SA 398) merged three settlements — REVIEW: geometric placement test is an approximation.',
              });
              const mergedCluster = {
                members: A.members.concat(B.members, C.members),
                bbox: bboxUnion(bboxUnion(A.bbox, B.bbox), C.bbox),
                key: `three:${A.componentKeys.concat(B.componentKeys, C.componentKeys).sort().join('|')}`,
                qualifiesAsCity: true,
                qualificationSource: 'three-villages',
                componentKeys: A.componentKeys.concat(B.componentKeys, C.componentKeys),
              };
              const drop = [a, b, c].sort((x, y) => y - x);
              for (const idx of drop) clusters.splice(idx, 1);
              clusters.push(mergedCluster);
              acted = true;
              break outer;
            }
          }
        }
      }
    }
    return warnings;
  }

  // ---------- Stage 4: concavity ("bow") heuristic — warning only ----------
  // Grid over the city rect; cells covered = within JOIN of a building bbox. Empty
  // connected regions touching the rect border whose span >= 4000 amos raise a warning
  // (SA 398:3: a bow with endpoints >= 4000 amos apart is NOT simply filled).
  function concavityWarnings(cluster, buildings, settings) {
    const rect = cluster.bbox;
    const bow = AMOS.BOW * settings.amahM;
    const join = AMOS.JOIN * settings.amahM;
    const W = rect.maxX - rect.minX, H = rect.maxY - rect.minY;
    if (W < bow && H < bow) return []; // whole city smaller than 4000 amos — nothing to flag
    const nx = Math.min(96, Math.max(8, Math.ceil(W / join)));
    const ny = Math.min(96, Math.max(8, Math.ceil(H / join)));
    const cw = W / nx, ch = H / ny;
    const covered = new Uint8Array(nx * ny);
    for (const i of cluster.members) {
      const bb = expandRect(buildings[i].bbox, join);
      const x0 = Math.max(0, Math.floor((bb.minX - rect.minX) / cw));
      const x1 = Math.min(nx - 1, Math.floor((bb.maxX - rect.minX) / cw));
      const y0 = Math.max(0, Math.floor((bb.minY - rect.minY) / ch));
      const y1 = Math.min(ny - 1, Math.floor((bb.maxY - rect.minY) / ch));
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) covered[cy * nx + cx] = 1;
    }
    const seen = new Uint8Array(nx * ny);
    const warnings = [];
    for (let start = 0; start < nx * ny; start++) {
      if (covered[start] || seen[start]) continue;
      // BFS over the empty region
      const stack = [start];
      seen[start] = 1;
      let minCX = Infinity, maxCX = -Infinity, minCY = Infinity, maxCY = -Infinity, touchesBorder = false;
      while (stack.length) {
        const cell = stack.pop();
        const cx = cell % nx, cy = (cell / nx) | 0;
        if (cx === 0 || cy === 0 || cx === nx - 1 || cy === ny - 1) touchesBorder = true;
        if (cx < minCX) minCX = cx; if (cx > maxCX) maxCX = cx;
        if (cy < minCY) minCY = cy; if (cy > maxCY) maxCY = cy;
        const neigh = [cell - 1, cell + 1, cell - nx, cell + nx];
        for (const nb of neigh) {
          if (nb < 0 || nb >= nx * ny) continue;
          const nbx = nb % nx;
          if (Math.abs(nbx - cx) > 1) continue; // row wrap guard
          if (!covered[nb] && !seen[nb]) { seen[nb] = 1; stack.push(nb); }
        }
      }
      const spanX = (maxCX - minCX + 1) * cw, spanY = (maxCY - minCY + 1) * ch;
      if (touchesBorder && Math.max(spanX, spanY) >= bow) {
        const reviewKey = `concavity:${warnings.length}`;
        const savedReview = settings.concavityReviews && settings.concavityReviews[reviewKey];
        const endpoints = savedReview && Array.isArray(savedReview.endpoints) &&
          savedReview.endpoints.length === 2 && savedReview.endpoints.every((p) =>
            p && Number.isFinite(p.x) && Number.isFinite(p.y))
          ? savedReview.endpoints.map((p) => ({ x: p.x, y: p.y }))
          : null;
        warnings.push({
          type: 'large-concavity',
          reviewKey,
          reviewerEndpoints: endpoints,
          reviewStatus: endpoints ? 'endpoints-recorded-not-applied' : 'needs-endpoints',
          text: 'Empty region spanning >= 4000 amos inside the squared rectangle — per SA 398:3 a bow this wide is NOT automatically filled. The rectangle shown may be too lenient here; REQUIRES a posek.',
          region: {
            minX: rect.minX + minCX * cw, maxX: rect.minX + (maxCX + 1) * cw,
            minY: rect.minY + minCY * ch, maxY: rect.minY + (maxCY + 1) * ch,
          },
        });
      }
    }
    return warnings;
  }

  // ---------- Full pipeline ----------
  // buildings: [{ring:[{x,y}..], bbox, included, id, klass}]
  // settings: { amahM, karpef, minCityHouses, overlapMerge, squaringAngleDeg }
  // pin: {x, y}
  function runPipeline(buildings, settings, pin) {
    const warnings = [];
    const joinM = AMOS.JOIN * settings.amahM;
    const t2 = AMOS.JOIN2 * settings.amahM;
    const techumM = AMOS.TECHUM * settings.amahM;
    const karpefM = AMOS.KARPEF * settings.amahM;

    // Optional rotation for natural-edge squaring (CI OC 110:23): rotate the whole plane
    // by -angle, compute axis-aligned everything, results are in rotated frame; the
    // renderer rotates rect corners back.
    const angle = ((settings.squaringAngleDeg || 0) * Math.PI) / 180;
    const pointAngle = ((settings.pointRotationDeg || 0) * Math.PI) / 180;
    const rot = (p) => angle === 0 ? p : ({
      x: p.x * Math.cos(-angle) - p.y * Math.sin(-angle),
      y: p.x * Math.sin(-angle) + p.y * Math.cos(-angle),
    });
    const unrot = (p) => angle === 0 ? p : ({
      x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
      y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
    });
    let work = buildings;
    let workPin = pin;
    if (angle !== 0) {
      work = buildings.map((b) => {
        const ring = b.ring.map(rot);
        return { ...b, ring, bbox: bboxOfRing(ring) };
      });
      workPin = rot(pin);
    }

    // Stage 1: ibur chains
    const labels = clusterBuildings(work, joinM);
    const clusters = buildClusters(work, labels);
    annotateCityQualification(clusters, work, settings.minCityHouses, settings.cityQualificationOverrides);
    const qualificationAudit = clusters.map((c) => ({ key: c.key, members: [...c.members], memberIds: [...c.memberIds], bbox: { ...c.bbox },
      qualifiesAsCity: c.qualifiesAsCity, qualificationSource: c.qualificationSource,
      qualificationRemapScore: c.qualificationRemapScore }));

    // Stage 2 + 3: settlement merges
    const mergeNotes = mergeCities(clusters, work, t2, settings.minCityHouses);
    for (const n of mergeNotes) {
      warnings.push({ type: 'city-merge', text: `Two settlements merged (gap ${n.gapM.toFixed(1)} m <= 141 1/3 amos).` });
    }
    warnings.push(...threeVillages(clusters, work, settings));

    // Locate the pin's cluster. Priority:
    //  1. A settlement whose RECTANGLE contains the pin — being inside the squared city
    //     bounds makes him a resident (whole city = 4 amos); among several containing
    //     rectangles (hamlet inside a city's rect) take the largest settlement.
    //  2. Otherwise the nearest settlement within 70 2/3 amos (iburah shel ir).
    let home = -1, bestD = Infinity, bestContainSize = -1;
    const pinRect = { minX: workPin.x, maxX: workPin.x, minY: workPin.y, maxY: workPin.y };
    clusters.forEach((c, idx) => {
      if (rectContains(c.bbox, pinRect) && c.members.length > bestContainSize) {
        bestContainSize = c.members.length;
        home = idx; bestD = 0;
      }
    });
    if (home < 0) {
      clusters.forEach((c, idx) => {
        if (bboxGap(expandRect(c.bbox, joinM), pinRect) > 0) return;
        for (const i of c.members) {
          const d = ringDistToPoint(workPin, work[i].ring);
          if (d < bestD) { bestD = d; home = idx; }
        }
      });
    }
    const validatedPerimeter = Array.isArray(settings.validatedCityPerimeter) && settings.validatedCityPerimeter.length >= 3
      ? settings.validatedCityPerimeter.map(rot) : null;
    const perimeterActive = !!(validatedPerimeter && pointInRing(workPin, validatedPerimeter));
    const mode = perimeterActive || (home >= 0 && bestD <= joinM) ? 'city' : 'point';

    let cityRect = null, karpefRect = null, techumRect = null, concavity = [];
    if (mode === 'city') {
      const cluster = perimeterActive ? { bbox: bboxOfRing(validatedPerimeter), members: [] } : clusters[home];
      cityRect = { ...cluster.bbox };                 // ribua — SA 398:1-3
      karpefRect = settings.karpef ? expandRect(cityRect, karpefM) : null; // MB 398:36
      techumRect = expandRect(karpefRect || cityRect, techumM);            // SA 399, square corners
      concavity = perimeterActive ? [] : concavityWarnings(cluster, work, settings);
      warnings.push(...concavity);
      if (perimeterActive) warnings.push({ type: 'validated-perimeter', text: 'A reviewer-supplied validated enclosure is being used as the city edge. The app did not infer its hukaf-l\'dira status; confirm the supplied perimeter and ruling.' });

      // Overlapping-squares machlokes (CI redraw vs R' S. Miller):
      const otherRects = clusters
        .map((c, i) => ({ i, rect: settings.karpef ? expandRect(c.bbox, karpefM) : c.bbox,
          size: c.members.length, qualifiesAsCity: c.qualifiesAsCity }))
        .filter((o) => o.i !== home && o.qualifiesAsCity);
      for (const o of otherRects) {
        if (rectsOverlap(karpefRect || cityRect, o.rect)) {
          if (settings.overlapMerge) {
            cityRect = bboxUnion(cityRect, clusters[o.i].bbox);
            cluster.members = [...new Set(cluster.members.concat(clusters[o.i].members))];
            karpefRect = settings.karpef ? expandRect(cityRect, karpefM) : null;
            techumRect = expandRect(karpefRect || cityRect, techumM);
            warnings.push({ type: 'overlap-merge', text: 'City rectangles overlap — joint rectangle redrawn and both settlements included in the audit count (Chazon Ish approach). Disputed (R’ S. Miller); REVIEW.' });
          } else {
            warnings.push({ type: 'overlap-detected', text: 'Another city’s rectangle overlaps this one. The Chazon Ish approach would redraw a joint larger rectangle (setting is OFF = strict). Ask a posek.' });
          }
        }
      }
      // Ir mubla'as: another settlement fully inside the techum counts as 4 amos — the
      // techum may effectively extend beyond the line on that side (SA 408). Warn only.
      for (const o of otherRects) {
        if (rectContains(techumRect, o.rect)) {
          warnings.push({ type: 'ir-mublaas', text: 'A settlement lies entirely inside the techum: it counts as 4 amos, so one may effectively continue beyond the line on that side (ir mubla’as). Not drawn; ask a rav.' });
        }
      }
    } else {
      // Person in an open field: 4 amos + 2000 each direction, square, rotatable (SA 397:1; 399)
      const half = 2 * settings.amahM; // half of 4 amos
      const base = { minX: workPin.x - half, maxX: workPin.x + half, minY: workPin.y - half, maxY: workPin.y + half };
      techumRect = expandRect(base, techumM);
      cityRect = base;
      warnings.push({ type: 'point-mode', text: 'No settlement found joining this point (within 70 2/3 amos) — treated as shevisa in an open field: 4 amos + 2000-amos square. The square may be rotated (settings).' });
    }

    const rectToCorners = (r) => r == null ? null : [
      unrot({ x: r.minX, y: r.minY }), unrot({ x: r.maxX, y: r.minY }),
      unrot({ x: r.maxX, y: r.maxY }), unrot({ x: r.minX, y: r.maxY }),
    ];
    const rotatePointCorners = (corners) => {
      if (mode !== 'point' || pointAngle === 0 || !corners) return corners;
      const center = unrot(workPin);
      return corners.map((p) => {
        const dx = p.x - center.x, dy = p.y - center.y;
        return {
          x: center.x + dx * Math.cos(pointAngle) - dy * Math.sin(pointAngle),
          y: center.y + dx * Math.sin(pointAngle) + dy * Math.cos(pointAngle),
        };
      });
    };

    const cityCorners = rotatePointCorners(rectToCorners(cityRect));
    const techumCorners = rotatePointCorners(rectToCorners(techumRect));
    const mil12Corners = rotatePointCorners(mode === 'city'
      ? rectToCorners(expandRect(karpefRect || cityRect, AMOS.MIL12 * settings.amahM))
      : rectToCorners(expandRect(cityRect, AMOS.MIL12 * settings.amahM)));

    return {
      mode,
      validatedPerimeterActive: perimeterActive,
      labels,
      homeCluster: home,
      clusters: clusters.map((c) => ({
        members: c.members,
        corners: rectToCorners(c.bbox),
        key: c.key,
        qualifiesAsCity: c.qualifiesAsCity,
        qualificationSource: c.qualificationSource,
        qualificationRemapScore: c.qualificationRemapScore,
        componentKeys: c.componentKeys,
      })),
      reviewClusters: qualificationAudit.map((c) => ({ key: c.key, members: c.members, memberIds: c.memberIds,
        corners: rectToCorners(c.bbox), qualifiesAsCity: c.qualifiesAsCity,
        qualificationSource: c.qualificationSource, qualificationRemapScore: c.qualificationRemapScore })),
      cityCorners,
      karpefCorners: rectToCorners(karpefRect),
      techumCorners,
      mil12Corners,
      concavityRegions: concavity.map((w) => rectToCorners(w.region)),
      concavityAudit: concavity.map((w) => ({
        reviewKey: w.reviewKey,
        regionCorners: rectToCorners(w.region),
        reviewerEndpoints: w.reviewerEndpoints ? w.reviewerEndpoints.map(unrot) : null,
        reviewStatus: w.reviewStatus,
        appliedToBoundary: false,
      })),
      warnings,
      thresholds: { joinM, t2, techumM, karpefM },
    };
  }

  return {
    AMOS, makeProjection, runPipeline, bufferRing,
    // exported for tests
    _internals: {
      bboxOfRing, bboxGap, expandRect, rectsOverlap, rectContains, ringDist,
      ringDistToPoint, clusterBuildings, buildClusters, mergeCities, GridIndex,
      pointInRing, segSegDist, annotateCityQualification, concavityWarnings,
    },
  };
});
