/*
 * Data layer: geocoding (Nominatim), building footprints (OSM Overpass),
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
    'cowshed', 'sty', 'farm_auxiliary', 'warehouse', 'industrial', 'commercial',
    'retail', 'office', 'kiosk', 'supermarket', 'church', 'chapel', 'cathedral',
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
    return { klass: 'unknown', reason: 'building=' + b + ' (use untagged in OSM)' };
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

  async function autocomplete(query, bias) {
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const params = new URLSearchParams({ q: query, limit: '5' });
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
    return (data.features || []).map((feature) => ({
      lat: Number(feature.geometry.coordinates[1]),
      lon: Number(feature.geometry.coordinates[0]),
      label: photonLabel(feature.properties),
    })).filter((result) => Number.isFinite(result.lat) && Number.isFinite(result.lon) && result.label);
  }

  // ---------- Overpass buildings fetch ----------
  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  // bbox: {south, west, north, east} in degrees.
  async function fetchBuildings(bbox, timeoutSec) {
    const bb = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
    const query = `[out:json][timeout:${timeoutSec || 90}];
(
  way["building"](${bb});
  relation["building"]["type"="multipolygon"](${bb});
);
out geom;`;
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
        return parseOverpass(json);
      } catch (e) { lastErr = e; }
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
        // inflation only affects the 6-house city minimum and is flagged in the spec.
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

  // ---------- Local cache of Overpass responses (IndexedDB) ----------
  // The fetch is the slow, settings-INDEPENDENT part — the same buildings serve every
  // shita, so we cache raw data per area and always recompute boundaries (cheap, pure).
  // Cached entries carry fetchedAt so results are attributable to a data date.
  const DB_NAME = 'techum-cache', STORE = 'overpass';
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
  // Returns {buildings, fetchedAt, checkedAt, fromCache}. force=true bypasses the cache.
  // No TTL — cache entries live until an automatic change-check invalidates them:
  // `checkedAt` records the last time the entry was verified to still match OSM.
  async function fetchBuildingsCached(bbox, { force = false } = {}) {
    const key = bboxKey(bbox);
    if (!force) {
      const hit = await cacheGet(key);
      if (hit) {
        return { buildings: hit.buildings, fetchedAt: hit.fetchedAt,
                 checkedAt: hit.checkedAt || hit.fetchedAt, fromCache: true };
      }
    }
    const buildings = await fetchBuildings(bbox);
    const fetchedAt = new Date().toISOString();
    await cachePut(key, { buildings, fetchedAt, checkedAt: fetchedAt });
    return { buildings, fetchedAt, checkedAt: fetchedAt, fromCache: false };
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

  root.TechumData = { classify, geocode, autocomplete, fetchBuildings, fetchBuildingsCached,
    countChangedBuildings, markCheckedCurrent,
    _tables: { DWELLING_TAGS, NON_DWELLING_TAGS, REVIEW_TAGS },
    _internals: { parseOverpass, bboxKey, photonLabel } };
})(typeof self !== 'undefined' ? self : this);
