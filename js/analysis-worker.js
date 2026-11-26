/* Runs the pure halachic geometry engine away from the browser's UI thread. */
'use strict';

// Same cache-busting query string as the page's geometry.js (main.js passes it through).
importScripts('geometry.js' + self.location.search);

self.onmessage = (event) => {
  const { id, buildings, settings, pin, loaded } = event.data || {};
  try {
    const started = performance.now();
    const result = self.TechumGeo.runPipeline(buildings, settings, pin);
    // Which map data the result still needs (spec rev. 18.3), on the same footprints.
    const needs = loaded ? self.TechumGeo.dataNeeds(buildings, result, {
      proj: self.TechumGeo.makeProjection(loaded.lat0, loaded.lon0), pin, tiles: loaded.tiles, bbox: loaded.bbox,
    }) : null;
    self.postMessage({ id, result, needs, workerMs: performance.now() - started });
  } catch (error) {
    self.postMessage({ id, error: error && error.message ? error.message : String(error) });
  }
};
