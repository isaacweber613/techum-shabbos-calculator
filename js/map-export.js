/*
 * Google Static Maps export planning.
 * Up to MAX_STATIC_MAP_IMAGES Static Maps images (each at most 640x640, scale 2) are
 * laid out in a grid at the sharpest whole zoom level they can cover the view at.
 * Each image is scaled by a power of two so its geographic extent stays aligned
 * with Leaflet's existing boundary layers. Each image is one billed Google request.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TechumMapExport = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_STATIC_MAP_SIZE = 640;
  const MAX_STATIC_MAP_IMAGES = 4;

  // Splits an even pixel total into `parts` even sizes that differ by at most 2.
  function evenSplit(total, parts) {
    const units = total / 2;
    return Array.from({ length: parts }, (_, index) =>
      2 * (Math.floor(units / parts) + (index < units % parts ? 1 : 0)));
  }

  function staticMapPlan(options) {
    const width = Math.max(1, Math.round(options.width));
    const height = Math.max(1, Math.round(options.height));
    const zoom = Math.round(options.zoom);
    const maxImages = Math.max(1, Math.floor(options.maxImages || MAX_STATIC_MAP_IMAGES));
    for (let zoomReduction = 0; zoomReduction <= zoom; zoomReduction += 1) {
      const divisor = 2 ** zoomReduction;
      // Even request sizes keep each image's centre on a whole pixel boundary.
      const requestWidth = 2 * Math.ceil(width / divisor / 2);
      const requestHeight = 2 * Math.ceil(height / divisor / 2);
      const columns = Math.ceil(requestWidth / MAX_STATIC_MAP_SIZE);
      const rows = Math.ceil(requestHeight / MAX_STATIC_MAP_SIZE);
      if (columns * rows > maxImages) continue;
      const widths = evenSplit(requestWidth, columns);
      const heights = evenSplit(requestHeight, rows);
      // Centred across; flush with the bottom so Google's attribution strip stays in view.
      const gridLeft = (width - requestWidth * divisor) / 2;
      const gridTop = height - requestHeight * divisor;
      const images = [];
      let top = gridTop;
      heights.forEach((imageHeight, row) => {
        let left = gridLeft;
        widths.forEach((imageWidth) => {
          const cssWidth = imageWidth * divisor, cssHeight = imageHeight * divisor;
          images.push({
            width: imageWidth, height: imageHeight, left, top, cssWidth, cssHeight,
            bottomRow: row === rows - 1,
            // Image centre relative to the view centre, in pixels at the request zoom.
            offsetX: (left + cssWidth / 2 - width / 2) / divisor,
            offsetY: (top + cssHeight / 2 - height / 2) / divisor,
          });
          left += cssWidth;
        });
        top += imageHeight * divisor;
      });
      return {
        requestZoom: zoom - zoomReduction, scale: 2, divisor, images,
        attributionHeight: Math.min(height, 36 * Math.max(1, divisor / 2)),
      };
    }
    return null;
  }

  function normalizedLeafletSvgViewBox(viewBox) {
    const values = String(viewBox || '').trim().split(/[\s,]+/).map(Number);
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))
      || values[2] <= 0 || values[3] <= 0) return null;
    // Leaflet gives its renderer equal-and-opposite CSS and viewBox offsets.
    // Browsers cancel them, but html2canvas applies the SVG transform repeatedly.
    // Baking that cancellation into the viewBox preserves the visible coordinates.
    return `0 0 ${values[2]} ${values[3]}`;
  }

  // Caption burned into exported map images so a shared PNG names its place and shita.
  function exportCaptionLines({ label, profileLabel, amahCm, incomplete }) {
    const amah = Number(amahCm);
    return [
      String(label || 'Selected map point'),
      `${profileLabel} · amah ${(amah / 2.54).toFixed(2)} in (${amah} cm) · 2,000 amos = ${Math.round(20 * amah).toLocaleString('en-US')} m`,
      // The dashed line of an incomplete result does not explain itself on a shared image.
      ...(incomplete ? ['INCOMPLETE — the map data ran out; this boundary could be larger or smaller. Do not rely on it.'] : []),
      'DRAFT — decision support, not a psak. Review with a rav/mumcheh.',
    ];
  }

  return { MAX_STATIC_MAP_SIZE, MAX_STATIC_MAP_IMAGES, staticMapPlan, normalizedLeafletSvgViewBox, exportCaptionLines };
}));
