(() => {
  const design = new URLSearchParams(location.search).get('design');
  if (!/^[1-5]$/.test(design || '')) return;

  const concepts = {
    1: { name: 'Quiet Search', title: 'Confirm the place', copy: 'Make sure the pin is on the building where you will be for Shabbos.' },
    2: { name: 'The Atlas', title: 'Place the pin on the atlas', copy: 'Confirm your exact building, then we’ll trace and measure the boundary.' },
    3: { name: 'Night Compass', title: 'Set your starting point', copy: 'Check the pin, start the calculation, and follow the three clear stages.' },
    4: { name: 'Guided Welcome', title: 'Is this the right building?', copy: 'Confirm the place. We’ll handle the map work and explain what matters.' },
    5: { name: 'Calm Concierge', title: 'One quick confirmation', copy: 'Check the building below. Everything else is taken care of for you.' },
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

    const advancedHeading = document.querySelector('.advanced-heading');
    const sidebar = document.getElementById('sidebar');
    if (advancedHeading && sidebar) {
      const drawer = document.createElement('aside');
      drawer.id = 'design-drawer';
      drawer.setAttribute('aria-hidden', 'true');
      drawer.innerHTML = `<header><div><small>Concept ${design}</small><h2>Review tools</h2></div><button id="design-drawer-close" type="button" aria-label="Close review tools">×</button></header><p class="design-drawer-intro">Profiles, map layers, building review, audit geometry, and exports. Most people can leave these untouched.</p>`;
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
