/*
 * Data layer: geocoding (Nominatim), Overture building footprints,
 * and the dwelling classification table (spec Part 1.3 — beis dirah).
 * Classic script: exposes window.TechumData.
 */
(function (root) {
  'use strict';

  // ---------- Dwelling classification (auditable table) ----------
  // Halachic basis: beis dirah = roofed, >=4x4 amos, inhabited/attended (SA HaRav 398:8-14).
  // OSM can't tell us "attended", so:
  //   dwelling  = clearly residential tags
  //   non       = clearly not a dwelling (unroofed / storage / no one lives there)
  //   review    = halachically ambiguous categories (hotel, hospital, shul, school, ruins,
  //               guardhouse) — open question Q5 in the spec; included/excluded per the
  //               unknown-buildings setting and ALWAYS flagged in the UI.
  //   unknown   = building=yes / untagged — a data gap, not a psak; per setting, flagged.
  const DWELLING_TAGS = new Set([
    'house', 'residential', 'apartments', 'detached', 'semidetached_house',
    'semi_detached', 'terrace', 'terraced_house', 'bungalow', 'dormitory',
    'cabin', 'farm', 'houseboat', 'static_caravan', 'ger', 'stilt_house',
  ]);
  const NON_DWELLING_TAGS = new Set([
    'garage', 'garages', 'shed', 'roof', 'carport', 'greenhouse', 'barn', 'stable',
    'cowshed', 'sty', 'farm_auxiliary', 'warehouse',
    'retail', 'kiosk', 'supermarket', 'church', 'chapel', 'cathedral',
    'mosque', 'temple', 'shrine', 'civic', 'public', 'government', 'fire_station',
    'train_station', 'transportation', 'parking', 'service', 'transformer_tower',
    'water_tower', 'storage_tank', 'silo', 'bunker', 'construction', 'grandstand',
    'stadium', 'sports_hall', 'sports_centre', 'pavilion', 'toilets', 'hangar',
    'digester', 'slurry_tank', 'container', 'tent', 'gazebo', 'bridge',
  ]);
  const REVIEW_TAGS = new Set([
    'synagogue',   // extends the city ONLY with an attendant's dirah (SA HaRav 398:8)
    'school', 'kindergarten', 'college', 'university',
    'hotel', 'hospital',            // people sleep there — spec open question Q5
    'office', 'industrial', 'commercial', 'factory', // some poskim count offices/lunch facilities
    'ruins',                        // counts if walls+roof remain habitable
    'guardhouse',                   // burgan/watchman hut — counts if attended
    'religious', 'monastery',
  ]);

  function classify(tags) {
    const b = (tags && tags.building) || 'yes';
    if (DWELLING_TAGS.has(b)) return { klass: 'dwelling', reason: 'building=' + b };
    if (NON_DWELLING_TAGS.has(b)) return { klass: 'non', reason: 'building=' + b };
    if (REVIEW_TAGS.has(b)) return { klass: 'review', reason: 'building=' + b + ' (halachically ambiguous — ask a rav)' };
    if (tags && tags.abandoned === 'yes') return { klass: 'review', reason: 'abandoned' };
    if (tags && (tags.amenity === 'place_of_worship'))
      return { klass: 'review', reason: 'place of worship — counts only with attendant dirah' };
    return { klass: 'unknown', reason: 'building=' + b + ' (structure use is not identified)' };
  }

  // Describes how much of the fetched footprint set can be classified from OSM tags.
  // This is deliberately NOT called map completeness: Overpass cannot reveal buildings
  // that have never been mapped. Consumers must retain the caveat in `limitations`.
  function computeDataConfidence(buildings) {
    const counts = { dwelling: 0, non: 0, review: 0, unknown: 0, invalidGeometry: 0 };
    const list = Array.isArray(buildings) ? buildings : [];
    for (const building of list) {
      const klass = building && building.klass
        ? building.klass
        : classify(building && building.tags).klass;
      if (Object.prototype.hasOwnProperty.call(counts, klass)) counts[klass]++;
      else counts.unknown++;
      const ring = building && (building.ringLatLon || building.ring);
      if (!Array.isArray(ring) || ring.length < 3) counts.invalidGeometry++;
    }
    const total = list.length;
    const tagged = counts.dwelling + counts.non + counts.review;
    const decided = counts.dwelling + counts.non;
    const taggedRate = total ? tagged / total : 0;
    const decidedRate = total ? decided / total : 0;
    const needsReview = counts.review + counts.unknown + counts.invalidGeometry;
    // Grade only tag auditability, never geographic completeness.
    const grade = total === 0 ? 'none'
      : counts.invalidGeometry > 0 || decidedRate < 0.5 ? 'low'
      : decidedRate < 0.8 || counts.review > 0 ? 'medium' : 'high';
    return {
      total, counts, taggedRate, decidedRate, needsReview, grade,
      limitations: [
        'Measures classification of fetched OSM footprints, not whether every real building is mapped.',
        'OSM tags do not establish halachic beis-dirah status; ambiguous and untagged footprints require review.',
      ],
    };
  }

  // ---------- Nominatim geocoding ----------
  async function geocode(query, bias) {
    // Production goes through the Worker so requests are identified, globally throttled,
    // and cached as required by the public Nominatim usage policy. The direct URL remains
    // only for local development through serve.mjs.
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const params = new URLSearchParams({ format: 'jsonv2', limit: '5', q: query });
    if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lon)) {
      const lat = Math.round(bias.lat * 100) / 100;
      const lon = Math.round(bias.lon * 100) / 100;
      params.set('lat', String(lat));
      params.set('lon', String(lon));
      if (local) {
        params.delete('lat');
        params.delete('lon');
        params.set('viewbox', `${lon - 0.5},${lat + 0.5},${lon + 0.5},${lat - 0.5}`);
      }
    }
    const url = local
      ? 'https://nominatim.openstreetmap.org/search?' + params.toString()
      : '/api/geocode?' + params.toString();
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Geocoding failed: HTTP ' + res.status);
    const arr = await res.json();
    return arr.map((r) => ({
      lat: parseFloat(r.lat), lon: parseFloat(r.lon), label: r.display_name,
    }));
  }

  async function reverseGeocode(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Valid coordinates are required');
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const params = new URLSearchParams({
      format: 'jsonv2', zoom: '18', addressdetails: '1', lat: String(lat), lon: String(lon),
    });
    const url = local
      ? 'https://nominatim.openstreetmap.org/reverse?' + params.toString()
      : '/api/reverse-geocode?' + params.toString();
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Reverse geocoding failed: HTTP ' + res.status);
    const result = await res.json();
    if (!result || !result.display_name) throw new Error('No address found for this location');
    return { lat: parseFloat(result.lat), lon: parseFloat(result.lon), label: result.display_name };
  }

  function photonLabel(properties) {
    const p = properties || {};
    const parts = [];
    const first = p.housenumber && p.street
      ? `${p.housenumber} ${p.street}`
      : p.name || p.street;
    for (const value of [first, p.locality, p.district, p.city, p.county, p.state, p.postcode, p.country]) {
      if (!value) continue;
      const text = String(value).trim();
      if (text && !parts.some((part) => part.toLowerCase() === text.toLowerCase())) parts.push(text);
    }
    return parts.join(', ');
  }

  function dedupeAutocompleteResults(results, limit = 5) {
    const seen = new Set();
    const unique = [];
    for (const result of results || []) {
      if (!result || !Number.isFinite(result.lat) || !Number.isFinite(result.lon) || !result.label) continue;
      const key = String(result.label).trim().replace(/\s+/g, ' ').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(result);
      if (unique.length >= limit) break;
    }
    return unique;
  }

  async function autocomplete(query, bias) {
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    // Ask for a few extras because Photon can return the same display label for
    // multiple feature types. The UI still receives at most five unique choices.
    const params = new URLSearchParams({ q: query, limit: '8' });
    if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lon)) {
      params.set('lat', String(Math.round(bias.lat * 100) / 100));
      params.set('lon', String(Math.round(bias.lon * 100) / 100));
    }
    const url = local
      ? 'https://photon.komoot.io/api/?' + params.toString()
      : '/api/autocomplete?' + params.toString();
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Autocomplete failed: HTTP ' + res.status);
    const data = await res.json();
    return dedupeAutocompleteResults((data.features || []).map((feature) => ({
      lat: Number(feature.geometry.coordinates[1]),
      lon: Number(feature.geometry.coordinates[0]),
      label: photonLabel(feature.properties),
    })), 5);
  }

  // ---------- Overpass buildings fetch ----------
  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  // bbox: {south, west, north, east} in degrees.
  async function fetchBuildings(bbox, timeoutSec) {
    const clientTimeoutSec = Math.min(timeoutSec || 45, 90);
    const bb = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
    const query = `[out:json][timeout:${timeoutSec || 90}];
(
  way["building"](${bb});
  relation["building"]["type"="multipolygon"](${bb});
);
out geom;`;
    let lastErr;
    for (const ep of OVERPASS_ENDPOINTS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), clientTimeoutSec * 1000);
      try {
        const res = await fetch(ep, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Overpass HTTP ' + res.status);
        const json = await res.json();
        return parseOverpass(json);
      } catch (e) {
        lastErr = e && e.name === 'AbortError'
          ? new Error(`Map-data server timed out after ${clientTimeoutSec}s`) : e;
      } finally { clearTimeout(timer); }
    }
    throw lastErr;
  }

  function parseOverpass(json) {
    const buildings = [];
    for (const el of json.elements || []) {
      const tags = el.tags || {};
      if (el.type === 'way' && el.geometry && el.geometry.length >= 3) {
        buildings.push({
          id: 'w' + el.id, tags,
          ringLatLon: el.geometry.map((g) => ({ lat: g.lat, lon: g.lon })),
        });
      } else if (el.type === 'relation' && el.members) {
        // Multipolygon: each outer member becomes its own pseudo-building carrying the
        // relation's tags. Touching members re-join in clustering; the slight house-count
        // inflation can affect the provisional six-footprint city proxy and is flagged in the spec.
        let part = 0;
        for (const m of el.members) {
          if (m.role !== 'outer' || !m.geometry || m.geometry.length < 3) continue;
          buildings.push({
            id: 'r' + el.id + '_' + part++, tags,
            ringLatLon: m.geometry.map((g) => ({ lat: g.lat, lon: g.lon })),
          });
        }
      }
    }
    return buildings;
  }

  // ---------- Optional Overture comparison input ----------
  // OSM remains the calculator's authoritative input. Overture's official distribution
  // is bulk GeoParquet rather than a browser-ready bbox API, so this parser accepts an
  // explicitly downloaded GeoJSON extract for an auditable second-source comparison.
  // Overture properties are deliberately NOT translated into dwelling status: a second
  // map source cannot resolve the halachic beis-dirah question.
  function parseOvertureGeoJSON(geojson) {
    const features = geojson && geojson.type === 'FeatureCollection'
      ? geojson.features : geojson && geojson.type === 'Feature' ? [geojson] : [];
    const buildings = [];
    for (const feature of features || []) {
      const geometry = feature && feature.geometry;
      if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) continue;
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
      let part = 0;
      for (const polygon of polygons || []) {
        const outer = polygon && polygon[0];
        if (!Array.isArray(outer) || outer.length < 4) continue;
        const ringLatLon = outer.map((point) => ({ lat: Number(point[1]), lon: Number(point[0]) }))
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
        if (ringLatLon.length < 4) continue;
        const rawId = feature.id || (feature.properties && feature.properties.id) || `anonymous-${buildings.length}`;
        buildings.push({
          id: `ovt:${rawId}${polygons.length > 1 ? ':' + part : ''}`,
          source: 'overture',
          sourceId: String(rawId),
          sourceProperties: feature.properties || {},
          tags: {},
          klass: 'unknown',
          classificationReason: 'Overture comparison footprint; dwelling status not inferred',
          ringLatLon,
        });
        part++;
      }
    }
    return buildings;
  }

  function ringBBox(ring) {
    const box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
    for (const point of ring || []) {
      box.west = Math.min(box.west, point.lon); box.east = Math.max(box.east, point.lon);
      box.south = Math.min(box.south, point.lat); box.north = Math.max(box.north, point.lat);
    }
    return box;
  }

  function boxesIntersect(a, b) {
    return a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south;
  }

  function orient(a, b, c) {
    return (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon);
  }

  function segmentsIntersect(a, b, c, d) {
    const e = 1e-12;
    const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
    const onSegment = (p, q, r) => Math.abs(orient(p, q, r)) <= e &&
      r.lon >= Math.min(p.lon, q.lon) - e && r.lon <= Math.max(p.lon, q.lon) + e &&
      r.lat >= Math.min(p.lat, q.lat) - e && r.lat <= Math.max(p.lat, q.lat) + e;
    if (onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) return true;
    return ((o1 > e && o2 < -e) || (o1 < -e && o2 > e)) &&
      ((o3 > e && o4 < -e) || (o3 < -e && o4 > e));
  }

  function pointInRing(point, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if (((a.lat > point.lat) !== (b.lat > point.lat)) &&
          point.lon < (b.lon - a.lon) * (point.lat - a.lat) / (b.lat - a.lat) + a.lon) inside = !inside;
    }
    return inside;
  }

  function ringsIntersect(a, b) {
    if (!a.length || !b.length || !boxesIntersect(ringBBox(a), ringBBox(b))) return false;
    if (pointInRing(a[0], b) || pointInRing(b[0], a)) return true;
    for (let i = 0; i < a.length; i++) {
      const a2 = a[(i + 1) % a.length];
      for (let j = 0; j < b.length; j++) {
        if (segmentsIntersect(a[i], a2, b[j], b[(j + 1) % b.length])) return true;
      }
    }
    return false;
  }

  // Returns review candidates, never buildings to silently add to the halachic engine.
  // "Unmatched" means polygon non-intersection, not proof that OSM is missing a building:
  // datasets can differ in capture date, geometry, subdivision, and demolition status.
  function compareBuildingSources(osmBuildings, overtureBuildings) {
    const osm = (osmBuildings || []).filter((b) => Array.isArray(b.ringLatLon) && b.ringLatLon.length >= 3);
    const overture = (overtureBuildings || []).filter((b) => Array.isArray(b.ringLatLon) && b.ringLatLon.length >= 3);
    const osmBoxes = osm.map((building) => ringBBox(building.ringLatLon));
    const unmatchedOverture = [];
    let matchedOverture = 0;
    for (const candidate of overture) {
      const candidateBox = ringBBox(candidate.ringLatLon);
      let match = false;
      for (let i = 0; i < osm.length; i++) {
        if (boxesIntersect(candidateBox, osmBoxes[i]) && ringsIntersect(candidate.ringLatLon, osm[i].ringLatLon)) {
          match = true; break;
        }
      }
      if (match) matchedOverture++;
      else unmatchedOverture.push(candidate);
    }
    return {
      source: 'Overture Maps comparison extract',
      osmCount: osm.length,
      overtureCount: overture.length,
      matchedOverture,
      unmatchedOverture,
      limitations: [
        'An unmatched footprint is a review candidate, not proof that OSM is missing a current building.',
        'Differences can result from capture dates, geometry, building subdivision, construction, or demolition.',
        'No Overture footprint is included in the halachic calculation until a reviewer confirms it.',
      ],
    };
  }

  // ---------- Local cache of Overture responses (IndexedDB) ----------
  // The fetch is the slow, settings-INDEPENDENT part — the same buildings serve every
  // shita, so we cache raw data per area and always recompute boundaries (cheap, pure).
  // Cached entries carry fetchedAt so results are attributable to a data date.
  //
  // Layers (production):
  //   L1 IndexedDB — same browser, exact bbox (instant shita-switch / re-calc)
  //   L2 Worker R2 tiles — shared across users for the same ~2 km grid cells
  //   L3 Overture public PMTiles — cold fill via the Worker
  const DB_NAME = 'techum-cache-v2', STORE = 'overture';
  function isLocalHost() {
    try {
      return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    } catch { return true; }
  }
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function cacheGet(key) {
    try {
      const db = await openDB();
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        tx.onsuccess = () => resolve(tx.result || null);
        tx.onerror = () => resolve(null);
      });
    } catch { return null; }
  }
  async function cachePut(key, value) {
    try {
      const db = await openDB();
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
        tx.onsuccess = resolve;
        tx.onerror = resolve;
      });
    } catch { /* cache is best-effort */ }
  }
  function bboxKey(bbox) {
    const r = (x) => x.toFixed(5);
    return `${r(bbox.south)},${r(bbox.west)},${r(bbox.north)},${r(bbox.east)}`;
  }

  // Production path: Worker unions fixed-degree R2 tiles (shared multi-user cache).
  async function fetchBuildingsFromServer(bbox, { force = false } = {}) {
    const params = new URLSearchParams({
      south: String(bbox.south), west: String(bbox.west),
      north: String(bbox.north), east: String(bbox.east),
    });
    if (force) params.set('force', '1');
    const res = await fetch('/api/buildings?' + params.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      let detail = 'HTTP ' + res.status;
      try {
        const err = await res.json();
        if (err && err.error) detail = err.error;
      } catch { /* ignore */ }
      throw new Error(detail);
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.buildings)) throw new Error('invalid buildings response');
    return {
      buildings: data.buildings,
      fetchedAt: data.fetchedAt || new Date().toISOString(),
      checkedAt: data.checkedAt || data.fetchedAt || new Date().toISOString(),
      fromCache: !!data.fromCache,
      source: data.source || 'server-tiles',
      release: data.release || null,
      correctionsApplied: data.correctionsApplied || 0,
      tiles: data.tiles || null,
    };
  }

  // Returns the fused Overture footprint set. force=true bypasses browser and R2 caches.
  async function fetchBuildingsCached(bbox, { force = false } = {}) {
    const key = bboxKey(bbox);
    if (!force) {
      const hit = await cacheGet(key);
      if (hit) {
        return { buildings: hit.buildings, fetchedAt: hit.fetchedAt,
                 checkedAt: hit.checkedAt || hit.fetchedAt, fromCache: true,
                 source: 'local-overture', release: hit.release || null,
                 correctionsApplied: hit.correctionsApplied || 0 };
      }
    }

    const remote = await fetchBuildingsFromServer(bbox, { force });
    await cachePut(key, {
      buildings: remote.buildings,
      fetchedAt: remote.fetchedAt,
      checkedAt: remote.checkedAt,
      release: remote.release,
      correctionsApplied: remote.correctionsApplied,
    });
    return remote;
  }

  async function submitBuildingCorrection(correction) {
    const response = await fetch('/api/building-corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(correction),
    });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try { const data = await response.json(); if (data && data.error) detail = data.error; } catch { /* ignore */ }
      throw new Error(detail);
    }
    return response.json();
  }
  // After a clean change-check ("no edits since fetchedAt"), reset the verification clock.
  async function markCheckedCurrent(bbox) {
    const key = bboxKey(bbox);
    const hit = await cacheGet(key);
    if (hit) { hit.checkedAt = new Date().toISOString(); await cachePut(key, hit); }
    return hit && hit.checkedAt;
  }

  // ---------- Change detection: buildings edited since a given date ----------
  // Overpass `newer:` filter — counts building ways/relations edited/created in the bbox
  // since `sinceISO`. CAVEAT: deletions don't appear in `newer:` results (a deleted way
  // is gone) — occasional full "Fresh data" refetches remain the backstop for deletions.
  async function countChangedBuildings(bbox, sinceISO) {
    const bb = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
    const query = `[out:json][timeout:30];
(
  way["building"](newer:"${sinceISO}")(${bb});
  relation["building"]["type"="multipolygon"](newer:"${sinceISO}")(${bb});
);
out count;`;
    let lastErr;
    for (const ep of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        if (!res.ok) throw new Error('Overpass HTTP ' + res.status);
        const json = await res.json();
        const c = (json.elements || []).find((el) => el.type === 'count');
        return c ? parseInt(c.tags.total, 10) : 0;
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  root.TechumData = { classify, computeDataConfidence, geocode, reverseGeocode, autocomplete, fetchBuildings, fetchBuildingsCached,
    fetchBuildingsFromServer, submitBuildingCorrection, countChangedBuildings, markCheckedCurrent,
    _tables: { DWELLING_TAGS, NON_DWELLING_TAGS, REVIEW_TAGS },
    parseOvertureGeoJSON, compareBuildingSources,
    _internals: { parseOverpass, parseOvertureGeoJSON, compareBuildingSources,
      ringsIntersect, bboxKey, photonLabel, dedupeAutocompleteResults, isLocalHost } };
})(typeof self !== 'undefined' ? self : this);
