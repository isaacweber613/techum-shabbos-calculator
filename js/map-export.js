/*
 * Google Static Maps export planning.
 * A single permitted Static Maps image is scaled by a power of two so its
 * geographic extent stays aligned with Leaflet's existing boundary layers.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TechumMapExport = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_STATIC_MAP_SIZE = 640;

  function staticMapPlan(options) {
    const width = Math.max(1, Math.round(options.width));
    const height = Math.max(1, Math.round(options.height));
    const zoom = Math.round(options.zoom);
    const ratio = Math.max(width, height) / MAX_STATIC_MAP_SIZE;
    const zoomReduction = Math.max(0, Math.ceil(Math.log2(Math.max(1, ratio))));
    if (zoomReduction > zoom) return null;
    const divisor = 2 ** zoomReduction;
    const requestWidth = Math.max(1, Math.floor(width / divisor));
    const requestHeight = Math.max(1, Math.floor(height / divisor));
    const cssWidth = requestWidth * divisor;
    const cssHeight = requestHeight * divisor;
    return {
      requestWidth, requestHeight, requestZoom: zoom - zoomReduction, scale: 2,
      cssWidth, cssHeight, left: (width - cssWidth) / 2, top: (height - cssHeight) / 2,
      attributionHeight: Math.min(height, 36 * Math.max(1, divisor / 2)),
    };
  }

  return { MAX_STATIC_MAP_SIZE, staticMapPlan };
}));
