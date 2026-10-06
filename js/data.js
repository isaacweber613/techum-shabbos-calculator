/*
 * Data layer: geocoding (Nominatim), Overture building footprints,
 * and the dwelling classification table (spec Part 1.3 — beis dirah).
 * Classic script: exposes window.TechumData.
 */
(function (root) {
  'use strict';

  // ---------- Dwelling classification (auditable table) ----------
  // Halachic basis: beis dirah = roofed, >=4x4 amos, inhabited/attended (SA HaRav 398:8-14).
  // Map data (Overture building class/subtype, carried as tags.building) can't tell us
  // "attended", so:
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

  // Overture footprints with no `class` carry only a broad `subtype`. Read it through the
  // same tables as the equivalent class so, e.g., an unlabeled outbuilding is treated like
  // a shed/garage rather than an unknown structure. Subtypes that can hold a dwelling
  // (agricultural includes farmhouses; military includes barracks) go to review or stay
  // unknown — never to non.
  const OVERTURE_SUBTYPE_TAGS = {
    residential: 'residential',
    outbuilding: 'shed',
    civic: 'civic',
    service: 'service',
    transportation: 'transportation',
    agricultural: 'farm_unclassified',
    industrial: 'industrial',
    commercial: 'commercial',
    religious: 'religious',
    education: 'school',
    medical: 'hospital',
  };
  const SUBTYPE_REVIEW_TAGS = new Set(['farm_unclassified']);

  function classify(tags) {
    let b = (tags && tags.building) || 'yes';
    const subtype = tags && tags.overture_subtype;
    if (b === 'yes' && typeof subtype === 'string' &&
        Object.prototype.hasOwnProperty.call(OVERTURE_SUBTYPE_TAGS, subtype)) {
      const mapped = OVERTURE_SUBTYPE_TAGS[subtype];
      if (SUBTYPE_REVIEW_TAGS.has(mapped)) {
        return { klass: 'review', reason: 'Overture subtype=' + subtype + ' (may be a farmhouse — ask a rav)' };
      }
      const cls = classify(Object.assign({}, tags, { building: mapped, overture_subtype: undefined }));
      return { klass: cls.klass, reason: 'Overture subtype=' + subtype + ' → ' + cls.reason };
    }
    if (DWELLING_TAGS.has(b)) return { klass: 'dwelling', reason: 'building=' + b };
    if (NON_DWELLING_TAGS.has(b)) return { klass: 'non', reason: 'building=' + b };
    if (REVIEW_TAGS.has(b)) return { klass: 'review', reason: 'building=' + b + ' (halachically ambiguous — ask a rav)' };
    if (tags && tags.abandoned === 'yes') return { klass: 'review', reason: 'abandoned' };
    if (tags && (tags.amenity === 'place_of_worship'))
      return { klass: 'review', reason: 'place of worship — counts only with attendant dirah' };
    return { klass: 'unknown', reason: 'building=' + b + ' (structure use is not identified)' };
  }

  // Describes how much of the fetched footprint set can be classified from its use tags.
  // This is deliberately NOT called map completeness: no map source can reveal buildings
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
        'Measures classification of fetched Overture footprints, not whether every real building is mapped.',
        'Map use tags do not establish halachic beis-dirah status; ambiguous and untagged footprints require review.',
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

  // ---------- Server request sizing ----------
  // Mirrors worker/buildings.ts: 0.02° cache tiles, at most 36 tiles (6×6) per request.
  // A large city's auto-expansion can need a wider area than one request may cover, so the
  // area is split along an absolute 5×5-tile grid (0.1° blocks). Interior blocks keep the
  // same key between expansion passes, so the browser cache reuses them.
  const SERVER_TILE_DEG = 0.02;
  const SERVER_MAX_TILES = 36;
  const SERVER_MAX_SPAN_DEG = SERVER_TILE_DEG * Math.sqrt(SERVER_MAX_TILES);
  const BLOCK_TILES = 5;
  const tileIndex = (deg) => Math.floor(deg / SERVER_TILE_DEG + 1e-12);

  function splitServerBBox(bbox) {
    const i0 = tileIndex(bbox.south), i1 = tileIndex(bbox.north - 1e-12);
    const j0 = tileIndex(bbox.west), j1 = tileIndex(bbox.east - 1e-12);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) <= SERVER_MAX_TILES &&
        bbox.north - bbox.south <= SERVER_MAX_SPAN_DEG && bbox.east - bbox.west <= SERVER_MAX_SPAN_DEG) {
      return [bbox];
    }
    const blockDeg = BLOCK_TILES * SERVER_TILE_DEG;
    const parts = [];
    for (let bi = Math.floor(i0 / BLOCK_TILES); bi <= Math.floor(i1 / BLOCK_TILES); bi++) {
      const south = Math.max(bbox.south, bi * blockDeg), north = Math.min(bbox.north, (bi + 1) * blockDeg);
      if (!(north > south)) continue;
      for (let bj = Math.floor(j0 / BLOCK_TILES); bj <= Math.floor(j1 / BLOCK_TILES); bj++) {
        const west = Math.max(bbox.west, bj * blockDeg), east = Math.min(bbox.east, (bj + 1) * blockDeg);
        if (east > west) parts.push({ south, west, north, east });
      }
    }
    return parts;
  }

  function mergeServerResponses(parts) {
    if (parts.length === 1) return parts[0];
    const byId = new Map();
    for (const part of parts) for (const b of part.buildings) if (b && b.id && !byId.has(b.id)) byId.set(b.id, b);
    const oldest = (values) => values.filter(Boolean).reduce((a, b) => (a < b ? a : b), new Date().toISOString());
    const releases = new Set();
    for (const part of parts) {
      for (const release of String(part.release || '').split(' + ')) if (release) releases.add(release);
    }
    const allIds = parts.every((part) => Array.isArray(part.correctionIds));
    const correctionIds = allIds ? [...new Set(parts.flatMap((part) => part.correctionIds))] : null;
    const remote = parts.find((part) => part.source !== 'local-overture');
    return {
      buildings: [...byId.values()],
      fetchedAt: oldest(parts.map((part) => part.fetchedAt)),
      checkedAt: oldest(parts.map((part) => part.checkedAt)),
      fromCache: parts.every((part) => part.fromCache),
      source: remote ? remote.source : 'local-overture',
      release: releases.size ? [...releases].sort().join(' + ') : null,
      correctionsApplied: correctionIds ? correctionIds.length
        : parts.reduce((sum, part) => sum + (part.correctionsApplied || 0), 0),
      correctionIds,
      requests: parts.length,
    };
  }

  // Brief server contention (the Worker's one-fill-per-second slot) is retried; a
  // longer rate-limit window is surfaced to the user instead of hanging the calculation.
  function retryDelayMs(status, retryAfter, attempt) {
    if (status !== 429 || attempt >= 3) return null;
    const seconds = Number(retryAfter);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 5) return null;
    return Math.max(250, seconds * 1000) * (attempt + 1);
  }

  // Production path: Worker unions fixed-degree R2 tiles (shared multi-user cache).
  async function fetchBuildingsFromServer(bbox, { force = false } = {}) {
    const params = new URLSearchParams({
      south: String(bbox.south), west: String(bbox.west),
      north: String(bbox.north), east: String(bbox.east),
    });
    if (force) params.set('force', '1');
    let res;
    for (let attempt = 0; ; attempt++) {
      res = await fetch('/api/buildings?' + params.toString(), {
        headers: { Accept: 'application/json' },
      });
      const delay = res.ok ? null : retryDelayMs(res.status, res.headers.get('Retry-After'), attempt);
      if (delay === null) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
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
      correctionIds: Array.isArray(data.correctionIds) ? data.correctionIds : null,
      tiles: data.tiles || null,
    };
  }

  async function fetchPartCached(bbox, force) {
    const key = bboxKey(bbox);
    if (!force) {
      const hit = await cacheGet(key);
      if (hit) {
        return { buildings: hit.buildings, fetchedAt: hit.fetchedAt,
                 checkedAt: hit.checkedAt || hit.fetchedAt, fromCache: true,
                 source: 'local-overture', release: hit.release || null,
                 correctionsApplied: hit.correctionsApplied || 0,
                 correctionIds: Array.isArray(hit.correctionIds) ? hit.correctionIds : null };
      }
    }

    const remote = await fetchBuildingsFromServer(bbox, { force });
    await cachePut(key, {
      buildings: remote.buildings,
      fetchedAt: remote.fetchedAt,
      checkedAt: remote.checkedAt,
      release: remote.release,
      correctionsApplied: remote.correctionsApplied,
      correctionIds: remote.correctionIds,
    });
    return remote;
  }

  // Returns the fused Overture footprint set. force=true bypasses browser and R2 caches.
  // Areas wider than one Worker request are fetched block by block (sequentially, so cold
  // fills do not contend for the Worker's global fill slot) and merged by footprint id.
  async function fetchBuildingsCached(bbox, { force = false } = {}) {
    const parts = [];
    for (const part of splitServerBBox(bbox)) parts.push(await fetchPartCached(part, force));
    return mergeServerResponses(parts);
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
  root.TechumData = { classify, computeDataConfidence, geocode, reverseGeocode, autocomplete, fetchBuildingsCached,
    submitBuildingCorrection,
    _tables: { DWELLING_TAGS, NON_DWELLING_TAGS, REVIEW_TAGS },
    _internals: { bboxKey, photonLabel, dedupeAutocompleteResults, splitServerBBox,
      mergeServerResponses, retryDelayMs } };
})(typeof self !== 'undefined' ? self : this);
