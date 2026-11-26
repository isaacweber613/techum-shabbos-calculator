/*
 * Techum Calculator — app orchestration + Leaflet rendering.
 * Flow: geocode/pin -> fetch Overture buildings (auto-expanding) -> classify ->
 * project -> TechumGeo.runPipeline -> render layers -> exports.
 */
(function () {
  'use strict';
  const G = window.TechumGeo, D = window.TechumData, S = window.TechumSettings, K = window.TechumKML;
  const ENGINE_VERSION = '1.5.6 (2026-11-25)';
  const isSimplifiedDirection = /^(9|10)$/.test(document.documentElement.dataset.design || '');

  let settings = S.load();
  let map, pinMarker, buildingRenderer, baseLayerControl;
  let googleMap, googleUnderlay, googleBaseLayer, originalMapLayer, illustratedMapLayer, activeBaseLayer;
  let googleMapsBrowserKey = '';
  let userSelectedBaseLayer = false;
  let state = {
    pin: null,            // {lat, lon}
    proj: null,
    rawBuildings: [],     // from Overture: {id, tags, ringLatLon}
    manualBuildings: [],  // reviewer-drawn/imported corrections
    buildings: [],        // projected + classified: {id, tags, ring, bbox, klass, included, override}
    overrides: new Map(), // id -> 'include' | 'exclude'
    result: null,
    fetchBBox: null,      // {south, west, north, east}
    fromSnapshot: false,  // loaded buildings came from a snapshot: never refetched
    dataCapHit: false,
    dataRelease: null,
    correctionsApplied: 0,
    snapInfo: null,
    pinReview: null,
    pinPlacementConfirmed: false,
    validatedPerimeter: null,
    validatedJoinPerimeters: [], // rav-confirmed residential yards/perimeters; geometry-only, house count = 0
  };
  const layerGroups = {
    buildings: null, rects: null, second: null, settlements: null, audit: null, perimeter: null,
  };
  const auditCache = new Map(); // building id + join dist -> buffer loops (pure geometry)
  let drawing = null;
  let bowCapture = null;
  let analysisWorker = null;
  let analysisRequestId = 0;
  let latestAnalysisId = 0;
  let activeCalculationId = 0;
  let automaticCalculationTimer = null;
  let mapExportInProgress = false;
  const analysisPending = new Map();
  function track(type, data) { if (window.TechumTrack) window.TechumTrack.send(type, data); }

  const SETTING_HELP = {
    profile: 'Choose a documented bundle of shitos; the explanation below states what changes and why.',
    amah: 'Sets the length of an amah. This changes distances and can change which buildings connect.',
    karpef: 'Adds 70⅔ amos around a single city before measuring the 2,000-amah techum.',
    'sq-angle': 'Automatic ribua preserves a clearly rectangular city in its existing direction; irregular cities are squared to true north. A nonzero value is a reviewer override.',
    overlap: 'Selects one of the three sourced approaches to overlapping city rectangles.',
    'large-hole-policy': 'Controls a wholly surrounded empty area at least 4,000 amos in both governing directions.',
    'bow-policy': 'Selects the sourced bow/L rule after a reviewer confirms the real-city endpoints.',
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
    'chazon-ish': '<b>Chazon Ish scenario:</b> larger 22.68-inch amah and the expansive reading that repeatedly redraws overlapping city rectangles. The Chazon Ish\'s practical conclusion on overlap is reported as uncertain; use this scenario only with rabbinic direction. A reviewer may also set a controlling natural angle.',
    mechaber: '<b>Mechaber / Sefardi:</b> 18.90-inch amah here, no extra single-city karpef, shape-aware SA squaring, and no automatic overlapping-rectangle merge.',
    custom: '<b>Custom:</b> one or more choices differ from the selected profile. Review every changed shita with a rav.',
  };
  const MAP_PALETTE = {
    pink: '#F0A1B7',
    pinkStroke: '#A94364',
    green: '#C8DF97',
    greenStroke: '#4F713D',
    greenSoft: '#E5EFC8',
    cream: '#FFF8E8',
  };

  function addSettingHelp() {
    Object.entries(SETTING_HELP).forEach(([id, explanation]) => {
      const input = document.getElementById(id);
      const label = input && input.closest('label');
      if (!label) return;
      const accessibleName = [...label.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim()).filter(Boolean).join(' ');
      if (accessibleName && !input.hasAttribute('aria-label')) input.setAttribute('aria-label', accessibleName);
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
  function setGoogleMapVisible(visible) {
    document.getElementById('map').classList.toggle('google-map-active', visible);
    if (googleUnderlay) googleUnderlay.setAttribute('aria-hidden', String(!visible));
  }

  function syncGoogleMap() {
    if (!googleMap || !googleBaseLayer || !map.hasLayer(googleBaseLayer)) return;
    const center = map.getCenter();
    googleMap.setCenter({ lat: center.lat, lng: center.lng });
    googleMap.setZoom(map.getZoom());
  }

  function ensureGoogleMap() {
    if (googleMap || !window.google?.maps?.Map) return;
    const center = map.getCenter();
    googleMap = new window.google.maps.Map(googleUnderlay, {
      center: { lat: center.lat, lng: center.lng }, zoom: map.getZoom(), mapTypeId: 'roadmap',
      disableDefaultUI: true, gestureHandling: 'none', keyboardShortcuts: false, clickableIcons: false,
    });
  }

  function switchBaseLayer(layer) {
    [originalMapLayer, illustratedMapLayer, googleBaseLayer].filter(Boolean).forEach((candidate) => {
      if (candidate !== layer && map.hasLayer(candidate)) map.removeLayer(candidate);
    });
    if (layer && !map.hasLayer(layer)) layer.addTo(map);
    activeBaseLayer = layer;
    const googleActive = layer === googleBaseLayer;
    setGoogleMapVisible(googleActive);
    if (googleActive) { ensureGoogleMap(); syncGoogleMap(); }
  }

  function disableGoogleMap(reason) {
    const wasGoogleActive = activeBaseLayer === googleBaseLayer;
    setGoogleMapVisible(false);
    if (googleBaseLayer && map.hasLayer(googleBaseLayer)) map.removeLayer(googleBaseLayer);
    if (baseLayerControl && googleBaseLayer) baseLayerControl.removeLayer(googleBaseLayer);
    if (wasGoogleActive || !activeBaseLayer) switchBaseLayer(originalMapLayer);
    googleBaseLayer = null;
    console.info('Google Maps unavailable; using the original map.', reason || 'fallback');
  }

  function loadGoogleMaps(key) {
    if (window.google && window.google.maps && window.google.maps.Map) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const callback = '__techumGoogleMapsReady';
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (error) reject(error); else resolve();
      };
      window[callback] = () => finish();
      window.gm_authFailure = () => {
        disableGoogleMap('authentication failure');
        finish(new Error('Google Maps authentication failed'));
      };
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.async = true;
      script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key)
        + '&loading=async&callback=' + callback + '&v=weekly';
      script.onerror = () => finish(new Error('Google Maps script failed to load'));
      document.head.appendChild(script);
      const timeout = window.setTimeout(() => finish(new Error('Google Maps timed out')), 10000);
    });
  }

  async function preferGoogleMap() {
    try {
      const response = await fetch('/api/map-config', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('map configuration returned ' + response.status);
      const config = await response.json();
      if (!config || config.provider !== 'google' || typeof config.key !== 'string') throw new Error('invalid map configuration');
      googleMapsBrowserKey = config.key;
      await loadGoogleMaps(config.key);

      googleBaseLayer = L.layerGroup();
      baseLayerControl.addBaseLayer(googleBaseLayer, 'Google Maps');
      if (!userSelectedBaseLayer) switchBaseLayer(googleBaseLayer);
      console.info('Google Maps enabled; the original map remains available as fallback.');
    } catch (error) {
      disableGoogleMap(error instanceof Error ? error.message : String(error));
    }
  }

  function initMap() {
    map = L.map('map', { zoomControl: true }).setView([41.1, -74.05], 13);
    googleUnderlay = document.createElement('div');
    googleUnderlay.className = 'google-map-underlay';
    googleUnderlay.setAttribute('aria-hidden', 'true');
    document.getElementById('map').prepend(googleUnderlay);
    // Thousands of footprint paths are substantially cheaper on one canvas than as
    // thousands of live SVG nodes; boundary lines remain SVG for crisp interaction.
    buildingRenderer = L.canvas({ padding: 0.35 });
    const imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20, maxNativeZoom: 19,
      crossOrigin: true,
      attribution: 'Imagery © Esri | Map data © OpenStreetMap contributors',
    });
    // CARTO's free basemaps began answering every tile with an "API KEY REQUIRED" stamp
    // (seen 2026-11-25). Place names come from Esri's reference layer, the same service
    // family as the imagery; the illustrated map is OpenStreetMap's own tile server, whose
    // usage policy allows keyless web use with visible attribution.
    const imageryLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20, maxNativeZoom: 19, crossOrigin: true, attribution: 'Labels © Esri',
    });
    const illustrated = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20, maxNativeZoom: 19, crossOrigin: true,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    const realistic = L.layerGroup([imagery, imageryLabels]);
    originalMapLayer = realistic;
    illustratedMapLayer = illustrated;
    activeBaseLayer = realistic;
    realistic.addTo(map);
    baseLayerControl = L.control.layers({
      'Original satellite map': realistic,
      'Original illustrated map': illustrated,
    }, null, { collapsed: !isSimplifiedDirection, position: 'topright' }).addTo(map);
    baseLayerControl.getContainer().addEventListener('change', () => { userSelectedBaseLayer = true; });
    map.on('baselayerchange', (event) => {
      activeBaseLayer = event.layer;
      const googleActive = event.layer === googleBaseLayer;
      setGoogleMapVisible(googleActive);
      if (googleActive) { ensureGoogleMap(); syncGoogleMap(); }
    });
    map.on('move zoomend', syncGoogleMap);
    map.on('resize', () => {
      if (googleMap && window.google && window.google.maps) window.google.maps.event.trigger(googleMap, 'resize');
      syncGoogleMap();
    });
    void preferGoogleMap();
    layerGroups.buildings = L.layerGroup().addTo(map);
    layerGroups.rects = L.layerGroup().addTo(map);
    layerGroups.second = L.layerGroup().addTo(map);
    layerGroups.settlements = L.layerGroup().addTo(map);
    layerGroups.audit = L.layerGroup().addTo(map);
    layerGroups.perimeter = L.layerGroup().addTo(map);
    map.on('click', (e) => {
      if (drawing) { addDrawingVertex(e.latlng); return; }
      if (bowCapture) { addBowEndpoint(e.latlng); return; }
      const invalidatesResult = !!(state.result || state.rawBuildings.length);
      setPin(e.latlng.lat, e.latlng.lng, { invalidateResult: invalidatesResult, confirmed: true });
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
    state.pinReview = null;
    state.snapInfo = null;
    state.pinPlacementConfirmed = !!(options && options.confirmed);
    document.body.classList.add('has-pin');
    if (!pinMarker) {
      pinMarker = L.marker([lat, lon], { draggable: true }).addTo(map);
      pinMarker.bindTooltip('Shevisa point — drag to adjust', { direction: 'top' });
      pinMarker.on('dragend', () => {
        const p = pinMarker.getLatLng();
        state.pin = { lat: p.lat, lon: p.lng };
        state.pinReview = null;
        state.snapInfo = { keptExact: true, reason: 'You positioned the pin manually.' };
        state.pinPlacementConfirmed = true;
        if (state.result || state.rawBuildings.length) invalidateCalculationForMovedPin();
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
  // What the last finished lookup found, so Enter never asks people to wait for nothing.
  let suggestionOutcome = 'pending';

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
    setPin(r.lat, r.lon, { invalidateResult: !!(state.result || state.rawBuildings.length) });
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
    if (q.length < 3) { suggestionOutcome = 'empty'; closeSuggestions(); return; }
    const request = ++suggestionRequest;
    try {
      const results = await D.autocomplete(q, state.locationBias);
      if (request === suggestionRequest && document.getElementById('address').value.trim() === q) {
        suggestionOutcome = results.length ? 'found' : 'empty';
        renderSuggestions(results);
      }
    } catch {
      if (request === suggestionRequest) { suggestionOutcome = 'error'; closeSuggestions(); }
    }
  }

  function onAddressInput() {
    clearTimeout(suggestionTimer);
    suggestionRequest++;
    suggestionOutcome = 'pending';
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
      else if (suggestions.length) setStatus('Choose one of the suggested addresses before continuing.');
      else if (suggestionOutcome === 'empty') setStatus('No place matches that. Check the spelling, add the town or country, or click the map.');
      else if (suggestionOutcome === 'error') setStatus('Address search is not reachable. Check your connection, or click the map to set the point.');
      else setStatus('Looking up that address… choose it from the list when it appears.');
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
    setPin(lat, lon, { invalidateResult: !!(state.result || state.rawBuildings.length) });
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
    setRetryVisible(false);
    const calculationId = ++activeCalculationId;
    const startPin = state.pin;
    // A newer run (or cancel) owns the progress UI. A pin moved without a new run means this
    // run's buildings belong to the old place: discard it and release the busy flag.
    const isStale = () => {
      if (calculationId !== activeCalculationId) return true;
      if (state.pin === startPin) return false;
      activeCalculationId++;
      finishCalculationProgress(false);
      setStatus('The pin moved during the calculation, so that run was discarded. Calculate again for the new pin.');
      return true;
    };
    setCalculationStage('fetch', forceFresh ? 'Refreshing map buildings…' : 'Getting nearby map buildings…');
    await nextPaint();
    if (isStale()) return;
    const calcStarted = performance.now();
    const perf = { passes: [], buildings: 0 };
    document.getElementById('performance-report').hidden = true;
    state.dataCapHit = false;
    state.dataCapReason = null;
    state.fromCache = false;
    // Switch frames only once this pin's buildings arrive; the previous buildings stay
    // projected in their own frame if the first fetch fails.
    const proj = G.makeProjection(startPin.lat, startPin.lon);
    let bbox = bboxAround(state.pin, settings.fetchRadiusM);
    let iteration = 0;
    let expansionError = null;
    while (true) {
      const fetchLabel = `Getting map buildings${iteration ? ` (area pass ${iteration + 1})` : ''}`;
      setCalculationStage('fetch', `${fetchLabel}…`);
      await nextPaint();
      if (isStale()) return;
      const fetchStarted = performance.now();
      let fetched;
      // A first visit to a new area can take 20 seconds while the server loads it. Show how far
      // along it is and how long it has been, so the wait never looks frozen.
      let fetchPart = '';
      const showFetchStage = () => {
        if (calculationId !== activeCalculationId) return;
        const seconds = Math.round((performance.now() - fetchStarted) / 1000);
        setCalculationStage('fetch', `${fetchLabel}${fetchPart}…${seconds >= 3 ? ` ${seconds} s` : ''}`);
      };
      const fetchTicker = setInterval(showFetchStage, 1000);
      try {
        fetched = await D.fetchBuildingsCached(bbox, { force: !!forceFresh, onProgress: (done, total) => {
          fetchPart = total > 1 ? `: part ${done + 1} of ${total}` : '';
          showFetchStage();
        } });
        if (isStale()) return;
      } catch (e) {
        if (isStale()) return;
        if (iteration > 0 && state.result) {
          // A completed, analyzed pass already exists. Keep it, flagged as incomplete like a
          // data limit (the town may continue beyond the loaded area), rather than discarding
          // the whole calculation because a wider pass failed.
          state.dataCapHit = true;
          state.dataCapReason = 'failed';
          expansionError = e;
          perf.passes.push({ pass: iteration + 1, buildings: 0, fetchMs: performance.now() - fetchStarted,
            prepMs: 0, engineMs: 0, engineStages: null, failed: true });
          break;
        }
        // A fetch that never reaches the server throws a TypeError ("Failed to fetch").
        setStatus(e instanceof TypeError
          ? 'Could not reach the map-data service. Check your connection, then press Try again.'
          : 'Map-data error: ' + String(e.message).replace(/^map-data error:\s*/i, '') + ' — try again in a minute.');
        finishCalculationProgress(false);
        return;
      } finally {
        clearInterval(fetchTicker);
      }
      const fetchMs = performance.now() - fetchStarted;
      // Do not start an unexpectedly oversized expansion pass. Keep the last complete
      // analyzed pass and mark it as bounded instead of silently analyzing beyond the
      // configured safety limit (the old behavior reached 80k under a 60k cap).
      if (iteration > 0 && fetched.buildings.length > settings.maxBuildings) {
        state.dataCapHit = true;
        state.dataCapReason = 'buildings';
        perf.passes.push({ pass: iteration + 1, buildings: fetched.buildings.length, fetchMs,
          prepMs: 0, engineMs: 0, engineStages: null, skippedAtDataCap: true });
        break;
      }
      state.proj = proj;
      state.rawBuildings = fetched.buildings;
      state.fetchedAt = fetched.fetchedAt;
      state.fromCache = fetched.fromCache;
      state.dataSource = fetched.source || (fetched.fromCache ? 'local-overture' : 'overture');
      state.dataRelease = fetched.release || state.dataRelease;
      state.correctionsApplied = fetched.correctionsApplied || 0;
      state.fetchBBox = bbox;
      state.fromSnapshot = false;
      const prepStarted = performance.now();
      prepareBuildings();
      // Never move the shevisa point automatically. A nearby mapped footprint is
      // offered as an explicit choice after the exact pin has been calculated.
      reviewPinPlacementCandidate();
      const prepMs = performance.now() - prepStarted;
      setCalculationStage('analyze', `Building the city from ${state.rawBuildings.length.toLocaleString()} footprints…`);
      await nextPaint();
      if (isStale()) return;
      const engineStarted = performance.now();
      try {
        await recompute(true);
        if (isStale()) return;
      } catch (error) {
        if (isStale()) return;
        setStatus('Calculation error: ' + error.message);
        finishCalculationProgress(false);
        return;
      }
      const engineMs = performance.now() - engineStarted;
      perf.passes.push({ pass: iteration + 1, buildings: state.rawBuildings.length, fetchMs, prepMs, engineMs,
        engineStages: state.result && state.result.engineTimings ? state.result.engineTimings : null });
      // Widen until the result needs no building outside the loaded area: the town's whole
      // techum, and the towns that can change a three-villages join with it (G.dataFrontier).
      // There is no halachic cap and no limit on the number of widenings; the building-count
      // data limit is the only stop, and the result is then marked incomplete.
      const needed = G.dataFrontier(state.result, state.proj, bbox, state.proj.toXY(state.pin.lat, state.pin.lon));
      if (!needed) break;
      if (state.rawBuildings.length > settings.maxBuildings) {
        state.dataCapHit = true;
        state.dataCapReason = 'buildings';
        break;
      }
      bbox = bboxUnionDeg(bbox, needed);
      iteration++;
    }
    setCalculationStage('draw', 'Drawing and labeling the boundaries…');
    await nextPaint();
    if (isStale()) return;
    const renderStarted = performance.now();
    render(); // the final analysis pass already produced state.result
    perf.renderMs = performance.now() - renderStarted;
    perf.totalMs = performance.now() - calcStarted;
    perf.buildings = state.rawBuildings.length;
    renderPerformanceReport(perf);
    const resultBounds = techumBounds();
    if (resultBounds) map.fitBounds(resultBounds);
    const ageDays = state.fetchedAt ? ((Date.now() - Date.parse(state.fetchedAt)) / 86400000) : 0;
    const ageLabel = ageDays < 1 ? 'today' : ageDays.toFixed(0) + ' days old';
    const releaseLabel = state.dataRelease ? `Overture ${state.dataRelease}` : 'Overture';
    const cacheLabel = state.fromCache
      ? `${releaseLabel} data from cache (${ageLabel}).`
      : `Fresh ${releaseLabel} footprints.`;
    setStatus((state.dataCapHit
      ? `Incomplete — stopped after ${state.rawBuildings.length} buildings; the town continues past the loaded map data. `
      : `Done — ${state.rawBuildings.length} buildings analyzed. `) +
      (state.result && state.result.mode === 'city'
        ? 'Techum drawn from the squared city. '
        : state.result && state.result.mode === 'building'
          ? 'Techum drawn from the mapped building walls. '
          : 'Point-shevisa techum drawn. ') +
      cacheLabel +
      (expansionError ? ` ⚠ Could not load the wider area the city may extend into (${expansionError.message}); ` +
        'the boundary may be too large or too small — recalculate to retry.' : ''));
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

  function prepareBuildings() {
    auditCache.clear(); // buffers are keyed by building id — new data invalidates them
    const proj = state.proj;
    const joinPerimeters = state.validatedJoinPerimeters.map((item, index) => ({
      id: item.id || `validated-join-${index + 1}`,
      tags: { building: 'yes', source: 'rav-validated-join-perimeter' },
      ringLatLon: item.ringLatLon || item,
      joinOnly: true,
    }));
    state.buildings = state.rawBuildings.concat(state.manualBuildings, joinPerimeters).map((raw) => {
      const ring = raw.ringLatLon.map((p) => proj.toXY(p.lat, p.lon));
      const cls = D.classify(raw.tags);
      return {
        id: raw.id, tags: raw.tags, ring,
        bbox: ringBBox(ring), joinOnly: !!raw.joinOnly,
        klass: cls.klass, reason: cls.reason,
        included: false, // set in recompute from klass + settings + override
      };
      });
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }

  // A finished run hides the strip after a delay; a run that starts meanwhile must keep it.
  let progressHideTimer = null;
  function setCalculationStage(stage, message) {
    clearTimeout(progressHideTimer);
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

  // A failed or cancelled run leaves the automatic design with no visible way to
  // retry (the regular Calculate button is hidden). Reveal a dedicated retry control
  // only for that state; a successful run hides it again.
  function setRetryVisible(visible) {
    const button = document.getElementById('btn-retry');
    if (button) button.hidden = !visible;
  }

  function finishCalculationProgress(succeeded) {
    const progress = document.getElementById('calc-progress');
    setRetryVisible(!succeeded);
    const button = document.getElementById('btn-calc');
    progress.querySelectorAll('[data-stage]').forEach((el) => {
      el.classList.toggle('done', succeeded);
      el.classList.remove('active');
    });
    button.setAttribute('aria-busy', 'false');
    button.disabled = false;
    button.querySelector('.calc-label').textContent = succeeded ? 'Recalculate my techum' : 'Try calculating again';
    clearTimeout(progressHideTimer);
    progressHideTimer = window.setTimeout(() => {
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
        : drawing.mode === 'join-perimeter'
          ? `Drawing validated joining perimeter: ${drawing.points.length} point(s). Click each corner, then Finish shape.`
        : `Drawing missing footprint: ${drawing.points.length} point(s). Click each corner, then Finish shape.`);
  }

  function startDrawing(mode = 'polygon') {
    if (!state.result) { setStatus('Set an address and calculate before drawing on the map.'); return; }
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
      saveSettings();
      if (!await recompute()) return;
      setStatus('Validated enclosure stored but inactive. Enable it only after a rav confirms that this perimeter counts for techum.');
      return;
    }
    if (mode === 'join-perimeter') {
      state.validatedJoinPerimeters.push({ id: `validated-join-${Date.now()}`, ringLatLon });
      prepareBuildings(); if (!await recompute()) return;
      setStatus('Validated residential joining perimeter added. It affects join distances but does not count as a house.');
      return;
    }
    state.manualBuildings.push({ id: `manual-${Date.now()}-${state.manualBuildings.length + 1}`,
      tags: { building: 'yes', source: 'manual-review' }, ringLatLon });
    prepareBuildings(); if (!await recompute()) return;
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

  function importBuildings(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!state.result) throw new Error('set an address and calculate first');
        const polygons = K.parseGeoJSONFootprints(JSON.parse(reader.result));
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

  function importValidatedPerimeter(file) {
    const reader = new FileReader(); reader.onload = () => {
      try {
        const polygons = K.parseGeoJSONFootprints(JSON.parse(reader.result));
        if (polygons.length !== 1) throw new Error('provide exactly one Polygon/MultiPolygon outer perimeter');
        state.validatedPerimeter = polygons[0]; settings.useValidatedPerimeter = false; saveSettings();
        document.getElementById('use-perimeter').checked = false;
        if (state.result) render();
        setStatus('Validated perimeter imported but inactive. Enable it only after confirming this exact perimeter and ruling with the rav.');
      } catch (e) { setStatus('Validated perimeter import failed: ' + e.message); }
    }; reader.readAsText(file);
  }
  function importValidatedJoinPerimeters(file) {
    const reader = new FileReader(); reader.onload = () => {
      try {
        const polygons = K.parseGeoJSONFootprints(JSON.parse(reader.result));
        if (!polygons.length) throw new Error('provide at least one Polygon or MultiPolygon perimeter');
        const stamp = Date.now();
        polygons.forEach((ringLatLon, index) => state.validatedJoinPerimeters.push({
          id: `validated-join-import-${stamp}-${index + 1}`, ringLatLon,
        }));
        if (state.result) { prepareBuildings(); recompute(); }
        setStatus(`${polygons.length} rav-validated joining perimeter(s) imported; they affect gaps but not the house count.`);
      } catch (e) { setStatus('Joining-perimeter import failed: ' + e.message); }
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
    // Narrowest width in any direction, so a narrow shed turned off the compass still counts as
    // narrow (spec rev. 18.2).
    return G.belowMinDwellingSize(b.ring, settings.amahCm / 100);
  }
  function isIncluded(b) {
    if (b.joinOnly) return true;
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
    if (b.joinOnly) return true;
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
  function geometrySettings(amahCm = settings.amahCm) {
    return {
      amahM: amahCm / 100,
      karpef: settings.karpef,
      minCityHouses: settings.minCityHouses,
      overlapPolicy: settings.overlapPolicy,
      largeHolePolicy: settings.largeHolePolicy,
      bowPolicy: settings.bowPolicy,
      squaringAngleDeg: settings.squaringAngleDeg,
      pointRotationDeg: settings.pointRotationDeg,
      cityQualificationOverrides: settings.cityQualificationOverrides || {},
      concavityReviews: settings.concavityReviews || {},
      validatedCityPerimeter: projectedValidatedPerimeter(),
    };
  }
  function workerSafeBuildings(buildings) {
    return buildings.map((b) => ({ id: b.id, ring: b.ring, bbox: b.bbox, included: b.included, joinOnly: !!b.joinOnly }));
  }

  // The worker imports geometry.js with this same query string, so the background engine can
  // never run a different (stale-cached) build than the main-thread engine used for small areas.
  function geometryAssetVersion() {
    const script = document.querySelector('script[src*="js/geometry.js"]');
    try { return script ? new URL(script.src, location.href).search : ''; } catch { return ''; }
  }

  function runPipelineAsync(buildings, geoSettings, pinXY) {
    if (typeof Worker === 'undefined' || buildings.length < 1500) {
      return Promise.resolve(G.runPipeline(buildings, geoSettings, pinXY));
    }
    if (!analysisWorker) analysisWorker = new Worker('js/analysis-worker.js' + geometryAssetVersion());
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
    if (!state.pin || !state.proj) return null;
    const generation = ++latestAnalysisId;
    for (const b of state.buildings) b.included = isIncluded(b);
    const pinXY = state.proj.toXY(state.pin.lat, state.pin.lon);
    const geoSettings = geometrySettings();
    let result;
    try {
      result = await runPipelineAsync(state.buildings, geoSettings, pinXY);
    } catch (error) {
      // calculate() (skipRender) reports its own errors. Every other re-analysis (settings,
      // overrides, imports) must not leave the previous boundary on screen looking current.
      if (skipRender) throw error;
      if (generation !== latestAnalysisId) return null;
      state.result = null;
      render();
      setStatus('Recalculation failed: ' + error.message + ' — the previous boundary was removed. Adjust the input or recalculate.');
      setRetryVisible(true);
      return null;
    }
    if (generation !== latestAnalysisId) return null;
    state.result = result;
    // A re-analysis of the loaded buildings (a changed setting, profile, pin or override) can
    // need map data the last search did not load; a larger amah makes a larger town. A live
    // result then runs the whole search again, so it never depends on what was loaded for the
    // previous settings. A snapshot is never refetched; it is marked incomplete instead, and so
    // is a snapshot that does not record its loaded area, since it cannot be checked.
    if (!skipRender && !state.fetchBBox && state.fromSnapshot && state.pin) {
      state.dataCapHit = true; state.dataCapReason = 'snapshot-area-unknown';
    } else if (!skipRender && state.fetchBBox && state.pin) {
      const more = G.dataFrontier(result, state.proj, state.fetchBBox, state.proj.toXY(state.pin.lat, state.pin.lon));
      if (!more) { state.dataCapHit = false; state.dataCapReason = null; }
      else if (state.fromSnapshot) { state.dataCapHit = true; state.dataCapReason = 'snapshot'; }
      else if (!state.dataCapHit) { void calculate(false); return result; }
    }
    if (!skipRender) { render(); setRetryVisible(false); }
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
    if (res.mode === 'building' && res.homeBuilding >= 0) homeMembers.add(res.homeBuilding);
    state.buildings.forEach((b, i) => {
      if (b.bbox.maxX < view.minX || b.bbox.minX > view.maxX || b.bbox.maxY < view.minY || b.bbox.minY > view.maxY) return;
      const st = { ...(KLASS_STYLE[b.klass] || KLASS_STYLE.unknown) };
      if (b.joinOnly) { st.color = '#00b8a9'; st.fillColor = '#b7f3e8'; }
      const ov = state.overrides.get(b.id);
      let dash = null, weight = 1, fillOpacity = b.included ? 0.45 : 0.12, opacity = b.included ? 0.9 : 0.45;
      if (ov) { dash = '4 3'; weight = 2.5; st.color = ov === 'exclude' ? '#ff4136' : '#0074d9'; }
      const poly = L.polygon(b.ring.map((p) => { const ll = state.proj.toLatLon(p.x, p.y); return [ll.lat, ll.lon]; }), {
        color: st.color, weight, fillColor: st.fillColor, fillOpacity: homeMembers.has(i) ? Math.min(0.65, fillOpacity + 0.15) : fillOpacity,
        opacity, dashArray: dash, renderer: buildingRenderer,
        bubblingMouseEvents: false, // a footprint click must not also move the pin
      });
      b.mapLayer = poly;
      poly.bindTooltip(`<b>${b.joinOnly ? 'RAV-VALIDATED JOIN PERIMETER' : escapeHtml(b.klass.toUpperCase())}</b> — ${escapeHtml(b.reason)}` +
        (b.joinOnly ? '<br>Participates in 70⅔/141⅓ geometry; house count +0.' : '') +
        (ov ? `<br>manual correction: ${escapeHtml(ov)}` : '') + `<br><i>Optional: click to correct include/exclude</i>`, { sticky: true });
      poly.on('click', async (e) => {
        if (drawing) { addDrawingVertex(e.latlng); return; }
        if (bowCapture) { addBowEndpoint(e.latlng); return; }
        const cur = state.overrides.get(b.id);
        if (!cur) state.overrides.set(b.id, 'include');
        else if (cur === 'include') state.overrides.set(b.id, 'exclude');
        else state.overrides.delete(b.id);
        const decision = state.overrides.get(b.id);
        if (!await recompute()) return;
        if (!decision) { setStatus('Building returned to the automatic Overture decision.'); return; }
        const sourceRing = b.ring.map((point) => state.proj.toLatLon(point.x, point.y));
        const shared = await shareBuildingCorrection({ sourceId: b.id, decision, sourceRing,
          note: 'Optional map correction from building click' });
        setStatus(`Building marked ${decision === 'include' ? 'included' : 'excluded'}.` + shared);
      });
      poly.addTo(layerGroups.buildings);
    });
  }

  // Removes every trace of a result that no longer applies (moved pin, failed re-analysis).
  function clearResultDisplay() {
    document.body.classList.remove('has-result', 'key-comparison', 'key-12mil', 'key-concavity');
    layerGroups.buildings.clearLayers();
    layerGroups.rects.clearLayers(); layerGroups.second.clearLayers(); layerGroups.settlements.clearLayers();
    layerGroups.audit.clearLayers(); layerGroups.perimeter.clearLayers();
    document.getElementById('results').replaceChildren();
    document.getElementById('confidence').hidden = true;
    document.getElementById('review-queue').hidden = true;
  }

  function invalidateCalculationForMovedPin() {
    latestAnalysisId++; // an analysis still running for the old pin must not repopulate the result
    state.result = null;
    state.snapInfo = null;
    clearResultDisplay();
    setStatus('Pin moved. Calculate again to fetch the correct surrounding buildings; the previous boundary was cleared.');
  }

  // Optional second full-pipeline scenarios run on the main thread; skip them on metro-scale data.
  const COMPARISON_SCENARIO_MAX_BUILDINGS = 10000;
  function canRunComparisonAmah() {
    return !!settings.secondAmahCm && settings.secondAmahCm !== settings.amahCm
      && state.buildings.length <= COMPARISON_SCENARIO_MAX_BUILDINGS;
  }

  function render() {
    const res = state.result;
    if (!res) { clearResultDisplay(); return; }
    document.body.classList.add('has-result');
    layerGroups.rects.clearLayers();
    layerGroups.second.clearLayers();
    layerGroups.settlements.clearLayers();
    layerGroups.perimeter.clearLayers();

    renderBuildings();

    if (state.validatedPerimeter) {
      L.polygon(state.validatedPerimeter.map((p) => [p.lat, p.lon]), {
        color: res.validatedPerimeterActive ? '#00ffff' : '#7a7f7d', weight: 3,
        dashArray: res.validatedPerimeterActive ? '10 4' : '4 6', fill: false,
      }).bindTooltip(res.validatedPerimeterActive ? 'ACTIVE rav-validated city perimeter' : 'Stored validated perimeter (inactive)')
        .addTo(layerGroups.perimeter);
    }

    // rectangles
    // The boundary shapes are drawn above the footprints. While footprints are shown, the
    // shapes let clicks through so a footprint under the pink or green area can be corrected.
    const shapesTakeClicks = !document.getElementById('layer-buildings').checked;
    const addRect = (corners, style, label, group) => {
      if (!corners) return;
      if (style.casing) // white underlay so the line reads against any satellite imagery
        L.polygon(cornersToLatLngs(corners), { color: '#ffffff', weight: (style.weight || 3) + 3, fill: false, opacity: 0.85, interactive: false })
          .addTo(group || layerGroups.rects);
      const p = L.polygon(cornersToLatLngs(corners), { ...style, interactive: shapesTakeClicks }).addTo(group || layerGroups.rects);
      if (label && shapesTakeClicks) p.bindTooltip(label, { sticky: true });
    };
    // A stepped result is many overlapping regions (§1.5). The map draws their union as one
    // outline per layer, with holes, so no edge is drawn inside the area (spec rev. 18.2); the
    // regions themselves stay separate in the result and in every export.
    const addRegions = (regions, style, label, group) => {
      const list = (Array.isArray(regions) ? regions : []).filter(Boolean);
      if (list.length < 2) { list.forEach((region) => addRect(region, style, label, group)); return; }
      const loops = G.unionOutline(list).map(cornersToLatLngs);
      if (!loops.length) return;
      if (style.casing)
        L.polygon(loops, { color: '#ffffff', weight: (style.weight || 3) + 3, fill: false, opacity: 0.85, interactive: false })
          .addTo(group || layerGroups.rects);
      const p = L.polygon(loops, { ...style, fillRule: 'evenodd', interactive: shapesTakeClicks }).addTo(group || layerGroups.rects);
      if (label && shapesTakeClicks) p.bindTooltip(`${label} · one outline of ${list.length} stepped regions`, { sticky: true });
    };
    if (document.getElementById('layer-techum').checked)
      addRegions(res.techumRegions || [res.techumCorners], { color: MAP_PALETTE.pinkStroke, weight: 3.5, fill: true,
        fillColor: MAP_PALETTE.pink, fillOpacity: 0.38, casing: true,
        // An incomplete result (the map data ran out) is drawn dashed, not as a confident line.
        ...(state.dataCapHit ? { dashArray: '10 7' } : {}) },
      'PINK TECHUM AREA — 2000 amos (' + settings.amahCm + ' cm amah)' +
        (state.dataCapHit ? ' · INCOMPLETE: the map data ran out' : ''));
    if ((res.karpefRegions || []).length && document.getElementById('layer-karpef').checked)
      addRegions(res.karpefRegions, { color: MAP_PALETTE.greenStroke, weight: 2, dashArray: '6 5',
        fill: true, fillColor: MAP_PALETTE.greenSoft, fillOpacity: 0.2 }, 'Karpef (+70⅔ amos — Rema/MB 398:36)');
    if (document.getElementById('layer-city').checked) {
      const startingAreaLabel = res.mode === 'city'
        ? 'GREEN STARTING CITY (ribua ha’ir)'
        : res.mode === 'building' ? 'GREEN MAPPED BUILDING — starting walls' : 'GREEN 4-AMOS SHEVISA';
      addRegions(res.cityRegions || [res.cityCorners], { color: MAP_PALETTE.greenStroke, weight: 4, fill: true,
        fillColor: MAP_PALETTE.green, fillOpacity: 0.62, casing: true },
      startingAreaLabel);
    }
    if (settings.show12mil)
      addRegions(res.mil12Regions || [res.mil12Corners], { color: '#666', weight: 1.5, dashArray: '2 6', fill: false }, '12 mil (d’oraisa shita)');
    for (const region of res.concavityRegions || [])
      addRect(region, { color: '#ffdc00', weight: 2, dashArray: '4 4', fillColor: '#ffdc00', fillOpacity: 0.15 }, '≥4000-amos concavity — review');

    // verified-only scenario: pipeline over clearly-residential structures only.
    // Brackets the data uncertainty from untagged buildings; neither line is a psak.
    // This optional data-quality scenario is another complete pipeline. On a metro
    // fetch it can monopolize the main thread for minutes, so keep the primary result
    // responsive and omit the comparison at large scale.
    const canRenderVerifiedScenario = state.buildings.length <= COMPARISON_SCENARIO_MAX_BUILDINGS;
    // Each extra line is its own result on the buildings loaded for the main one. A larger amah
    // makes a larger town, so a line can need map data that was not loaded; it is then labelled
    // incomplete on the map and in the answer, never shown as a finished line.
    const scenarioIncomplete = (scenario) => state.dataCapHit || !state.fetchBBox ||
      !!G.dataFrontier(scenario, state.proj, state.fetchBBox, state.proj.toXY(state.pin.lat, state.pin.lon));
    const cutLabel = ' · INCOMPLETE: needs map data that was not loaded';
    state.scenarioIncomplete = { verified: false, comparison: false };
    if (settings.showVerifiedOnly && res.mode === 'city' && canRenderVerifiedScenario) {
      const verifiedB = state.buildings.map((b) => ({ ...b, included: isVerifiedIncluded(b) }));
      if (verifiedB.some((b) => b.included)) {
        const resV = G.runPipeline(verifiedB, geometrySettings(), state.proj.toXY(state.pin.lat, state.pin.lon));
        const resVIncomplete = scenarioIncomplete(resV);
        state.scenarioIncomplete.verified = resVIncomplete;
        if (resV.techumCorners)
          addRegions(resV.techumRegions || [resV.techumCorners], { color: '#ffb300', weight: 2.5, dashArray: resVIncomplete ? '2 6' : '8 6', fill: false },
            'Scenario: verified dwellings only (' + (resV.mode === 'city' ? 'city' : resV.mode === 'building' ? 'building shevisa' : 'point shevisa!') + ') — data-uncertainty bracket, not a psak' +
            (resVIncomplete ? cutLabel : ''), layerGroups.second);
      }
    }

    // comparison shita line (full second pipeline run — thresholds change with the amah)
    if (canRunComparisonAmah()) {
      const res2 = G.runPipeline(state.buildings, geometrySettings(settings.secondAmahCm), state.proj.toXY(state.pin.lat, state.pin.lon));
      const res2Incomplete = scenarioIncomplete(res2);
      state.scenarioIncomplete.comparison = res2Incomplete;
      addRegions(res2.techumRegions || [res2.techumCorners], { color: '#e040fb', weight: 2.5, dashArray: res2Incomplete ? '2 6' : '10 6', fill: false },
        'Comparison: techum @ ' + (settings.secondAmahCm / 2.54).toFixed(2) + ' in amah' + (res2Incomplete ? cutLabel : ''), layerGroups.second);
    }

    // The map key lists these extra lines only while they are drawn.
    document.body.classList.toggle('key-comparison', canRunComparisonAmah());
    document.body.classList.toggle('key-12mil', !!settings.show12mil);
    document.body.classList.toggle('key-concavity', (res.concavityRegions || []).length > 0);

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

  function reviewPinPlacementCandidate() {
    if (!state.pin || !state.buildings.length) return;
    if (state.pinPlacementConfirmed) return;
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
      state.pinReview = null;
      state.pinPlacementConfirmed = true;
      state.snapInfo = { keptExact: true, reason: 'No plausible mapped footprint was found within 75 m.',
        distanceM: best ? best.distanceM : null };
      return;
    }
    if (best.distanceM <= 0.5) {
      state.pinReview = null;
      state.pinPlacementConfirmed = true;
      state.snapInfo = { alreadyInside: true, distanceM: best.distanceM, buildingId: best.building.id,
        klass: best.building.klass, reason: best.building.reason, original };
      return;
    }
    const ll = state.proj.toLatLon(best.point.x, best.point.y);
    state.pinReview = { distanceM: best.distanceM, buildingId: best.building.id,
      klass: best.building.klass, reason: best.building.reason, original,
      candidate: { lat: ll.lat, lon: ll.lon } };
    state.snapInfo = { requiresConfirmation: true, ...state.pinReview };
  }

  async function useMappedPinCandidate() {
    const review = state.pinReview;
    if (!review) return;
    state.pin = { ...review.candidate };
    state.pinReview = null;
    state.pinPlacementConfirmed = true;
    state.snapInfo = { confirmedMapped: true, ...review };
    pinMarker.setLatLng([state.pin.lat, state.pin.lon]);
    state.proj = G.makeProjection(state.pin.lat, state.pin.lon);
    prepareBuildings();
    if (!await recompute()) return;
    setStatus('Mapped starting footprint confirmed; the calculation now uses its walls.');
  }

  function keepExactPin() {
    if (!state.pinReview) return;
    const review = state.pinReview;
    state.pinReview = null;
    state.pinPlacementConfirmed = true;
    state.snapInfo = { keptExact: true, distanceM: review.distanceM,
      reason: 'You kept the exact address or map pin instead of the nearby footprint.' };
    render();
    setStatus('Exact pin confirmed; the nearby mapped footprint was not substituted.');
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
      const houses = cluster.houseCount == null ? cluster.members.length : cluster.houseCount;
      const label = `Settlement #${index + 1}: ${houses} counted house${houses === 1 ? '' : 's'}; ${cluster.members.length - houses} join-only perimeter${cluster.members.length - houses === 1 ? '' : 's'}` +
        (isHome ? '<br><b>This is the selected home city.</b>' : '') +
        `<br>Dashed box is its derived outer rectangle after 70⅔-amah chaining and settlement merges.`;
      L.polygon(cornersToLatLngs(cluster.corners), {
        color, weight: isHome ? 3 : 1.5, dashArray: isHome ? '10 5' : '6 6',
        fill: true, fillColor: color, fillOpacity: isHome ? 0.055 : 0.018,
        // lets a click reach a footprint underneath while footprints are shown
        interactive: !document.getElementById('layer-buildings').checked,
      }).bindTooltip(label, { sticky: true }).addTo(layerGroups.settlements);

      const center = cluster.corners.reduce((p, c) => ({ x: p.x + c.x / 4, y: p.y + c.y / 4 }), { x: 0, y: 0 });
      const ll = state.proj.toLatLon(center.x, center.y);
      // Rectangles remain hoverable, but persistent labels are limited to the
      // selected home settlement so the audit map remains readable.
      if (isHome) L.marker([ll.lat, ll.lon], {
        interactive: false,
        icon: L.divIcon({ className: 'cluster-label', html: `<span>HOME · #${index + 1} · ${houses} footprints</span>` }),
      }).addTo(layerGroups.settlements);
    });
    const home = res.homeCluster >= 0 ? res.clusters[res.homeCluster] : null;
    summary.textContent = `${res.clusters.length} settlement${res.clusters.length === 1 ? '' : 's'} derived; ` +
      (home ? `home is #${res.homeCluster + 1} with ${home.houseCount == null ? home.members.length : home.houseCount} counted footprints. ` : 'the pin did not join a settlement. ') +
      `70⅔ amos = ${res.thresholds.joinM.toFixed(1)} m; 141⅓ amos = ${res.thresholds.t2.toFixed(1)} m.`;
    const review = document.getElementById('cluster-review');
    const focused = review.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused && focused.dataset.clusterKey
      ? { key: focused.dataset.clusterKey, field: focused.dataset.field } : null;
    review.replaceChildren();
    const title = document.createElement('b'); title.textContent = 'Pre-merge city-status components'; review.appendChild(title);
    qualificationClusters.forEach((cluster, index) => {
      const row = document.createElement('label');
      const text = document.createElement('span');
      text.innerHTML = `Component #${index + 1} · ${cluster.houseCount == null ? cluster.members.length : cluster.houseCount} counted footprints<small>${cluster.qualifiesAsCity ? 'qualifies' : 'does not qualify'} via ${escapeHtml(cluster.qualificationSource)}${cluster.qualificationProvisional ? ' · PROVISIONAL' : ''}</small>`;
      const select = document.createElement('select'); select.setAttribute('aria-label', `Pre-merge component ${index + 1} city status`);
      select.dataset.clusterKey = cluster.key; select.dataset.field = 'status';
      [
        ['', 'Use provisional six-footprint proxy'],
        ['three-courtyards', 'Qualifies: 3 courtyards × 2 houses'],
        ['fifty-residents', 'Qualifies: at least 50 residents'],
        ['rav-attestation', 'Qualifies: rav-attested other basis'],
        ['does-not-qualify', 'Does not qualify'],
      ].forEach(([value, label]) => {
        const option = document.createElement('option'); option.value = value; option.textContent = label; select.appendChild(option);
      });
      const saved = (settings.cityQualificationOverrides || {})[cluster.key];
      const savedDecision = typeof saved === 'boolean' ? saved : saved && saved.decision;
      const savedBasis = saved && typeof saved === 'object' && saved.basis;
      select.value = typeof savedDecision === 'boolean'
        ? (savedDecision ? (savedBasis || 'rav-attestation') : 'does-not-qualify')
        : (cluster.qualificationSource === 'reviewer-remapped'
          ? (cluster.qualifiesAsCity ? (cluster.qualificationBasis || 'rav-attestation') : 'does-not-qualify') : '');
      const evidence = document.createElement('input'); evidence.type = 'text';
      evidence.maxLength = 1000; evidence.placeholder = 'Evidence note: courtyard groups, resident source, or rav/date';
      evidence.setAttribute('aria-label', `Pre-merge component ${index + 1} qualification evidence`);
      evidence.dataset.clusterKey = cluster.key; evidence.dataset.field = 'evidence';
      evidence.value = saved && typeof saved === 'object' && saved.evidence || cluster.qualificationEvidence || '';
      evidence.disabled = select.value === '';
      const saveDecision = () => {
        settings.cityQualificationOverrides = { ...(settings.cityQualificationOverrides || {}) };
        if (select.value === '') delete settings.cityQualificationOverrides[cluster.key];
        else settings.cityQualificationOverrides[cluster.key] = {
          decision: select.value !== 'does-not-qualify', basis: select.value,
          evidence: evidence.value.trim(), memberIds: cluster.memberIds || [],
        };
        saveSettings(); recompute();
      };
      select.addEventListener('change', () => {
        evidence.disabled = select.value === '';
        saveDecision();
      });
      evidence.addEventListener('change', saveDecision);
      row.append(text, select, evidence); review.appendChild(row);
      if (focusKey && focusKey.key === cluster.key) {
        const target = focusKey.field === 'evidence' ? evidence : select;
        if (!target.disabled) target.focus({ preventScroll: true });
      }
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
  let settingsSaveFailed = false;
  function saveSettings() {
    settingsSaveFailed = !S.save(settings);
    if (settingsSaveFailed) setStatus(document.getElementById('status').dataset.message || '');
  }
  function setStatus(msg) {
    const el = document.getElementById('status');
    el.dataset.message = msg;
    el.textContent = msg + (settingsSaveFailed
      ? ' ⚠ Settings could not be saved in this browser; they apply only until you reload.' : '');
  }

  // Plain text of every result block. The simplified design later moves blocks into collapsed
  // <details>, so exports must not read the visible text of #results.
  let resultSummaryText = '';
  function summaryTextFromBlocks(html) {
    const holder = document.createElement('div');
    holder.innerHTML = html;
    holder.querySelectorAll('button').forEach((button) => button.remove());
    return [...holder.children].map((block) => [...block.childNodes]
      .map((node) => node.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' '))
      .filter(Boolean).join('\n');
  }

  function renderPanel() {
    const res = state.result;
    const el = document.getElementById('results');
    if (!res) { el.innerHTML = ''; resultSummaryText = ''; return; }
    const counts = { dwelling: 0, unknown: 0, review: 0, non: 0 };
    for (const b of state.buildings) counts[b.klass] = (counts[b.klass] || 0) + 1;
    const homeSize = res.homeCluster >= 0 && res.clusters[res.homeCluster]
      ? (res.clusters[res.homeCluster].houseCount == null ? res.clusters[res.homeCluster].members.length : res.clusters[res.homeCluster].houseCount) : 0;
    const amahM = settings.amahCm / 100;
    const uncertainCount = counts.unknown + counts.review;
    const uncertainRatio = state.buildings.length ? uncertainCount / state.buildings.length : 0;
    const home = res.homeCluster >= 0 ? res.clusters[res.homeCluster] : null;
    const homeComponentKeys = new Set(home && home.componentKeys ? home.componentKeys : home ? [home.key] : []);
    const provisionalHome = (res.qualificationClusters || []).filter((cluster) =>
      cluster.qualificationProvisional && cluster.qualifiesAsCity && homeComponentKeys.has(cluster.key));
    const lines = [];
    if (state.dataCapHit) {
      // A town cut off by the data limit is not an inner bound. A cut-off neighbour can make a
      // three-villages join come out either way, so the boundary can be too large as well as too
      // small, and the home town itself can be the wrong one. First in the answer.
      const capHelp = state.dataCapReason === 'failed'
        ? 'Loading a wider area failed. Calculate again to retry.'
        : state.dataCapReason === 'snapshot'
          ? 'This snapshot holds less map data than these settings need. Calculate again to load the rest.'
          : state.dataCapReason === 'snapshot-area-unknown'
            ? 'This snapshot does not record which area its map data covers, so it cannot be checked. Calculate again to load the data.'
            : `The search stopped at the ${settings.maxBuildings.toLocaleString()}-building data limit. Raise “Max buildings” in All settings → Buildings & data and calculate again.`;
      lines.push(`<div class="warn accuracy-status data-limit"><b>Incomplete: the map data ran out</b><span>The town, or a town that can join it, continues past the loaded map data. ` +
        `With the rest of the data this boundary could be larger or smaller, and the home town could be a different one, so do not rely on it. ` +
        `There is no halachic limit on a town's length. ${escapeHtml(capHelp)}</span></div>`);
    }
    if (res.calculationStatus === 'provisional-no-fill') {
      lines.push('<div class="warn"><b>Provisional smaller boundary:</b> a material bow/L pocket has not yet received reviewer-confirmed endpoints. The app has not filled that pocket.</div>');
    }
    if (state.pinReview) {
      const pinBuildingWords = { dwelling: 'home', unknown: 'building whose use is not known',
        review: 'building that needs a rav’s review', non: 'non-dwelling building' }[state.pinReview.klass] || 'building';
      lines.push(`<div class="warn pin-confirmation"><b>Confirm your starting place</b><span title="${escapeHtml(state.pinReview.reason)}">The address pin is ${state.pinReview.distanceM.toFixed(1)} m from a mapped ${escapeHtml(pinBuildingWords)}. The calculator has <b>not moved it</b>.</span><span class="pin-confirm-actions"><button type="button" id="btn-use-mapped-pin">Use mapped building</button><button type="button" id="btn-keep-exact-pin">Keep exact pin</button></span></div>`);
    } else if (state.snapInfo) {
      if (state.snapInfo.confirmedMapped) lines.push(`<div class="note"><b>Starting building confirmed</b> — you moved the pin ${state.snapInfo.distanceM.toFixed(1)} m to the mapped ${escapeHtml(state.snapInfo.klass)} footprint.</div>`);
      else if (state.snapInfo.alreadyInside) lines.push(`<div class="note"><b>Pin check:</b> the pin is inside a mapped ${escapeHtml(state.snapInfo.klass)} footprint (${escapeHtml(state.snapInfo.reason)}).</div>`);
      else lines.push(`<div class="note"><b>Exact pin kept:</b> ${escapeHtml(state.snapInfo.reason || 'No mapped building was substituted.')}</div>`);
    }
    if (provisionalHome.length) {
      lines.push(`<div class="warn accuracy-status"><b>City status needs rav review</b><span>${provisionalHome.length} component${provisionalHome.length === 1 ? '' : 's'} contributing to the home city ${provisionalHome.length === 1 ? 'uses' : 'use'} the provisional six-footprint proxy. Confirm the actual courtyard/resident basis before relying on this boundary.</span></div>`);
    }
    // When the pin sits between several cities, the drawing is only their common area. That is
    // the most important flag on the page, so show it in the answer card, not in a closed list.
    const homeAmbiguity = res.warnings.find((w) => w.type === 'multiple-home-candidates');
    if (homeAmbiguity) {
      lines.push(`<div class="warn accuracy-status"><b>Starting city needs rav review</b><span>${escapeHtml(homeAmbiguity.text)}</span></div>`);
    }
    if (uncertainCount && (uncertainRatio >= 0.25 || uncertainCount >= 100)) {
      lines.push(`<div class="warn accuracy-status"><b>Building classification can move this boundary</b><span>${uncertainCount.toLocaleString()} of ${state.buildings.length.toLocaleString()} footprints (${Math.round(uncertainRatio * 100)}%) have unknown or ambiguous use and are included automatically. Review the prioritized boundary and home-city structures first.</span></div>`);
    }
    const modeLabel = res.mode === 'city'
      ? 'city (whole city = 4 amos)'
      : res.mode === 'building' ? 'building shevisa (measured from mapped walls)' : 'open field (point shevisa)';
    lines.push(`<div class="stat"><b>Mode:</b> ${modeLabel}</div>`);
    if (res.mode === 'city' && res.squaring) {
      const angleText = `${Math.abs(res.squaring.angleDeg || 0).toFixed(1)}°`;
      const squareText = res.squaring.method === 'preserved-rectangle'
        ? `existing rectangular direction preserved (${angleText}; SA/MB 398:1)`
        : res.squaring.method === 'reviewer-angle'
          ? `reviewer-set direction (${angleText})`
          : 'irregular city squared to the world directions (SA 398:2–3)';
      lines.push(`<div class="stat"><b>City squaring:</b> ${squareText}</div>`);
      lines.push(`<div class="stat"><b>Overlap rule:</b> ${escapeHtml(res.overlapPolicy || settings.overlapPolicy)}${(res.cityRegions || []).length > 1 ? ` · ${(res.cityRegions || []).length} stepped regions` : ''}</div>`);
    }
    lines.push(`<div class="stat"><b>Buildings fetched:</b> ${state.buildings.length} — ` +
      `<span class="sw dw"></span>${counts.dwelling} identified dwelling, <span class="sw un"></span>${counts.unknown} use-unknown, ` +
      `<span class="sw rv"></span>${counts.review} optional-review, <span class="sw no"></span>${counts.non} non-dwelling</div>`);
    if (settings.showVerifiedOnly && state.buildings.length > COMPARISON_SCENARIO_MAX_BUILDINGS) {
      lines.push('<div class="note"><b>Verified-dwellings comparison omitted:</b> this optional second scenario is disabled above 10,000 footprints to keep large-city calculations responsive. The primary techum still uses the complete fetched dataset.</div>');
    }
    if (settings.secondAmahCm && settings.secondAmahCm !== settings.amahCm && state.buildings.length > COMPARISON_SCENARIO_MAX_BUILDINGS) {
      lines.push('<div class="note"><b>Comparison-amah line omitted:</b> this optional second full-city scenario is disabled above 10,000 footprints. Change the primary amah and recalculate to evaluate that shita on a large city.</div>');
    }
    // An extra line drawn from map data that does not cover its own town.
    const scenarioCut = state.scenarioIncomplete || {};
    if (scenarioCut.comparison) {
      lines.push('<div class="warn">⚠ <b>Comparison line incomplete:</b> with the second amah the town needs map data that was not loaded for the main result, so the dotted comparison line could be larger or smaller. Choose a profile with that amah and calculate to load what it needs.</div>');
    }
    if (scenarioCut.verified) {
      lines.push('<div class="warn">⚠ <b>Verified-dwellings line incomplete:</b> that line’s town needs map data that was not loaded for the main result, so the dotted line could be larger or smaller.</div>');
    }
    if (res.mode === 'city') lines.push(`<div class="stat"><b>Home city cluster:</b> ${homeSize} counted footprints</div>`);
    if (res.mode === 'building' && res.homeBuilding >= 0) {
      const homeBuilding = state.buildings[res.homeBuilding];
      lines.push(`<div class="stat"><b>Starting structure:</b> mapped footprint ${escapeHtml(homeBuilding && homeBuilding.id ? homeBuilding.id : String(res.homeBuilding + 1))}</div>`);
    }
    const smallCount = settings.minSizeFilter
      ? state.buildings.filter((b) => isTooSmall(b) && state.overrides.get(b.id) !== 'include').length : 0;
    if (smallCount) lines.push(`<div class="stat"><b>Below 4×4 amos (excluded):</b> ${smallCount} structures</div>`);
    lines.push(`<div class="stat"><b>Thresholds:</b> join 70⅔ amos = ${(70.667 * amahM).toFixed(1)} m · ` +
      `city-merge 141⅓ = ${(141.333 * amahM).toFixed(1)} m · techum 2000 = ${(2000 * amahM).toFixed(0)} m` +
      (settings.karpef ? ` · karpef +${(70.667 * amahM).toFixed(1)} m` : '') + `</div>`);
    const seenWarnings = new Map();
    // A big town merges dozens of settlement pairs, each with its own gap. One line per gap
    // buried every other warning (about 100 lines for Monsey), so list them as one range.
    const mergeGaps = res.warnings.filter((w) => w.type === 'city-merge')
      .map((w) => Number((/gap ([\d.]+) m/.exec(w.text) || [])[1])).filter(Number.isFinite);
    const mergeSummary = mergeGaps.length > 1
      ? `${mergeGaps.length} pairs of settlements merged (gaps ${Math.min(...mergeGaps).toFixed(1)}–${Math.max(...mergeGaps).toFixed(1)} m, each within 141⅓ amos).`
      : null;
    for (const w of res.warnings) {
      if (w === homeAmbiguity) continue;
      const key = w.type + '|' + (mergeSummary && w.type === 'city-merge' ? mergeSummary : w.text);
      if (mergeSummary && w.type === 'city-merge' && seenWarnings.has(key)) continue;
      seenWarnings.set(key, (seenWarnings.get(key) || 0) + 1);
    }
    for (const [key, count] of seenWarnings) {
      const [type, text] = [key.slice(0, key.indexOf('|')), key.slice(key.indexOf('|') + 1)];
      const informational = type === 'point-mode';
      const cls = informational ? 'note' : 'warn';
      lines.push(`<div class="${cls}">${informational ? 'ℹ' : '⚠'} ${escapeHtml(text)}${count > 1 ? ` <b>(×${count})</b>` : ''}</div>`);
    }
    el.innerHTML = lines.join('');
    resultSummaryText = summaryTextFromBlocks(lines.join(''));
    const useMapped = document.getElementById('btn-use-mapped-pin');
    const keepExact = document.getElementById('btn-keep-exact-pin');
    if (useMapped) useMapped.addEventListener('click', () => void useMappedPinCandidate());
    if (keepExact) keepExact.addEventListener('click', keepExactPin);
    renderConfidence();
  }

  function renderConfidence() {
    const el = document.getElementById('confidence');
    const report = D.computeDataConfidence(state.buildings);
    const uncertain = report.needsReview;
    const ratio = report.total ? uncertain / report.total : 0;
    const home = state.result && state.result.homeCluster >= 0 ? state.result.clusters[state.result.homeCluster] : null;
    const homeKeys = new Set(home && home.componentKeys ? home.componentKeys : home ? [home.key] : []);
    const provisional = state.result ? (state.result.qualificationClusters || []).filter((cluster) =>
      cluster.qualificationProvisional && cluster.qualifiesAsCity && homeKeys.has(cluster.key)).length : 0;
    const level = state.dataCapHit ? 'poor' : (provisional || ratio >= 0.25 || uncertain >= 100) ? 'mixed' : 'good';
    const label = state.dataCapHit ? 'Building fetch incomplete'
      : level === 'mixed' ? 'Review required before relying' : 'Automatic building map ready';
    el.className = `confidence ${level}`;
    el.innerHTML = `<b>${label}</b><span>${state.buildings.length.toLocaleString()} Overture footprints loaded. ` +
      `${uncertain.toLocaleString()} structures have unknown or ambiguous use and are included automatically.` +
      `${provisional ? ` ${provisional} home-city status decision${provisional === 1 ? '' : 's'} remain provisional.` : ''}` +
      `${state.dataCapHit ? ' Fetch boundary is incomplete.' : ''}</span>`;
    el.hidden = false;
  }

  function renderReviewQueue() {
    const el = document.getElementById('review-queue');
    if (!settings.showAuditRings) { el.hidden = true; el.replaceChildren(); return; }
    const res = state.result;
    const homeMembers = res && res.homeCluster >= 0 && res.clusters[res.homeCluster]
      ? new Set(res.clusters[res.homeCluster].members) : new Set();
    if (res && res.mode === 'building' && res.homeBuilding >= 0) homeMembers.add(res.homeBuilding);
    const homeBoxes = [...homeMembers].map((index) => state.buildings[index] && state.buildings[index].bbox).filter(Boolean);
    const extent = homeBoxes.length ? homeBoxes.reduce((box, bbox) => ({
      minX: Math.min(box.minX, bbox.minX), minY: Math.min(box.minY, bbox.minY),
      maxX: Math.max(box.maxX, bbox.maxX), maxY: Math.max(box.maxY, bbox.maxY),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }) : null;
    const items = state.buildings.map((building, index) => ({ building, index })).filter(({ building }) =>
      building.klass === 'unknown' || building.klass === 'review').map((item) => {
      const inHome = homeMembers.has(item.index);
      const b = item.building;
      const outerEdge = inHome && extent && (Math.abs(b.bbox.minX - extent.minX) < 2 ||
        Math.abs(b.bbox.maxX - extent.maxX) < 2 || Math.abs(b.bbox.minY - extent.minY) < 2 ||
        Math.abs(b.bbox.maxY - extent.maxY) < 2);
      const starting = (res && res.homeBuilding === item.index) || (state.pinReview && state.pinReview.buildingId === b.id);
      const score = (starting ? 1000 : 0) + (outerEdge ? 500 : 0) + (inHome ? 250 : 0) + (b.klass === 'review' ? 50 : 0);
      return { ...item, score, impact: starting ? 'starting place' : outerEdge ? 'outer edge' : inHome ? 'home city' : 'nearby' };
    }).sort((a, b) => b.score - a.score || String(a.building.id).localeCompare(String(b.building.id)));
    const bows = (state.result && state.result.concavityAudit) || [];
    if (!items.length && !bows.length) { el.hidden = true; el.replaceChildren(); return; }
    const head = document.createElement('div'); head.className = 'review-title';
    head.innerHTML = `<b>Priority review</b><span>${items.length} ambiguous or untagged structures · highest boundary impact first</span>`;
    const list = document.createElement('div'); list.className = 'review-list';
    bows.forEach((audit) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'bow-review';
      button.innerHTML = `<span>⌁</span><b>${audit.shapeKind === 'hole' ? 'Large enclosed hole' : 'Bow / L-shaped pocket'}</b><small>${audit.reviewerEndpoints ? `Endpoints applied · ${escapeHtml(audit.reviewStatus)}` : audit.shapeKind === 'hole' ? escapeHtml(audit.reviewStatus) : 'Select two endpoints; provisional no-fill is active'}</small>`;
      button.addEventListener('click', () => recordConcavityEndpoints(audit.reviewKey)); list.appendChild(button);
    });
    items.slice(0, 20).forEach(({ building: b, impact }) => {
      const button = document.createElement('button'); button.type = 'button';
      button.innerHTML = `<span class="sw ${b.klass === 'unknown' ? 'un' : 'rv'}"></span><b>${escapeHtml(impact)}</b><small>${escapeHtml(b.klass)} · ${escapeHtml(b.reason)}</small>`;
      button.addEventListener('click', () => {
        const sw = state.proj.toLatLon(b.bbox.minX, b.bbox.minY), ne = state.proj.toLatLon(b.bbox.maxX, b.bbox.maxY);
        map.fitBounds([[sw.lat, sw.lon], [ne.lat, ne.lon]], { maxZoom: 20, padding: [40, 40] });
        if (b.mapLayer) b.mapLayer.openTooltip();
      });
      list.appendChild(button);
    });
    if (items.length > 20) {
      const more = document.createElement('small'); more.className = 'muted';
      more.textContent = `Showing the 20 highest-impact structures of ${items.length}; use the map to inspect the rest.`; list.appendChild(more);
    }
    el.replaceChildren(head, list); el.hidden = false;
  }

  function recordConcavityEndpoints(reviewKey) {
    cancelMapMode(false);
    bowCapture = { reviewKey, points: [] };
    document.getElementById('btn-cancel-map-mode').hidden = false;
    document.body.classList.add('map-mode-active');
    setStatus('Bow review mode: click the first halachic endpoint. Press Escape or Cancel to stop. The selected bow rule will be recalculated after the second point.');
  }
  function addBowEndpoint(latlng) {
    bowCapture.points.push(state.proj.toXY(latlng.lat, latlng.lng));
    if (bowCapture.points.length < 2) { setStatus('Bow review mode: click the second endpoint, or press Escape to cancel.'); return; }
    const capture = bowCapture;
    settings.concavityReviews = { ...(settings.concavityReviews || {}) };
    settings.concavityReviews[capture.reviewKey] = { endpoints: capture.points };
    cancelMapMode(false); saveSettings(); recompute();
    setStatus('Bow endpoints recorded and the selected bow rule was applied. Review the updated boundary and audit before approval.');
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
      `Overlapping-ribua policy: ${settings.overlapPolicy}`,
      `Large enclosed-hole policy: ${settings.largeHolePolicy}`,
      `Bow/L policy: ${settings.bowPolicy}`,
      `City minimum: actual rule is 3 courtyards × 2 houses (or sourced resident-count route); unreviewed components use a PROVISIONAL ${settings.minCityHouses}-footprint proxy`,
      `Min dwelling size 4x4 amos filter: ${settings.minSizeFilter ? 'on' : 'off'}`,
      `Untagged buildings: ${settings.includeUnknown ? 'included (flagged)' : 'excluded'}; ambiguous: ${settings.includeReview ? 'included (flagged)' : 'excluded'}`,
      '== Audit / reproducibility ==',
      `Engine version: ${ENGINE_VERSION} (deterministic: same data + same settings = same output)`,
      `Building data: Overture ${state.dataRelease || 'release unknown'}, fetched ${state.fetchedAt || 'n/a'}; extent S${bb ? bb.south.toFixed(5) : '?'} W${bb ? bb.west.toFixed(5) : '?'} N${bb ? bb.north.toFixed(5) : '?'} E${bb ? bb.east.toFixed(5) : '?'}`,
      `Buildings: ${state.buildings.length} (${counts.dwelling} dwelling / ${counts.unknown} untagged / ${counts.review} ambiguous / ${counts.non} non)`,
      `Manual missing-building footprints: ${state.manualBuildings.length} (reviewer supplied)`,
      `Accepted shared corrections applied: ${state.correctionsApplied || 0}`,
      `Rav-validated enclosure perimeter: ${state.validatedPerimeter ? (settings.useValidatedPerimeter ? 'ACTIVE as city edge' : 'stored but inactive') : 'none'}`,
      `Rav-validated residential joining perimeters: ${state.validatedJoinPerimeters.length} (join geometry only; each counts as zero houses)`,
      `Manual overrides: ${state.overrides.size}${state.overrides.size ? ' [' + [...state.overrides.entries()].map(([id, v]) => id + ':' + v).join(', ') + ']' : ''}`,
      `Search frontier closed: ${state.dataCapHit ? 'NO — data limit reached; the town continues past the loaded data, so the result is incomplete and may be too large or too small' : 'yes'}`,
      `Extra lines from cut-off data: ${['comparison', 'verified'].filter((k) => (state.scenarioIncomplete || {})[k]).join(', ') || 'none'}`,
      `Projection: local true-north tangent plane @ pin (per-point lon scaling)`,
      `Shevisa pin: ${state.pin ? state.pin.lat.toFixed(6) + ', ' + state.pin.lon.toFixed(6) : 'n/a'}`,
      `Generated: ${new Date().toISOString()} — DRAFT, requires review by a rav/mumcheh.`,
    ].join('\n');
  }

  // ---------------- snapshots (determinism / offline reproducibility) ----------------
  // The engine is pure; the only thing that changes between runs is map-release data. A snapshot
  // freezes the fetched buildings + pin + settings + overrides so the identical result is
  // reproducible forever (and shareable) without refetching.
  function saveSnapshot() {
    if (!state.result) { setStatus('Calculate a techum before saving a snapshot.'); return; }
    const snap = {
      format: 'techum-snapshot', version: ENGINE_VERSION,
      pin: state.pin, label: state.lastLabel || null, fetchedAt: state.fetchedAt, fetchBBox: state.fetchBBox,
      dataRelease: state.dataRelease, dataSource: state.dataSource,
      dataCapHit: state.dataCapHit, correctionsApplied: state.correctionsApplied || 0,
      settings, overrides: [...state.overrides.entries()],
      rawBuildings: state.rawBuildings, manualBuildings: state.manualBuildings,
      validatedPerimeter: state.validatedPerimeter,
      validatedJoinPerimeters: state.validatedJoinPerimeters,
    };
    K.download('techum-snapshot.json', JSON.stringify(snap), 'application/json');
    track('snapshot', { action: 'save' });
    setStatus('Snapshot saved. Load snapshot replays this exact map later.');
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
    clearTimeout(automaticCalculationTimer);
    cancelCalculation();
    cancelMapMode(false);
    const label = (registryEntry && registryEntry.cityLabel) || snap.label
      || `Snapshot pin (${Number(snap.pin.lat).toFixed(5)}, ${Number(snap.pin.lon).toFixed(5)})`;
    state.lastQuery = null; state.lastLabel = label;
    document.getElementById('address').value = label;
    state.pin = snap.pin; state.fetchedAt = snap.fetchedAt; state.fetchBBox = snap.fetchBBox; state.fromSnapshot = true;
    state.dataRelease = snap.dataRelease || null; state.dataSource = snap.dataSource || 'snapshot';
    state.dataCapHit = !!snap.dataCapHit; state.rawBuildings = snap.rawBuildings;
    // Older snapshots did not record this; never carry over the previous calculation's count.
    state.correctionsApplied = Number(snap.correctionsApplied) || 0;
    state.manualBuildings = snap.manualBuildings || []; state.overrides = new Map(snap.overrides || []);
    state.validatedPerimeter = snap.validatedPerimeter || null;
    state.validatedJoinPerimeters = snap.validatedJoinPerimeters || [];
    settings = S.normalize(snap.settings); saveSettings(); refreshSettingsInputs();
    state.proj = G.makeProjection(state.pin.lat, state.pin.lon); setPin(state.pin.lat, state.pin.lon, { confirmed: true });
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
          try {
            const detail = await fetch(`/api/registry/${encodeURIComponent(entry.slug)}`);
            if (!detail.ok) throw new Error(`HTTP ${detail.status}`);
            const full = await detail.json();
            applySnapshot(full.snapshot, full);
          } catch (e) { setStatus('Registry load failed: ' + e.message); }
        });
        row.append(info, load); el.appendChild(row);
      });
    } catch (e) { el.textContent = 'Reviewed library unavailable: ' + e.message; }
  }

  // KML and KMZ carry the same layers, including the comparison-amah line when it is on.
  function buildKmlText(res) {
    const toPath = (corners) => corners && cornersToLatLngs(corners).map(([lat, lon]) => ({ lat, lon }));
    const toPaths = (regions) => (regions || []).map(toPath).filter(Boolean);
    let second = null;
    let secondRegions = [];
    if (canRunComparisonAmah()) {
      const res2 = G.runPipeline(state.buildings, geometrySettings(settings.secondAmahCm), state.proj.toXY(state.pin.lat, state.pin.lon));
      second = toPath(res2.techumCorners);
      secondRegions = toPaths(res2.techumRegions);
    }
    return K.buildKML({
      pin: state.pin,
      techum: toPath(res.techumCorners),
      city: toPath(res.cityCorners),
      karpef: toPath(res.karpefCorners),
      techumRegions: toPaths(res.techumRegions), cityRegions: toPaths(res.cityRegions),
      karpefRegions: toPaths(res.karpefRegions), second, secondRegions,
      ...exportAuditLayers(res, toPath),
    }, configText());
  }

  function exportKML() {
    const res = state.result;
    if (!res) { setStatus('Calculate a techum before exporting KML.'); return; }
    K.download('techum-draft.kml', buildKmlText(res));
    track('export', { format: 'kml' });
    setStatus('KML exported for Google Earth review.');
  }

  function exportGeoJSON() {
    const res = state.result;
    if (!res) { setStatus('Calculate a techum before exporting GeoJSON.'); return; }
    const toPath = (corners) => corners && cornersToLatLngs(corners).map(([lat, lon]) => ({ lat, lon }));
    const toPaths = (regions) => (regions || []).map(toPath).filter(Boolean);
    const fc = K.buildGeoJSON({
      pin: state.pin, techum: toPath(res.techumCorners), city: toPath(res.cityCorners), karpef: toPath(res.karpefCorners),
      techumRegions: toPaths(res.techumRegions), cityRegions: toPaths(res.cityRegions), karpefRegions: toPaths(res.karpefRegions),
      ...exportAuditLayers(res, toPath),
    }, { config: configText(), dataConfidence: D.computeDataConfidence(state.buildings) });
    K.download('techum-draft.geojson', JSON.stringify(fc, null, 2), 'application/geo+json');
    track('export', { format: 'geojson' });
    setStatus('GeoJSON exported.');
  }

  function exportKMZ() {
    const res = state.result;
    if (!res) { setStatus('Calculate a techum before exporting KMZ.'); return; }
    downloadBlob('techum-draft.kmz', new Blob([K.buildKMZ(buildKmlText(res))], { type: 'application/vnd.google-earth.kmz' }));
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
      description: `Reviewer endpoints; status: ${a.reviewStatus}; applied to boundary: ${a.appliedToBoundary ? 'yes' : 'no'}.`,
      path: a.reviewerEndpoints.map((p) => { const ll = state.proj.toLatLon(p.x, p.y); return { lat: ll.lat, lon: ll.lon }; }),
    }));
    return { buildings, settlements, auditLines };
  }

  // Export libraries load on first use, pinned and integrity-checked, instead of on every page view.
  const EXPORT_LIBRARIES = {
    html2canvas: {
      src: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
      integrity: 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H',
      ready: () => !!window.html2canvas, failure: 'Image exporter did not load. Check the internet connection and try again.',
    },
    jspdf: {
      src: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
      integrity: 'sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/',
      ready: () => !!(window.jspdf && window.jspdf.jsPDF), failure: 'PDF exporter did not load. Check the internet connection and try again.',
    },
  };
  const exportLibraryLoads = new Map();
  function loadExportLibrary(name) {
    const lib = EXPORT_LIBRARIES[name];
    if (lib.ready()) return Promise.resolve();
    if (!exportLibraryLoads.has(name)) {
      exportLibraryLoads.set(name, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = lib.src; script.integrity = lib.integrity; script.crossOrigin = 'anonymous'; script.async = true;
        script.onload = () => {
          if (lib.ready()) { resolve(); return; }
          exportLibraryLoads.delete(name); script.remove(); reject(new Error(lib.failure));
        };
        script.onerror = () => { exportLibraryLoads.delete(name); script.remove(); reject(new Error(lib.failure)); };
        document.head.appendChild(script);
      }));
    }
    return exportLibraryLoads.get(name);
  }
  // The feedback screenshot (js/feedback.js) uses the same lazily loaded html2canvas.
  window.TechumLoadExportLibrary = loadExportLibrary;
  window.TechumNormalizeMapClone = (clonedDocument) => {
    const clonedMap = clonedDocument.getElementById('map');
    if (clonedMap) normalizeLeafletCloneOverlays(clonedMap);
  };

  function exportCaptionLines() {
    const eff = S.effectiveProfile(settings);
    return window.TechumMapExport.exportCaptionLines({
      label: state.lastLabel || (state.pin ? `${state.pin.lat.toFixed(5)}, ${state.pin.lon.toFixed(5)}` : ''),
      profileLabel: eff === 'custom' ? 'Custom (edited) settings' : S.PROFILES[settings.profile].label,
      amahCm: settings.amahCm,
      incomplete: state.dataCapHit, // a shared image names an incomplete result
    });
  }

  // The techum (every region) with a 5% margin, or null before a result exists.
  function techumBounds() {
    if (!state.result || !state.result.techumCorners) return null;
    const regions = state.result.techumRegions && state.result.techumRegions.length
      ? state.result.techumRegions : [state.result.techumCorners];
    const pts = regions.flat().map((p) => {
      const ll = state.proj.toLatLon(p.x, p.y);
      return [ll.lat, ll.lon];
    });
    return L.latLngBounds(pts).pad(0.05);
  }

  // Downloads are a fixed square framed on the techum, whatever the screen size: 2 x 2
  // Google images at full sharpness, captured at 2x (2456 x 2456 pixels).
  const EXPORT_CANVAS_SCALE = 2;
  function frameMapForExport() {
    const mapElement = document.getElementById('map');
    const originalStyle = mapElement.getAttribute('style');
    const originalCenter = map.getCenter(), originalZoom = map.getZoom();
    const side = window.TechumMapExport.EXPORT_SQUARE_PX;
    Object.assign(mapElement.style, { position: 'fixed', left: '0px', top: '0px', right: 'auto', bottom: 'auto',
      width: `${side}px`, height: `${side}px`, zIndex: '2000' });
    map.invalidateSize({ animate: false, pan: false });
    const bounds = techumBounds();
    if (bounds) {
      const zoom = Math.min(map.getMaxZoom(), Math.floor(map.getBoundsZoom(bounds, false)));
      map.setView(bounds.getCenter(), zoom, { animate: false });
    }
    return {
      restore: () => {
        if (originalStyle === null) mapElement.removeAttribute('style');
        else mapElement.setAttribute('style', originalStyle);
        map.invalidateSize({ animate: false, pan: false });
        map.setView(originalCenter, originalZoom, { animate: false });
      },
    };
  }

  async function captureMapCanvas(options = {}) {
    if (!state.result) throw new Error('Calculate a techum first.');
    await loadExportLibrary('html2canvas');
    if (mapExportInProgress) throw new Error('Another map export is already being prepared. Wait for it to finish.');
    mapExportInProgress = true;
    const originalBaseLayer = activeBaseLayer;
    const interactionLock = lockMapExportInteraction();
    const frame = frameMapForExport();
    let exportLock = null;
    let googleExport = null;
    let fallbackBasemap = null;
    try {
      // Leaflet redraws its tiles and boundary lines for the square view before capture.
      if (activeBaseLayer !== googleBaseLayer) await waitForBaseLayerReady(activeBaseLayer);
      else await new Promise((resolve) => window.setTimeout(resolve, 50));
      exportLock = lockMapExportState();
      if (activeBaseLayer === googleBaseLayer) {
        try {
          googleExport = await prepareGoogleExportUnderlay();
        } catch (error) {
          exportLock.remove();
          const fallbackReady = waitForBaseLayerReady(originalMapLayer);
          fallbackBasemap = 'original satellite map';
          switchBaseLayer(originalMapLayer);
          await fallbackReady;
          console.info('Google export unavailable; using the original satellite map for this export.',
            error instanceof Error ? error.message : String(error));
          exportLock = lockMapExportState();
        }
      }
      exportLock.assertStable();
      exportCaptionForClone = options.caption ? exportCaptionLines() : null;
      const canvas = await window.html2canvas(document.getElementById('map'), {
        useCORS: true, allowTaint: false, backgroundColor: MAP_PALETTE.cream,
        scale: EXPORT_CANVAS_SCALE, logging: false, imageTimeout: 5000,
        onclone: normalizeLeafletExportSvg,
      });
      exportLock.assertStable();
      return { canvas, fallbackBasemap };
    } finally {
      if (googleExport) googleExport.remove();
      if (exportLock) exportLock.remove();
      if (fallbackBasemap && originalBaseLayer === googleBaseLayer && googleBaseLayer) switchBaseLayer(googleBaseLayer);
      frame.restore();
      interactionLock.remove();
      mapExportInProgress = false;
    }
  }

  function waitForBaseLayerReady(layer, timeoutMs = 6000) {
    const layers = layer && typeof layer.getLayers === 'function' ? layer.getLayers() : [layer];
    return new Promise((resolve) => {
      let remaining = layers.length;
      let settled = false;
      let timeout;
      const listeners = [];
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        listeners.forEach(([candidate, listener]) => candidate.off('load', listener));
        // Leaflet's fade animation continues briefly after the layer's load event.
        // Wait for full tile opacity so the fallback does not look washed out.
        window.setTimeout(resolve, 450);
      };
      const markReady = () => { remaining -= 1; if (remaining <= 0) finish(); };
      if (!remaining) { finish(); return; }
      layers.forEach((candidate) => {
        if (!candidate || typeof candidate.once !== 'function') { markReady(); return; }
        let ready = false;
        const listener = () => {
          if (ready) return;
          ready = true;
          candidate.off('load', listener);
          markReady();
        };
        listeners.push([candidate, listener]);
        candidate.once('load', listener);
        queueMicrotask(() => {
          if (typeof candidate.isLoading === 'function' && !candidate.isLoading()) listener();
        });
      });
      timeout = window.setTimeout(finish, timeoutMs);
    });
  }

  let exportCaptionForClone = null;
  function normalizeLeafletExportSvg(clonedDocument) {
    const clonedMap = clonedDocument.getElementById('map');
    if (!clonedMap) return;
    // Interactive controls are not part of the review image; the tile attribution stays.
    clonedMap.querySelectorAll('.leaflet-control-zoom, .leaflet-control-layers').forEach((element) => { element.style.display = 'none'; });
    const key = clonedMap.querySelector('#simple-map-key');
    if (key) {
      key.classList.add('open');
      // Sit above the tile attribution (Leaflet's, or Google's repainted strip) so neither covers the other.
      const attributionHeight = Math.max(0, ...[...clonedMap.querySelectorAll(
        '.leaflet-control-attribution, .google-static-attribution-overlay')].map((element) => element.offsetHeight));
      Object.assign(key.style, { left: '10px', right: 'auto', bottom: `${attributionHeight + 8}px`,
        transform: 'none', maxWidth: 'calc(100% - 20px)', backdropFilter: 'none' });
      const toggle = key.querySelector('.map-key-toggle'); if (toggle) toggle.style.display = 'none';
      const items = key.querySelector('.map-key-items'); if (items) items.style.flexWrap = 'wrap';
    }
    if (exportCaptionForClone) {
      const caption = clonedDocument.createElement('div');
      Object.assign(caption.style, {
        position: 'absolute', zIndex: '1000', top: '10px', left: '10px', maxWidth: 'calc(100% - 20px)', padding: '8px 11px',
        borderRadius: '8px', background: 'rgba(255,250,240,.96)', color: '#253328', font: '600 12px/1.4 system-ui, sans-serif',
        boxShadow: '0 4px 14px rgba(0,0,0,.18)',
      });
      exportCaptionForClone.forEach((text, index) => {
        const line = clonedDocument.createElement('div');
        line.textContent = text;
        if (index === exportCaptionForClone.length - 1 || /^INCOMPLETE/.test(text)) { line.style.color = '#973c58'; line.style.fontWeight = '800'; }
        caption.appendChild(line);
      });
      clonedMap.appendChild(caption);
    }
    normalizeLeafletCloneOverlays(clonedMap);
  }

  // html2canvas ignores the transform Leaflet uses to place the boundary layer, so the
  // shapes land up and to the left of the map. Used by exports and the feedback screenshot.
  function normalizeLeafletCloneOverlays(clonedMap) {
    clonedMap.querySelectorAll('.leaflet-proxy').forEach((element) => { element.style.display = 'none'; });
    clonedMap.querySelectorAll('.leaflet-tile-loaded').forEach((tile) => { tile.style.opacity = '1'; });
    clonedMap.querySelectorAll('.leaflet-overlay-pane > svg.leaflet-zoom-animated').forEach((svg) => {
      const viewBox = window.TechumMapExport?.normalizedLeafletSvgViewBox(svg.getAttribute('viewBox'));
      if (!viewBox) return;
      svg.style.transform = 'none';
      svg.style.left = '0px';
      svg.style.top = '0px';
      svg.setAttribute('viewBox', viewBox);
    });
  }

  function lockMapExportInteraction() {
    const app = document.getElementById('app');
    const original = {
      inert: app.inert, ariaBusy: app.getAttribute('aria-busy'),
    };
    app.inert = true;
    app.setAttribute('aria-busy', 'true');
    const handlers = ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom', 'boxZoom', 'keyboard']
      .map((name) => map[name]).filter(Boolean);
    const enabledHandlers = handlers.filter((handler) => handler.enabled());
    enabledHandlers.forEach((handler) => handler.disable());
    return {
      remove: () => {
        enabledHandlers.forEach((handler) => handler.enable());
        app.inert = original.inert;
        if (original.ariaBusy === null) app.removeAttribute('aria-busy');
        else app.setAttribute('aria-busy', original.ariaBusy);
      },
    };
  }

  function lockMapExportState() {
    const center = map.getCenter();
    const size = map.getSize();
    const original = {
      lat: center.lat, lng: center.lng, zoom: map.getZoom(), width: size.x, height: size.y,
      result: state.result, pin: state.pin, baseLayer: activeBaseLayer,
    };
    let invalidated = false;
    const invalidate = () => { invalidated = true; };
    const events = 'movestart zoomstart resize baselayerchange layeradd layerremove';
    map.on(events, invalidate);
    return {
      assertStable: () => {
        const currentCenter = map.getCenter();
        const currentSize = map.getSize();
        if (invalidated || map.getZoom() !== original.zoom || currentSize.x !== original.width || currentSize.y !== original.height
          || Math.abs(currentCenter.lat - original.lat) > 1e-10 || Math.abs(currentCenter.lng - original.lng) > 1e-10
          || state.result !== original.result || state.pin !== original.pin || activeBaseLayer !== original.baseLayer) {
          throw new Error('The map or calculation changed during export. Try exporting again after it settles.');
        }
      },
      remove: () => map.off(events, invalidate),
    };
  }

  async function prepareGoogleExportUnderlay() {
    if (!window.TechumMapExport) throw new Error('Google map export support did not load. Reload and try again.');
    if (!googleMapsBrowserKey) throw new Error('Google map export is not configured. Reload and try again.');
    const mapElement = document.getElementById('map');
    const size = map.getSize();
    const center = map.getCenter();
    const zoom = map.getZoom();
    const plan = window.TechumMapExport.staticMapPlan({ zoom, width: size.x, height: size.y });
    if (!plan) throw new Error('This zoom level is too low to export the complete Google map view. Zoom in and try again.');
    // The Worker counts Static Maps requests so exports switch to the free map before Google's daily quota refuses.
    const slot = await fetch(`/api/map-export-slot?images=${plan.images.length}`,
      { method: 'POST', headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!slot.ok) throw new Error(slot.status === 429 ? "Today's Google export allowance is used up." : 'Google map export is unavailable right now.');
    const container = document.createElement('div');
    container.className = 'google-static-export-underlay';
    container.setAttribute('aria-hidden', 'true');
    const attributionOverlay = document.createElement('div');
    attributionOverlay.className = 'google-static-attribution-overlay';
    attributionOverlay.setAttribute('aria-hidden', 'true');
    attributionOverlay.style.setProperty('--google-attribution-height', `${plan.attribution.height}px`);
    try {
      const centerPoint = map.project(center, plan.requestZoom);
      const images = plan.images.map((part) => {
        const image = document.createElement('img');
        image.alt = '';
        image.crossOrigin = 'anonymous';
        image.referrerPolicy = 'strict-origin-when-cross-origin';
        Object.assign(image.style, {
          left: `${part.left}px`, top: `${part.top}px`, width: `${part.cssWidth}px`, height: `${part.cssHeight}px`,
        });
        const partCenter = map.unproject(centerPoint.add([part.offsetX, part.offsetY]), plan.requestZoom);
        const params = new URLSearchParams({
          center: `${partCenter.lat.toFixed(7)},${partCenter.lng.toFixed(7)}`, zoom: String(plan.requestZoom),
          size: `${part.width}x${part.height}`, scale: String(plan.scale),
          maptype: 'roadmap', format: 'png32', key: googleMapsBrowserKey,
        });
        const loaded = new Promise((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error('Google map export timed out. Try again shortly.')), 10000);
          image.onload = () => { window.clearTimeout(timeout); resolve(); };
          image.onerror = () => { window.clearTimeout(timeout); reject(new Error('Google could not render this map view for export. Try again shortly.')); };
        });
        image.src = 'https://maps.googleapis.com/maps/api/staticmap?' + params.toString();
        container.appendChild(image);
        return { image, part, loaded };
      });
      await Promise.all(images.map(({ loaded }) => loaded));
      // Each image's own Google strip is hidden under the next row or below the view.
      // Repaint one logo (bottom left) and one "Map data" line (bottom right), straight
      // from Google's images and uncropped, above Leaflet's boundary panes.
      plan.attribution.boxes.forEach((box) => {
        const { image, part } = images[box.image];
        const clip = document.createElement('div');
        Object.assign(clip.style, { position: 'absolute', overflow: 'hidden', top: '0px',
          left: `${box.left}px`, width: `${box.width}px`, height: `${plan.attribution.height}px` });
        const attributionImage = image.cloneNode(false);
        attributionImage.alt = '';
        Object.assign(attributionImage.style, { left: `${part.left - box.left}px`, top: `${-part.contentCssHeight}px` });
        clip.appendChild(attributionImage);
        attributionOverlay.appendChild(clip);
      });
      mapElement.prepend(container);
      mapElement.appendChild(attributionOverlay);
      mapElement.classList.add('google-map-exporting');
      return {
        remove: () => {
          mapElement.classList.remove('google-map-exporting');
          container.remove();
          attributionOverlay.remove();
        },
      };
    } catch (error) {
      container.remove();
      attributionOverlay.remove();
      throw error;
    }
  }

  function downloadBlob(filename, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function exportPNG() {
    setStatus('Rendering the visible map as a PNG image…');
    try {
      const { canvas, fallbackBasemap } = await captureMapCanvas({ caption: true });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Browser could not encode the map image.');
      downloadBlob('techum-review-map.png', blob); track('export', { format: 'png', fallbackBasemap });
      setStatus(fallbackBasemap
        ? 'PNG exported with the original satellite map because Google export was unavailable. The calculated boundaries are unchanged.'
        : 'PNG exported — a square map of the whole techum with the visible audit layers.');
    } catch (e) { setStatus('PNG export failed: ' + e.message); }
  }

  async function exportPDF() {
    setStatus('Rendering a print-ready PDF review sheet…');
    try {
      await loadExportLibrary('jspdf');
      const { canvas, fallbackBasemap } = await captureMapCanvas();
      const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter', compress: true });
      const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
      const margin = 10, usableW = pageW - 2 * margin;
      const paintPdfPage = () => {
        pdf.setFillColor(255, 248, 232); pdf.rect(0, 0, pageW, pageH, 'F');
        pdf.setFillColor(240, 161, 183); pdf.rect(0, 0, pageW, 3, 'F');
        pdf.setFillColor(200, 223, 151); pdf.rect(0, pageH - 2, pageW, 2, 'F');
      };
      paintPdfPage();
      pdf.setTextColor(54, 95, 70); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18);
      pdf.text('Techum Shabbos review map', margin, 13);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(151, 60, 88);
      pdf.text('DRAFT decision-support only - not a psak. Review with a rav/mumcheh.', margin, 19);
      pdf.setTextColor(70, 80, 76); pdf.text(String(state.lastLabel || 'Selected map point'), margin, 24, { maxWidth: usableW });
      pdf.setFillColor(240, 161, 183); pdf.setDrawColor(169, 67, 100); pdf.rect(margin, 26, 7, 4, 'FD');
      pdf.setTextColor(70, 80, 76); pdf.setFontSize(7.5); pdf.text('Techum area', margin + 9, 29);
      pdf.setFillColor(200, 223, 151); pdf.setDrawColor(79, 113, 61); pdf.rect(margin + 38, 26, 7, 4, 'FD');
      pdf.text('Starting city', margin + 47, 29);
      const imageData = canvas.toDataURL('image/jpeg', 0.85);
      const maxH = pageH - 45, ratio = canvas.width / canvas.height;
      let imageW = usableW, imageH = imageW / ratio;
      if (imageH > maxH) { imageH = maxH; imageW = imageH * ratio; }
      const imageX = margin + (usableW - imageW) / 2;
      pdf.addImage(imageData, 'JPEG', imageX, 33, imageW, imageH, undefined, 'FAST');
      pdf.setDrawColor(79, 113, 61); pdf.setLineWidth(0.6); pdf.rect(imageX - 0.4, 32.6, imageW + 0.8, imageH + 0.8);

      const confidence = D.computeDataConfidence(state.buildings);
      const report = 'CALCULATION SUMMARY\n' + resultSummaryText +
        `\n\nMAP-DATA REVIEW\n${confidence.needsReview} of ${confidence.total} fetched footprints need classification review. ` +
        'This does not measure whether every real building is mapped.\n\nACTIVE CONFIGURATION AND AUDIT RECORD\n' + configText();
      const pdfSafeReport = report
        // "70⅔" must print as "70 2/3", not "702/3".
        .replace(/(\d)([⅓⅔])/g, '$1 $2').replace(/⅔/g, '2/3').replace(/⅓/g, '1/3').replace(/×/g, 'x')
        .replace(/[—–]/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/·/g, '-')
        .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...')
        .normalize('NFKD').replace(/[^\x20-\x7E\n]/g, '');
      // Wrap with the font the report is printed in, or long lines run off the page.
      pdf.setFont('courier', 'normal'); pdf.setFontSize(8.5);
      const lines = pdfSafeReport.split('\n').flatMap((line) =>
        line ? pdf.splitTextToSize(line, usableW) : ['']);
      pdf.addPage('letter', 'landscape'); paintPdfPage();
      pdf.setTextColor(54, 95, 70); pdf.setFont('courier', 'normal'); pdf.setFontSize(8.5);
      let y = 12;
      for (const line of lines) {
        if (y > pageH - 10) {
          pdf.addPage('letter', 'landscape'); paintPdfPage();
          pdf.setTextColor(54, 95, 70); pdf.setFont('courier', 'normal'); pdf.setFontSize(8.5); y = 12;
        }
        pdf.text(line, margin, y); y += 4;
      }
      const pages = pdf.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        pdf.setPage(i); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(79, 113, 61);
        pdf.text(`Page ${i} of ${pages} - generated ${new Date().toISOString()}`, pageW - margin, pageH - 4, { align: 'right' });
      }
      pdf.save('techum-review.pdf'); track('export', { format: 'pdf', fallbackBasemap });
      setStatus(fallbackBasemap
        ? 'PDF exported with the original satellite map because Google export was unavailable. The calculated boundaries are unchanged.'
        : 'PDF exported — it includes the map, warnings, confidence limits, and active configuration.');
    } catch (e) {
      setStatus('PDF export failed: ' + e.message);
    }
  }

  // ---------------- settings UI ----------------
  let refreshSettingsInputs = () => {};
  function bindSettings() {
    const $ = (id) => document.getElementById(id);
    const refreshInputs = refreshSettingsInputs = () => {
      $('profile').value = S.effectiveProfile(settings) === 'custom' ? 'custom' : settings.profile;
      $('profile-explanation').innerHTML = PROFILE_EXPLANATIONS[S.effectiveProfile(settings)] || PROFILE_EXPLANATIONS.custom;
      $('amah').value = String(settings.amahCm);
      $('karpef').checked = settings.karpef;
      $('sq-angle').value = settings.squaringAngleDeg;
      $('point-angle').value = settings.pointRotationDeg;
      $('overlap').value = settings.overlapPolicy;
      $('large-hole-policy').value = settings.largeHolePolicy;
      $('bow-policy').value = settings.bowPolicy;
      $('inc-unknown').checked = settings.includeUnknown;
      $('inc-review').checked = settings.includeReview;
      $('min-size').checked = settings.minSizeFilter;
      $('verified-only').checked = settings.showVerifiedOnly;
      $('second-amah').value = String(settings.secondAmahCm || 0);
      $('show-12mil').checked = settings.show12mil;
      $('audit-rings').checked = settings.showAuditRings;
      $('fetch-radius').value = settings.fetchRadiusM;
      $('max-buildings').value = settings.maxBuildings;
      $('use-perimeter').checked = !!settings.useValidatedPerimeter && !!state.validatedPerimeter;
      // Lets the simplified design's quick-settings card mirror programmatic changes.
      document.dispatchEvent(new CustomEvent('techum:settings-refreshed'));
    };
    // Re-analyze only a current result: after a pin move the loaded buildings belong to the old place.
    const onChange = () => { saveSettings(); if (state.result) recompute(); };

    $('profile').addEventListener('change', (e) => {
      if (e.target.value !== 'custom') settings = S.applyProfile(settings, e.target.value);
      refreshInputs(); onChange();
    });
    $('amah').addEventListener('change', (e) => { settings.amahCm = parseFloat(e.target.value); refreshInputs(); onChange(); });
    $('karpef').addEventListener('change', (e) => { settings.karpef = e.target.checked; refreshInputs(); onChange(); });
    $('sq-angle').addEventListener('change', (e) => { settings.squaringAngleDeg = parseFloat(e.target.value) || 0; refreshInputs(); onChange(); });
    $('point-angle').addEventListener('change', (e) => { settings.pointRotationDeg = parseFloat(e.target.value) || 0; refreshInputs(); onChange(); });
    $('overlap').addEventListener('change', (e) => { settings.overlapPolicy = e.target.value; refreshInputs(); onChange(); });
    $('large-hole-policy').addEventListener('change', (e) => { settings.largeHolePolicy = e.target.value; refreshInputs(); onChange(); });
    $('bow-policy').addEventListener('change', (e) => { settings.bowPolicy = e.target.value; refreshInputs(); onChange(); });
    $('inc-unknown').addEventListener('change', (e) => { settings.includeUnknown = e.target.checked; onChange(); });
    $('inc-review').addEventListener('change', (e) => { settings.includeReview = e.target.checked; onChange(); });
    $('min-size').addEventListener('change', (e) => { settings.minSizeFilter = e.target.checked; onChange(); });
    $('verified-only').addEventListener('change', (e) => { settings.showVerifiedOnly = e.target.checked; onChange(); });
    $('second-amah').addEventListener('change', (e) => { settings.secondAmahCm = parseFloat(e.target.value) || 0; onChange(); });
    $('show-12mil').addEventListener('change', (e) => { settings.show12mil = e.target.checked; onChange(); });
    $('audit-rings').addEventListener('change', (e) => {
      settings.showAuditRings = e.target.checked; saveSettings();
      if (state.result) { renderAuditRings(); renderAuditGuide(); renderReviewQueue(); }
    });
    $('fetch-radius').addEventListener('change', (e) => { settings.fetchRadiusM = Math.max(300, parseInt(e.target.value, 10) || S.DEFAULTS.fetchRadiusM); saveSettings(); });
    $('max-buildings').addEventListener('change', (e) => { settings.maxBuildings = Math.max(1000, parseInt(e.target.value, 10) || S.DEFAULTS.maxBuildings); saveSettings(); });
    $('use-perimeter').addEventListener('change', (e) => {
      if (e.target.checked && !state.validatedPerimeter) { e.target.checked = false; setStatus('Import a rav-validated perimeter first.'); return; }
      settings.useValidatedPerimeter = e.target.checked; saveSettings(); if (state.result) recompute();
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
    document.getElementById('btn-retry').addEventListener('click', () => calculate(false));
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
    document.getElementById('btn-draw-join-perimeter').addEventListener('click', () => startDrawing('join-perimeter'));
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
    document.getElementById('btn-import-join-perimeter').addEventListener('click', () => document.getElementById('join-perimeter-file').click());
    document.getElementById('join-perimeter-file').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) importValidatedJoinPerimeters(e.target.files[0]); e.target.value = '';
    });
    document.getElementById('btn-clear-perimeter').addEventListener('click', () => {
      state.validatedPerimeter = null; settings.useValidatedPerimeter = false; saveSettings();
      document.getElementById('use-perimeter').checked = false; if (state.result) recompute();
      setStatus('Validated perimeter cleared.');
    });
    document.getElementById('btn-clear-join-perimeters').addEventListener('click', () => {
      if (state.validatedJoinPerimeters.length && !confirm('Remove all rav-validated joining perimeters?')) return;
      state.validatedJoinPerimeters = []; if (state.result) { prepareBuildings(); recompute(); }
      setStatus('Validated joining perimeters cleared.');
    });
    document.getElementById('btn-clear-manual').addEventListener('click', () => {
      if (state.manualBuildings.length && !confirm('Remove all manually drawn and imported footprints?')) return;
      state.manualBuildings = []; if (state.result) { prepareBuildings(); recompute(); } setStatus('Manual footprints cleared.');
    });
    document.getElementById('btn-clear-overrides').addEventListener('click', () => {
      if (!state.overrides.size) { setStatus('There are no manual building overrides to clear.'); return; }
      if (!confirm(`Clear ${state.overrides.size} manual building override(s)?`)) return;
      state.overrides.clear(); if (state.result) recompute(); setStatus('Manual building overrides cleared.');
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
