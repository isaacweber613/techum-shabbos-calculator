(() => {
  const requestedDesign = new URLSearchParams(location.search).get('design');
  const isDesignPreview = /^(?:[1-9]|10)$/.test(requestedDesign || '');
  const design = isDesignPreview ? requestedDesign : '10';

  const concepts = {
    1: { name: 'Quiet Search', title: 'Confirm the place', copy: 'Make sure the pin is on the building where you will be for Shabbos.' },
    2: { name: 'The Atlas', title: 'Place the pin on the atlas', copy: 'Confirm your exact building, then we’ll trace and measure the boundary.' },
    3: { name: 'Night Compass', title: 'Set your starting point', copy: 'Check the pin, start the calculation, and follow the three clear stages.' },
    4: { name: 'Guided Welcome', title: 'Is this the right building?', copy: 'Confirm the place. We’ll handle the map work and explain what matters.' },
    5: { name: 'Calm Concierge', title: 'One quick confirmation', copy: 'Check the building below. Everything else is taken care of for you.' },
    6: { name: 'Soft Horizon', title: 'Is the pin on your place?', copy: 'A gentle check before we measure. When it looks right, continue — nothing else is required.' },
    7: { name: 'Studio Draft', title: 'Confirm pin placement', copy: 'Lock the building. The workspace will measure the city, square the edges, and draft the 2,000-amah line.' },
    8: { name: 'Shabbos Table', title: 'Is this where you’re staying?', copy: 'Confirm the home or hotel. We’ll set the table with a clear map and plain explanation for your rav.' },
    9: { name: 'Map First', title: 'See your techum right away', copy: 'Type an address and the boundary appears automatically. Drag the pin anytime and the map updates itself.' },
    10: { name: 'Clear Answer', title: 'One address. One clear answer.', copy: 'We calculate automatically, then explain only what matters in plain language.' },
  };

  document.addEventListener('DOMContentLoaded', () => {
    const concept = concepts[design];
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
    const nav = document.createElement('div');
    nav.id = 'design-experience-nav';
    if (isDesignPreview) {
      nav.innerHTML = `<a href="/designtest/${design}/" aria-label="Back to ${concept.name}">←</a><span><b>Concept ${design}</b>${concept.name}</span><button id="design-settings-button" type="button" aria-expanded="false" aria-controls="design-drawer">Review tools</button>`;
    } else {
      nav.classList.add('production-review-nav');
      nav.innerHTML = '<span><b>Calculation settings</b>Profiles, layers, and review tools</span><button id="design-settings-button" type="button" aria-expanded="false" aria-controls="design-drawer">All settings</button>';
    }
    brand?.after(nav);

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
          <button id="simple-more-settings" type="button">All settings</button>
        </div>`;
      document.getElementById('status')?.after(quickSettings);

      const updateSettingsSummary = () => {
        const profile = document.getElementById('quick-profile');
        const amah = document.getElementById('quick-amah');
        const summary = document.getElementById('simple-settings-summary');
        if (!profile || !amah || !summary) return;
        const profileNames = {
          'mishna-berura': 'Mishna Berurah', 'chazon-ish': 'Chazon Ish',
          mechaber: 'Mechaber', custom: 'Custom',
        };
        const amahLabel = amah.selectedOptions[0]?.textContent?.match(/\d+\.\d+ in/)?.[0] || 'custom amah';
        summary.textContent = `${profileNames[profile.value] || 'Custom'} · ${amahLabel}`;
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
        source.addEventListener('change', () => { quick.value = source.value; updateSettingsSummary(); });
      };
      syncSelect('profile', 'quick-profile');
      syncSelect('amah', 'quick-amah');
      updateSettingsSummary();

      const mapKey = document.createElement('div');
      mapKey.id = 'simple-map-key';
      mapKey.setAttribute('aria-label', 'Map line key');
      mapKey.innerHTML = `
        <b>Map lines</b>
        <span><i class="key-line techum"></i><strong>Pink</strong> Your techum area</span>
        <span><i class="key-line city"></i><strong>Green</strong> Starting place (city, building, or 4 amos)</span>
        <span><i class="key-line karpef"></i><strong>Pale green</strong> Extra city space</span>
        <span><i class="key-line alternate"></i><strong>Amber</strong> Alternate, when shown</span>`;
      document.getElementById('map')?.append(mapKey);

      const results = document.getElementById('results');
      if (results) {
        const simplifyResults = () => {
          if (!results.textContent.trim() || results.querySelector('.simple-result-card')) return;
          const original = [...results.children];
          const modeStat = original.find((node) => node.classList.contains('stat') && node.textContent.includes('Mode:'));
          const isCity = modeStat?.textContent.includes('city (') || false;
          const isBuilding = modeStat?.textContent.includes('building shevisa') || false;
          const confidence = document.getElementById('confidence')?.textContent.trim() || '';
          const card = document.createElement('section');
          card.className = 'simple-result-card';
          card.innerHTML = `
            <h3>Your techum is ready</h3>
            <p><b>Pink area = your techum.</b> The green area is ${isCity ? 'the starting city' : isBuilding ? 'the mapped building used as your starting place' : 'your 4-amah starting square'}. Drag the pin to update automatically.</p>
            <details class="simple-result-explainer">
              <summary>How was this calculated? <span aria-hidden="true">i</span></summary>
              <p>${isCity
                ? 'Nearby qualifying homes are joined into a halachic city, that city is squared, and the techum is measured outward from the square.'
                : 'The map did not derive a qualifying city at this point, so the techum is measured from the shevisa point.'}</p>
              ${confidence ? `<p>${confidence}</p>` : ''}
              <p>This remains a draft for review with a qualified rav.</p>
            </details>`;
          results.prepend(card);

          const reviewNotes = original.filter((node) =>
            (node.classList.contains('warn') && /data limit|incomplete|review|concav|overlap|outside|missing|uncertain/i.test(node.textContent)) ||
            (node.classList.contains('note') && /point|data limit|incomplete/i.test(node.textContent)));
          if (reviewNotes.length) {
            const review = document.createElement('details');
            review.className = 'simple-review-notes';
            review.innerHTML = `<summary>${reviewNotes.length} review ${reviewNotes.length === 1 ? 'note' : 'notes'}</summary>`;
            reviewNotes.forEach((node) => review.append(node));
            card.append(review);
          }
          const technical = original.filter((node) => !reviewNotes.includes(node));
          if (technical.length) {
            const details = document.createElement('details');
            details.className = 'simple-technical-details';
            details.innerHTML = '<summary>Calculation details</summary>';
            technical.forEach((node) => details.append(node));
            card.append(details);
          }
        };
        new MutationObserver(simplifyResults).observe(results, { childList: true });
        simplifyResults();
      }
    }

    // Concept-specific cherry enhancements on the live calculator shell.
    if (design === '6') {
      const status = document.getElementById('status');
      if (status && !document.getElementById('horizon-progress')) {
        const bar = document.createElement('div');
        bar.id = 'horizon-progress';
        bar.setAttribute('aria-hidden', 'true');
        bar.innerHTML = '<i></i>';
        status.after(bar);
      }
    }
    if (design === '7') {
      const introEl = document.querySelector('.intro');
      if (introEl && !document.getElementById('studio-readout')) {
        const readout = document.createElement('div');
        readout.id = 'studio-readout';
        readout.innerHTML = '<span class="stamp">DRAFT</span><span id="studio-readout-text">Waiting for pin confirmation…</span>';
        introEl.after(readout);
        const update = () => {
          const text = document.getElementById('studio-readout-text');
          if (!text) return;
          const status = document.getElementById('status')?.textContent?.trim();
          const hasPin = document.body.classList.contains('has-pin') || document.querySelector('.has-pin');
          if (status && status.length > 2) text.textContent = status;
          else if (hasPin) text.textContent = 'Pin placed — ready to measure.';
          else text.textContent = 'Waiting for pin confirmation…';
        };
        update();
        const statusEl = document.getElementById('status');
        if (statusEl) {
          const obs = new MutationObserver(update);
          obs.observe(statusEl, { childList: true, characterData: true, subtree: true });
        }
        document.getElementById('btn-calc')?.addEventListener('click', () => {
          const text = document.getElementById('studio-readout-text');
          if (text) text.textContent = 'Measuring city · squaring · drawing 2000 amos…';
        });
      }
    }
    if (design === '8') {
      if (!document.getElementById('table-glow')) {
        const glow = document.createElement('div');
        glow.id = 'table-glow';
        glow.setAttribute('aria-hidden', 'true');
        document.body.append(glow);
      }
      const markReady = () => document.body.classList.add('table-ready');
      document.getElementById('btn-calc')?.addEventListener('click', markReady);
      const results = document.getElementById('results');
      if (results) {
        const obs = new MutationObserver(() => {
          if (results.textContent && results.textContent.trim().length > 20) markReady();
        });
        obs.observe(results, { childList: true, subtree: true });
      }
    }

    const advancedHeading = document.querySelector('.advanced-heading');
    const sidebar = document.getElementById('sidebar');
    if (advancedHeading && sidebar) {
      const drawer = document.createElement('aside');
      drawer.id = 'design-drawer';
      drawer.setAttribute('aria-hidden', 'true');
      const drawerTitles = {
        6: 'Quiet tools',
        7: 'Inspector',
        8: 'For your rav',
        9: 'All settings',
        10: 'All settings',
      };
      const drawerIntros = {
        6: 'Profiles, layers, building review, and exports. Most people never open this — the map already has what they need.',
        7: 'Method, map layers, building overrides, audit geometry, and exports. Keep the canvas clean; open the inspector only when reviewing.',
        8: 'Halachic profiles, map layers, and exports for careful review. Guests can leave these untouched; hosts (rabbis) will find everything here.',
        9: 'The two common choices stay beside the result. Every layer, shita, correction, audit control, and export remains easy to reach here.',
        10: 'Common choices stay visible. Open this organized panel for comparison lines, building review, audit tools, and exports.',
      };
      const title = drawerTitles[design] || 'Review tools';
      const introText = drawerIntros[design] || 'Profiles, map layers, building review, audit geometry, and exports. Most people can leave these untouched.';
      const drawerEyebrow = isDesignPreview ? `Concept ${design}` : 'Review controls';
      drawer.innerHTML = `<header><div><small>${drawerEyebrow}</small><h2>${title}</h2></div><button id="design-drawer-close" type="button" aria-label="Close review tools">×</button></header><p class="design-drawer-intro">${introText}</p>`;
      const movable = [];
      let node = advancedHeading;
      while (node) { movable.push(node); node = node.nextSibling; }
      movable.forEach((item) => drawer.append(item));
      // Keep the fixed drawer at the document root so the sidebar's stacking
      // context cannot put the full-screen backdrop in front of its controls.
      document.body.append(drawer);

      const backdrop = document.createElement('div');
      backdrop.id = 'design-drawer-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.append(backdrop);

      const btnLabel = design === '7' ? 'Inspector' : design === '8' ? 'For your rav' : design === '6' ? 'Quiet tools' : isSimpleDirection ? 'All settings' : 'Review tools';
      const settingsBtn = document.getElementById('design-settings-button');
      if (settingsBtn) settingsBtn.textContent = btnLabel;

      const toggle = (open) => {
        document.body.classList.toggle('design-settings-open', open);
        drawer.setAttribute('aria-hidden', String(!open));
        document.getElementById('design-settings-button')?.setAttribute('aria-expanded', String(open));
      };
      document.getElementById('design-settings-button')?.addEventListener('click', () => toggle(true));
      document.getElementById('simple-more-settings')?.addEventListener('click', () => toggle(true));
      document.getElementById('design-drawer-close')?.addEventListener('click', () => toggle(false));
      backdrop.addEventListener('click', () => toggle(false));
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') toggle(false); });
    }
  });
})();
