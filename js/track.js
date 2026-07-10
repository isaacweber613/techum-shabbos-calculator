/*
 * Usage analytics tracker — fire-and-forget beacons to the local server's
 * /api/event. Anonymous random visitor id (localStorage); no cookies, no
 * third parties. Silently no-ops when the API is absent (e.g. static hosting)
 * or the beacon fails — analytics must NEVER break the calculator.
 * Classic script: exposes window.TechumTrack.
 */
(function (root) {
  'use strict';

  function visitorId() {
    try {
      let id = localStorage.getItem('techum-vid');
      if (!id) {
        const buf = new Uint8Array(8);
        (root.crypto && crypto.getRandomValues)
          ? crypto.getRandomValues(buf)
          : buf.forEach((_, i) => { buf[i] = (Math.random() * 256) | 0; });
        id = [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('techum-vid', id);
      }
      return id;
    } catch (e) { return 'anon'; }
  }
  const vid = visitorId();

  function send(type, data) {
    try {
      const body = JSON.stringify({ type: type, vid: vid, ...(data || {}) });
      if (navigator.sendBeacon &&
          navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }))) return;
      fetch('/api/event', { method: 'POST', body: body, keepalive: true }).catch(function () {});
    } catch (e) { /* never surface */ }
  }

  // one visit per page load
  send('visit', {
    page: location.pathname || '/',
    ref: document.referrer || null,
    lang: navigator.language || null,
    tz: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || null,
  });

  root.TechumTrack = { send: send, vid: vid };
})(typeof self !== 'undefined' ? self : this);
