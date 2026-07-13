/*
 * Techum Calculator — app orchestration + Leaflet rendering.
 * Flow: geocode/pin -> fetch Overture buildings (auto-expanding) -> classify ->
 * project -> TechumGeo.runPipeline -> render layers -> exports.
 */
(function () {
  'use strict';
  const G = window.TechumGeo, D = window.TechumData, S = window.TechumSettings, K = window.TechumKML;
  const ENGINE_VERSION = '1.2.0 (2026-07-13)';
  const isSimplifiedDirection = /^(9|10)$/.test(document.documentElement.dataset.design || '');

  let settings = S.load();
  let map, pinMarker, buildingRenderer;
  let state = {
    pin: null,            // {lat, lon}
    proj: null,
    rawBuildings: [],     // from Overture: {id, tags, ringLatLon}
    manualBuildings: [],  // reviewer-drawn/imported corrections
    buildings: [],        // projected + classified: {id, tags, ring, bbox, klass, included, override}
    overrides: new Map(), // id -> 'include' | 'exclude'
    result: null,
    fetchBBox: null,      // {south, west, north, east}
    dataCapHit: false,
    dataRelease: null,
    correctionsApplied: 0,
    snapInfo: null,
    overtureReport: null,
    validatedPerimeter: null,
  };
  const layerGroups = {
    buildings: null, rects: null, second: null, settlements: null, audit: null, overture: null, perimeter: null,
  };
  const auditCache = new Map(); // building id + join dist -> buffer loops (pure geometry)
  let drawing = null;
  let bowCapture = null;
  let analysisWorker = null;
  let analysisRequestId = 0;
  let latestAnalysisId = 0;
  let activeCalculationId = 0;
  let automaticCalculationTimer = null;
  const analysisPending = new Map();
  function track(type, data) { if (window.TechumTrack) window.TechumTrack.send(type, data); }

  const SETTING_HELP = {
    profile: 'Choose a documented bundle of shitos; the explanation below states what changes and why.',
    amah: 'Sets the length of an amah. This changes distances and can change which buildings connect.',
    karpef: 'Adds 70⅔ amos around a single city before measuring the 2,000-amah techum.',
    'sq-angle': 'Automatic ribua preserves a clearly rectangular city in its existing direction; irregular cities are squared to true north. A nonzero value is a reviewer override.',
    overlap: 'Controls whether overlapping squared city areas are treated as one city.',
    'inc-unknown': 'Includes detected structures whose dwelling use is not identified.',
    'inc-review': 'Includes hotels, schools, shuls and similar places that need individual review.',
    'min-size': 'Leaves out structures smaller than four by four amos.',
    'fetch-radius': 'How far from the pin the first building-data search reaches.',
    'max-buildings': 'Safety limit for the number of building footprints downloaded.',
    'layer-buildings': 'Shows the building footprints used by the calculation.',
    'layer-city': 'Shows the squared city boundary from which the techum is measured.',
    'layer-karpef': 'Shows the additional karpef area around the city.',
    'layer-techum': 'Shows the final 2,000-amah techum boundary.',
    'verified-only': 'Adds a comparison using only clearly identified dwellings.',
    'second-amah': 'Adds another techum line using a different amah length.',
    'show-12mil': 'Shows the larger twelve-mil boundary used by one Torah-law opinion.',
    'audit-rings': 'Shows exactly how nearby buildings connect into settlements and the home city.',
  };
  const PROFILE_EXPLANATIONS = {
    'mishna-berura': '<b>Mishna Berurah / Ashkenazi:</b> R\' Chaim Naeh amah (18.90 in), Rema\'s 70⅔-amah karpef, shape-aware SA/MB squaring, and the stricter view that overlapping city rectangles do not automatically merge.',
    'chazon-ish': '<b>Chazon Ish:</b> larger 22.68-inch amah and the lenient view that overlapping city rectangles are redrawn together. Shape-aware automatic squaring is the starting value; a reviewer can set a controlling natural angle.',
    mechaber: '<b>Mechaber / Sefardi:</b> 18.90-inch amah here, no extra single-city karpef, shape-aware SA squaring, and no automatic overlapping-rectangle merge.',
    custom: '<b>Custom:</b> one or more choices differ from the selected profile. Review every changed shita with a rav.',
  };

  function addSettingHelp() {
    Object.entries(SETTING_HELP).forEach(([id, explanation]) => {
      const input = document.getElementById(id);
      const label = input && input.closest('label');
      if (!label) return;
      const help = document.createElement('button');
      help.type = 'button';
      help.className = 'setting-help';
      help.textContent = '?';
      help.setAttribute('aria-label', 'About this setting');
      help.dataset.tip = explanation;
      help.setAttribute('aria-expanded', 'false');
      help.addEventListener('click', (e) => {
        e.preventDefault();
        const open = help.getAttribute('aria-expanded') !== 'true';
        document.querySelectorAll('.setting-help[aria-expanded="true"]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
        help.setAttribute('aria-expanded', String(open));
      });
      label.appendChild(help);
    });
  }

  function compactSettingGroups() {
    document.querySelectorAll('.settings-grid > details').forEach((details) => {
      const items = document.createElement('div');
      items.className = 'setting-items';
      [...details.children].filter((child) => child.tagName !== 'SUMMARY').forEach((child) => items.appendChild(child));
      details.appendChild(items);
    });
  }

  // ---------------- map ----------------
  function initMap() {
    map = L.map('map', { zoomControl: true }).setView([41.1, -74.05], 13);
    // Thousands of footprint paths are substantially cheaper on one canvas than as
    // thousands of live SVG nodes; boundary lines remain SVG for crisp interaction.
    buildingRenderer = L.canvas({ padding: 0.35 });
    const imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20, maxNativeZoom: 19,
      crossOrigin: true,
      attribution: 'Imagery © Esri | Map data © OpenStreetMap contributors',
    });
    const imageryLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      maxZoom: 20, opacity: 0.9, crossOrigin: true, attribution: '© CARTO',
    });
    if (isSimplifiedDirection) {
      const illustrated = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20, crossOrigin: true,
        attribution: '© OpenStreetMap contributors © CARTO',
      });
      const realistic = L.layerGroup([imagery, imageryLabels]);
      illustrated.addTo(map);
      L.control.layers({ 'Illustrated map': illustrated, 'Realistic view': realistic }, null, {
        collapsed: false, position: 'topright',
      }).addTo(map);
    } else {
      imagery.addTo(map);
      imageryLabels.addTo(map);
    }
    layerGroups.buildings = L.layerGroup().addTo(map);
    layerGroups.rects = L.layerGroup().addTo(map);
    layerGroups.second = L.layerGroup().addTo(map);
    layerGroups.settlements = L.layerGroup().addTo(map);
    layerGroups.audit = L.layerGroup().addTo(map);
    layerGroups.overture = L.layerGroup().addTo(map);
    layerGroups.perimeter = L.layerGroup().addTo(map);
    map.on('click', (e) => {
      if (drawing) { addDrawingVertex(e.latlng); return; }
      if (bowCapture) { addBowEndpoint(e.latlng); return; }
      const invalidatesResult = !!state.rawBuildings.length;
      setPin(e.latlng.lat, e.latlng.lng, { invalidateResult: invalidatesResult });
      if (isSimplifiedDirection) {
        setStatus('Pin moved — updating your techum automatically…');
        scheduleAutomaticCalculation();
      } else if (!invalidatesResult) setStatus('Pin set from the map. Confirm its position, then Calculate. Click elsewhere to move it.');
    });
    // audit rings are viewport-limited — refresh them as the reviewer pans/zooms
    map.on('moveend', () => {
      if (state.result) renderBuildings();
      if (settings.showAuditRings && state.result) renderAuditRings();
    });
  }

  function setPin(lat, lon, options) {
    state.pin = { lat, lon };
    document.body.classList.add('has-pin');
    if (!pinMarker) {
      pinMarker = L.marker([lat, lon], { draggable: true }).addTo(map);
      pinMarker.bindTooltip('Shevisa point — drag to adjust', { direction: 'top' });
      pinMarker.on('dragend', () => {
        const p = pinMarker.getLatLng();
        state.pin = { lat: p.lat, lon: p.lng };
        if (state.rawBuildings.length) invalidateCalculationForMovedPin();
        if (isSimplifiedDirection) scheduleAutomaticCalculation();
      });
    } else pinMarker.setLatLng([lat, lon]);
    document.getElementById('btn-calc').disabled = false;
    if (options && options.invalidateResult) invalidateCalculationForMovedPin();
  }

  function scheduleAutomaticCalculation() {
    if (!isSimplifiedDirection) return;
    clearTimeout(automaticCalculationTimer);
    automaticCalculationTimer = window.setTimeout(() => {
      if (document.getElementById('btn-calc').getAttribute('aria-busy') === 'true') cancelCalculation();
      void calculate(false);
    }, 280);
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
    document.getElementById('address').removeAttribute('aria-activedescendant');
  }

  function applyGeocodeResult(r, query) {
    document.getElementById('address').value = r.label;
    state.lastQuery = query || r.label;
    state.lastLabel = r.label;
    setPin(r.lat, r.lon, { invalidateResult: isSimplifiedDirection && !!state.rawBuildings.length });
    map.setView([r.lat, r.lon], 16);
    closeSuggestions();
    if (isSimplifiedDirection) {
      setStatus('Found ' + r.label + ' — calculating your techum…');
      scheduleAutomaticCalculation();
    } else {
      setStatus('Pin set: ' + r.label + ' — confirm the pin is on the right building (drag it if not), then Calculate.');
    }
  }

  function renderSuggestions(results) {
    suggestions = results;
    activeSuggestion = -1;
    const list = document.getElementById('address-suggestions');
    list.replaceChildren(...results.map((r, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'suggestion';
      button.id = `address-suggestion-${i}`;
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
      document.getElementById('address').setAttribute('aria-activedescendant', `address-suggestion-${activeSuggestion}`);
      return;
    }
    if (e.key === 'Escape') { closeSuggestions(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestion >= 0 || (isSimplifiedDirection && suggestions.length)) {
        applyGeocodeResult(suggestions[Math.max(0, activeSuggestion)], document.getElementById('address').value.trim());
      }
      else setStatus(suggestions.length
        ? 'Choose one of the suggested addresses before continuing.'
        : 'Wait for address suggestions, then choose the correct address.');
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setStatus('Location is not available in this browser — click the map instead.'); return; }
    const button = document.getElementById('btn-location');
    const idleLabel = button.dataset.idleLabel || button.textContent;
    button.dataset.idleLabel = idleLabel;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Finding your location…';
    setStatus('Finding your location…');

    const finish = () => {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = idleLabel;
    };

    navigator.geolocation.getCurrentPosition((position) => {
      void applyCurrentLocation(position).finally(finish);
    }, (error) => {
      setStatus(error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied — enter an address or click the map.'
        : 'Could not get your location — enter an address or click the map.');
      finish();
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  async function applyCurrentLocation(position) {
    const { latitude: lat, longitude: lon, accuracy } = position.coords;
    state.locationBias = { lat, lon };
    const fallbackLabel = `Current location (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
    let label = fallbackLabel;
    setStatus('Location found — finding the street address…');
    try {
      const result = await D.reverseGeocode(lat, lon);
      if (result && result.label) label = result.label;
    } catch {
      // The coordinate is still usable when the public address service is unavailable.
    }
    state.lastQuery = 'My current location';
    state.lastLabel = label;
    document.getElementById('address').value = label;
    setPin(lat, lon, { invalidateResult: isSimplifiedDirection && !!state.rawBuildings.length });
    map.setView([lat, lon], 17);
    closeSuggestions();
    if (isSimplifiedDirection) {
      setStatus(`Found ${label} — calculating your techum…`);
      scheduleAutomaticCalculation();
    } else {
      setStatus(`${label} found (accuracy about ${Math.round(accuracy)} m). Confirm the pin, then Calculate.`);
    }
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
    if (document.getElementById('btn-calc').getAttribute('aria-busy') === 'true') return;
    const calculationId = ++activeCalculationId;
    setCalculationStage('fetch', forceFresh ? 'Refreshing map buildings…' : 'Getting nearby map buildings…');
    await nextPaint();
    const calcStarted = performance.now();
    const perf = { passes: [], buildings: 0 };
    document.getElementById('performance-report').hidden = true;
    state.dataCapHit = false;
    state.fromCache = false;
    state.proj = G.makeProjection(state.pin.lat, state.pin.lon);
    let bbox = bboxAround(state.pin, settings.fetchRadiusM);
    let iteration = 0;
    while (true) {
      setCalculationStage('fetch', `Getting map buildings${iteration ? ` (area pass ${iteration + 1})` : ''}…`);
      await nextPaint();
      const fetchStarted = performance.now();
      let fetched;
      try {
        fetched = await D.fetchBuildingsCached(bbox, { force: !!forceFresh });
        if (calculationId !== activeCalculationId) return;
      } catch (e) {
        setStatus('Map-data error: ' + e.message + ' — try again in a minute (public server rate limits).');
        finishCalculationProgress(false);
        return;
      }
      const fetchMs = performance.now() - fetchStarted;
      // Do not start an unexpectedly oversized expansion pass. Keep the last complete
      // analyzed pass and mark it as bounded instead of silently analyzing beyond the
      // configured safety limit (the old behavior reached 80k under a 60k cap).
      if (iteration > 0 && fetched.buildings.length > settings.maxBuildings) {
        state.dataCapHit = true;
        perf.passes.push({ pass: iteration + 1, buildings: fetched.buildings.length, fetchMs,
          prepMs: 0, engineMs: 0, engineStages: null, skippedAtDataCap: true });
        break;
      }
      state.rawBuildings = fetched.buildings;
      state.fetchedAt = fetched.fetchedAt;
      state.checkedAt = fetched.checkedAt;
      state.fromCache = fetched.fromCache;
      state.dataSource = fetched.source || (fetched.fromCache ? 'local-overture' : 'overture');
      state.dataRelease = fetched.release || state.dataRelease;
      state.correctionsApplied = fetched.correctionsApplied || 0;
      state.fetchBBox = bbox;
      const prepStarted = performance.now();
      prepareBuildings();
      // Snap before the expensive pipeline so its result already uses the actual
      // footprint. Snapping at the end forced a second metro-scale engine run.
      snapPinToFootprint();
      const prepMs = performance.now() - prepStarted;
      setCalculationStage('analyze', `Building the city from ${state.rawBuildings.length.toLocaleString()} footprints…`);
      await nextPaint();
      const engineStarted = performance.now();
      try {
        await recompute(true);
        if (calculationId !== activeCalculationId) return;
      } catch (error) {
        if (calculationId !== activeCalculationId) return;
        setStatus('Calculation error: ' + error.message);
        finishCalculationProgress(false);
        return;
      }
      const engineMs = performance.now() - engineStarted;
      perf.passes.push({ pass: iteration + 1, buildings: state.rawBuildings.length, fetchMs, prepMs, engineMs,
        engineStages: state.result && state.result.engineTimings ? state.result.engineTimings : null });
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
    setCalculationStage('draw', 'Drawing and labeling the boundaries…');
    await nextPaint();
    const renderStarted = performance.now();
    render(); // the final analysis pass already produced state.result
    perf.renderMs = performance.now() - renderStarted;
    perf.totalMs = performance.now() - calcStarted;
    perf.buildings = state.rawBuildings.length;
    state.performance = perf;
    renderPerformanceReport(perf);
    if (state.result && state.result.techumCorners) {
      const pts = state.result.techumCorners.map((p) => {
        const ll = state.proj.toLatLon(p.x, p.y);
        return [ll.lat, ll.lon];
      });
      map.fitBounds(L.latLngBounds(pts).pad(0.05));
    }
    const ageDays = state.fetchedAt ? ((Date.now() - Date.parse(state.fetchedAt)) / 86400000) : 0;
    const ageLabel = ageDays < 1 ? 'today' : ageDays.toFixed(0) + ' days old';
    const releaseLabel = state.dataRelease ? `Overture ${state.dataRelease}` : 'Overture';
    const cacheLabel = state.fromCache
      ? `${releaseLabel} data from cache (${ageLabel}).`
      : `Fresh ${releaseLabel} footprints.`;
    setStatus(`Done — ${state.rawBuildings.length} buildings analyzed. ` +
      (state.result && state.result.mode === 'city'
        ? 'Techum drawn from the squared city. ' : 'Point-shevisa techum drawn. ') +
      cacheLabel);
    finishCalculationProgress(true);
    track('calc', {
      q: state.lastQuery || null, label: state.lastLabel || null,
      pin: { lat: +state.pin.lat.toFixed(5), lon: +state.pin.lon.toFixed(5) },
      mode: state.result ? state.result.mode : null,
      buildings: state.rawBuildings.length,
      fromCache: !!state.fromCache, fresh: !!forceFresh,
      profile: S.effectiveProfile(settings),
      nonDefaults: S.diffFromDefaults(settings),
      ms: Math.round(perf.totalMs), performance: perf,
    });
    // Overture releases are immutable and named in every result. Updating the configured
    // release bumps the server tile-cache version; no user-facing staleness action is needed.
  }

  function renderPerformanceReport(perf) {
    const el = document.getElementById('performance-report');
    const totals = perf.passes.reduce((a, p) => ({ fetch: a.fetch + p.fetchMs, prep: a.prep + p.prepMs, engine: a.engine + p.engineMs }), { fetch: 0, prep: 0, engine: 0 });
    const parts = [['map-data wait', totals.fetch], ['footprint preparation', totals.prep], ['halachic engine', totals.engine], ['final draw', perf.renderMs || 0]].sort((a, b) => b[1] - a[1]);
    const reason = parts[0][1] > 1000 ? `Most time: ${parts[0][0]} (${(parts[0][1] / 1000).toFixed(1)}s).` : 'No slow stage detected.';
    const stageTotals = {};
    for (const pass of perf.passes) for (const [name, ms] of Object.entries(pass.engineStages || {})) {
      if (name !== 'total') stageTotals[name] = (stageTotals[name] || 0) + ms;
    }
    const slowEngineStages = Object.entries(stageTotals).sort((a, b) => b[1] - a[1]);
    const stageSummary = slowEngineStages.length
      ? ` Slowest engine stage: ${slowEngineStages[0][0]} (${(slowEngineStages[0][1] / 1000).toFixed(1)}s).`
      : '';
    el.innerHTML = `<strong>Calculation time: ${(perf.totalMs / 1000).toFixed(1)}s</strong><span>${escapeHtml(reason + stageSummary)} ${perf.passes.length} map pass(es), ${perf.buildings.toLocaleString()} footprints.</span><span class="performance-actions"><button type="button" id="btn-dismiss-performance" aria-label="Dismiss performance report">Dismiss</button></span>`;
    el.hidden = false;
    document.getElementById('btn-dismiss-performance').onclick = () => { el.hidden = true; };
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
    state.buildings = state.rawBuildings.concat(state.manualBuildings).map((raw) => {
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

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }

  function setCalculationStage(stage, message) {
    const progress = document.getElementById('calc-progress');
    const button = document.getElementById('btn-calc');
    const order = ['fetch', 'analyze', 'draw'];
    const active = order.indexOf(stage);
    progress.hidden = false;
    progress.setAttribute('aria-hidden', 'false');
    progress.querySelectorAll('[data-stage]').forEach((el, i) => {
      el.classList.toggle('done', i < active);
      el.classList.toggle('active', i === active);
    });
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.querySelector('.calc-label').textContent = stage === 'fetch'
      ? 'Getting map data' : stage === 'analyze' ? 'Building the city' : 'Drawing your tchum';
    setStatus(message);
  }

  function finishCalculationProgress(succeeded) {
    const progress = document.getElementById('calc-progress');
    const button = document.getElementById('btn-calc');
    progress.querySelectorAll('[data-stage]').forEach((el) => {
      el.classList.toggle('done', succeeded);
      el.classList.remove('active');
    });
    button.setAttribute('aria-busy', 'false');
    button.disabled = false;
    button.querySelector('.calc-label').textContent = succeeded ? 'Recalculate my techum' : 'Try calculating again';
    window.setTimeout(() => {
      progress.hidden = true;
      progress.setAttribute('aria-hidden', 'true');
    }, succeeded ? 1200 : 0);
  }

  function addDrawingVertex(latlng) {
    drawing.points.push({ lat: latlng.lat, lon: latlng.lng });
    if (drawing.layer) drawing.layer.remove();
    if (drawing.mode === 'rectangle' && drawing.points.length === 2) {
      const a = drawing.points[0], b = drawing.points[1];
      drawing.points = [a, { lat: a.lat, lon: b.lon }, b, { lat: b.lat, lon: a.lon }];
      drawing.layer = L.polygon(drawing.points.map((p) => [p.lat, p.lon]), {
        color: '#d43f8d', weight: 3, dashArray: '6 5', interactive: false,
      }).addTo(map);
      void finishDrawing();
      return;
    }
    drawing.layer = L.polyline(drawing.points.map((p) => [p.lat, p.lon]), {
      color: '#d43f8d', weight: 3, dashArray: '6 5', interactive: false,
    }).addTo(map);
    document.getElementById('btn-finish-building').disabled = drawing.points.length < 3;
    setStatus(drawing.mode === 'rectangle'
      ? 'Rectangle footprint: click the opposite roof corner.'
      : drawing.mode === 'enclosure'
        ? `Drawing validated enclosure: ${drawing.points.length} point(s). Click each corner, then Finish shape.`
        : `Drawing missing footprint: ${drawing.points.length} point(s). Click each corner, then Finish shape.`);
  }

  function startDrawing(mode = 'polygon') {
    if (!state.pin || !state.proj) { setStatus('Set an address and calculate before drawing on the map.'); return; }
    cancelMapMode(false);
    drawing = { points: [], layer: null, mode };
    map.doubleClickZoom.disable();
    const finish = document.getElementById('btn-finish-building'); finish.hidden = mode === 'rectangle'; finish.disabled = true;
    document.getElementById('btn-cancel-map-mode').hidden = false;
    document.body.classList.add('map-mode-active');
    setStatus(mode === 'rectangle'
      ? 'Rectangle footprint: click two opposite roof corners. Press Escape or Cancel to stop.'
      : mode === 'enclosure'
        ? 'Validated enclosure: click each perimeter corner, then Finish shape. It will stay inactive until explicitly enabled.'
        : 'Drawing mode: click each roof corner, then Finish shape. Press Escape or Cancel to stop.');
  }

  async function shareBuildingCorrection(correction) {
    try {
      const saved = await D.submitBuildingCorrection(correction);
      return saved.status === 'accepted'
        ? ' Shared correction is active for everyone.'
        : ' Sent for shared review; it is active in your current calculation.';
    } catch (error) {
      return ` Saved in this calculation; shared save failed (${error.message}).`;
    }
  }

  async function finishDrawing() {
    if (!drawing || drawing.points.length < 3) return;
    const ringLatLon = drawing.points.slice();
    const mode = drawing.mode;
    if (drawing.layer) drawing.layer.remove();
    drawing = null; map.doubleClickZoom.enable(); document.getElementById('btn-finish-building').hidden = true;
    document.getElementById('btn-cancel-map-mode').hidden = true; document.body.classList.remove('map-mode-active');
    if (mode === 'enclosure') {
      state.validatedPerimeter = ringLatLon;
      settings.useValidatedPerimeter = false;
      document.getElementById('use-perimeter').checked = false;
      S.save(settings);
      await recompute();
      setStatus('Validated enclosure stored but inactive. Enable it only after a rav confirms that this perimeter counts for techum.');
      return;
    }
    state.manualBuildings.push({ id: `manual-${Date.now()}-${state.manualBuildings.length + 1}`,
      tags: { building: 'yes', source: 'manual-review' }, ringLatLon });
    prepareBuildings(); await recompute();
    const shared = await shareBuildingCorrection({ decision: 'include', ringLatLon,
      note: 'User-drawn missing building footprint' });
    setStatus('Missing footprint added automatically.' + shared);
  }

  function cancelCalculation() {
    if (document.getElementById('btn-calc').getAttribute('aria-busy') !== 'true') return;
    activeCalculationId++;
    latestAnalysisId++;
    if (analysisWorker) { analysisWorker.terminate(); analysisWorker = null; }
    for (const reject of analysisPending.values()) reject(new Error('Calculation cancelled.'));
    analysisPending.clear();
    finishCalculationProgress(false);
    setStatus('Calculation cancelled. You can change the pin or settings and try again.');
  }

  function cancelMapMode(announce = true) {
    const hadMode = !!drawing || !!bowCapture;
    if (drawing && drawing.layer) drawing.layer.remove();
    drawing = null; bowCapture = null;
    if (map) map.doubleClickZoom.enable();
    const finish = document.getElementById('btn-finish-building');
    if (finish) { finish.hidden = true; finish.disabled = true; }
    const cancel = document.getElementById('btn-cancel-map-mode'); if (cancel) cancel.hidden = true;
    document.body.classList.remove('map-mode-active');
    if (announce && hadMode) setStatus('Map selection cancelled.');
  }

  function polygonsFromGeoJSON(value) {
    return K.parseGeoJSONFootprints(value);
  }

  function importBuildings(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!state.pin || !state.proj) throw new Error('set an address and calculate first');
        const polygons = polygonsFromGeoJSON(JSON.parse(reader.result));
        if (!polygons.length) throw new Error('no Polygon or MultiPolygon footprints found');
        const stamp = Date.now();
        polygons.forEach((ringLatLon, i) => state.manualBuildings.push({ id: `manual-import-${stamp}-${i + 1}`,
          tags: { building: 'yes', source: 'manual-geojson-review' }, ringLatLon }));
        prepareBuildings(); recompute();
        setStatus(`${polygons.length} manual footprint(s) imported and flagged for review.`);
      } catch (e) { setStatus('Building import failed: ' + e.message); }
    };
    reader.readAsText(file);
  }

  function importOverture(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!state.rawBuildings.length) throw new Error('calculate an address before comparing sources');
        const overture = D.parseOvertureGeoJSON(JSON.parse(reader.result));
        if (!overture.length) throw new Error('no valid Overture Polygon or MultiPolygon footprints found');
        state.overtureReport = D.compareBuildingSources(state.rawBuildings.concat(state.manualBuildings), overture);
        renderOvertureReport();
        setStatus(`Overture comparison complete: ${state.overtureReport.unmatchedOverture.length} unmatched review candidate(s). None were added automatically.`);
      } catch (e) { setStatus('Overture comparison failed: ' + e.message); }
    };
    reader.readAsText(file);
  }

  function renderOvertureReport() {
    const el = document.getElementById('overture-report'); layerGroups.overture.clearLayers(); el.replaceChildren();
    const report = state.overtureReport; if (!report) return;
    const summary = document.createElement('p'); summary.className = 'muted';
    summary.textContent = `${report.matchedOverture} matched; ${report.unmatchedOverture.length} unmatched candidates. Review each against imagery.`; el.appendChild(summary);
    report.unmatchedOverture.slice(0, 100).forEach((candidate) => {
      const row = document.createElement('div'); row.className = 'source-candidate';
      const label = document.createElement('span'); label.textContent = candidate.sourceId;
      const add = document.createElement('button'); add.type = 'button'; add.textContent = 'Add for review';
      const ignore = document.createElement('button'); ignore.type = 'button'; ignore.textContent = 'Ignore';
      const layer = L.polygon(candidate.ringLatLon.map((p) => [p.lat, p.lon]), { color: '#ff2da4', weight: 2, dashArray: '5 4', fillOpacity: 0.16 })
        .bindTooltip(`Overture-only candidate ${escapeHtml(candidate.sourceId)} — not in calculation`).addTo(layerGroups.overture);
      add.addEventListener('click', () => {
        state.manualBuildings.push({ id: `manual-${candidate.id}`, tags: { building: 'yes', source: 'overture-review', overture_id: candidate.sourceId }, ringLatLon: candidate.ringLatLon });
        layerGroups.overture.removeLayer(layer); row.remove(); prepareBuildings(); recompute();
        setStatus(`Overture candidate ${candidate.sourceId} added as an untagged manual footprint for explicit review.`);
      });
      ignore.addEventListener('click', () => { layerGroups.overture.removeLayer(layer); row.remove(); });
      row.append(label, add, ignore); el.appendChild(row);
    });
  }

  function importValidatedPerimeter(file) {
    const reader = new FileReader(); reader.onload = () => {
      try {
        const polygons = K.parseGeoJSONFootprints(JSON.parse(reader.result));
        if (polygons.length !== 1) throw new Error('provide exactly one Polygon/MultiPolygon outer perimeter');
        state.validatedPerimeter = polygons[0]; settings.useValidatedPerimeter = false; S.save(settings);
        document.getElementById('use-perimeter').checked = false;
        if (state.result) render();
        setStatus('Validated perimeter imported but inactive. Enable it only after confirming this exact perimeter and ruling with the rav.');
      } catch (e) { setStatus('Validated perimeter import failed: ' + e.message); }
    }; reader.readAsText(file);
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
  function projectedValidatedPerimeter() {
    return settings.useValidatedPerimeter && Array.isArray(state.validatedPerimeter)
      ? state.validatedPerimeter.map((p) => state.proj.toXY(p.lat, p.lon)) : null;
  }
  function workerSafeBuildings(buildings) {
    return buildings.map((b) => ({ id: b.id, ring: b.ring, bbox: b.bbox, included: b.included }));
  }

  function runPipelineAsync(buildings, geoSettings, pinXY) {
    if (typeof Worker === 'undefined' || buildings.length < 1500) {
      return Promise.resolve(G.runPipeline(buildings, geoSettings, pinXY));
    }
    if (!analysisWorker) analysisWorker = new Worker('js/analysis-worker.js');
    const id = ++analysisRequestId;
    return new Promise((resolve, reject) => {
      analysisPending.set(id, reject);
      const onMessage = (event) => {
        if (!event.data || event.data.id !== id) return;
        analysisPending.delete(id);
        analysisWorker.removeEventListener('message', onMessage);
        analysisWorker.removeEventListener('error', onError);
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data.result);
      };
      const onError = (event) => {
        analysisPending.delete(id);
        analysisWorker.removeEventListener('message', onMessage);
        analysisWorker.removeEventListener('error', onError);
        reject(new Error(event.message || 'The background analysis worker failed.'));
      };
      analysisWorker.addEventListener('message', onMessage);
      analysisWorker.addEventListener('error', onError);
      analysisWorker.postMessage({ id, buildings: workerSafeBuildings(buildings), settings: geoSettings, pin: pinXY });
    });
  }

  async function recompute(skipRender) {
    if (!state.buildings.length && !state.pin) return;
    const generation = ++latestAnalysisId;
    for (const b of state.buildings) b.included = isIncluded(b);
    const pinXY = state.proj.toXY(state.pin.lat, state.pin.lon);
    const geoSettings = {
      amahM: settings.amahCm / 100,
      karpef: settings.karpef,
      minCityHouses: settings.minCityHouses,
      overlapMerge: settings.overlapMerge,
      squaringAngleDeg: settings.squaringAngleDeg,
      pointRotationDeg: settings.pointRotationDeg,
      cityQualificationOverrides: settings.cityQualificationOverrides || {},
      concavityReviews: settings.concavityReviews || {},
      validatedCityPerimeter: projectedValidatedPerimeter(),
    };
    const result = await runPipelineAsync(state.buildings, geoSettings, pinXY);
    if (generation !== latestAnalysisId) return null;
    state.result = result;
    if (!skipRender) render();
    return result;
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

  // Drawing every footprint in a metro fetch can create tens of thousands of interactive
  // Leaflet paths and lock the browser. Geometry still uses the complete dataset; this
  // display layer is viewport-limited and refreshes after pan/zoom.
  function renderBuildings() {
    layerGroups.buildings.clearLayers();
    const res = state.result;
    if (!res || !document.getElementById('layer-buildings').checked || !state.proj) return;
    const bounds = map.getBounds().pad(0.2);
    const sw = state.proj.toXY(bounds.getSouth(), bounds.getWest());
    const ne = state.proj.toXY(bounds.getNorth(), bounds.getEast());
    const view = { minX: Math.min(sw.x, ne.x), minY: Math.min(sw.y, ne.y), maxX: Math.max(sw.x, ne.x), maxY: Math.max(sw.y, ne.y) };
    const homeMembers = res.mode === 'city' && res.homeCluster >= 0 && res.clusters[res.homeCluster]
      ? new Set(res.clusters[res.homeCluster].members) : new Set();
    state.buildings.forEach((b, i) => {
      if (b.bbox.maxX < view.minX || b.bbox.minX > view.maxX || b.bbox.maxY < view.minY || b.bbox.minY > view.maxY) return;
      const st = { ...(KLASS_STYLE[b.klass] || KLASS_STYLE.unknown) };
      const ov = state.overrides.get(b.id);
      let dash = null, weight = 1, fillOpacity = b.included ? 0.45 : 0.12, opacity = b.included ? 0.9 : 0.45;
      if (ov) { dash = '4 3'; weight = 2.5; st.color = ov === 'exclude' ? '#ff4136' : '#0074d9'; }
      const poly = L.polygon(b.ring.map((p) => { const ll = state.proj.toLatLon(p.x, p.y); return [ll.lat, ll.lon]; }), {
        color: st.color, weight, fillColor: st.fillColor, fillOpacity: homeMembers.has(i) ? Math.min(0.65, fillOpacity + 0.15) : fillOpacity,
        opacity, dashArray: dash, renderer: buildingRenderer,
      });
      b.mapLayer = poly;
      poly.bindTooltip(`<b>${escapeHtml(b.klass.toUpperCase())}</b> — ${escapeHtml(b.reason)}` +
        (ov ? `<br>manual correction: ${escapeHtml(ov)}` : '') + `<br><i>Optional: click to correct include/exclude</i>`, { sticky: true });
      poly.on('click', async () => {
        const cur = state.overrides.get(b.id);
        if (!cur) state.overrides.set(b.id, 'include');
        else if (cur === 'include') state.overrides.set(b.id, 'exclude');
        else state.overrides.delete(b.id);
        const decision = state.overrides.get(b.id);
        await recompute();
        if (!decision) { setStatus('Building returned to the automatic Overture decision.'); return; }
        const sourceRing = b.ring.map((point) => state.proj.toLatLon(point.x, point.y));
        const shared = await shareBuildingCorrection({ sourceId: b.id, decision, sourceRing,
          note: 'Optional map correction from building click' });
        setStatus(`Building marked ${decision === 'include' ? 'included' : 'excluded'}.` + shared);
      });
      poly.addTo(layerGroups.buildings);
    });
  }

  function invalidateCalculationForMovedPin() {
    state.result = null;
    state.snapInfo = null;
    document.body.classList.remove('has-result');
    layerGroups.rects.clearLayers(); layerGroups.second.clearLayers(); layerGroups.settlements.clearLayers();
    layerGroups.audit.clearLayers(); layerGroups.perimeter.clearLayers();
    document.getElementById('results').replaceChildren();
    document.getElementById('confidence').hidden = true;
    document.getElementById('review-queue').hidden = true;
    setStatus('Pin moved. Calculate again to fetch the correct surrounding buildings; the previous boundary was cleared.');
  }

  function render() {
    document.body.classList.add('has-result');
    layerGroups.rects.clearLayers();
    layerGroups.second.clearLayers();
    layerGroups.settlements.clearLayers();
    layerGroups.perimeter.clearLayers();
    const res = state.result;
    if (!res) return;

    renderBuildings();

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
    // This optional data-quality scenario is another complete pipeline. On a metro
    // fetch it can monopolize the main thread for minutes, so keep the primary result
    // responsive and omit the comparison at large scale.
    const canRenderVerifiedScenario = state.buildings.length <= 10000;
    if (settings.showVerifiedOnly && res.mode === 'city' && canRenderVerifiedScenario) {
      const verifiedB = state.buildings.map((b) => ({ ...b, included: isVerifiedIncluded(b) }));
      if (verifiedB.some((b) => b.included)) {
        const resV = G.runPipeline(verifiedB, {
          amahM: settings.amahCm / 100, karpef: settings.karpef,
          minCityHouses: settings.minCityHouses, overlapMerge: settings.overlapMerge,
          squaringAngleDeg: settings.squaringAngleDeg,
          pointRotationDeg: settings.pointRotationDeg,
          cityQualificationOverrides: settings.cityQualificationOverrides || {}, concavityReviews: settings.concavityReviews || {},
          validatedCityPerimeter: projectedValidatedPerimeter(),
        }, state.proj.toXY(state.pin.lat, state.pin.lon));
        if (resV.techumCorners)
          addRect(resV.techumCorners, { color: '#ffb300', weight: 2.5, dashArray: '8 6', fill: false },
            'Scenario: verified dwellings only (' + (resV.mode === 'point' ? 'point shevisa!' : 'city') + ') — data-uncertainty bracket, not a psak', layerGroups.second);
      }
    }

    // comparison shita line (full second pipeline run — thresholds change with the amah)
    if (settings.secondAmahCm && settings.secondAmahCm !== settings.amahCm && state.buildings.length <= 10000) {
      const res2 = G.runPipeline(state.buildings, {
        amahM: settings.secondAmahCm / 100, karpef: settings.karpef,
        minCityHouses: settings.minCityHouses, overlapMerge: settings.overlapMerge,
        squaringAngleDeg: settings.squaringAngleDeg,
        pointRotationDeg: settings.pointRotationDeg,
        cityQualificationOverrides: settings.cityQualificationOverrides || {}, concavityReviews: settings.concavityReviews || {},
        validatedCityPerimeter: projectedValidatedPerimeter(),
      }, state.proj.toXY(state.pin.lat, state.pin.lon));
      addRect(res2.techumCorners, { color: '#e040fb', weight: 2.5, dashArray: '10 6', fill: false },
        'Comparison: techum @ ' + (settings.secondAmahCm / 2.54).toFixed(2) + ' in amah', layerGroups.second);
    }

    renderAuditRings();
    renderAuditGuide();
    renderPanel();
    renderReviewQueue();
  }

  function closestPointOnRing(point, ring) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b.x - a.x, dy = b.y - a.y, den = dx * dx + dy * dy;
      const t = den ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / den)) : 0;
      const q = { x: a.x + t * dx, y: a.y + t * dy };
      const d = Math.hypot(point.x - q.x, point.y - q.y);
      if (d < bestD) { bestD = d; best = q; }
    }
    return { point: best, distanceM: bestD };
  }

  function snapPinToFootprint() {
    if (!state.pin || !state.buildings.length) return;
    const original = { ...state.pin };
    const p = state.proj.toXY(original.lat, original.lon);
    let best = null;
    state.buildings.forEach((b) => {
      if (b.klass === 'non') return;
      const inside = G._internals.pointInRing(p, b.ring);
      const near = inside ? { point: p, distanceM: 0 } : closestPointOnRing(p, b.ring);
      if (!best || near.distanceM < best.distanceM) best = { ...near, building: b };
    });
    if (!best || best.distanceM > 75) {
      state.snapInfo = { snapped: false, reason: 'No plausible footprint within 75 m', distanceM: best ? best.distanceM : null };
      return;
    }
    if (best.distanceM > 0.5) {
      const ll = state.proj.toLatLon(best.point.x, best.point.y);
      state.pin = { lat: ll.lat, lon: ll.lon };
      pinMarker.setLatLng([ll.lat, ll.lon]);
    }
    state.snapInfo = { snapped: best.distanceM > 0.5, distanceM: best.distanceM, buildingId: best.building.id,
      klass: best.building.klass, reason: best.building.reason, original };
  }

  function renderAuditGuide() {
    const guide = document.getElementById('audit-guide');
    const summary = document.getElementById('audit-summary');
    const res = state.result;
    guide.hidden = !settings.showAuditRings;
    layerGroups.settlements.clearLayers();
    if (!settings.showAuditRings || !res) return;

    // Draw the final post-merge settlements. City-status decisions, however, must
    // be attached to the pre-merge qualification components used by the engine.
    const settlementClusters = res.clusters;
    const qualificationClusters = res.qualificationClusters || res.reviewClusters || res.clusters;
    const visibleSettlements = settlementClusters.filter((cluster) => cluster.qualifiesAsCity ||
      cluster.members.length >= Math.max(1, settings.minCityHouses - 2) ||
      settlementClusters[res.homeCluster] === cluster);
    visibleSettlements.slice(0, 40).forEach((cluster) => {
      const index = settlementClusters.indexOf(cluster);
      const isHome = index === res.homeCluster;
      const color = isHome ? '#00e676' : `hsl(${(index * 137.508) % 360}, 75%, 48%)`;
      const label = `Settlement #${index + 1}: ${cluster.members.length} included structure${cluster.members.length === 1 ? '' : 's'}` +
        (isHome ? '<br><b>This is the selected home city.</b>' : '') +
        `<br>Dashed box is its derived outer rectangle after 70⅔-amah chaining and settlement merges.`;
      L.polygon(cornersToLatLngs(cluster.corners), {
        color, weight: isHome ? 3 : 1.5, dashArray: isHome ? '10 5' : '6 6',
        fill: true, fillColor: color, fillOpacity: isHome ? 0.055 : 0.018,
      }).bindTooltip(label, { sticky: true }).addTo(layerGroups.settlements);

      const center = cluster.corners.reduce((p, c) => ({ x: p.x + c.x / 4, y: p.y + c.y / 4 }), { x: 0, y: 0 });
      const ll = state.proj.toLatLon(center.x, center.y);
      L.marker([ll.lat, ll.lon], {
        interactive: false,
        icon: L.divIcon({ className: 'cluster-label', html: `<span>${isHome ? 'HOME · ' : ''}#${index + 1} · ${cluster.members.length}</span>` }),
      }).addTo(layerGroups.settlements);
    });
    const home = res.homeCluster >= 0 ? res.clusters[res.homeCluster] : null;
    summary.textContent = `${res.clusters.length} settlement${res.clusters.length === 1 ? '' : 's'} derived; ` +
      (home ? `home is #${res.homeCluster + 1} with ${home.members.length} included structures. ` : 'the pin did not join a settlement. ') +
      `70⅔ amos = ${res.thresholds.joinM.toFixed(1)} m; 141⅓ amos = ${res.thresholds.t2.toFixed(1)} m.`;
    const review = document.getElementById('cluster-review');
    review.replaceChildren();
    const title = document.createElement('b'); title.textContent = 'Pre-merge city-status components'; review.appendChild(title);
    qualificationClusters.forEach((cluster, index) => {
      const row = document.createElement('label');
      const text = document.createElement('span');
      text.innerHTML = `Component #${index + 1} · ${cluster.members.length} structures<small>${cluster.qualifiesAsCity ? 'qualifies' : 'does not qualify'} via ${escapeHtml(cluster.qualificationSource)}</small>`;
      const select = document.createElement('select'); select.setAttribute('aria-label', `Pre-merge component ${index + 1} city status`);
      [['','Use footprint-count proxy'],['true','Rav/reviewer: qualifies'],['false','Rav/reviewer: does not qualify']].forEach(([value, label]) => {
        const option = document.createElement('option'); option.value = value; option.textContent = label; select.appendChild(option);
      });
      const saved = (settings.cityQualificationOverrides || {})[cluster.key];
      const savedDecision = typeof saved === 'boolean' ? saved : saved && saved.decision;
      select.value = typeof savedDecision === 'boolean' ? String(savedDecision) : (cluster.qualificationSource === 'reviewer-remapped' ? String(cluster.qualifiesAsCity) : '');
      select.addEventListener('change', () => {
        settings.cityQualificationOverrides = { ...(settings.cityQualificationOverrides || {}) };
        if (select.value === '') delete settings.cityQualificationOverrides[cluster.key];
        else settings.cityQualificationOverrides[cluster.key] = { decision: select.value === 'true', memberIds: cluster.memberIds || [] };
        S.save(settings); recompute();
      });
      row.append(text, select); review.appendChild(row);
    });
    const omitted = settlementClusters.length - Math.min(40, visibleSettlements.length);
    if (omitted > 0) {
      const note = document.createElement('small'); note.className = 'muted';
      note.textContent = `${omitted} additional small, non-qualifying settlements are not drawn on the map.`; review.appendChild(note);
    }
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
    const summary = document.getElementById('audit-summary');
    if (summary && skipped) summary.textContent = `Showing ${shown} of ${shown + skipped} buildings in view — zoom in to audit the rest.`;
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
    if (state.snapInfo) {
      if (state.snapInfo.snapped) lines.push(`<div class="note"><b>Pin snapped to mapped footprint</b> — moved ${state.snapInfo.distanceM.toFixed(1)} m to ${escapeHtml(state.snapInfo.klass)} (${escapeHtml(state.snapInfo.reason)}). Confirm the marker against the imagery; drag it to correct.</div>`);
      else lines.push(`<div class="note"><b>Pin check:</b> ${escapeHtml(state.snapInfo.reason || 'Already on a mapped footprint')}. Confirm against imagery.</div>`);
    }
    lines.push(`<div class="stat"><b>Mode:</b> ${res.mode === 'city' ? 'city (whole city = 4 amos)' : 'open field (point shevisa)'}</div>`);
    if (res.mode === 'city' && res.squaring) {
      const angleText = `${Math.abs(res.squaring.angleDeg || 0).toFixed(1)}°`;
      const squareText = res.squaring.method === 'preserved-rectangle'
        ? `existing rectangular direction preserved (${angleText}; SA/MB 398:1)`
        : res.squaring.method === 'reviewer-angle'
          ? `reviewer-set direction (${angleText})`
          : 'irregular city squared to the world directions (SA 398:2–3)';
      lines.push(`<div class="stat"><b>City squaring:</b> ${squareText}</div>`);
    }
    lines.push(`<div class="stat"><b>Buildings fetched:</b> ${state.buildings.length} — ` +
      `<span class="sw dw"></span>${counts.dwelling} identified dwelling, <span class="sw un"></span>${counts.unknown} use-unknown, ` +
      `<span class="sw rv"></span>${counts.review} optional-review, <span class="sw no"></span>${counts.non} non-dwelling</div>`);
    if (settings.showVerifiedOnly && state.buildings.length > 10000) {
      lines.push('<div class="note"><b>Verified-dwellings comparison omitted:</b> this optional second scenario is disabled above 10,000 footprints to keep large-city calculations responsive. The primary techum still uses the complete fetched dataset.</div>');
    }
    if (settings.secondAmahCm && settings.secondAmahCm !== settings.amahCm && state.buildings.length > 10000) {
      lines.push('<div class="note"><b>Comparison-amah line omitted:</b> this optional second full-city scenario is disabled above 10,000 footprints. Change the primary amah and recalculate to evaluate that shita on a large city.</div>');
    }
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
    el.innerHTML = lines.join('');
    renderConfidence(counts);
  }

  function renderConfidence(counts) {
    const el = document.getElementById('confidence');
    const report = D.computeDataConfidence(state.buildings);
    const uncertain = report.needsReview;
    const level = state.dataCapHit ? 'poor' : 'good';
    const label = state.dataCapHit ? 'Building fetch incomplete' : 'Automatic building map ready';
    el.className = `confidence ${level}`;
    el.innerHTML = `<b>${label}</b><span>${state.buildings.length.toLocaleString()} Overture footprints loaded. ` +
      `${uncertain.toLocaleString()} structures have unknown or ambiguous use and are included automatically; review is optional.${state.dataCapHit ? ' Fetch boundary is incomplete.' : ''}</span>`;
    el.hidden = false;
  }

  function renderReviewQueue() {
    const el = document.getElementById('review-queue');
    if (!settings.showAuditRings) { el.hidden = true; el.replaceChildren(); return; }
    const items = state.buildings.filter((b) => b.klass === 'unknown' || b.klass === 'review');
    const bows = (state.result && state.result.concavityAudit) || [];
    if (!items.length && !bows.length) { el.hidden = true; el.replaceChildren(); return; }
    const head = document.createElement('div'); head.className = 'review-title';
    head.innerHTML = `<b>Review queue</b><span>${items.length} ambiguous or untagged structures · select one to inspect</span>`;
    const list = document.createElement('div'); list.className = 'review-list';
    bows.forEach((audit) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'bow-review';
      button.innerHTML = `<span>⌁</span><b>Bow / concavity</b><small>${audit.reviewerEndpoints ? 'Endpoints recorded; not applied to boundary' : 'Select two endpoints for the rav'}</small>`;
      button.addEventListener('click', () => recordConcavityEndpoints(audit.reviewKey)); list.appendChild(button);
    });
    items.slice(0, 100).forEach((b) => {
      const button = document.createElement('button'); button.type = 'button';
      button.innerHTML = `<span class="sw ${b.klass === 'unknown' ? 'un' : 'rv'}"></span><b>${escapeHtml(b.klass)}</b><small>${escapeHtml(b.reason)}</small>`;
      button.addEventListener('click', () => {
        const sw = state.proj.toLatLon(b.bbox.minX, b.bbox.minY), ne = state.proj.toLatLon(b.bbox.maxX, b.bbox.maxY);
        map.fitBounds([[sw.lat, sw.lon], [ne.lat, ne.lon]], { maxZoom: 20, padding: [40, 40] });
        if (b.mapLayer) b.mapLayer.openTooltip();
      });
      list.appendChild(button);
    });
    if (items.length > 100) {
      const more = document.createElement('small'); more.className = 'muted';
      more.textContent = `Showing the first 100 of ${items.length}; use the map to inspect the rest.`; list.appendChild(more);
    }
    el.replaceChildren(head, list); el.hidden = false;
  }

  function recordConcavityEndpoints(reviewKey) {
    cancelMapMode(false);
    bowCapture = { reviewKey, points: [] };
    document.getElementById('btn-cancel-map-mode').hidden = false;
    document.body.classList.add('map-mode-active');
    setStatus('Bow review mode: click the first endpoint. Press Escape or Cancel to stop. Points are recorded for the rav and do not alter the boundary.');
  }
  function addBowEndpoint(latlng) {
    bowCapture.points.push(state.proj.toXY(latlng.lat, latlng.lng));
    if (bowCapture.points.length < 2) { setStatus('Bow review mode: click the second endpoint, or press Escape to cancel.'); return; }
    const capture = bowCapture;
    settings.concavityReviews = { ...(settings.concavityReviews || {}) };
    settings.concavityReviews[capture.reviewKey] = { endpoints: capture.points };
    cancelMapMode(false); S.save(settings); recompute();
    setStatus('Bow endpoints recorded for rav review. They have NOT changed the calculated boundary.');
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
    const sq = state.result && state.result.squaring;
    const squaringAudit = sq
      ? `${sq.method} @ ${(sq.angleDeg || 0).toFixed(2)}°${sq.rectangularity == null ? '' : `; rectangularity ${(sq.rectangularity * 100).toFixed(1)}%`}${sq.reviewRequired ? '; REQUIRES REVIEW' : ''}`
      : (settings.squaringAngleDeg ? `reviewer angle @ ${settings.squaringAngleDeg}°` : 'automatic');
    return [
      '== Psak configuration ==',
      `Profile: ${eff === 'custom' ? 'CUSTOM' : S.PROFILES[settings.profile].label}`,
      `Amah: ${settings.amahCm} cm (2000 amos = ${(20 * settings.amahCm).toFixed(0)} m)`,
      `Single-city karpef: ${settings.karpef ? 'ON (Rema / MB 398:36)' : 'OFF (Mechaber)'}`,
      `Squaring orientation: ${squaringAudit}`,
      `Overlapping-rectangles merge: ${settings.overlapMerge ? 'ON (Chazon Ish)' : 'OFF (strict)'}`,
      `City minimum: ${settings.minCityHouses} footprints (MB 398:38 — COUNT-BASED APPROXIMATION of the 3-chatzeros model; courtyard structure not modeled)`,
      `Min dwelling size 4x4 amos filter: ${settings.minSizeFilter ? 'on' : 'off'}`,
      `Untagged buildings: ${settings.includeUnknown ? 'included (flagged)' : 'excluded'}; ambiguous: ${settings.includeReview ? 'included (flagged)' : 'excluded'}`,
      '== Audit / reproducibility ==',
      `Engine version: ${ENGINE_VERSION} (deterministic: same data + same settings = same output)`,
      `Building data: Overture ${state.dataRelease || 'release unknown'}, fetched ${state.fetchedAt || 'n/a'}; extent S${bb ? bb.south.toFixed(5) : '?'} W${bb ? bb.west.toFixed(5) : '?'} N${bb ? bb.north.toFixed(5) : '?'} E${bb ? bb.east.toFixed(5) : '?'}`,
      `Buildings: ${state.buildings.length} (${counts.dwelling} dwelling / ${counts.unknown} untagged / ${counts.review} ambiguous / ${counts.non} non)`,
      `Manual missing-building footprints: ${state.manualBuildings.length} (reviewer supplied)`,
      `Accepted shared corrections applied: ${state.correctionsApplied || 0}`,
      `Rav-validated enclosure perimeter: ${state.validatedPerimeter ? (settings.useValidatedPerimeter ? 'ACTIVE as city edge' : 'stored but inactive') : 'none'}`,
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
  // The engine is pure; the only thing that changes between runs is map-release data. A snapshot
  // freezes the fetched buildings + pin + settings + overrides so the identical result is
  // reproducible forever (and shareable) without refetching.
  function saveSnapshot() {
    if (!state.rawBuildings.length) { setStatus('Calculate a techum before saving a snapshot.'); return; }
    const snap = {
      format: 'techum-snapshot', version: ENGINE_VERSION,
      pin: state.pin, fetchedAt: state.fetchedAt, fetchBBox: state.fetchBBox,
      dataRelease: state.dataRelease, dataSource: state.dataSource,
      dataCapHit: state.dataCapHit,
      settings, overrides: [...state.overrides.entries()],
      rawBuildings: state.rawBuildings, manualBuildings: state.manualBuildings,
      validatedPerimeter: state.validatedPerimeter,
    };
    K.download('techum-snapshot.json', JSON.stringify(snap), 'application/json');
    track('snapshot', { action: 'save' });
  }
  function loadSnapshot(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const snap = JSON.parse(reader.result);
        applySnapshot(snap);
      } catch (e) { setStatus('Snapshot load failed: ' + e.message); }
    };
    reader.readAsText(file);
  }

  function applySnapshot(snap, registryEntry) {
    if (!snap || snap.format !== 'techum-snapshot' || !snap.pin || !Array.isArray(snap.rawBuildings)) throw new Error('not a techum snapshot');
    state.pin = snap.pin; state.fetchedAt = snap.fetchedAt; state.fetchBBox = snap.fetchBBox;
    state.dataRelease = snap.dataRelease || null; state.dataSource = snap.dataSource || 'snapshot';
    state.dataCapHit = !!snap.dataCapHit; state.rawBuildings = snap.rawBuildings;
    state.manualBuildings = snap.manualBuildings || []; state.overrides = new Map(snap.overrides || []);
    state.validatedPerimeter = snap.validatedPerimeter || null;
    settings = { ...S.DEFAULTS, ...snap.settings }; S.save(settings);
    state.proj = G.makeProjection(state.pin.lat, state.pin.lon); setPin(state.pin.lat, state.pin.lon);
    map.setView([state.pin.lat, state.pin.lon], 15); prepareBuildings(); recompute();
    const review = registryEntry && registryEntry.review;
    setStatus(registryEntry
      ? `Reviewed snapshot loaded: ${registryEntry.cityLabel}, reviewed by ${review.reviewerName} on ${review.reviewedAt}${review.conditions ? ' — conditions: ' + review.conditions : ''}.`
      : `Snapshot loaded — ${state.rawBuildings.length} buildings (data from ${snap.fetchedAt}). Deterministic replay.`);
    track('snapshot', { action: registryEntry ? 'registry-load' : 'load' });
  }

  async function browseRegistry() {
    const el = document.getElementById('registry-list'); el.textContent = 'Loading reviewed cities…';
    try {
      const response = await fetch('/api/registry'); if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json(); el.replaceChildren();
      if (!data.entries || !data.entries.length) { el.textContent = 'No published reviewed snapshots yet.'; return; }
      data.entries.forEach((entry) => {
        const row = document.createElement('div'); row.className = 'registry-entry';
        const info = document.createElement('span'); info.innerHTML = `<b>${escapeHtml(entry.cityLabel)}</b><small>${escapeHtml(entry.review.reviewerName)} · ${escapeHtml(entry.review.reviewedAt)} · revision ${entry.revision}</small>`;
        const load = document.createElement('button'); load.type = 'button'; load.textContent = 'Load reviewed map';
        load.addEventListener('click', async () => {
          if (!confirm(`Replace the current calculation with the published reviewed snapshot for ${entry.cityLabel}?`)) return;
          const detail = await fetch(`/api/registry/${encodeURIComponent(entry.slug)}`); if (!detail.ok) { setStatus(`Registry load failed: HTTP ${detail.status}`); return; }
          const full = await detail.json(); try { applySnapshot(full.snapshot, full); } catch (e) { setStatus('Registry snapshot invalid: ' + e.message); }
        });
        row.append(info, load); el.appendChild(row);
      });
    } catch (e) { el.textContent = 'Reviewed library unavailable: ' + e.message; }
  }

  function exportKML() {
    const res = state.result;
    if (!res) { setStatus('Calculate a techum before exporting KML.'); return; }
    const toPath = (corners) => corners && cornersToLatLngs(corners).map(([lat, lon]) => ({ lat, lon }));
    let second = null;
    if (settings.secondAmahCm && settings.secondAmahCm !== settings.amahCm) {
      const res2 = G.runPipeline(state.buildings, {
        amahM: settings.secondAmahCm / 100, karpef: settings.karpef,
        minCityHouses: settings.minCityHouses, overlapMerge: settings.overlapMerge,
        squaringAngleDeg: settings.squaringAngleDeg,
        cityQualificationOverrides: settings.cityQualificationOverrides || {}, concavityReviews: settings.concavityReviews || {},
        validatedCityPerimeter: projectedValidatedPerimeter(),
      }, state.proj.toXY(state.pin.lat, state.pin.lon));
      second = toPath(res2.techumCorners);
    }
    const kml = K.buildKML({
      pin: state.pin,
      techum: toPath(res.techumCorners),
      city: toPath(res.cityCorners),
      karpef: toPath(res.karpefCorners),
      second,
      ...exportAuditLayers(res, toPath),
    }, configText());
    K.download('techum-draft.kml', kml);
    track('export', { format: 'kml' });
  }

  function exportGeoJSON() {
    const res = state.result;
    if (!res) { setStatus('Calculate a techum before exporting GeoJSON.'); return; }
    if (state.validatedPerimeter) {
      L.polygon(state.validatedPerimeter.map((p) => [p.lat, p.lon]), {
        color: res.validatedPerimeterActive ? '#00ffff' : '#7a7f7d', weight: 3,
        dashArray: res.validatedPerimeterActive ? '10 4' : '4 6', fill: false,
      }).bindTooltip(res.validatedPerimeterActive ? 'ACTIVE rav-validated city perimeter' : 'Stored validated perimeter (inactive)')
        .addTo(layerGroups.perimeter);
    }
    const toPath = (corners) => corners && cornersToLatLngs(corners).map(([lat, lon]) => ({ lat, lon }));
    const fc = K.buildGeoJSON({
      pin: state.pin, techum: toPath(res.techumCorners), city: toPath(res.cityCorners), karpef: toPath(res.karpefCorners),
      ...exportAuditLayers(res, toPath),
    }, { config: configText(), dataConfidence: D.computeDataConfidence(state.buildings) });
    K.download('techum-draft.geojson', JSON.stringify(fc, null, 2), 'application/geo+json');
    track('export', { format: 'geojson' });
  }

  function exportKMZ() {
    const res = state.result;
    if (!res) { setStatus('Calculate a techum before exporting KMZ.'); return; }
    const toPath = (corners) => corners && cornersToLatLngs(corners).map(([lat, lon]) => ({ lat, lon }));
    const kml = K.buildKML({
      pin: state.pin, techum: toPath(res.techumCorners), city: toPath(res.cityCorners),
      karpef: toPath(res.karpefCorners), ...exportAuditLayers(res, toPath),
    }, configText());
    downloadBlob('techum-draft.kmz', new Blob([K.buildKMZ(kml)], { type: 'application/vnd.google-earth.kmz' }));
    track('export', { format: 'kmz' });
    setStatus('KMZ exported for Google Earth review.');
  }

  function exportAuditLayers(res, toPath) {
    const buildings = state.buildings.map((b) => b.ring.map((p) => {
      const ll = state.proj.toLatLon(p.x, p.y); return { lat: ll.lat, lon: ll.lon };
    }));
    const settlements = res.clusters.map((c) => toPath(c.corners));
    const auditLines = (res.concavityAudit || []).filter((a) => a.reviewerEndpoints).map((a) => ({
      name: `Recorded bow endpoints (${a.reviewKey})`, kind: 'threshold',
      description: 'Recorded for rav review; not applied to the calculated boundary.',
      path: a.reviewerEndpoints.map((p) => { const ll = state.proj.toLatLon(p.x, p.y); return { lat: ll.lat, lon: ll.lon }; }),
    }));
    return { buildings, settlements, auditLines };
  }

  async function captureMapCanvas() {
    if (!state.result) throw new Error('Calculate a techum first.');
    if (!window.html2canvas) throw new Error('Image exporter did not load. Check the internet connection and reload.');
    map.invalidateSize();
    return window.html2canvas(document.getElementById('map'), {
      useCORS: true, allowTaint: false, backgroundColor: '#eef1ef',
      scale: Math.min(1.5, window.devicePixelRatio || 1.25), logging: false, imageTimeout: 5000,
    });
  }

  function downloadBlob(filename, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function exportPNG() {
    setStatus('Rendering the visible map as a PNG image…');
    try {
      const canvas = await captureMapCanvas();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Browser could not encode the map image.');
      downloadBlob('techum-review-map.png', blob); track('export', { format: 'png' });
      setStatus('PNG exported — it shows the current map view and visible audit layers.');
    } catch (e) { setStatus('PNG export failed: ' + e.message); }
  }

  async function exportPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) { setStatus('PDF exporter did not load. Check the internet connection and reload.'); return; }
    setStatus('Rendering a print-ready PDF review sheet…');
    try {
      const canvas = await captureMapCanvas();
      const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter', compress: true });
      const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
      const margin = 10, usableW = pageW - 2 * margin;
      pdf.setTextColor(23, 32, 29); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18);
      pdf.text('Techum Shabbos review map', margin, 13);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(122, 31, 31);
      pdf.text('DRAFT decision-support only - not a psak. Review with a rav/mumcheh.', margin, 19);
      pdf.setTextColor(70, 80, 76); pdf.text(String(state.lastLabel || 'Selected map point'), margin, 24, { maxWidth: usableW });
      const imageData = canvas.toDataURL('image/jpeg', 0.94);
      const maxH = pageH - 38, ratio = canvas.width / canvas.height;
      let imageW = usableW, imageH = imageW / ratio;
      if (imageH > maxH) { imageH = maxH; imageW = imageH * ratio; }
      pdf.addImage(imageData, 'JPEG', margin + (usableW - imageW) / 2, 29, imageW, imageH, undefined, 'FAST');

      const confidence = D.computeDataConfidence(state.buildings);
      const report = 'CALCULATION SUMMARY\n' + document.getElementById('results').innerText +
        `\n\nMAP-DATA REVIEW\n${confidence.needsReview} of ${confidence.total} fetched footprints need classification review. ` +
        'This does not measure whether every real building is mapped.\n\nACTIVE CONFIGURATION AND AUDIT RECORD\n' + configText();
      const pdfSafeReport = report
        .replace(/⅔/g, '2/3').replace(/⅓/g, '1/3').replace(/×/g, 'x')
        .replace(/[—–]/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/·/g, '-')
        .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...')
        .normalize('NFKD').replace(/[^\x20-\x7E\n]/g, '');
      const lines = pdfSafeReport.split('\n').flatMap((line) =>
        line ? pdf.splitTextToSize(line, usableW - 40) : ['']);
      pdf.addPage('letter', 'landscape'); pdf.setTextColor(23, 32, 29); pdf.setFont('courier', 'normal'); pdf.setFontSize(8.5);
      let y = 12;
      for (const line of lines) {
        if (y > pageH - 10) { pdf.addPage('letter', 'landscape'); y = 12; }
        pdf.text(line, margin, y); y += 4;
      }
      const pages = pdf.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        pdf.setPage(i); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(100);
        pdf.text(`Page ${i} of ${pages} - generated ${new Date().toISOString()}`, pageW - margin, pageH - 4, { align: 'right' });
      }
      pdf.save('techum-review.pdf'); track('export', { format: 'pdf' });
      setStatus('PDF exported — it includes the map, warnings, confidence limits, and active configuration.');
    } catch (e) {
      setStatus('PDF export failed: ' + e.message);
    }
  }

  // ---------------- settings UI ----------------
  function bindSettings() {
    const $ = (id) => document.getElementById(id);
    const refreshInputs = () => {
      $('profile').value = S.effectiveProfile(settings) === 'custom' ? 'custom' : settings.profile;
      $('profile-explanation').innerHTML = PROFILE_EXPLANATIONS[S.effectiveProfile(settings)] || PROFILE_EXPLANATIONS.custom;
      $('amah').value = String(settings.amahCm);
      $('karpef').checked = settings.karpef;
      $('sq-angle').value = settings.squaringAngleDeg;
      $('point-angle').value = settings.pointRotationDeg;
      $('overlap').checked = settings.overlapMerge;
      $('inc-unknown').checked = settings.includeUnknown;
      $('inc-review').checked = settings.includeReview;
      $('min-size').checked = settings.minSizeFilter;
      $('verified-only').checked = settings.showVerifiedOnly;
      $('second-amah').value = String(settings.secondAmahCm || 0);
      $('show-12mil').checked = settings.show12mil;
      $('audit-rings').checked = settings.showAuditRings;
      $('fetch-radius').value = settings.fetchRadiusM;
      $('max-buildings').value = settings.maxBuildings;
      $('use-perimeter').checked = !!settings.useValidatedPerimeter;
    };
    const onChange = () => { S.save(settings); if (state.rawBuildings.length) recompute(); };

    $('profile').addEventListener('change', (e) => {
      if (e.target.value !== 'custom') settings = S.applyProfile(settings, e.target.value);
      refreshInputs(); onChange();
    });
    $('amah').addEventListener('change', (e) => { settings.amahCm = parseFloat(e.target.value); refreshInputs(); onChange(); });
    $('karpef').addEventListener('change', (e) => { settings.karpef = e.target.checked; refreshInputs(); onChange(); });
    $('sq-angle').addEventListener('change', (e) => { settings.squaringAngleDeg = parseFloat(e.target.value) || 0; refreshInputs(); onChange(); });
    $('point-angle').addEventListener('change', (e) => { settings.pointRotationDeg = parseFloat(e.target.value) || 0; refreshInputs(); onChange(); });
    $('overlap').addEventListener('change', (e) => { settings.overlapMerge = e.target.checked; refreshInputs(); onChange(); });
    $('inc-unknown').addEventListener('change', (e) => { settings.includeUnknown = e.target.checked; onChange(); });
    $('inc-review').addEventListener('change', (e) => { settings.includeReview = e.target.checked; onChange(); });
    $('min-size').addEventListener('change', (e) => { settings.minSizeFilter = e.target.checked; onChange(); });
    $('verified-only').addEventListener('change', (e) => { settings.showVerifiedOnly = e.target.checked; onChange(); });
    $('second-amah').addEventListener('change', (e) => { settings.secondAmahCm = parseFloat(e.target.value) || 0; onChange(); });
    $('show-12mil').addEventListener('change', (e) => { settings.show12mil = e.target.checked; onChange(); });
    $('audit-rings').addEventListener('change', (e) => {
      settings.showAuditRings = e.target.checked; S.save(settings);
      if (state.result) { renderAuditRings(); renderAuditGuide(); }
    });
    $('fetch-radius').addEventListener('change', (e) => { settings.fetchRadiusM = Math.max(300, parseInt(e.target.value, 10) || 1200); S.save(settings); });
    $('max-buildings').addEventListener('change', (e) => { settings.maxBuildings = Math.max(1000, parseInt(e.target.value, 10) || 30000); S.save(settings); });
    $('use-perimeter').addEventListener('change', (e) => {
      if (e.target.checked && !state.validatedPerimeter) { e.target.checked = false; setStatus('Import a rav-validated perimeter first.'); return; }
      settings.useValidatedPerimeter = e.target.checked; S.save(settings); if (state.result) recompute();
    });
    ['layer-buildings', 'layer-city', 'layer-karpef', 'layer-techum'].forEach((id) =>
      $(id).addEventListener('change', () => render()));
    refreshInputs();
  }

  // ---------------- boot ----------------
  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    bindSettings();
    compactSettingGroups();
    addSettingHelp();
    document.getElementById('btn-dismiss-banner').addEventListener('click', () => {
      document.getElementById('banner').remove();
      map.invalidateSize();
    });
    document.getElementById('address').addEventListener('input', onAddressInput);
    document.getElementById('address').addEventListener('keydown', onAddressKeydown);
    document.getElementById('address').addEventListener('blur', () => setTimeout(closeSuggestions, 100));
    document.getElementById('btn-location').addEventListener('click', useMyLocation);
    document.getElementById('btn-calc').addEventListener('click', () => calculate(false));
    document.getElementById('btn-cancel-calc').addEventListener('click', cancelCalculation);
    document.getElementById('btn-fresh').addEventListener('click', () => calculate(true));
    document.getElementById('btn-kml').addEventListener('click', exportKML);
    document.getElementById('btn-kmz').addEventListener('click', exportKMZ);
    document.getElementById('btn-geojson').addEventListener('click', exportGeoJSON);
    document.getElementById('btn-pdf').addEventListener('click', exportPDF);
    document.getElementById('btn-image').addEventListener('click', exportPNG);
    document.getElementById('btn-snapshot').addEventListener('click', saveSnapshot);
    document.getElementById('snapshot-file').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) loadSnapshot(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('btn-load-snapshot').addEventListener('click', () =>
      document.getElementById('snapshot-file').click());
    document.getElementById('btn-draw-rectangle').addEventListener('click', () => startDrawing('rectangle'));
    document.getElementById('btn-draw-building').addEventListener('click', () => startDrawing('polygon'));
    document.getElementById('btn-draw-perimeter').addEventListener('click', () => startDrawing('enclosure'));
    document.getElementById('btn-finish-building').addEventListener('click', () => void finishDrawing());
    document.getElementById('btn-cancel-map-mode').addEventListener('click', () => cancelMapMode());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (drawing || bowCapture)) cancelMapMode(); });
    let resizeTimer;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => map.invalidateSize(), 100); });
    document.getElementById('btn-import-buildings').addEventListener('click', () => document.getElementById('building-file').click());
    document.getElementById('building-file').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) importBuildings(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('btn-registry-refresh').addEventListener('click', browseRegistry);
    document.getElementById('btn-import-perimeter').addEventListener('click', () => document.getElementById('perimeter-file').click());
    document.getElementById('perimeter-file').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) importValidatedPerimeter(e.target.files[0]); e.target.value = '';
    });
    document.getElementById('btn-clear-perimeter').addEventListener('click', () => {
      state.validatedPerimeter = null; settings.useValidatedPerimeter = false; S.save(settings);
      document.getElementById('use-perimeter').checked = false; if (state.result) recompute();
      setStatus('Validated perimeter cleared.');
    });
    document.getElementById('btn-clear-manual').addEventListener('click', () => {
      if (state.manualBuildings.length && !confirm('Remove all manually drawn and imported footprints?')) return;
      state.manualBuildings = []; prepareBuildings(); recompute(); setStatus('Manual footprints cleared.');
    });
    document.getElementById('btn-clear-overrides').addEventListener('click', () => {
      if (!state.overrides.size) { setStatus('There are no manual building overrides to clear.'); return; }
      if (!confirm(`Clear ${state.overrides.size} manual building override(s)?`)) return;
      state.overrides.clear(); if (state.rawBuildings.length) recompute(); setStatus('Manual building overrides cleared.');
    });
    const draftAddress = new URLSearchParams(location.search).get('draftAddress');
    if (draftAddress) {
      const query = draftAddress.trim().slice(0, 300);
      document.getElementById('address').value = query;
      const params = new URLSearchParams(location.search);
      const lat = Number(params.get('draftLat'));
      const lon = Number(params.get('draftLon'));
      const hasDraftCoordinates = params.has('draftLat') && params.has('draftLon');
      if (hasDraftCoordinates && Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180) {
        applyGeocodeResult({ lat, lon, label: query }, query);
      } else {
        setStatus('Finding ' + query + '…');
        void D.geocode(query, state.locationBias).then((results) => {
          if (results.length) applyGeocodeResult(results[0], query);
          else setStatus('We could not find that place — try a more specific address.');
        }).catch(() => setStatus('We could not find that place — check the address and try again.'));
      }
    } else setStatus('Enter an address (or click the map) to set the shevisa point.');
  });
})();
