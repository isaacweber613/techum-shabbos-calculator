/*
 * Techum Calculator — app orchestration + Leaflet rendering.
 * Flow: geocode/pin -> fetch OSM buildings (auto-expanding) -> classify ->
 * project -> TechumGeo.runPipeline -> render layers -> exports.
 */
(function () {
  'use strict';
  const G = window.TechumGeo, D = window.TechumData, S = window.TechumSettings, K = window.TechumKML;
  const ENGINE_VERSION = '1.1.0 (2026-07-10)';

  let settings = S.load();
  let map, pinMarker;
  let state = {
    pin: null,            // {lat, lon}
    proj: null,
    rawBuildings: [],     // from Overpass: {id, tags, ringLatLon}
    buildings: [],        // projected + classified: {id, tags, ring, bbox, klass, included, override}
    overrides: new Map(), // id -> 'include' | 'exclude'
    result: null,
    fetchBBox: null,      // {south, west, north, east}
    dataCapHit: false,
  };
  const layerGroups = {
    buildings: null, rects: null, second: null, audit: null,
  };
  const auditCache = new Map(); // building id + join dist -> buffer loops (pure geometry)
  function track(type, data) { if (window.TechumTrack) window.TechumTrack.send(type, data); }

  // ---------------- map ----------------
  function initMap() {
    map = L.map('map', { zoomControl: true }).setView([41.1, -74.05], 13);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20, maxNativeZoom: 19,
      attribution: 'Imagery © Esri | Map data © OpenStreetMap contributors',
    }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      maxZoom: 20, opacity: 0.9, attribution: '© CARTO',
    }).addTo(map);
    layerGroups.buildings = L.layerGroup().addTo(map);
    layerGroups.rects = L.layerGroup().addTo(map);
    layerGroups.second = L.layerGroup().addTo(map);
    layerGroups.audit = L.layerGroup().addTo(map);
    map.on('click', (e) => { if (!pinMarker) setPin(e.latlng.lat, e.latlng.lng); });
    // audit rings are viewport-limited — refresh them as the reviewer pans/zooms
    map.on('moveend', () => { if (settings.showAuditRings && state.result) renderAuditRings(); });
  }

  function setPin(lat, lon) {
    state.pin = { lat, lon };
    if (!pinMarker) {
      pinMarker = L.marker([lat, lon], { draggable: true }).addTo(map);
      pinMarker.bindTooltip('Shevisa point — drag to adjust', { direction: 'top' });
      pinMarker.on('dragend', () => {
        const p = pinMarker.getLatLng();
        state.pin = { lat: p.lat, lon: p.lng };
        if (state.rawBuildings.length) recompute();
      });
    } else pinMarker.setLatLng([lat, lon]);
    document.getElementById('btn-calc').disabled = false;
  }

  // ---------------- geocode ----------------
  let suggestionTimer = null;
  let suggestionRequest = 0;
  let suggestions = [];
  let activeSuggestion = -1;

  function closeSuggestions() {
    suggestions = [];
    activeSuggestion = -1;
    const list = document.getElementById('address-suggestions');
    list.hidden = true;
    list.replaceChildren();
    document.getElementById('address').setAttribute('aria-expanded', 'false');
  }

  function applyGeocodeResult(r, query) {
    document.getElementById('address').value = r.label;
    state.lastQuery = query || r.label;
    state.lastLabel = r.label;
    setPin(r.lat, r.lon);
    map.setView([r.lat, r.lon], 16);
    closeSuggestions();
    setStatus('Pin set: ' + r.label + ' — confirm the pin is on the right building (drag it if not), then Calculate.');
  }

  function renderSuggestions(results) {
    suggestions = results;
    activeSuggestion = -1;
    const list = document.getElementById('address-suggestions');
    list.replaceChildren(...results.map((r) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'suggestion';
      button.setAttribute('role', 'option');
      button.textContent = r.label;
      button.addEventListener('mousedown', (e) => e.preventDefault());
      button.addEventListener('click', () => applyGeocodeResult(r, document.getElementById('address').value.trim()));
      return button;
    }));
    list.hidden = !results.length;
    document.getElementById('address').setAttribute('aria-expanded', String(!!results.length));
  }

  async function fetchSuggestions() {
    const q = document.getElementById('address').value.trim();
    if (q.length < 3) { closeSuggestions(); return; }
    const request = ++suggestionRequest;
    try {
      const results = await D.autocomplete(q, state.locationBias);
      if (request === suggestionRequest && document.getElementById('address').value.trim() === q) renderSuggestions(results);
    } catch { if (request === suggestionRequest) closeSuggestions(); }
  }

  function onAddressInput() {
    clearTimeout(suggestionTimer);
    suggestionRequest++;
    closeSuggestions();
    suggestionTimer = setTimeout(fetchSuggestions, 650);
  }

  function onAddressKeydown(e) {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && suggestions.length) {
      e.preventDefault();
      activeSuggestion = e.key === 'ArrowDown'
        ? (activeSuggestion + 1) % suggestions.length
        : (activeSuggestion - 1 + suggestions.length) % suggestions.length;
      document.querySelectorAll('.suggestion').forEach((el, i) => {
        el.classList.toggle('active', i === activeSuggestion);
        el.setAttribute('aria-selected', String(i === activeSuggestion));
      });
      return;
    }
    if (e.key === 'Escape') { closeSuggestions(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestion >= 0) applyGeocodeResult(suggestions[activeSuggestion], document.getElementById('address').value.trim());
      else onSearch();
    }
  }

  async function onSearch() {
    const q = document.getElementById('address').value.trim();
    if (!q) return;
    setStatus('Geocoding…');
    try {
      const results = await D.geocode(q, state.locationBias);
      track('search', { q, found: results.length > 0, label: results.length ? results[0].label : null });
      if (!results.length) { setStatus('Address not found — try again or click the map.'); return; }
      applyGeocodeResult(results[0], q);
    } catch (e) { setStatus('Geocoding error: ' + e.message); }
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setStatus('Location is not available in this browser — click the map instead.'); return; }
    setStatus('Getting your location…');
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude: lat, longitude: lon, accuracy } = position.coords;
      state.locationBias = { lat, lon };
      state.lastQuery = 'My location';
      state.lastLabel = 'My location';
      document.getElementById('address').value = 'My location';
      setPin(lat, lon);
      map.setView([lat, lon], 17);
      closeSuggestions();
      setStatus(`Pin set from your location (accuracy about ${Math.round(accuracy)} m) — confirm it on the map, then Calculate.`);
    }, (error) => {
      setStatus(error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied — enter an address or click the map.'
        : 'Could not get your location — enter an address or click the map.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  // ---------------- fetch + auto-expand ----------------
  function bboxAround(pin, radiusM) {
    const proj = G.makeProjection(pin.lat, pin.lon);
    const dLat = radiusM / proj.mPerDegLat;
    const dLon = radiusM / (proj.mPerDegLat * Math.cos((pin.lat * Math.PI) / 180));
    return { south: pin.lat - dLat, north: pin.lat + dLat, west: pin.lon - dLon, east: pin.lon + dLon };
  }
  function bboxUnionDeg(a, b) {
    return { south: Math.min(a.south, b.south), west: Math.min(a.west, b.west),
             north: Math.max(a.north, b.north), east: Math.max(a.east, b.east) };
  }

  async function calculate(forceFresh) {
    if (!state.pin) return;
    const calcStarted = Date.now();
    state.dataCapHit = false;
    state.fromCache = false;
    state.proj = G.makeProjection(state.pin.lat, state.pin.lon);
    let bbox = bboxAround(state.pin, settings.fetchRadiusM);
    let iteration = 0;
    while (true) {
      setStatus(`Fetching buildings (pass ${iteration + 1})…`);
      try {
        const r = await D.fetchBuildingsCached(bbox, { force: !!forceFresh });
        state.rawBuildings = r.buildings;
        state.fetchedAt = r.fetchedAt;
        state.checkedAt = r.checkedAt;
        state.fromCache = r.fromCache;
      } catch (e) { setStatus('Overpass error: ' + e.message + ' — try again in a minute (public server rate limits).'); return; }
      state.fetchBBox = bbox;
      prepareBuildings();
      recompute(true);
      if (state.rawBuildings.length > settings.maxBuildings) {
        state.dataCapHit = true;
        break;
      }
      // Expand if the home city's rectangle approaches the fetched area's edge —
      // the chain might continue beyond the data we have (no halachic cap; data cap only).
      const needed = neededExpansion(bbox);
      if (!needed || iteration >= settings.maxExpandIterations) {
        state.dataCapHit = !!needed;
        break;
      }
      bbox = bboxUnionDeg(bbox, needed);
      iteration++;
    }
    recompute(); // final render with cap flags
    if (state.result && state.result.techumCorners) {
      const pts = state.result.techumCorners.map((p) => {
        const ll = state.proj.toLatLon(p.x, p.y);
        return [ll.lat, ll.lon];
      });
      map.fitBounds(L.latLngBounds(pts).pad(0.05));
    }
    const ageDays = state.fetchedAt ? ((Date.now() - Date.parse(state.fetchedAt)) / 86400000) : 0;
    setStatus(`Done — ${state.rawBuildings.length} buildings analyzed. ` +
      (state.result && state.result.mode === 'city'
        ? 'Techum drawn from the squared city. ' : 'Point-shevisa techum drawn. ') +
      (state.fromCache
        ? `Data from local cache (${ageDays < 1 ? 'today' : ageDays.toFixed(0) + ' days old'}).`
        : 'Fresh OSM data.'));
    track('calc', {
      q: state.lastQuery || null, label: state.lastLabel || null,
      pin: { lat: +state.pin.lat.toFixed(5), lon: +state.pin.lon.toFixed(5) },
      mode: state.result ? state.result.mode : null,
      buildings: state.rawBuildings.length,
      fromCache: !!state.fromCache, fresh: !!forceFresh,
      profile: S.effectiveProfile(settings),
      nonDefaults: S.diffFromDefaults(settings),
      ms: Date.now() - calcStarted,
    });
    // Automatic staleness check — no user action needed. If the cached data hasn't been
    // verified against OSM within autoCheckDays, silently check; refetch only on real edits.
    const verifiedAge = Date.now() - Date.parse(state.checkedAt || state.fetchedAt || 0);
    if (state.fromCache && verifiedAge > (settings.autoCheckDays || 30) * 86400000) {
      await checkUpdates(true);
    }
  }

  function neededExpansion(bbox) {
    const res = state.result;
    if (!res || res.mode !== 'city' || !res.cityCorners) return null;
    const margin = res.thresholds.t2 + 60; // 141 1/3 amos + footprint-error margin
    const proj = state.proj;
    const pts = res.cityCorners.map((p) => proj.toLatLon(p.x, p.y));
    const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
    const dLat = margin / proj.mPerDegLat;
    const dLon = margin / (proj.mPerDegLat * Math.cos((state.pin.lat * Math.PI) / 180));
    let grow = null;
    const want = {
      south: Math.min(...lats) - 3 * dLat, north: Math.max(...lats) + 3 * dLat,
      west: Math.min(...lons) - 3 * dLon, east: Math.max(...lons) + 3 * dLon,
    };
    if (Math.min(...lats) - dLat < bbox.south || Math.max(...lats) + dLat > bbox.north ||
        Math.min(...lons) - dLon < bbox.west || Math.max(...lons) + dLon > bbox.east) {
      grow = want;
    }
    return grow;
  }

  function prepareBuildings() {
    auditCache.clear(); // buffers are keyed by building id — new data invalidates them
    const proj = state.proj;
    state.buildings = state.rawBuildings.map((raw) => {
      const ring = raw.ringLatLon.map((p) => proj.toXY(p.lat, p.lon));
      const cls = D.classify(raw.tags);
      return {
        id: raw.id, tags: raw.tags, ring,
        bbox: ringBBox(ring),
        klass: cls.klass, reason: cls.reason,
        included: false, // set in recompute from klass + settings + override
      };
    });
  }
  function ringBBox(ring) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of ring) {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  // Minimum dwelling size: 4x4 amos (SA HaRav 398:10 — "under 4 amos wide is not a
  // dwelling even if very long"). Amah-dependent, so evaluated per run.
  function isTooSmall(b) {
    if (!settings.minSizeFilter) return false;
    const min = 4 * (settings.amahCm / 100);
    return (b.bbox.maxX - b.bbox.minX) < min || (b.bbox.maxY - b.bbox.minY) < min;
  }
  function isIncluded(b) {
    const ov = state.overrides.get(b.id);
    if (ov === 'include') return true;
    if (ov === 'exclude') return false;
    if (isTooSmall(b)) return false;
    if (b.klass === 'dwelling') return true;
    if (b.klass === 'non') return false;
    if (b.klass === 'review') return settings.includeReview;
    return settings.includeUnknown; // 'unknown'
  }
  // Verified-only scenario: only clearly residential structures (and manual includes).
  // NOT "machmir" vs "meikil" — a changed join can alter the city topology either way;
  // the two scenarios simply bracket the data uncertainty. Neither is authoritative.
  function isVerifiedIncluded(b) {
    const ov = state.overrides.get(b.id);
    if (ov === 'include') return true;
    if (ov === 'exclude') return false;
    if (isTooSmall(b)) return false;
    return b.klass === 'dwelling';
  }

  // ---------------- pipeline + render ----------------
  function recompute(skipRender) {
    if (!state.buildings.length && !state.pin) return;
    for (const b of state.buildings) b.included = isIncluded(b);
    const pinXY = state.proj.toXY(state.pin.lat, state.pin.lon);
    const geoSettings = {
      amahM: settings.amahCm / 100,
      karpef: settings.karpef,
      minCityHouses: settings.minCityHouses,
      overlapMerge: settings.overlapMerge,
      squaringAngleDeg: settings.squaringAngleDeg,
      pointRotationDeg: settings.pointRotationDeg,
    };
    state.result = G.runPipeline(state.buildings, geoSettings, pinXY);
    if (!skipRender) render();
  }

  function cornersToLatLngs(corners) {
    // sample edges every ~150m so long rectangle edges stay faithful after unprojection
    const out = [];
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i], b = corners[(i + 1) % corners.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / 150));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const p = state.proj.toLatLon(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        out.push([p.lat, p.lon]);
      }
    }
    return out;
  }

  const KLASS_STYLE = {
    dwelling: { color: '#2ecc40', fillColor: '#2ecc40' },
    unknown: { color: '#ff9f1a', fillColor: '#ff9f1a' },
    review: { color: '#b45cff', fillColor: '#b45cff' },
    non: { color: '#9aa0a6', fillColor: '#9aa0a6' },
  };

  function render() {
    layerGroups.buildings.clearLayers();
    layerGroups.rects.clearLayers();
    layerGroups.second.clearLayers();
    const res = state.result;
    if (!res) return;

    // buildings
    const showBuildings = document.getElementById('layer-buildings').checked;
    const homeMembers = res.mode === 'city' && res.homeCluster >= 0 && res.clusters[res.homeCluster]
      ? new Set(res.clusters[res.homeCluster].members) : new Set();
    if (showBuildings) {
      state.buildings.forEach((b, i) => {
        const st = { ...(KLASS_STYLE[b.klass] || KLASS_STYLE.unknown) };
        const ov = state.overrides.get(b.id);
        let dash = null, weight = 1, fillOpacity = b.included ? 0.45 : 0.12, opacity = b.included ? 0.9 : 0.45;
        if (ov) { dash = '4 3'; weight = 2.5; st.color = ov === 'exclude' ? '#ff4136' : '#0074d9'; }
        const inHome = homeMembers.has(i);
        const poly = L.polygon(b.ring.map((p) => { const ll = state.proj.toLatLon(p.x, p.y); return [ll.lat, ll.lon]; }), {
          color: st.color, weight, fillColor: st.fillColor, fillOpacity: inHome ? Math.min(0.65, fillOpacity + 0.15) : fillOpacity,
          opacity, dashArray: dash,
        });
        poly.bindTooltip(
          `<b>${escapeHtml(b.klass.toUpperCase())}</b> — ${escapeHtml(b.reason)}` +
          (ov ? `<br>manual override: ${escapeHtml(ov)}` : '') +
          `<br><i>click to cycle: auto → include → exclude</i>`,
          { sticky: true }
        );
        poly.on('click', () => {
          const cur = state.overrides.get(b.id);
          if (!cur) state.overrides.set(b.id, 'include');
          else if (cur === 'include') state.overrides.set(b.id, 'exclude');
          else state.overrides.delete(b.id);
          recompute();
        });
        poly.addTo(layerGroups.buildings);
      });
    }

    // rectangles
    const addRect = (corners, style, label, group) => {
      if (!corners) return;
      if (style.casing) // white underlay so the line reads against any satellite imagery
        L.polygon(cornersToLatLngs(corners), { color: '#ffffff', weight: (style.weight || 3) + 3, fill: false, opacity: 0.85 })
          .addTo(group || layerGroups.rects);
      const p = L.polygon(cornersToLatLngs(corners), style).addTo(group || layerGroups.rects);
      if (label) p.bindTooltip(label, { sticky: true });
    };
    if (document.getElementById('layer-city').checked)
      addRect(res.cityCorners, { color: '#00c916', weight: 4, fill: false, casing: true }, res.mode === 'city' ? 'CITY rectangle (ribua ha’ir)' : '4-amos shevisa');
    if (res.karpefCorners && document.getElementById('layer-karpef').checked)
      addRect(res.karpefCorners, { color: '#00c2c2', weight: 2, dashArray: '6 5', fill: false }, 'Karpef (+70⅔ amos — Rema/MB 398:36)');
    if (document.getElementById('layer-techum').checked)
      addRect(res.techumCorners, { color: '#ff2222', weight: 3.5, fill: true, fillOpacity: 0.03 }, 'TECHUM — 2000 amos (' + settings.amahCm + ' cm amah)');
    if (settings.show12mil)
      addRect(res.mil12Corners, { color: '#666', weight: 1.5, dashArray: '2 6', fill: false }, '12 mil (d’oraisa shita)');
    for (const region of res.concavityRegions || [])
      addRect(region, { color: '#ffdc00', weight: 2, dashArray: '4 4', fillColor: '#ffdc00', fillOpacity: 0.15 }, '≥4000-amos concavity — review');

    // verified-only scenario: pipeline over clearly-residential structures only.
    // Brackets the data uncertainty from untagged buildings; neither line is a psak.
    if (settings.showVerifiedOnly && res.mode === 'city') {
      const verifiedB = state.buildings.map((b) => ({ ...b, included: isVerifiedIncluded(b) }));
      if (verifiedB.some((b) => b.included)) {
        const resV = G.runPipeline(verifiedB, {
          amahM: settings.amahCm / 100, karpef: settings.karpef,
          minCityHouses: settings.minCityHouses, overlapMerge: settings.overlapMerge,
          squaringAngleDeg: settings.squaringAngleDeg,
        }, state.proj.toXY(state.pin.lat, state.pin.lon));
        if (resV.techumCorners)
          addRect(resV.techumCorners, { color: '#ffb300', weight: 2.5, dashArray: '8 6', fill: false },
            'Scenario: verified dwellings only (' + (resV.mode === 'point' ? 'point shevisa!' : 'city') + ') — data-uncertainty bracket, not a psak', layerGroups.second);
      }
    }

    // comparison shita line (full second pipeline run — thresholds change with the amah)
    if (settings.secondAmahCm && settings.secondAmahCm !== settings.amahCm) {
      const res2 = G.runPipeline(state.buildings, {
        amahM: settings.secondAmahCm / 100, karpef: settings.karpef,
        minCityHouses: settings.minCityHouses, overlapMerge: settings.overlapMerge,
        squaringAngleDeg: settings.squaringAngleDeg,
      }, state.proj.toXY(state.pin.lat, state.pin.lon));
      addRect(res2.techumCorners, { color: '#e040fb', weight: 2.5, dashArray: '10 6', fill: false },
        'Comparison: techum @ ' + settings.secondAmahCm + ' cm amah', layerGroups.second);
    }

    renderAuditRings();
    renderPanel();
  }

  // ---------------- audit rings (manual-audit aid, advanced toggle) ----------------
  // Dotted contour exactly 70⅔ amos from each included footprint — the same distance
  // field the clustering uses, so the picture IS the computation:
  //   · a building whose walls reach a ring joins that chain (ibur, SA 398:5-7);
  //   · two rings touching, when both settlements qualify as cities, is exactly the
  //     141⅓-amos merge — each city contributes its own 70⅔ (SA 398:5).
  // Colors identify chains. Viewport-limited and cached; auditing is a zoomed-in task.
  function renderAuditRings() {
    layerGroups.audit.clearLayers();
    const res = state.result;
    if (!settings.showAuditRings || !res || !state.buildings.length) return;
    const joinM = res.thresholds.joinM;
    const mb = map.getBounds().pad(0.2);
    const sw = state.proj.toXY(mb.getSouth(), mb.getWest());
    const ne = state.proj.toXY(mb.getNorth(), mb.getEast());
    const view = {
      minX: Math.min(sw.x, ne.x) - joinM, minY: Math.min(sw.y, ne.y) - joinM,
      maxX: Math.max(sw.x, ne.x) + joinM, maxY: Math.max(sw.y, ne.y) + joinM,
    };
    const CAP = 400;
    let shown = 0, skipped = 0;
    state.buildings.forEach((b, i) => {
      if (!b.included) return;
      if (b.bbox.maxX < view.minX || b.bbox.minX > view.maxX ||
          b.bbox.maxY < view.minY || b.bbox.minY > view.maxY) return;
      if (shown >= CAP) { skipped++; return; }
      shown++;
      const key = b.id + '|' + joinM.toFixed(2);
      let loops = auditCache.get(key);
      if (!loops) { loops = G.bufferRing(b.ring, joinM); auditCache.set(key, loops); }
      const label = res.labels[i];
      const color = label >= 0 ? `hsl(${(label * 137.508) % 360}, 90%, 55%)` : '#cccccc';
      for (const loop of loops) {
        L.polygon(loop.map((p) => { const ll = state.proj.toLatLon(p.x, p.y); return [ll.lat, ll.lon]; }), {
          color, weight: 1.6, dashArray: '1 5', fill: false, opacity: 0.95,
        }).bindTooltip(
          `<b>70⅔ amos = ${joinM.toFixed(1)} m</b> around this building (chain #${label + 1}).` +
          `<br>A building whose walls reach this ring joins the chain (ibur — SA 398:5-7).` +
          `<br>Two rings touching, both qualifying cities, is exactly the 141⅓-amos merge (2 × 70⅔).`,
          { sticky: true }
        ).addTo(layerGroups.audit);
      }
    });
    if (skipped) setStatus(`Audit rings: showing ${shown} of ${shown + skipped} buildings in view — zoom in to audit the rest.`);
  }

  // ---------------- info panel ----------------
  function setStatus(msg) { document.getElementById('status').textContent = msg; }

  function renderPanel() {
    const res = state.result;
    const el = document.getElementById('results');
    if (!res) { el.innerHTML = ''; return; }
    const counts = { dwelling: 0, unknown: 0, review: 0, non: 0 };
    for (const b of state.buildings) counts[b.klass] = (counts[b.klass] || 0) + 1;
    const homeSize = res.homeCluster >= 0 && res.clusters[res.homeCluster]
      ? res.clusters[res.homeCluster].members.length : 0;
    const amahM = settings.amahCm / 100;
    const lines = [];
    lines.push(`<div class="stat"><b>Mode:</b> ${res.mode === 'city' ? 'city (whole city = 4 amos)' : 'open field (point shevisa)'}</div>`);
    lines.push(`<div class="stat"><b>Buildings fetched:</b> ${state.buildings.length} — ` +
      `<span class="sw dw"></span>${counts.dwelling} dwelling, <span class="sw un"></span>${counts.unknown} untagged, ` +
      `<span class="sw rv"></span>${counts.review} needs-review, <span class="sw no"></span>${counts.non} non-dwelling</div>`);
    if (res.mode === 'city') lines.push(`<div class="stat"><b>Home city cluster:</b> ${homeSize} structures</div>`);
    const smallCount = settings.minSizeFilter
      ? state.buildings.filter((b) => isTooSmall(b) && state.overrides.get(b.id) !== 'include').length : 0;
    if (smallCount) lines.push(`<div class="stat"><b>Below 4×4 amos (excluded):</b> ${smallCount} structures</div>`);
    lines.push(`<div class="stat"><b>Thresholds:</b> join 70⅔ amos = ${(70.667 * amahM).toFixed(1)} m · ` +
      `city-merge 141⅓ = ${(141.333 * amahM).toFixed(1)} m · techum 2000 = ${(2000 * amahM).toFixed(0)} m` +
      (settings.karpef ? ` · karpef +${(70.667 * amahM).toFixed(1)} m` : '') + `</div>`);
    if (state.dataCapHit) {
      lines.push(`<div class="warn">⚠ <b>Data limit reached</b> — the built-up chain may continue beyond the fetched area. ` +
        `There is <b>no halachic cap</b> on chain length; the techum shown is an inner (machmir) bound in those directions. ` +
        `Raise the fetch limits in settings to extend.</div>`);
    }
    const seenWarnings = new Map();
    for (const w of res.warnings) {
      const key = w.type + '|' + w.text;
      seenWarnings.set(key, (seenWarnings.get(key) || 0) + 1);
    }
    for (const [key, count] of seenWarnings) {
      const [type, text] = [key.slice(0, key.indexOf('|')), key.slice(key.indexOf('|') + 1)];
      const cls = type === 'point-mode' ? 'note' : 'warn';
      lines.push(`<div class="${cls}">${type === 'point-mode' ? 'ℹ' : '⚠'} ${escapeHtml(text)}${count > 1 ? ` <b>(×${count})</b>` : ''}</div>`);
    }
    const reviewCount = counts.review + counts.unknown;
    if (reviewCount) {
      lines.push(`<div class="note">ℹ ${reviewCount} buildings are untagged/ambiguous (orange/purple). ` +
        `Click any building to include/exclude it; the map recomputes instantly.</div>`);
    }
    el.innerHTML = lines.join('');
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------------- exports ----------------
  function configText() {
    const eff = S.effectiveProfile(settings);
    const counts = { dwelling: 0, unknown: 0, review: 0, non: 0 };
    for (const b of state.buildings) counts[b.klass] = (counts[b.klass] || 0) + 1;
    const bb = state.fetchBBox;
    return [
      '== Psak configuration ==',
      `Profile: ${eff === 'custom' ? 'CUSTOM' : S.PROFILES[settings.profile].label}`,
      `Amah: ${settings.amahCm} cm (2000 amos = ${(20 * settings.amahCm).toFixed(0)} m)`,
      `Single-city karpef: ${settings.karpef ? 'ON (Rema / MB 398:36)' : 'OFF (Mechaber)'}`,
      `Squaring orientation: ${settings.squaringAngleDeg ? 'natural edge @ ' + settings.squaringAngleDeg + '° (manual orientation decision)' : 'compass (true north)'}`,
      `Overlapping-rectangles merge: ${settings.overlapMerge ? 'ON (Chazon Ish)' : 'OFF (strict)'}`,
      `City minimum: ${settings.minCityHouses} footprints (MB 398:38 — COUNT-BASED APPROXIMATION of the 3-chatzeros model; courtyard structure not modeled)`,
      `Min dwelling size 4x4 amos filter: ${settings.minSizeFilter ? 'on' : 'off'}`,
      `Untagged buildings: ${settings.includeUnknown ? 'included (flagged)' : 'excluded'}; ambiguous: ${settings.includeReview ? 'included (flagged)' : 'excluded'}`,
      '== Audit / reproducibility ==',
      `Engine version: ${ENGINE_VERSION} (deterministic: same data + same settings = same output)`,
      `OSM data fetched: ${state.fetchedAt || 'n/a'} via Overpass; extent S${bb ? bb.south.toFixed(5) : '?'} W${bb ? bb.west.toFixed(5) : '?'} N${bb ? bb.north.toFixed(5) : '?'} E${bb ? bb.east.toFixed(5) : '?'}`,
      `Buildings: ${state.buildings.length} (${counts.dwelling} dwelling / ${counts.unknown} untagged / ${counts.review} ambiguous / ${counts.non} non)`,
      `Manual overrides: ${state.overrides.size}${state.overrides.size ? ' [' + [...state.overrides.entries()].map(([id, v]) => id + ':' + v).join(', ') + ']' : ''}`,
      `Search frontier closed: ${state.dataCapHit ? 'NO — data cap hit, chain may continue; techum is an inner bound in those directions' : 'yes'}`,
      `Projection: local true-north tangent plane @ pin (per-point lon scaling)`,
      `Shevisa pin: ${state.pin ? state.pin.lat.toFixed(6) + ', ' + state.pin.lon.toFixed(6) : 'n/a'}`,
      `Generated: ${new Date().toISOString()} — DRAFT, requires review by a rav/mumcheh.`,
    ].join('\n');
  }

  // ---------------- map-update check ----------------
  // "Did the map change since my data date — and if so, did the techum actually move?"
  // Counts OSM building edits in the fetched extent since state.fetchedAt; if any,
  // refetches fresh, recomputes, and reports the techum-line displacement. Most map
  // edits don't move the boundary — the diff is what a reviewer actually cares about.
  async function checkUpdates(auto) {
    if (!state.fetchBBox || !state.fetchedAt) return;
    setStatus((auto ? 'Data older than ' + (settings.autoCheckDays || 30) + ' days — auto-checking OSM for edits since ' : 'Checking OSM for building edits since ') + new Date(state.fetchedAt).toLocaleString() + '…');
    let n;
    try { n = await D.countChangedBuildings(state.fetchBBox, state.fetchedAt); }
    catch (e) { setStatus('Update check failed: ' + e.message + (auto ? ' — using cached data (will retry next calculation).' : '')); return; }
    if (!n) {
      const stamped = await D.markCheckedCurrent(state.fetchBBox);
      if (stamped) state.checkedAt = stamped;
      setStatus('Auto-verified: no building edits in this area since ' + new Date(state.fetchedAt).toLocaleDateString() +
        ' — the map is unchanged, techum is current.');
      return;
    }
    const oldTechum = state.result && state.result.techumCorners;
    const oldFetchedAt = state.fetchedAt;
    setStatus(`${n} building edit(s) since your data date — refetching fresh…`);
    await calculate(true);
    const newTechum = state.result && state.result.techumCorners;
    if (oldTechum && newTechum && oldTechum.length === newTechum.length) {
      let maxD = 0;
      for (let i = 0; i < newTechum.length; i++) {
        maxD = Math.max(maxD, Math.hypot(newTechum[i].x - oldTechum[i].x, newTechum[i].y - oldTechum[i].y));
      }
      setStatus(`Map updated (${n} edits since ${new Date(oldFetchedAt).toLocaleDateString()}). ` +
        (maxD < 0.5
          ? 'The techum line is UNCHANGED — the edits did not affect the boundary.'
          : `⚠ THE TECHUM MOVED — up to ${maxD.toFixed(1)} m. Previous results/psak need re-review.`));
    }
  }

  // ---------------- snapshots (determinism / offline reproducibility) ----------------
  // The engine is pure; the only thing that changes between runs is OSM data. A snapshot
  // freezes the fetched buildings + pin + settings + overrides so the identical result is
  // reproducible forever (and shareable) without refetching.
  function saveSnapshot() {
    if (!state.rawBuildings.length) return;
    const snap = {
      format: 'techum-snapshot', version: ENGINE_VERSION,
      pin: state.pin, fetchedAt: state.fetchedAt, fetchBBox: state.fetchBBox,
      dataCapHit: state.dataCapHit,
      settings, overrides: [...state.overrides.entries()],
      rawBuildings: state.rawBuildings,
    };
    K.download('techum-snapshot.json', JSON.stringify(snap), 'application/json');
    track('snapshot', { action: 'save' });
  }
  function loadSnapshot(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const snap = JSON.parse(reader.result);
        if (snap.format !== 'techum-snapshot') throw new Error('not a techum snapshot');
        state.pin = snap.pin;
        state.fetchedAt = snap.fetchedAt;
        state.fetchBBox = snap.fetchBBox;
        state.dataCapHit = !!snap.dataCapHit;
        state.rawBuildings = snap.rawBuildings;
        state.overrides = new Map(snap.overrides || []);
        settings = { ...S.DEFAULTS, ...snap.settings };
        S.save(settings);
        state.proj = G.makeProjection(state.pin.lat, state.pin.lon);
        setPin(state.pin.lat, state.pin.lon);
        map.setView([state.pin.lat, state.pin.lon], 15);
        prepareBuildings();
        recompute();
        setStatus(`Snapshot loaded — ${state.rawBuildings.length} buildings (data from ${snap.fetchedAt}). Deterministic replay.`);
        track('snapshot', { action: 'load' });
        // Old snapshot? Verify against today's map automatically (the snapshot file itself
        // stays frozen; this only reports drift and redraws from fresh data if edits exist).
        if (Date.now() - Date.parse(snap.fetchedAt || 0) > (settings.autoCheckDays || 30) * 86400000) {
          checkUpdates(true);
        }
      } catch (e) { setStatus('Snapshot load failed: ' + e.message); }
    };
    reader.readAsText(file);
  }

  function exportKML() {
    const res = state.result;
    if (!res) return;
    const toPath = (corners) => corners && cornersToLatLngs(corners).map(([lat, lon]) => ({ lat, lon }));
    let second = null;
    if (settings.secondAmahCm && settings.secondAmahCm !== settings.amahCm) {
      const res2 = G.runPipeline(state.buildings, {
        amahM: settings.secondAmahCm / 100, karpef: settings.karpef,
        minCityHouses: settings.minCityHouses, overlapMerge: settings.overlapMerge,
        squaringAngleDeg: settings.squaringAngleDeg,
      }, state.proj.toXY(state.pin.lat, state.pin.lon));
      second = toPath(res2.techumCorners);
    }
    const kml = K.buildKML({
      pin: state.pin,
      techum: toPath(res.techumCorners),
      city: toPath(res.cityCorners),
      karpef: toPath(res.karpefCorners),
      second,
    }, configText());
    K.download('techum-draft.kml', kml);
    track('export', { format: 'kml' });
  }

  function exportGeoJSON() {
    const res = state.result;
    if (!res) return;
    const toPoly = (corners, props) => corners && ({
      type: 'Feature', properties: props,
      geometry: { type: 'Polygon', coordinates: [cornersToLatLngs(corners).concat([cornersToLatLngs(corners)[0]]).map(([lat, lon]) => [lon, lat])] },
    });
    const fc = {
      type: 'FeatureCollection',
      properties: { disclaimer: 'DRAFT — requires review by a rav/mumcheh', config: configText() },
      features: [
        toPoly(res.techumCorners, { layer: 'techum' }),
        toPoly(res.cityCorners, { layer: 'city' }),
        toPoly(res.karpefCorners, { layer: 'karpef' }),
      ].filter(Boolean),
    };
    K.download('techum-draft.geojson', JSON.stringify(fc, null, 2), 'application/geo+json');
    track('export', { format: 'geojson' });
  }

  // ---------------- settings UI ----------------
  function bindSettings() {
    const $ = (id) => document.getElementById(id);
    const refreshInputs = () => {
      $('profile').value = S.effectiveProfile(settings) === 'custom' ? 'custom' : settings.profile;
      $('amah').value = String(settings.amahCm);
      $('karpef').checked = settings.karpef;
      $('sq-angle').value = settings.squaringAngleDeg;
      $('overlap').checked = settings.overlapMerge;
      $('min-city').value = settings.minCityHouses;
      $('inc-unknown').checked = settings.includeUnknown;
      $('inc-review').checked = settings.includeReview;
      $('min-size').checked = settings.minSizeFilter;
      $('verified-only').checked = settings.showVerifiedOnly;
      $('second-amah').value = String(settings.secondAmahCm || 0);
      $('show-12mil').checked = settings.show12mil;
      $('audit-rings').checked = settings.showAuditRings;
      $('fetch-radius').value = settings.fetchRadiusM;
      $('max-buildings').value = settings.maxBuildings;
    };
    const onChange = () => { S.save(settings); if (state.rawBuildings.length) recompute(); };

    $('profile').addEventListener('change', (e) => {
      if (e.target.value !== 'custom') settings = S.applyProfile(settings, e.target.value);
      refreshInputs(); onChange();
    });
    $('amah').addEventListener('change', (e) => { settings.amahCm = parseFloat(e.target.value); refreshInputs(); onChange(); });
    $('karpef').addEventListener('change', (e) => { settings.karpef = e.target.checked; refreshInputs(); onChange(); });
    $('sq-angle').addEventListener('change', (e) => { settings.squaringAngleDeg = parseFloat(e.target.value) || 0; refreshInputs(); onChange(); });
    $('overlap').addEventListener('change', (e) => { settings.overlapMerge = e.target.checked; refreshInputs(); onChange(); });
    $('min-city').addEventListener('change', (e) => { settings.minCityHouses = Math.max(1, parseInt(e.target.value, 10) || 6); refreshInputs(); onChange(); });
    $('inc-unknown').addEventListener('change', (e) => { settings.includeUnknown = e.target.checked; onChange(); });
    $('inc-review').addEventListener('change', (e) => { settings.includeReview = e.target.checked; onChange(); });
    $('min-size').addEventListener('change', (e) => { settings.minSizeFilter = e.target.checked; onChange(); });
    $('verified-only').addEventListener('change', (e) => { settings.showVerifiedOnly = e.target.checked; onChange(); });
    $('second-amah').addEventListener('change', (e) => { settings.secondAmahCm = parseFloat(e.target.value) || 0; onChange(); });
    $('show-12mil').addEventListener('change', (e) => { settings.show12mil = e.target.checked; onChange(); });
    $('audit-rings').addEventListener('change', (e) => {
      settings.showAuditRings = e.target.checked; S.save(settings);
      if (state.result) renderAuditRings();
    });
    $('fetch-radius').addEventListener('change', (e) => { settings.fetchRadiusM = Math.max(300, parseInt(e.target.value, 10) || 1200); S.save(settings); });
    $('max-buildings').addEventListener('change', (e) => { settings.maxBuildings = Math.max(1000, parseInt(e.target.value, 10) || 30000); S.save(settings); });
    ['layer-buildings', 'layer-city', 'layer-karpef', 'layer-techum'].forEach((id) =>
      $(id).addEventListener('change', () => render()));
    refreshInputs();
  }

  // ---------------- boot ----------------
  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    bindSettings();
    document.getElementById('btn-search').addEventListener('click', onSearch);
    document.getElementById('address').addEventListener('input', onAddressInput);
    document.getElementById('address').addEventListener('keydown', onAddressKeydown);
    document.getElementById('address').addEventListener('blur', () => setTimeout(closeSuggestions, 100));
    document.getElementById('btn-location').addEventListener('click', useMyLocation);
    document.getElementById('btn-calc').addEventListener('click', () => calculate(false));
    document.getElementById('btn-fresh').addEventListener('click', () => calculate(true));
    document.getElementById('btn-kml').addEventListener('click', exportKML);
    document.getElementById('btn-geojson').addEventListener('click', exportGeoJSON);
    document.getElementById('btn-snapshot').addEventListener('click', saveSnapshot);
    document.getElementById('snapshot-file').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) loadSnapshot(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('btn-load-snapshot').addEventListener('click', () =>
      document.getElementById('snapshot-file').click());
    document.getElementById('btn-clear-overrides').addEventListener('click', () => { state.overrides.clear(); if (state.rawBuildings.length) recompute(); });
    setStatus('Enter an address (or click the map) to set the shevisa point.');
  });
})();
