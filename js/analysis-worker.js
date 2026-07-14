/* Runs the pure halachic geometry engine away from the browser's UI thread. */
'use strict';

importScripts('geometry.js?v=20260714-1');

self.onmessage = (event) => {
  const { id, buildings, settings, pin } = event.data || {};
  try {
    const started = performance.now();
    const result = self.TechumGeo.runPipeline(buildings, settings, pin);
    self.postMessage({ id, result, workerMs: performance.now() - started });
  } catch (error) {
    self.postMessage({ id, error: error && error.message ? error.message : String(error) });
  }
};
