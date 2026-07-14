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
  function pointInOrOnRing(p, ring) {
    return pointInRing(p, ring) || ringDistToPoint(p, ring) < 0.01;
  }
  function ringsOverlap(r1, r2) {
    if (pointInOrOnRing(r1[0], r2) || pointInOrOnRing(r2[0], r1)) return true;
    for (let i = 0; i < r1.length; i++) {
      for (let j = 0; j < r2.length; j++) {
        if (segsIntersect(r1[i], r1[(i + 1) % r1.length], r2[j], r2[(j + 1) % r2.length])) return true;
      }
    }
    return false;
  }
  function ringContainsRing(outer, inner) {
    return inner.every((p) => pointInOrOnRing(p, outer));
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
      cluster.houseCount = cluster.members.reduce((count, index) => count + (buildings[index].joinOnly ? 0 : 1), 0);
      cluster.qualifiesAsCity = typeof decision === 'boolean'
        ? decision
        : cluster.houseCount >= minCityHouses;
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

  // A city that is already rectangular keeps its own orientation, even when it is
  // diagonal to the world's directions (SA/MB OC 398:1).  These helpers find the
  // minimum-area rectangle around the settlement, then use a deliberately strict
  // fill-ratio test before calling the settlement "already rectangular".  Irregular
  // shapes fall back to the true-north/world-direction rectangle (SA OC 398:2-3).
  function convexHull(points) {
    const unique = [...new Map(points.map((p) => [`${p.x},${p.y}`, p])).values()]
      .sort((a, b) => a.x - b.x || a.y - b.y);
    if (unique.length <= 2) return unique;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of unique) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = unique.length - 1; i >= 0; i--) {
      const p = unique[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }
  function ringArea(ring) {
    let twice = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      twice += a.x * b.y - b.x * a.y;
    }
    return Math.abs(twice) / 2;
  }
  function toOrientedFrame(p, angleRad) {
    const c = Math.cos(angleRad), s = Math.sin(angleRad);
    return { x: p.x * c + p.y * s, y: -p.x * s + p.y * c };
  }
  function fromOrientedFrame(p, angleRad) {
    const c = Math.cos(angleRad), s = Math.sin(angleRad);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  }
  function normalizeRectAngle(angleRad) {
    while (angleRad <= -Math.PI / 4) angleRad += Math.PI / 2;
    while (angleRad > Math.PI / 4) angleRad -= Math.PI / 2;
    return angleRad;
  }
  function rectCornersInFrame(rect, angleRad) {
    return [
      fromOrientedFrame({ x: rect.minX, y: rect.minY }, angleRad),
      fromOrientedFrame({ x: rect.maxX, y: rect.minY }, angleRad),
      fromOrientedFrame({ x: rect.maxX, y: rect.maxY }, angleRad),
      fromOrientedFrame({ x: rect.minX, y: rect.maxY }, angleRad),
    ];
  }
  function minimumAreaRect(points) {
    const hull = convexHull(points);
    if (hull.length < 3) return null;
    let best = null;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length];
      const angleRad = normalizeRectAngle(Math.atan2(b.y - a.y, b.x - a.x));
      const rect = bboxOfRing(hull.map((p) => toOrientedFrame(p, angleRad)));
      const area = (rect.maxX - rect.minX) * (rect.maxY - rect.minY);
      if (!best || area < best.area) best = { angleRad, rect, area, hull };
    }
    return best;
  }
  function trapezoidAxis(points) {
    const hull = convexHull(points);
    if (hull.length !== 4) return null;
    const edgeAngle = (index) => Math.atan2(
      hull[(index + 1) % 4].y - hull[index].y,
      hull[(index + 1) % 4].x - hull[index].x);
    const parallelDelta = (a, b) => {
      let delta = Math.abs(a - b) % Math.PI;
      if (delta > Math.PI / 2) delta = Math.PI - delta;
      return delta;
    };
    const tolerance = Math.PI / 180; // engineering classifier; exact law has no numeric tolerance
    const pairs = [[0, 2], [1, 3]].filter(([a, b]) => parallelDelta(edgeAngle(a), edgeAngle(b)) <= tolerance);
    if (!pairs.length) return null;
    const pair = pairs.sort((left, right) => {
      const length = ([index]) => Math.hypot(
        hull[(index + 1) % 4].x - hull[index].x,
        hull[(index + 1) % 4].y - hull[index].y);
      return length(right) - length(left);
    })[0];
    return normalizeRectAngle(edgeAngle(pair[0]));
  }
  function deriveSquaring(points, options) {
    const opts = options || {};
    if (opts.reviewerAngleApplied) {
      const rect = bboxOfRing(points);
      return { method: 'reviewer-angle', angleRad: 0, rect, rectangularity: null };
    }
    const min = minimumAreaRect(points);
    const hullArea = min ? ringArea(min.hull) : 0;
    const rectangularity = min && min.area > 0 ? hullArea / min.area : 0;
    // High confidence only: a chamfered/irregular town must not acquire a favorable
    // diagonal merely because its convex hull happens to have one long sloping edge.
    if (min && rectangularity >= 0.94) {
      return { method: 'preserved-rectangle', angleRad: min.angleRad, rect: min.rect, rectangularity };
    }
    const trapezoidAngle = trapezoidAxis(points);
    if (trapezoidAngle != null) {
      const rect = bboxOfRing(points.map((point) => toOrientedFrame(point, trapezoidAngle)));
      return { method: 'trapezoid-extended', angleRad: trapezoidAngle, rect, rectangularity };
    }
    return { method: 'world-aligned', angleRad: 0, rect: bboxOfRing(points), rectangularity };
  }

  function rectIntersection(a, b) {
    const out = {
      minX: Math.max(a.minX, b.minX), maxX: Math.min(a.maxX, b.maxX),
      minY: Math.max(a.minY, b.minY), maxY: Math.min(a.maxY, b.maxY),
    };
    return out.minX < out.maxX && out.minY < out.maxY ? out : null;
  }

  // Subtract one axis-aligned review mask from a ribua. The non-overlapping pieces
  // are exact rectangles, so karpef and techum remain exact L-infinity expansions.
  function subtractRect(rect, mask) {
    const cut = rectIntersection(rect, mask);
    if (!cut) return [{ ...rect }];
    const pieces = [];
    if (rect.minX < cut.minX) pieces.push({ minX: rect.minX, maxX: cut.minX, minY: rect.minY, maxY: rect.maxY });
    if (cut.maxX < rect.maxX) pieces.push({ minX: cut.maxX, maxX: rect.maxX, minY: rect.minY, maxY: rect.maxY });
    if (rect.minY < cut.minY) pieces.push({ minX: cut.minX, maxX: cut.maxX, minY: rect.minY, maxY: cut.minY });
    if (cut.maxY < rect.maxY) pieces.push({ minX: cut.minX, maxX: cut.maxX, minY: cut.maxY, maxY: rect.maxY });
    return pieces.filter((p) => p.maxX > p.minX && p.maxY > p.minY);
  }

  function polygonSignedArea(ring) {
    let twice = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      twice += a.x * b.y - b.x * a.y;
    }
    return twice / 2;
  }

  // Sutherland-Hodgman clipping. Every ribua/techum candidate is convex, so this
  // gives the exact conservative common area when the pin lies only in the empty
  // overlap of unrelated no-join cities.
  function intersectConvexPolygons(subject, clip) {
    if (!subject || subject.length < 3 || !clip || clip.length < 3) return [];
    let output = subject.map((p) => ({ x: p.x, y: p.y }));
    const sign = polygonSignedArea(clip) >= 0 ? 1 : -1;
    const inside = (p, a, b) => sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) >= -1e-8;
    const intersection = (s, e, a, b) => {
      const dx1 = e.x - s.x, dy1 = e.y - s.y, dx2 = b.x - a.x, dy2 = b.y - a.y;
      const den = dx1 * dy2 - dy1 * dx2;
      if (Math.abs(den) < 1e-12) return { x: e.x, y: e.y };
      const t = ((a.x - s.x) * dy2 - (a.y - s.y) * dx2) / den;
      return { x: s.x + t * dx1, y: s.y + t * dy1 };
    };
    for (let i = 0; i < clip.length && output.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length], input = output;
      output = [];
      let s = input[input.length - 1];
      for (const e of input) {
        const eInside = inside(e, a, b), sInside = inside(s, a, b);
        if (eInside) {
          if (!sInside) output.push(intersection(s, e, a, b));
          output.push(e);
        } else if (sInside) output.push(intersection(s, e, a, b));
        s = e;
      }
    }
    return output;
  }

  function intersectPolygonSets(sets) {
    if (!sets.length) return [];
    return sets.slice(1).reduce((subjects, clips) => subjects.flatMap((subject) =>
      clips.map((clip) => intersectConvexPolygons(subject, clip)).filter((ring) => ring.length >= 3)),
    sets[0]);
  }

  function clusterGapIndexed(cA, cB, buildings, upperBound, buildingGrid) {
    if (bboxGap(cA.bbox, cB.bbox) > upperBound) return Infinity;
    const source = cA.members.length <= cB.members.length ? cA : cB;
    const target = source === cA ? cB : cA;
    const targetMembers = new Set(target.members);
    let best = Infinity;
    for (const i of source.members) {
      const searchDistance = Math.min(best, upperBound);
      for (const j of buildingGrid.query(expandRect(buildings[i].bbox, searchDistance))) {
        if (!targetMembers.has(j)) continue;
        if (bboxGap(buildings[i].bbox, buildings[j].bbox) > searchDistance) continue;
        const distance = ringDist(buildings[i].ring, buildings[j].ring);
        if (distance < best) best = distance;
        if (best === 0) return 0;
      }
    }
    return best;
  }

  // ---------- Stage 2: city-to-city 141 1/3 merge (SA 398:5; MB 398:38 six-house min) ----------
  function mergeCities(clusters, buildings, t2, minCityHouses) {
    const notes = [];
    const qualifies = (cluster) => cluster.qualifiesAsCity == null
      ? cluster.members.length >= minCityHouses : cluster.qualifiesAsCity;
    const uf = UnionFind(clusters.length);
    const grid = GridIndex(Math.max(t2, 50));
    const buildingGrid = GridIndex(Math.max(t2, 25));
    buildings.forEach((building, index) => { if (building.included) buildingGrid.insert(index, building.bbox); });
    clusters.forEach((cluster, index) => { if (qualifies(cluster)) grid.insert(index, cluster.bbox); });

    // A merge never creates a new shorter building-to-building gap: the distance from
    // (A union B) to C is min(distance(A,C), distance(B,C)). Therefore the halachic
    // transitive merge is exactly the connected components of the original qualifying
    // cities under the fixed 141 1/3-amah threshold. Check each spatial candidate once.
    for (let a = 0; a < clusters.length; a++) {
      if (!qualifies(clusters[a])) continue;
      for (const b of grid.query(expandRect(clusters[a].bbox, t2))) {
        if (b <= a || !qualifies(clusters[b])) continue;
        if (bboxGap(clusters[a].bbox, clusters[b].bbox) > t2) continue;
        const gap = clusterGapIndexed(clusters[a], clusters[b], buildings, t2, buildingGrid);
        if (gap <= t2 && uf.find(a) !== uf.find(b)) {
          uf.union(a, b);
          notes.push({ type: 'city-merge', gapM: gap });
        }
      }
    }

    const groups = new Map();
    clusters.forEach((cluster, index) => {
      const root = qualifies(cluster) ? uf.find(index) : index;
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(cluster);
    });
    const mergedClusters = [...groups.values()].map((group) => {
      if (group.length === 1) return group[0];
      const members = group.flatMap((cluster) => cluster.members);
      const componentKeys = group.flatMap((cluster) => cluster.componentKeys);
      return {
        members,
        houseCount: group.reduce((sum, cluster) => sum + (cluster.houseCount == null ? cluster.members.length : cluster.houseCount), 0),
        bbox: group.reduce((box, cluster) => bboxUnion(box, cluster.bbox), group[0].bbox),
        key: `merged:${componentKeys.slice().sort().join('|')}`,
        qualifiesAsCity: true,
        qualificationSource: 'merged-qualified-cities',
        componentKeys,
      };
    });
    clusters.splice(0, clusters.length, ...mergedClusters);
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
    const buildingGrid = GridIndex(Math.max(techum, 100));
    buildings.forEach((building, index) => { if (building.included) buildingGrid.insert(index, building.bbox); });
    let acted = true;
    while (acted) {
      acted = false;
      // Only bona-fide cities can participate. Iterating every isolated footprint made
      // this O(all clusters^3), freezing dense-city pages even though almost all of
      // those clusters could never satisfy the rule.
      const candidates = clusters.map((cl, i) => ({ cl, i })).filter(({ cl }) =>
        cl.qualifiesAsCity == null
          ? cl.members.length >= settings.minCityHouses
          : cl.qualifiesAsCity);
      if (candidates.length < 3) break;
      const cityGrid = GridIndex(Math.max(techum, 100));
      candidates.forEach(({ cl, i }) => cityGrid.insert(i, cl.bbox));
      outer:
      for (const { i: b } of candidates) {
        const nearby = [];
        for (const i of cityGrid.query(expandRect(clusters[b].bbox, techum))) {
          if (i === b) continue;
          const gap = clusterGapIndexed(clusters[i], clusters[b], buildings, techum, buildingGrid);
          if (gap <= techum) nearby.push(i);
        }
        nearby.sort((a, c) => a - c);
        for (let ai = 0; ai < nearby.length; ai++) {
          const a = nearby[ai];
          for (let ci = ai + 1; ci < nearby.length; ci++) {
            const c = nearby[ci];
            const A = clusters[a], B = clusters[b], C = clusters[c];
            const maxOuterGap = Math.hypot(B.bbox.maxX - B.bbox.minX, B.bbox.maxY - B.bbox.minY) + 2 * t2;
            const dAC = clusterGapIndexed(A, C, buildings, maxOuterGap, buildingGrid);
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
                houseCount: [A, B, C].reduce((sum, cluster) => sum +
                  (cluster.houseCount == null ? cluster.members.length : cluster.houseCount), 0),
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

  // ---------- Stage 4: bow / enclosed-hole review geometry ----------
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
      const isLargeBow = touchesBorder && Math.max(spanX, spanY) >= bow;
      const isLargeHole = !touchesBorder && spanX >= bow && spanY >= bow;
      if (isLargeBow || isLargeHole) {
        const region = {
          minX: rect.minX + minCX * cw, maxX: rect.minX + (maxCX + 1) * cw,
          minY: rect.minY + minCY * ch, maxY: rect.minY + (maxCY + 1) * ch,
        };
        const kind = isLargeHole ? 'hole' : 'bow';
        const reviewKey = `${kind}:${[region.minX, region.minY, region.maxX, region.maxY]
          .map((value) => Math.round(value / Math.max(1, join))).join(':')}`;
        const savedReview = settings.concavityReviews && settings.concavityReviews[reviewKey];
        const endpoints = savedReview && Array.isArray(savedReview.endpoints) &&
          savedReview.endpoints.length === 2 && savedReview.endpoints.every((p) =>
            p && Number.isFinite(p.x) && Number.isFinite(p.y))
          ? savedReview.endpoints.map((p) => ({ x: p.x, y: p.y }))
          : null;
        const mouthM = Math.max(spanX, spanY), depthM = Math.min(spanX, spanY);
        warnings.push({
          type: isLargeHole ? 'large-interior-hole' : 'large-concavity',
          shapeKind: kind,
          reviewKey,
          reviewerEndpoints: endpoints,
          reviewStatus: isLargeHole ? 'policy-applied' : endpoints ? 'endpoints-confirmed' : 'provisional-no-fill-needs-endpoints',
          mouthM,
          depthM,
          text: isLargeHole
            ? 'A wholly enclosed empty area is at least 4000 amos in both governing axes. The default includes it (Beit Yitzchok / R’ Shulem Weiss); the strict exclusion setting follows Zichron Yosef / R’ Pesach Falk.'
            : 'A material bow/L pocket reaches 4000 amos. Until a reviewer confirms its endpoints, the app uses a provisional no-fill boundary instead of silently granting the pocket.',
          region,
        });
      }
    }
    return warnings;
  }

  // ---------- Full pipeline ----------
  // A result may contain several rectangular regions. This is required for the
  // R' Shlomo Miller overlap approach and for a no-fill bow/L pocket; flattening
  // those cases into one bounding rectangle would create an area no posek granted.
  function runPipeline(buildings, settings, pin) {
    const clock = () => typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const engineStarted = clock(), stageTimings = {};
    let stageStarted = engineStarted;
    const markStage = (name) => { const ended = clock(); stageTimings[name] = ended - stageStarted; stageStarted = ended; };
    const warnings = [];
    const joinM = AMOS.JOIN * settings.amahM, t2 = AMOS.JOIN2 * settings.amahM;
    const techumM = AMOS.TECHUM * settings.amahM, karpefM = AMOS.KARPEF * settings.amahM;
    const overlapPolicy = settings.overlapPolicy || (settings.overlapMerge ? 'join-redraw' : 'no-join');
    const largeHolePolicy = settings.largeHolePolicy || 'include-with-warning';
    const bowPolicy = settings.bowPolicy || 'rema-majority';

    const angle = ((settings.squaringAngleDeg || 0) * Math.PI) / 180;
    const pointAngle = ((settings.pointRotationDeg || 0) * Math.PI) / 180;
    const rot = (p) => angle === 0 ? ({ x: p.x, y: p.y }) : ({
      x: p.x * Math.cos(-angle) - p.y * Math.sin(-angle),
      y: p.x * Math.sin(-angle) + p.y * Math.cos(-angle),
    });
    const unrot = (p) => angle === 0 ? ({ x: p.x, y: p.y }) : ({
      x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
      y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
    });
    const work = angle === 0 ? buildings : buildings.map((building) => {
      const ring = building.ring.map(rot); return { ...building, ring, bbox: bboxOfRing(ring) };
    });
    const workPin = rot(pin);
    markStage('rotation');

    const labels = clusterBuildings(work, joinM);
    markStage('iburClustering');
    const clusters = buildClusters(work, labels);
    markStage('clusterAssembly');
    annotateCityQualification(clusters, work, settings.minCityHouses, settings.cityQualificationOverrides);
    const qualificationAudit = clusters.map((cluster) => ({
      key: cluster.key, members: [...cluster.members], memberIds: [...cluster.memberIds], bbox: { ...cluster.bbox },
      houseCount: cluster.houseCount, qualifiesAsCity: cluster.qualifiesAsCity,
      qualificationSource: cluster.qualificationSource, qualificationRemapScore: cluster.qualificationRemapScore,
    }));
    markStage('cityQualification');

    // 141⅓ and three-village mergers are applied to a fixed point. A three-village
    // merger can create a settlement that now qualifies for another 141⅓ merger.
    let changed = true, cityMergeMs = 0, threeVillagesMs = 0;
    while (changed) {
      const before = clusters.map((cluster) => cluster.componentKeys.slice().sort().join('|')).sort().join('::');
      let substageStarted = clock();
      for (const note of mergeCities(clusters, work, t2, settings.minCityHouses)) {
        warnings.push({ type: 'city-merge', text: `Two settlements merged (gap ${note.gapM.toFixed(1)} m <= 141 1/3 amos).` });
      }
      cityMergeMs += clock() - substageStarted;
      substageStarted = clock();
      warnings.push(...threeVillages(clusters, work, settings));
      threeVillagesMs += clock() - substageStarted;
      const after = clusters.map((cluster) => cluster.componentKeys.slice().sort().join('|')).sort().join('::');
      changed = before !== after;
    }
    stageTimings.cityMerges = cityMergeMs;
    stageTimings.threeVillages = threeVillagesMs;
    stageTimings.settlementMerges = cityMergeMs + threeVillagesMs;
    stageStarted = clock();

    const squaringCache = new Map();
    const clusterPoints = (cluster) => cluster.members.flatMap((index) => work[index].ring);
    const getClusterSquaring = (cluster) => {
      if (!squaringCache.has(cluster)) squaringCache.set(cluster,
        deriveSquaring(clusterPoints(cluster), { reviewerAngleApplied: angle !== 0 }));
      return squaringCache.get(cluster);
    };
    const cityModels = clusters.map((cluster, clusterIndex) => {
      if (!cluster.qualifiesAsCity) return null;
      const sq = getClusterSquaring(cluster);
      return { cluster, clusterIndex, sq, ring: rectCornersInFrame(sq.rect, sq.angleRad) };
    }).filter(Boolean);

    const expandedModelRing = (model, distance) => rectCornersInFrame(expandRect(model.sq.rect, distance), model.sq.angleRad);
    const overlapClosure = (seedIndex, policy) => {
      const chosen = new Set([seedIndex]);
      if (policy === 'no-join') return { indices: [seedIndex], redraw: null };
      if (policy === 'join-no-redraw') {
        const queue = [seedIndex];
        while (queue.length) {
          const current = cityModels[queue.shift()];
          cityModels.forEach((candidate, index) => {
            if (!chosen.has(index) && ringsOverlap(current.ring, candidate.ring)) { chosen.add(index); queue.push(index); }
          });
        }
        return { indices: [...chosen].sort((a, b) => a - b), redraw: null };
      }
      let redraw = null, acted = true;
      while (acted) {
        const jointSquaring = deriveSquaring([...chosen].flatMap((index) =>
          clusterPoints(cityModels[index].cluster)), { reviewerAngleApplied: angle !== 0 });
        redraw = jointSquaring;
        const redrawRing = rectCornersInFrame(redraw.rect, redraw.angleRad);
        acted = false;
        cityModels.forEach((candidate, index) => {
          if (!chosen.has(index) && ringsOverlap(redrawRing, candidate.ring)) { chosen.add(index); acted = true; }
        });
      }
      return { indices: [...chosen].sort((a, b) => a - b), redraw };
    };
    const closureMap = new Map();
    cityModels.forEach((model, index) => {
      const closure = overlapClosure(index, overlapPolicy), key = closure.indices.join(',');
      if (!closureMap.has(key)) closureMap.set(key, closure);
    });
    const closures = [...closureMap.values()];
    markStage('overlapClosures');

    let homeBuilding = -1, homeBuildingArea = Infinity;
    work.forEach((building, index) => {
      if (!building.included || building.joinOnly || !pointInOrOnRing(workPin, building.ring)) return;
      const area = Math.abs(ringArea(building.ring));
      if (area < homeBuildingArea) { homeBuilding = index; homeBuildingArea = area; }
    });
    let physicalCityModel = -1;
    if (homeBuilding >= 0) physicalCityModel = cityModels.findIndex((model) => model.cluster.members.includes(homeBuilding));

    const closureStartingRings = (closure) => {
      if (closure.redraw) return [rectCornersInFrame(
        settings.karpef ? expandRect(closure.redraw.rect, karpefM) : closure.redraw.rect,
        closure.redraw.angleRad)];
      return closure.indices.map((index) => expandedModelRing(cityModels[index], settings.karpef ? karpefM : 0));
    };
    let selectedClosures = physicalCityModel >= 0
      ? closures.filter((closure) => closure.indices.includes(physicalCityModel)).slice(0, 1)
      : closures.filter((closure) => closureStartingRings(closure).some((ring) => pointInOrOnRing(workPin, ring)));

    const validatedPerimeter = Array.isArray(settings.validatedCityPerimeter) && settings.validatedCityPerimeter.length >= 3
      ? settings.validatedCityPerimeter.map(rot) : null;
    const perimeterActive = !!(validatedPerimeter && pointInOrOnRing(workPin, validatedPerimeter));
    const mode = perimeterActive || selectedClosures.length ? 'city' : homeBuilding >= 0 ? 'building' : 'point';
    let home = selectedClosures.length === 1 ? cityModels[selectedClosures[0].indices[0]].clusterIndex : -1;
    markStage('homeSelection');

    let squaring = null, cityPolygons = [], karpefPolygons = [], techumPolygons = [], mil12Polygons = [];
    const concavity = [];
    const regionDefToRing = (def, expansion) => rectCornersInFrame(expandRect(def.rect, expansion || 0), def.angleRad);
    const applyShapeRules = (defs, sourceCluster, sourceAngle) => {
      if (!sourceCluster || !sourceCluster.members.length) return defs;
      const framedBuildings = work.map((building) => {
        const ring = building.ring.map((point) => toOrientedFrame(point, sourceAngle));
        return { ...building, ring, bbox: bboxOfRing(ring) };
      });
      const sourceRect = defs.length === 1 && defs[0].angleRad === sourceAngle ? defs[0].rect
        : bboxOfRing(defs.flatMap((def) => regionDefToRing(def, 0)).map((point) => toOrientedFrame(point, sourceAngle)));
      const found = concavityWarnings({ ...sourceCluster, bbox: sourceRect }, framedBuildings, {
        ...settings, concavityReviews: {},
      });
      let pieces = [{ rect: sourceRect, angleRad: sourceAngle }];
      for (const warning of found) {
        const saved = settings.concavityReviews && settings.concavityReviews[warning.reviewKey];
        const endpoints = saved && Array.isArray(saved.endpoints) && saved.endpoints.length === 2
          ? saved.endpoints.map((point) => toOrientedFrame(rot(point), sourceAngle)) : null;
        warning.reviewerEndpoints = endpoints;
        let exclude = false;
        if (warning.shapeKind === 'hole') {
          exclude = largeHolePolicy === 'exclude';
          warning.reviewStatus = exclude ? 'strict-exclusion-applied' : 'included-with-warning';
          warning.text = exclude
            ? 'A wholly enclosed >=4000-by-4000-amah void is excluded under the selected Zichron Yosef / R’ Pesach Falk setting.'
            : warning.text;
        } else {
          const chordM = endpoints ? Math.hypot(endpoints[1].x - endpoints[0].x, endpoints[1].y - endpoints[0].y) : null;
          let depthM = warning.depthM;
          if (endpoints) {
            const [a, b] = endpoints, chord = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            // Depth belongs to the detected empty bow/L pocket, not to the full
            // inhabited city behind its chord. Measuring every dwelling would
            // overstate the depth whenever the city extends far inland.
            depthM = Math.max(...rectCornersInFrame(warning.region, 0)
              .map((point) => Math.abs((b.x - a.x) * (a.y - point.y) - (a.x - point.x) * (b.y - a.y)) / chord));
          }
          const fillByRema = endpoints && (chordM < AMOS.BOW * settings.amahM || depthM < techumM);
          const fillByMechaber = endpoints && chordM < AMOS.BOW * settings.amahM;
          const fill = bowPolicy === 'emergency-fill' ? !!endpoints
            : bowPolicy === 'mechaber-curve' ? fillByMechaber : fillByRema;
          exclude = !fill;
          warning.chordM = chordM; warning.depthM = depthM;
          warning.reviewStatus = endpoints ? (fill ? 'reviewed-fill-applied' : 'reviewed-no-fill-applied')
            : 'provisional-no-fill-needs-endpoints';
          warning.text = endpoints
            ? `Reviewer endpoints applied: chord ${chordM.toFixed(1)} m; depth ${depthM.toFixed(1)} m. ${fill ? 'The pocket is filled under the selected bow rule.' : 'The >=4000-amah pocket remains unfilled.'}`
            : warning.text;
        }
        warning.appliedToBoundary = exclude;
        warning.frameAngleRad = sourceAngle;
        concavity.push(warning);
        if (exclude) pieces = pieces.flatMap((piece) => subtractRect(piece.rect, warning.region)
          .map((rect) => ({ rect, angleRad: sourceAngle })));
      }
      return pieces;
    };

    if (mode === 'city' && perimeterActive) {
      squaring = deriveSquaring(validatedPerimeter, { reviewerAngleApplied: angle !== 0 });
      const defs = [{ rect: squaring.rect, angleRad: squaring.angleRad }];
      cityPolygons = defs.map((def) => regionDefToRing(def, 0));
      karpefPolygons = settings.karpef ? defs.map((def) => regionDefToRing(def, karpefM)) : [];
      techumPolygons = defs.map((def) => regionDefToRing(def, techumM + (settings.karpef ? karpefM : 0)));
      mil12Polygons = defs.map((def) => regionDefToRing(def, AMOS.MIL12 * settings.amahM + (settings.karpef ? karpefM : 0)));
      warnings.push({ type: 'validated-perimeter', text: 'A reviewer-supplied validated enclosure is being used as the city edge. The app did not infer its hukaf-l\'dira status; confirm the supplied perimeter and ruling.' });
    } else if (mode === 'city') {
      const buildClosureBoundary = (closure) => {
        let defs;
        if (closure.redraw) {
          const members = closure.indices.flatMap((index) => cityModels[index].cluster.members);
          const combined = { members, bbox: closure.redraw.rect };
          defs = applyShapeRules([{ rect: closure.redraw.rect, angleRad: closure.redraw.angleRad }], combined, closure.redraw.angleRad);
        } else {
          defs = closure.indices.flatMap((index) => {
            const model = cityModels[index];
            return applyShapeRules([{ rect: model.sq.rect, angleRad: model.sq.angleRad }], model.cluster, model.sq.angleRad);
          });
        }
        return {
          defs,
          city: defs.map((def) => regionDefToRing(def, 0)),
          karpef: settings.karpef ? defs.map((def) => regionDefToRing(def, karpefM)) : [],
          techum: defs.map((def) => regionDefToRing(def, techumM + (settings.karpef ? karpefM : 0))),
          mil12: defs.map((def) => regionDefToRing(def, AMOS.MIL12 * settings.amahM + (settings.karpef ? karpefM : 0))),
        };
      };
      const boundaries = selectedClosures.map(buildClosureBoundary);
      if (boundaries.length > 1 && overlapPolicy === 'no-join' && physicalCityModel < 0) {
        cityPolygons = intersectPolygonSets(boundaries.map((boundary) => boundary.city));
        karpefPolygons = settings.karpef ? intersectPolygonSets(boundaries.map((boundary) => boundary.karpef)) : [];
        techumPolygons = intersectPolygonSets(boundaries.map((boundary) => boundary.techum));
        mil12Polygons = intersectPolygonSets(boundaries.map((boundary) => boundary.mil12));
        warnings.push({ type: 'multiple-home-candidates', text: 'The pin lies only in the empty overlap of unrelated no-join city squares. The displayed boundary is the conservative common area of every candidate; a rav must identify the governing city for a larger result.' });
        squaring = { method: 'candidate-intersection', angleRad: 0, rectangularity: null };
      } else {
        const boundary = boundaries[0];
        cityPolygons = boundary.city; karpefPolygons = boundary.karpef;
        techumPolygons = boundary.techum; mil12Polygons = boundary.mil12;
        const primary = cityModels[selectedClosures[0].indices[0]];
        squaring = selectedClosures[0].redraw
          ? { method: 'overlap-joint-redraw', angleRad: selectedClosures[0].redraw.angleRad, rectangularity: null }
          : primary.sq;
      }
      const selectedIndices = new Set(selectedClosures.flatMap((closure) => closure.indices));
      cityModels.forEach((model, index) => {
        if (selectedIndices.has(index)) return;
        const overlaps = selectedClosures.some((closure) => closure.indices.some((chosen) => ringsOverlap(cityModels[chosen].ring, model.ring)));
        if (overlaps && overlapPolicy === 'no-join') warnings.push({ type: 'overlap-detected', text: 'Another city’s ribua overlaps this one. The selected no-join default keeps the cities separate; the two joining alternatives are available in rav settings.' });
        const swallowed = techumPolygons.some((region) => model.ring.every((point) => pointInOrOnRing(point, region)));
        if (swallowed) warnings.push({ type: 'ir-muvlaas', text: 'Another complete city lies inside this techum. Its route-specific ir muvla’at continuation is not represented by one universal permission polygon; check the destination with a rav.' });
      });
      if (overlapPolicy === 'join-no-redraw' && selectedClosures[0].indices.length > 1) warnings.push({ type: 'overlap-merge-no-redraw', text: 'Overlapping city rectangles join without a new encompassing redraw (R’ Shlomo Miller). The green and pink results remain stepped unions of the original rectangles.' });
      if (overlapPolicy === 'join-redraw' && selectedClosures[0].indices.length > 1) warnings.push({ type: 'overlap-merge-redraw', text: 'Overlapping city rectangles join and were repeatedly redrawn to a fixed point under the selected expansive approach.' });
    } else if (mode === 'building') {
      squaring = deriveSquaring(work[homeBuilding].ring, { reviewerAngleApplied: angle !== 0 });
      const def = { rect: squaring.rect, angleRad: squaring.angleRad };
      cityPolygons = [regionDefToRing(def, 0)]; techumPolygons = [regionDefToRing(def, techumM)];
      mil12Polygons = [regionDefToRing(def, AMOS.MIL12 * settings.amahM)];
      warnings.push({ type: 'building-mode', text: 'No qualifying city joins this footprint. The techum is measured from the mapped building walls; confirm the footprint and dwelling status.' });
    } else {
      const half = 2 * settings.amahM;
      const base = { minX: workPin.x - half, maxX: workPin.x + half, minY: workPin.y - half, maxY: workPin.y + half };
      const rotateAroundPin = (ring) => pointAngle === 0 ? ring : ring.map((point) => {
        const dx = point.x - workPin.x, dy = point.y - workPin.y;
        return { x: workPin.x + dx * Math.cos(pointAngle) - dy * Math.sin(pointAngle),
          y: workPin.y + dx * Math.sin(pointAngle) + dy * Math.cos(pointAngle) };
      });
      cityPolygons = [rotateAroundPin(rectCornersInFrame(base, 0))];
      techumPolygons = [rotateAroundPin(rectCornersInFrame(expandRect(base, techumM), 0))];
      mil12Polygons = [rotateAroundPin(rectCornersInFrame(expandRect(base, AMOS.MIL12 * settings.amahM), 0))];
      squaring = { method: pointAngle === 0 ? 'world-aligned-point' : 'reviewer-angle-point', angleRad: pointAngle, rectangularity: null };
      warnings.push({ type: 'point-mode', text: 'No city starting area contains this point — treated as open-field shevisa: a 4-amah square plus 2000 amos on every side.' });
    }
    warnings.push(...concavity);
    markStage('boundaryAndWarnings');

    const outward = (polygons) => polygons.map((ring) => ring.map(unrot));
    const cityRegions = outward(cityPolygons), karpefRegions = outward(karpefPolygons);
    const techumRegions = outward(techumPolygons), mil12Regions = outward(mil12Polygons);
    const concavityAudit = concavity.map((warning) => ({
      reviewKey: warning.reviewKey,
      shapeKind: warning.shapeKind,
      regionCorners: rectCornersInFrame(warning.region, warning.frameAngleRad || 0).map(unrot),
      reviewerEndpoints: warning.reviewerEndpoints
        ? warning.reviewerEndpoints.map((point) => fromOrientedFrame(point, warning.frameAngleRad || 0)).map(unrot) : null,
      reviewStatus: warning.reviewStatus,
      appliedToBoundary: !!warning.appliedToBoundary,
      chordM: warning.chordM == null ? null : warning.chordM,
      depthM: warning.depthM,
    }));
    const provisional = concavity.some((warning) => warning.shapeKind === 'bow' && !warning.reviewerEndpoints);
    const rectToCorners = (rect, localAngle) => rectCornersInFrame(rect, localAngle || 0).map(unrot);
    const serializedClusters = clusters.map((cluster) => {
      const clusterSq = cluster.qualifiesAsCity ? getClusterSquaring(cluster) : null;
      return { members: [...cluster.members], houseCount: cluster.houseCount,
        corners: clusterSq ? rectToCorners(clusterSq.rect, clusterSq.angleRad) : rectToCorners(cluster.bbox),
        key: cluster.key, qualifiesAsCity: cluster.qualifiesAsCity,
        qualificationSource: cluster.qualificationSource, qualificationRemapScore: cluster.qualificationRemapScore,
        componentKeys: cluster.componentKeys };
    });
    if (mode === 'city' && selectedClosures.length === 1 && home >= 0 && selectedClosures[0].indices.length > 1) {
      const joinedModels = selectedClosures[0].indices.map((index) => cityModels[index]);
      serializedClusters[home] = {
        ...serializedClusters[home],
        members: [...new Set(joinedModels.flatMap((model) => model.cluster.members))],
        houseCount: joinedModels.reduce((sum, model) => sum + (model.cluster.houseCount || model.cluster.members.length), 0),
        overlapJoinedClusterIndices: joinedModels.map((model) => model.clusterIndex),
      };
    }
    const result = {
      mode,
      calculationStatus: provisional ? 'provisional-no-fill' : 'complete-default',
      validatedPerimeterActive: perimeterActive,
      labels, homeCluster: home, homeCandidates: selectedClosures.map((closure) => closure.indices.map((index) => cityModels[index].clusterIndex)),
      homeBuilding, overlapPolicy,
      clusters: serializedClusters,
      qualificationClusters: qualificationAudit.map((cluster) => ({
        key: cluster.key, members: cluster.members, memberIds: cluster.memberIds, houseCount: cluster.houseCount,
        corners: rectToCorners(cluster.bbox), qualifiesAsCity: cluster.qualifiesAsCity,
        qualificationSource: cluster.qualificationSource, qualificationRemapScore: cluster.qualificationRemapScore,
      })),
      cityRegions, karpefRegions, techumRegions, mil12Regions,
      // Compatibility aliases for callers that predate multi-region boundaries.
      cityCorners: cityRegions[0] || null, karpefCorners: karpefRegions[0] || null,
      techumCorners: techumRegions[0] || null, mil12Corners: mil12Regions[0] || null,
      squaring: {
        method: squaring.method,
        angleDeg: mode === 'point' ? (settings.pointRotationDeg || 0)
          : (settings.squaringAngleDeg || 0) + (squaring.angleRad || 0) * 180 / Math.PI,
        rectangularity: squaring.rectangularity,
        reviewRequired: concavity.length > 0 || selectedClosures.length > 1,
      },
      concavityRegions: concavityAudit.map((audit) => audit.regionCorners), concavityAudit,
      warnings, thresholds: { joinM, t2, techumM, karpefM },
    };
    markStage('resultSerialization');
    result.engineTimings = { ...stageTimings, total: clock() - engineStarted };
    return result;
  }

  return {
    AMOS, makeProjection, runPipeline, bufferRing,
    // exported for tests
    _internals: {
      bboxOfRing, bboxGap, expandRect, rectsOverlap, rectContains, ringDist,
      ringDistToPoint, clusterBuildings, buildClusters, mergeCities, GridIndex,
      pointInRing, segSegDist, annotateCityQualification, concavityWarnings,
      ringsOverlap, ringContainsRing,
      convexHull, minimumAreaRect, deriveSquaring, toOrientedFrame, fromOrientedFrame,
      intersectConvexPolygons, intersectPolygonSets,
    },
  };
});
