(() => {
  const design = new URLSearchParams(location.search).get('design');
  if (!/^[1-8]$/.test(design || '')) return;

  const concepts = {
    1: { name: 'Quiet Search', title: 'Confirm the place', copy: 'Make sure the pin is on the building where you will be for Shabbos.' },
    2: { name: 'The Atlas', title: 'Place the pin on the atlas', copy: 'Confirm your exact building, then we’ll trace and measure the boundary.' },
    3: { name: 'Night Compass', title: 'Set your starting point', copy: 'Check the pin, start the calculation, and follow the three clear stages.' },
    4: { name: 'Guided Welcome', title: 'Is this the right building?', copy: 'Confirm the place. We’ll handle the map work and explain what matters.' },
    5: { name: 'Calm Concierge', title: 'One quick confirmation', copy: 'Check the building below. Everything else is taken care of for you.' },
    6: { name: 'Soft Horizon', title: 'Is the pin on your place?', copy: 'A gentle check before we measure. When it looks right, continue — nothing else is required.' },
    7: { name: 'Studio Draft', title: 'Confirm pin placement', copy: 'Lock the building. The workspace will measure the city, square the edges, and draft the 2,000-amah line.' },
    8: { name: 'Shabbos Table', title: 'Is this where you’re staying?', copy: 'Confirm the home or hotel. We’ll set the table with a clear map and plain explanation for your rav.' },
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
    nav.innerHTML = `<a href="/designtest/${design}/" aria-label="Back to ${concept.name}">←</a><span><b>Concept ${design}</b>${concept.name}</span><button id="design-settings-button" type="button" aria-expanded="false" aria-controls="design-drawer">Review tools</button>`;
    brand?.after(nav);

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
      };
      const drawerIntros = {
        6: 'Profiles, layers, building review, and exports. Most people never open this — the map already has what they need.',
        7: 'Method, map layers, building overrides, audit geometry, and exports. Keep the canvas clean; open the inspector only when reviewing.',
        8: 'Halachic profiles, map layers, and exports for careful review. Guests can leave these untouched; hosts (rabbis) will find everything here.',
      };
      const title = drawerTitles[design] || 'Review tools';
      const introText = drawerIntros[design] || 'Profiles, map layers, building review, audit geometry, and exports. Most people can leave these untouched.';
      drawer.innerHTML = `<header><div><small>Concept ${design}</small><h2>${title}</h2></div><button id="design-drawer-close" type="button" aria-label="Close review tools">×</button></header><p class="design-drawer-intro">${introText}</p>`;
      const movable = [];
      let node = advancedHeading;
      while (node) { movable.push(node); node = node.nextSibling; }
      movable.forEach((item) => drawer.append(item));
      sidebar.append(drawer);

      const backdrop = document.createElement('button');
      backdrop.id = 'design-drawer-backdrop';
      backdrop.type = 'button';
      backdrop.setAttribute('aria-label', 'Close review tools');
      document.body.append(backdrop);

      const btnLabel = design === '7' ? 'Inspector' : design === '8' ? 'For your rav' : design === '6' ? 'Quiet tools' : 'Review tools';
      const settingsBtn = document.getElementById('design-settings-button');
      if (settingsBtn) settingsBtn.textContent = btnLabel;

      const toggle = (open) => {
        document.body.classList.toggle('design-settings-open', open);
        drawer.setAttribute('aria-hidden', String(!open));
        document.getElementById('design-settings-button')?.setAttribute('aria-expanded', String(open));
      };
      document.getElementById('design-settings-button')?.addEventListener('click', () => toggle(true));
      document.getElementById('design-drawer-close')?.addEventListener('click', () => toggle(false));
      backdrop.addEventListener('click', () => toggle(false));
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') toggle(false); });
    }
  });
})();
