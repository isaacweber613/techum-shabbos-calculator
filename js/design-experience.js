(() => {
  const requestedDesign = new URLSearchParams(location.search).get('design');
  // The numbered concepts are development previews only. On the public site the
  // live design is always 10, even if an old ?design= link is still circulating.
  const isLocalPreview = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const isDesignPreview = isLocalPreview && /^(?:[1-9]|10)$/.test(requestedDesign || '');
  const design = isDesignPreview ? requestedDesign : '10';

  const concepts = {
    9: { name: 'Map First', title: 'See your techum right away', copy: 'Type an address and the boundary appears automatically. Drag the pin anytime and the map updates itself.' },
    10: { name: 'Clear Answer', title: 'Where will you be for Shabbos?', copy: 'Enter an address or click the map to draft your 2,000-amah techum boundary.' },
  };

  document.addEventListener('DOMContentLoaded', () => {
    const concept = concepts[design] || concepts[10];
    document.body.dataset.design = design;
    document.body.classList.add('design-experience');

    const intro = document.querySelector('.intro');
    if (intro) {
      const heading = intro.querySelector('h2');
      const copy = intro.querySelector('p');
      if (heading) heading.textContent = concept.title;
      if (copy) copy.textContent = concept.copy;
    }

    const brand = document.querySelector('.brand');
    if (isDesignPreview && design !== '10') {
      const nav = document.createElement('div');
      nav.id = 'design-experience-nav';
      nav.innerHTML = `<a href="/" aria-label="Back to the calculator">←</a><span><b>Concept ${design}</b>${concept.name}</span><button id="design-settings-button" type="button" aria-expanded="false" aria-controls="design-drawer">All settings</button>`;
      brand?.after(nav);
    }

    const isSimpleDirection = design === '9' || design === '10';
    if (isSimpleDirection) {
      const locationButton = document.getElementById('btn-location');
      if (locationButton) locationButton.textContent = 'Use my current location';
      const buildingsLayer = document.getElementById('layer-buildings');
      if (buildingsLayer) buildingsLayer.checked = false;

      const quickSettings = document.createElement('details');
      quickSettings.id = 'simple-quick-settings';
      quickSettings.setAttribute('aria-label', 'Common settings');
      quickSettings.innerHTML = `
        <summary><span><small>Settings</small><b id="simple-settings-summary">Mishna Berurah · 18.90 in</b></span><em>Change</em></summary>
        <div class="simple-settings-body">
          <label><span>Profile</span><select id="quick-profile" aria-label="Halachic profile"></select></label>
          <label><span>Amah</span><select id="quick-amah" aria-label="Amah measurement"></select></label>
          <label class="quick-mode-field"><span>Starting mode</span><select id="quick-shevisa-mode" aria-label="Starting mode"></select></label>
          <button id="simple-more-settings" type="button" aria-expanded="false" aria-controls="design-drawer">All settings</button>
        </div>`;
      document.getElementById('status')?.after(quickSettings);

      // Reads the real settings inputs: a profile change or snapshot load sets them
      // programmatically, without the change events the quick selects listen for.
      const updateSettingsSummary = () => {
        const profile = document.getElementById('profile');
        const amah = document.getElementById('amah');
        const shevisaMode = document.getElementById('shevisa-mode');
        const summary = document.getElementById('simple-settings-summary');
        if (!profile || !amah || !summary) return;
        const quickProfile = document.getElementById('quick-profile');
        const quickAmah = document.getElementById('quick-amah');
        const quickMode = document.getElementById('quick-shevisa-mode');
        if (quickProfile) quickProfile.value = profile.value;
        if (quickAmah) quickAmah.value = amah.value;
        if (quickMode && shevisaMode) quickMode.value = shevisaMode.value;
        const profileNames = {
          'mishna-berura': 'Mishna Berurah', 'chazon-ish': 'Chazon Ish',
          mechaber: 'Mechaber', custom: 'Custom',
        };
        const amahLabel = amah.selectedOptions[0]?.textContent?.match(/\d+\.\d+ in/)?.[0] || 'custom amah';
        const modeTag = shevisaMode && shevisaMode.value === 'eruv-point' ? ' · Eruv point' : '';
        summary.textContent = `${profileNames[profile.value] || 'Custom'} · ${amahLabel}${modeTag}`;
      };

      const syncSelect = (sourceId, quickId) => {
        const source = document.getElementById(sourceId);
        const quick = document.getElementById(quickId);
        if (!source || !quick) return;
        quick.replaceChildren(...[...source.options].map((option) => option.cloneNode(true)));
        quick.value = source.value;
        quick.addEventListener('change', () => {
          source.value = quick.value;
          source.dispatchEvent(new Event('change', { bubbles: true }));
          updateSettingsSummary();
        });
        source.addEventListener('change', updateSettingsSummary);
      };
      syncSelect('profile', 'quick-profile');
      syncSelect('amah', 'quick-amah');
      syncSelect('shevisa-mode', 'quick-shevisa-mode');
      document.addEventListener('techum:settings-refreshed', updateSettingsSummary);
      updateSettingsSummary();

      const mapKey = document.createElement('div');
      mapKey.id = 'simple-map-key';
      mapKey.setAttribute('aria-label', 'Map line key');
      mapKey.innerHTML = `
        <button type="button" class="map-key-toggle" aria-expanded="false">Map key</button>
        <b>Map lines</b>
        <div class="map-key-items">
          <span><i class="key-line techum"></i><strong>Pink</strong> Techum</span>
          <span><i class="key-line city"></i><strong>Green</strong> Starting place</span>
          <span class="key-extra key-extra-karpef"><i class="key-line karpef"></i><strong>Pale green</strong> Karpef</span>
          <span class="key-extra key-extra-verified"><i class="key-line alternate"></i><strong>Amber</strong> Verified only</span>
          <span class="key-extra key-extra-comparison"><i class="key-line comparison"></i><strong>Purple</strong> Comparison amah</span>
          <span class="key-extra key-extra-concavity"><i class="key-line concavity"></i><strong>Yellow</strong> Pocket review</span>
          <span class="key-extra key-extra-12mil"><i class="key-line mil12"></i><strong>Gray</strong> 12 mil</span>
        </div>`;
      const mapKeyToggle = mapKey.querySelector('.map-key-toggle');
      mapKeyToggle.addEventListener('click', () => {
        const open = mapKey.classList.toggle('open');
        mapKeyToggle.setAttribute('aria-expanded', String(open));
      });
      if (window.L) { L.DomEvent.disableClickPropagation(mapKey); L.DomEvent.disableScrollPropagation(mapKey); }
      document.getElementById('map')?.append(mapKey);

      const results = document.getElementById('results');
      if (results) {
        const simplifyResults = () => {
          if (!results.textContent.trim() || results.querySelector('.simple-result-card')) return;
          const original = [...results.children];
          const meta = window.TechumApp?.getResultMeta?.() || null;
          const modeStat = original.find((node) => node.classList.contains('stat') && node.textContent.includes('Mode:'));
          const isCity = meta ? meta.mode === 'city' : (modeStat?.textContent.includes('city (') || false);
          const isBuilding = meta ? meta.mode === 'building' : (modeStat?.textContent.includes('building shevisa') || false);
          const isPoint = meta ? meta.mode === 'point' : (!isCity && !isBuilding);
          const isEruvPoint = !!(meta && meta.eruvPointMode);
          const pinConfirmation = original.find((node) => node.classList.contains('pin-confirmation'));
          const blockingAlerts = original.filter((node) =>
            node.classList.contains('data-limit') ||
            node.classList.contains('home-ambiguity') ||
            node.classList.contains('provisional-bow'));
          const incomplete = original.some((node) => node.classList.contains('data-limit'));
          const confidence = document.getElementById('confidence')?.textContent.trim() || '';

          const headline = incomplete
            ? 'This result is incomplete'
            : isCity
              ? 'Squared city + 2,000 amos'
              : isBuilding
                ? 'Building walls + 2,000 amos'
                : isEruvPoint
                  ? 'Eruv techumin (4-amah point) + 2,000 amos'
                  : 'Open-field 4-amah square + 2,000 amos';

          const metricLine = meta
            ? `${meta.techumM.toLocaleString()} m (${meta.techumMi} mi · ${meta.techumFt.toLocaleString()} ft) · ${meta.profileLabel} · ${meta.amahIn} in amah${meta.karpefApplied ? ' · +karpef' : ''}`
            : '';

          const card = document.createElement('section');
          card.className = 'simple-result-card';
          card.innerHTML = `
            <h3>${headline}</h3>
            ${metricLine ? `<div class="result-metrics">${metricLine}</div>` : ''}
            <p class="result-color-summary"><b>${incomplete ? 'Pink dashed area = an incomplete draft. Do not rely on it.' : 'Pink area = the current draft.'}</b> The green area is ${isCity ? 'the squared starting city' : isBuilding ? 'the mapped building used as your starting place' : 'your 4-amah starting square'}.</p>
            <div class="result-action-bar" role="group" aria-label="Result actions">
              <button type="button" id="result-btn-png">PNG</button>
              <button type="button" id="result-btn-pdf">PDF</button>
              <button type="button" id="result-btn-snapshot">Snapshot</button>
              <button type="button" id="result-btn-audit" class="${meta && meta.auditMode ? 'is-active' : ''}" aria-pressed="${meta && meta.auditMode ? 'true' : 'false'}">${meta && meta.auditMode ? 'Hide audit' : 'Audit map'}</button>
              <button type="button" id="result-btn-move-pin">Move pin</button>
            </div>
            <p class="result-tap-hint">Tap anywhere on the map to check if a spot is inside the techum, or drag the pin to move it.</p>
            <div id="result-export-feedback" class="export-feedback" role="status" aria-live="polite" hidden></div>`;

          card.querySelector('#result-btn-png')?.addEventListener('click', () => window.TechumApp?.exportPNG?.());
          card.querySelector('#result-btn-pdf')?.addEventListener('click', () => window.TechumApp?.exportPDF?.());
          card.querySelector('#result-btn-snapshot')?.addEventListener('click', () => window.TechumApp?.saveSnapshot?.());
          card.querySelector('#result-btn-audit')?.addEventListener('click', () => window.TechumApp?.toggleAuditMode?.());
          card.querySelector('#result-btn-move-pin')?.addEventListener('click', () => window.TechumApp?.startMovePinMode?.());

          if (isPoint) {
            const currentAngle = meta ? Math.max(-45, Math.min(45, meta.pointRotationDeg || 0)) : 0;
            const rotBox = document.createElement('div');
            rotBox.className = 'point-rotation-panel';
            rotBox.innerHTML = `
              <div class="point-rotation-header">
                <label for="result-point-angle">Rotate 4-amah square</label>
                <output id="result-angle-readout">${meta ? (meta.pointRotationDeg || 0) : 0}°</output>
              </div>
              <input id="result-point-angle" type="range" min="-45" max="45" step="1" value="${currentAngle}" aria-label="Rotate 4-amah square in degrees" />
              <div class="point-rotation-snaps">
                <button type="button" data-snap-angle="0" class="${currentAngle === 0 ? 'is-active' : ''}">0° Cardinal</button>
                <button type="button" data-snap-angle="45" class="${Math.abs(currentAngle) === 45 ? 'is-active' : ''}">45° Diagonal</button>
                <button type="button" id="btn-aim-corner">Aim corner on map</button>
              </div>
              <small class="point-rotation-note">Orienting an eruv/point square requires rabbinic guidance (a town reached on a diagonal does not count as 4 amos).</small>`;
            const slider = rotBox.querySelector('#result-point-angle');
            const readout = rotBox.querySelector('#result-angle-readout');
            const syncSnapHighlight = (val) => {
              rotBox.querySelectorAll('[data-snap-angle]').forEach((btn) => {
                const target = Number(btn.dataset.snapAngle);
                btn.classList.toggle('is-active', target === 45 ? Math.abs(val) === 45 : val === target);
              });
            };
            slider.addEventListener('input', () => {
              const val = Number(slider.value);
              readout.textContent = `${val}°`;
              syncSnapHighlight(val);
              window.TechumApp?.setPointRotation?.(val, { live: true });
            });
            slider.addEventListener('change', () => {
              const val = Number(slider.value);
              window.TechumApp?.setPointRotation?.(val, { live: false });
            });
            rotBox.querySelectorAll('[data-snap-angle]').forEach((btn) => {
              btn.addEventListener('click', () => {
                const val = Number(btn.dataset.snapAngle);
                slider.value = String(val);
                readout.textContent = `${val}°`;
                syncSnapHighlight(val);
                window.TechumApp?.setPointRotation?.(val, { live: false });
              });
            });
            rotBox.querySelector('#btn-aim-corner')?.addEventListener('click', () => {
              window.TechumApp?.startAimCornerMode?.();
            });
            card.append(rotBox);
          }

          blockingAlerts.forEach((node) => card.append(node));
          if (pinConfirmation) card.append(pinConfirmation);

          const used = new Set([...blockingAlerts, ...(pinConfirmation ? [pinConfirmation] : [])]);
          const reviewNotes = original.filter((node) =>
            !used.has(node) && (
              node.classList.contains('rav-caveat') ||
              (node.classList.contains('warn') && /data limit|incomplete|review|concav|overlap|outside|missing|uncertain|merge|village|muvla|pocket|perimeter|building/i.test(node.textContent)) ||
              (node.classList.contains('note') && /point|data limit|incomplete|eruv/i.test(node.textContent))
            ));
          if (reviewNotes.length) {
            const review = document.createElement('details');
            review.className = 'simple-review-notes';
            review.innerHTML = `<summary>Rav review checklist (${reviewNotes.length} ${reviewNotes.length === 1 ? 'item' : 'items'})</summary>
              <div class="review-checklist-bar">
                <span>Inspect flagged buildings and 70⅔-amah joins on the map.</span>
                <button type="button" class="btn-inspect-map">Inspect on map</button>
              </div>`;
            review.querySelector('.btn-inspect-map')?.addEventListener('click', () => {
              window.TechumApp?.enableAuditMode?.();
            });
            reviewNotes.forEach((node) => review.append(node));
            card.append(review);
          }

          const explainer = document.createElement('details');
          explainer.className = 'simple-result-explainer';
          explainer.innerHTML = `
            <summary>How was this calculated?</summary>
            <p>${isCity
              ? 'Nearby qualifying homes are joined into a halachic city, that city is squared, and the techum is measured outward from the square.'
              : isBuilding
                ? 'No qualifying city joins this building, so the techum is measured outward from its mapped walls.'
                : isEruvPoint
                  ? 'Eruv techumin mode measures a 4-amah square around your pin and adds 2,000 amos on every side, rotated to the angle you set.'
                  : 'The map did not derive a qualifying city at this point, so the techum is measured from the 4-amah shevisa square.'}</p>
            ${confidence ? `<p>${confidence}</p>` : ''}
            <p>This remains a draft for review with a qualified rav.</p>`;
          card.append(explainer);

          const technical = original.filter((node) => !used.has(node) && !reviewNotes.includes(node));
          if (technical.length) {
            const details = document.createElement('details');
            details.className = 'simple-technical-details';
            details.innerHTML = '<summary>Calculation details</summary>';
            technical.forEach((node) => details.append(node));
            card.append(details);
          }

          results.prepend(card);
        };
        new MutationObserver(simplifyResults).observe(results, { childList: true });
        simplifyResults();
      }
    }

    const advancedHeading = document.querySelector('.advanced-heading');
    const sidebar = document.getElementById('sidebar');
    if (advancedHeading && sidebar) {
      const drawer = document.createElement('aside');
      drawer.id = 'design-drawer';
      drawer.setAttribute('aria-hidden', 'true');
      const drawerEyebrow = isDesignPreview && design !== '10' ? `Concept ${design}` : 'Review controls';
      drawer.innerHTML = `<header><div><small>${drawerEyebrow}</small><h2>All settings</h2></div><button id="design-drawer-close" type="button" aria-label="Close all settings">×</button></header><p class="design-drawer-intro">Common choices stay on the main screen. Open this panel for shitos, audit geometry, building corrections, snapshots, and GIS exports.</p>`;
      const movable = [];
      let node = advancedHeading;
      while (node) {
        // Leave <footer> visible at the bottom of the main sidebar so Guide and About stay discoverable.
        if (node.tagName !== 'FOOTER') movable.push(node);
        node = node.nextSibling;
      }
      movable.forEach((item) => drawer.append(item));
      // Keep the fixed drawer at the document root so the sidebar's stacking
      // context cannot put the full-screen backdrop in front of its controls.
      document.body.append(drawer);

      // Keep "Show calculation" inside Map layers & audit so audit geometry is always reachable.
      const methodCallout = document.querySelector('.method-callout');
      const mapDisplayDetails = [...drawer.querySelectorAll('details')]
        .find((details) => /map layers|map display/i.test(details.querySelector('summary')?.textContent || ''));
      if (methodCallout && mapDisplayDetails) mapDisplayDetails.prepend(methodCallout);

      const backdrop = document.createElement('div');
      backdrop.id = 'design-drawer-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.append(backdrop);

      let returnFocus = null;
      const toggle = (open) => {
        const wasOpen = document.body.classList.contains('design-settings-open');
        document.body.classList.toggle('design-settings-open', open);
        drawer.setAttribute('aria-hidden', String(!open));
        document.getElementById('design-settings-button')?.setAttribute('aria-expanded', String(open));
        document.getElementById('simple-more-settings')?.setAttribute('aria-expanded', String(open));
        if (open && !wasOpen) {
          returnFocus = document.activeElement;
          document.getElementById('design-drawer-close')?.focus();
          window.TechumApp?.browseRegistryIfNeeded?.();
        } else if (!open && wasOpen) {
          // Return focus to the opener unless focus already moved to the map (draw mode).
          if (drawer.contains(document.activeElement) || document.activeElement === document.body) returnFocus?.focus?.();
          returnFocus = null;
        }
      };
      document.getElementById('design-settings-button')?.addEventListener('click', () => toggle(true));
      document.getElementById('simple-more-settings')?.addEventListener('click', () => toggle(true));
      document.getElementById('design-drawer-close')?.addEventListener('click', () => toggle(false));
      backdrop.addEventListener('click', () => toggle(false));
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('design-settings-open')) toggle(false);
      });

      // Draw, bow-endpoint, aim-corner, and move-pin modes need map clicks, which the drawer backdrop would swallow.
      const mapModeBar = document.createElement('div');
      mapModeBar.id = 'map-mode-bar';
      mapModeBar.setAttribute('role', 'group');
      mapModeBar.setAttribute('aria-label', 'Map selection controls');
      mapModeBar.innerHTML = '<span>Click the map to place points</span>';
      ['btn-finish-building', 'btn-cancel-map-mode'].forEach((id) => {
        const button = document.getElementById(id);
        if (button) mapModeBar.append(button);
      });
      const mapEl = document.getElementById('map');
      if (mapEl) {
        mapEl.append(mapModeBar);
        if (window.L?.DomEvent) {
          window.L.DomEvent.disableClickPropagation(mapModeBar);
          window.L.DomEvent.disableScrollPropagation(mapModeBar);
        }
      }
      new MutationObserver(() => {
        if (document.body.classList.contains('map-mode-active') && document.body.classList.contains('design-settings-open')) {
          toggle(false);
          mapEl?.focus();
        }
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  });
})();
