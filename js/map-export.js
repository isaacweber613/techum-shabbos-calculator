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
  // Google prints its logo (bottom left) and "Map data" line (bottom right) in the bottom
  // ~22 px of every Static Maps image (measured on a live export 2026-11-25). Each image is
  // requested this much taller; the strip is hidden under the next row or below the view,
  // and one logo and one "Map data" line are repainted at the view's bottom corners.
  const GOOGLE_STRIP_PX = 26;
  const GOOGLE_LOGO_PX = 80;
  // The download's square side in CSS pixels: exactly 2 x 2 images at the map's own zoom.
  const EXPORT_SQUARE_PX = 2 * (MAX_STATIC_MAP_SIZE - GOOGLE_STRIP_PX);

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
    const maxContentHeight = MAX_STATIC_MAP_SIZE - GOOGLE_STRIP_PX;
    for (let zoomReduction = 0; zoomReduction <= zoom; zoomReduction += 1) {
      const divisor = 2 ** zoomReduction;
      // Even request sizes keep each image's centre on a whole pixel boundary.
      const requestWidth = 2 * Math.ceil(width / divisor / 2);
      const requestHeight = 2 * Math.ceil(height / divisor / 2);
      const columns = Math.ceil(requestWidth / MAX_STATIC_MAP_SIZE);
      const rows = Math.ceil(requestHeight / maxContentHeight);
      if (columns * rows > maxImages) continue;
      const widths = evenSplit(requestWidth, columns);
      const heights = evenSplit(requestHeight, rows);
      // Centred across; the visible part is flush with the view's bottom edge.
      const gridLeft = (width - requestWidth * divisor) / 2;
      const gridTop = height - requestHeight * divisor;
      const images = [];
      let top = gridTop;
      heights.forEach((contentHeight, row) => {
        let left = gridLeft;
        widths.forEach((imageWidth, column) => {
          const imageHeight = contentHeight + GOOGLE_STRIP_PX;
          const cssWidth = imageWidth * divisor, cssHeight = imageHeight * divisor;
          images.push({
            width: imageWidth, height: imageHeight, left, top, cssWidth, cssHeight,
            contentCssHeight: contentHeight * divisor, row, column,
            // Image centre relative to the view centre, in pixels at the request zoom.
            offsetX: (left + cssWidth / 2 - width / 2) / divisor,
            offsetY: (top + cssHeight / 2 - height / 2) / divisor,
          });
          left += cssWidth;
        });
        top += contentHeight * divisor;
      });
      const bottomLeft = images.findIndex((image) => image.row === rows - 1 && image.column === 0);
      const bottomRight = images.findIndex((image) => image.row === rows - 1 && image.column === columns - 1);
      const textLeft = Math.max(0, images[bottomRight].left + images[bottomRight].cssWidth / 2);
      return {
        requestZoom: zoom - zoomReduction, scale: 2, divisor, images,
        attribution: {
          height: Math.min(height, GOOGLE_STRIP_PX * divisor),
          boxes: [
            { image: bottomLeft, left: 0, width: Math.min(width, GOOGLE_LOGO_PX * divisor) },
            { image: bottomRight, left: textLeft, width: width - textLeft },
          ],
        },
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
  function exportCaptionLines({ label, profileLabel, amahCm, incomplete, partial }) {
    const amah = Number(amahCm);
    return [
      String(label || 'Selected map point'),
      `${profileLabel} · amah ${(amah / 2.54).toFixed(2)} in (${amah} cm) · 2,000 amos = ${Math.round(20 * amah).toLocaleString('en-US')} m`,
      // An incomplete result either shows the dashed not-proven line or no boundary; the caption
      // says which, so the image never reads as a proof.
      ...(incomplete ? [partial
        ? 'INCOMPLETE — the dashed boundary is not proven; towns that can join this town may go on past the loaded map data.'
        : 'INCOMPLETE — towns that can join this town go on past the loaded map data, so no boundary is drawn.'] : []),
      'DRAFT — decision support, not a psak. Review with a rav/mumcheh.',
    ];
  }

  return { MAX_STATIC_MAP_SIZE, MAX_STATIC_MAP_IMAGES, EXPORT_SQUARE_PX, staticMapPlan, normalizedLeafletSvgViewBox, exportCaptionLines };
}));
