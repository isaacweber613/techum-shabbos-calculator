const $ = (selector, root = document) => root.querySelector(selector);
const settings = $('#settings-panel');
const backdrop = $('#backdrop');
const openSettings = () => { settings.classList.add('open'); backdrop.classList.add('open'); settings.setAttribute('aria-hidden', 'false'); };
const closeSettings = () => { settings.classList.remove('open'); backdrop.classList.remove('open'); settings.setAttribute('aria-hidden', 'true'); };
$('#settings-button')?.addEventListener('click', (event) => { event.preventDefault(); openSettings(); });
$('#close-settings')?.addEventListener('click', closeSettings);
backdrop?.addEventListener('click', closeSettings);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSettings(); });

const input = $('#place-search');
const suggestions = $('#suggestions');
let timer;
let controller;
const hideSuggestions = () => { suggestions.hidden = true; suggestions.innerHTML = ''; input?.setAttribute('aria-expanded', 'false'); };
const featureLabel = (feature) => {
  const p = feature.properties || {};
  const primary = [p.name, p.housenumber, p.street].filter(Boolean).join(' ') || 'Selected place';
  const secondary = [p.city || p.locality || p.county, p.state, p.country].filter(Boolean).join(', ');
  return { primary, secondary, full: [primary, secondary].filter(Boolean).join(', ') };
};
input?.addEventListener('input', () => {
  clearTimeout(timer);
  const query = input.value.trim();
  if (query.length < 3) { hideSuggestions(); return; }
  timer = setTimeout(async () => {
    controller?.abort(); controller = new AbortController();
    try {
      const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      const url = local
        ? `https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(query)}`
        : `/api/autocomplete?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();
      const features = Array.isArray(data.features) ? data.features.slice(0, 5) : [];
      suggestions.innerHTML = '';
      features.forEach((feature) => {
        const label = featureLabel(feature);
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'suggestion'; button.setAttribute('role', 'option');
        const strong = document.createElement('b'); strong.textContent = label.primary;
        const small = document.createElement('span'); small.textContent = label.secondary;
        button.append(strong, small);
        button.addEventListener('click', () => {
          input.value = label.full;
          const coordinates = feature.geometry?.coordinates;
          if (Array.isArray(coordinates) && coordinates.length >= 2) {
            input.dataset.lon = String(coordinates[0]);
            input.dataset.lat = String(coordinates[1]);
          }
          hideSuggestions(); input.focus();
        });
        suggestions.append(button);
      });
      suggestions.hidden = features.length === 0; input.setAttribute('aria-expanded', String(features.length > 0));
    } catch (error) { if (error.name !== 'AbortError') hideSuggestions(); }
  }, 220);
});
document.addEventListener('click', (event) => { if (!event.target.closest('.search-box')) hideSuggestions(); });
$('#search-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) { input.focus(); return; }
  sessionStorage.setItem('techum-design-draft-address', query);
  const design = location.pathname.match(/\/designtest\/([1-8])/)?.[1];
  const params = new URLSearchParams({ draftAddress: query });
  if (design) params.set('design', design);
  if (input.dataset.lat && input.dataset.lon) {
    params.set('draftLat', input.dataset.lat);
    params.set('draftLon', input.dataset.lon);
  }
  window.location.href = '/?' + params.toString();
});
$('#location-button')?.addEventListener('click', () => {
  if (!navigator.geolocation) return;
  const button = $('#location-button'); button.textContent = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(() => { button.textContent = 'Location ready — open calculator'; }, () => { button.textContent = 'Could not get location'; }, { timeout: 8000 });
});
