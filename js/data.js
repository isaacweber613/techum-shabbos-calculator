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
    // Overture's own class names for a semi-detached house and a dwelling house (spec rev. 18.2).
    'semi', 'dwelling_house',
  ]);
  const NON_DWELLING_TAGS = new Set([
    'garage', 'garages', 'shed', 'roof', 'carport', 'greenhouse', 'barn', 'stable',
    'cowshed', 'sty', 'farm_auxiliary', 'warehouse',
    'retail', 'kiosk', 'supermarket', 'shrine', 'civic', 'public', 'government',
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
    // A house of worship with clergy living quarters counts exactly like a shul with a
    // chazan's dirah (SA OC 398:6), so it needs the same review.
    'church', 'chapel', 'cathedral', 'mosque', 'temple',
    'fire_station',                 // crews sleep there — attended like a guardhouse
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

  // Typed or pasted "lat, lon" (as Google Maps copies them). The place search reads the
  // numbers as street names, so "39.5, -117.0" used to jump to 117 Avenue in Edmonton.
  function parseCoordinates(query) {
    const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(String(query || ''));
    if (!m) return null;
    const lat = Number(m[1]), lon = Number(m[2]);
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) return null;
    return { lat, lon, label: `Coordinates ${lat.toFixed(6)}, ${lon.toFixed(6)}` };
  }

  // ---------- Nominatim geocoding ----------
  async function geocode(query, bias) {
    const coordinates = parseCoordinates(query);
    if (coordinates) return [coordinates];
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
    const coordinates = parseCoordinates(query);
    if (coordinates) return [coordinates];
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
  // Every cache key carries this version. Keep it in step with worker/overture.ts
  // OVERTURE_RELEASE (and bump the suffix when cached areas must refill for another reason,
  // e.g. the shared-correction set). Entries under any other version are deleted on first use.
  // '#2': map data is cached by whole server tile (spec rev. 18.3); the older entries cached one
  // searched box each and are deleted.
  const CACHE_VERSION = '2026-09-23.1#2';
  const CACHE_KEY_PREFIX = `${CACHE_VERSION}|`;
  let pruned = false;
  function pruneOtherVersions(db) {
    if (pruned) return;
    pruned = true;
    try {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      const cursor = store.openKeyCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;
        if (!String(c.key).startsWith(CACHE_KEY_PREFIX)) store.delete(c.key);
        c.continue();
      };
    } catch { /* cache is best-effort */ }
  }
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => { pruneOtherVersions(req.result); resolve(req.result); };
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

  // ---------- Server tiles ----------
  // Mirrors worker/buildings.ts: 0.02° cache tiles, at most 36 tiles (6×6) per request. The
  // search loads whole tiles (spec rev. 18.3): a footprint that touches a loaded tile is loaded.
  const SERVER_TILE_DEG = 0.02;
  const SERVER_SPAN_TILES = 6; // a request may cover 6 × 6 = 36 tiles
  const BLOCK_TILES = 5;
  const parseTile = (key) => {
    const [i, j] = String(key).split('/').map(Number);
    return { i, j };
  };
  const tileIndex = (deg) => Math.floor(deg / SERVER_TILE_DEG + 1e-12);

  // Few requests: the server answers at most 30 a minute from one network, and each costs a round
  // trip. When all the wanted tiles fit in one server request, one box over them; otherwise one
  // box per 0.1° block (5 × 5 tiles) over that block's wanted tiles. A box can also hold tiles
  // already loaded, or not asked for; their answer is cached too.
  function tileRequests(keys) {
    const all = [...new Set(keys)].map(parseTile);
    if (!all.length) return [];
    const boxOf = (tiles) => ({ i0: Math.min(...tiles.map((t) => t.i)), i1: Math.max(...tiles.map((t) => t.i)),
      j0: Math.min(...tiles.map((t) => t.j)), j1: Math.max(...tiles.map((t) => t.j)) });
    const request = (box) => {
      const tiles = [];
      for (let i = box.i0; i <= box.i1; i++) for (let j = box.j0; j <= box.j1; j++) tiles.push(`${i}/${j}`);
      return { bbox: { south: box.i0 * SERVER_TILE_DEG, west: box.j0 * SERVER_TILE_DEG,
        north: (box.i1 + 1) * SERVER_TILE_DEG, east: (box.j1 + 1) * SERVER_TILE_DEG }, tiles };
    };
    const whole = boxOf(all);
    if (whole.i1 - whole.i0 < SERVER_SPAN_TILES && whole.j1 - whole.j0 < SERVER_SPAN_TILES) return [request(whole)];
    const blocks = new Map();
    for (const tile of all) {
      const block = `${Math.floor(tile.i / BLOCK_TILES)}/${Math.floor(tile.j / BLOCK_TILES)}`;
      if (!blocks.has(block)) blocks.set(block, []);
      blocks.get(block).push(tile);
    }
    return [...blocks.values()].map((tiles) => request(boxOf(tiles)));
  }

  function ringBounds(ring) {
    let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
    for (const p of ring) {
      if (p.lat < south) south = p.lat;
      if (p.lat > north) north = p.lat;
      if (p.lon < west) west = p.lon;
      if (p.lon > east) east = p.lon;
    }
    return { south, north, west, east };
  }
  function ringAreaDeg(ring) {
    let area = 0;
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      area += a.lon * b.lat - b.lon * a.lat;
    }
    return Math.abs(area / 2);
  }

  // An answer split into its tiles: as on the server, a footprint belongs to every tile its
  // outline's box touches.
  function splitIntoTiles(buildings, tiles) {
    const out = new Map(tiles.map((key) => [key, []]));
    for (const building of buildings) {
      if (!building || !Array.isArray(building.ringLatLon) || building.ringLatLon.length < 3) continue;
      const box = ringBounds(building.ringLatLon);
      for (let i = tileIndex(box.south); i <= tileIndex(box.north); i++) {
        for (let j = tileIndex(box.west); j <= tileIndex(box.east); j++) {
          const list = out.get(`${i}/${j}`);
          if (list) list.push(building);
        }
      }
    }
    return out;
  }

  // The loaded tiles as one footprint set. A footprint cut differently at a tile edge comes in
  // more than one tile; the largest copy is kept, so the set never depends on the order the tiles
  // arrived in.
  function combineTiles(records) {
    const byId = new Map();
    for (const record of records) {
      for (const building of record.buildings || []) {
        if (!building || !building.id || !Array.isArray(building.ringLatLon)) continue;
        const area = ringAreaDeg(building.ringLatLon), current = byId.get(building.id);
        if (!current || area > current.area) byId.set(building.id, { building, area });
      }
    }
    const oldest = (values) => values.filter(Boolean).reduce((a, b) => (a < b ? a : b), new Date().toISOString());
    const releases = new Set();
    for (const record of records) {
      for (const release of String(record.release || '').split(' + ')) if (release) releases.add(release);
    }
    const allIds = records.every((record) => Array.isArray(record.correctionIds));
    const correctionIds = allIds ? [...new Set(records.flatMap((record) => record.correctionIds))] : null;
    // The server's tiles, whether or not its own store answered (the browser's are local-overture).
    const remote = records.find((record) => record.source && record.source !== 'local-overture');
    return {
      buildings: [...byId.values()].map((entry) => entry.building),
      fetchedAt: oldest(records.map((record) => record.fetchedAt)),
      checkedAt: oldest(records.map((record) => record.checkedAt)),
      fromCache: records.length > 0 && records.every((record) => record.fromCache),
      source: remote ? remote.source || 'server-tiles' : 'local-overture',
      release: releases.size ? [...releases].sort().join(' + ') : null,
      correctionsApplied: correctionIds ? correctionIds.length
        : records.reduce((sum, record) => sum + (record.correctionsApplied || 0), 0),
      correctionIds,
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
    let activeForce = force;
    if (activeForce) params.set('force', '1');
    let res;
    let fillRemaining = Infinity;
    for (let attempt = 0; ; attempt++) {
      res = await fetch('/api/buildings?' + params.toString(), {
        headers: { Accept: 'application/json' },
      });
      // A large cold area is filled over several requests; keep going while it shrinks.
      const remaining = Number(res.headers.get('X-Building-Fill-Remaining'));
      if (res.status === 429 && Number.isFinite(remaining) && remaining > 0 && remaining < fillRemaining) {
        fillRemaining = remaining;
        // A forced refresh fills one invocation-sized group per request. Drop the
        // force flag after the first retry so the next request reuses the group
        // already refilled instead of starting over from that group forever.
        if (activeForce) { activeForce = false; params.delete('force'); }
        attempt = -1;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
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

  function tileCacheKey(key) { return `${CACHE_KEY_PREFIX}tile|${key}`; }

  // Each wanted tile, from the browser cache or the server. Areas are asked for block by block
  // (sequentially, so cold fills do not contend for the Worker's global fill slot). Every tile of
  // an answer is cached on its own, including the tiles of its box that were not asked for: the
  // answer holds them whole. force=true bypasses the browser and R2 caches.
  async function fetchTilesCached(keys, { force = false } = {}) {
    const tiles = new Map();
    const pending = [];
    for (const key of keys) {
      const hit = force ? null : await cacheGet(tileCacheKey(key));
      if (hit) {
        tiles.set(key, { buildings: hit.buildings, fetchedAt: hit.fetchedAt, checkedAt: hit.checkedAt || hit.fetchedAt,
          fromCache: true, source: 'local-overture', release: hit.release || null,
          correctionsApplied: hit.correctionsApplied || 0,
          correctionIds: Array.isArray(hit.correctionIds) ? hit.correctionIds : null });
      } else pending.push(key);
    }
    let requests = 0;
    for (const request of tileRequests(pending)) {
      const remote = await fetchBuildingsFromServer(request.bbox, { force });
      requests++;
      const split = splitIntoTiles(remote.buildings, request.tiles);
      for (const key of request.tiles) {
        const record = { buildings: split.get(key), fetchedAt: remote.fetchedAt, checkedAt: remote.checkedAt,
          release: remote.release, correctionsApplied: remote.correctionsApplied, correctionIds: remote.correctionIds };
        await cachePut(tileCacheKey(key), record);
        // fromCache as the server said: its own tile store answered, so the data is as old as
        // fetchedAt and the status line says so rather than calling it fresh.
        tiles.set(key, { ...record, fromCache: remote.fromCache, source: remote.source });
      }
    }
<<<<<<< ours

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
  async function fetchBuildingsCached(bbox, { force = false, onProgress = null } = {}) {
    const parts = [];
    const blocks = splitServerBBox(bbox);
    for (const part of blocks) {
      if (onProgress) onProgress(parts.length, blocks.length);
      parts.push(await fetchPartCached(part, force));
    }
    return mergeServerResponses(parts);
=======
    return { tiles, requests };
>>>>>>> theirs
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
<<<<<<< ours
  root.TechumData = { classify, computeDataConfidence, geocode, reverseGeocode, autocomplete, parseCoordinates, fetchBuildingsCached,
    submitBuildingCorrection,
    _internals: { bboxKey, cacheKey, CACHE_VERSION, photonLabel, dedupeAutocompleteResults, splitServerBBox,
      mergeServerResponses, retryDelayMs } };
=======
  root.TechumData = { classify, computeDataConfidence, geocode, reverseGeocode, autocomplete, fetchTilesCached,
    combineTiles, submitBuildingCorrection,
    _internals: { tileCacheKey, CACHE_VERSION, photonLabel, dedupeAutocompleteResults, tileRequests,
      splitIntoTiles, combineTiles, retryDelayMs } };
>>>>>>> theirs
})(typeof self !== 'undefined' ? self : this);
