(function () {
  'use strict';

  const recentLogs = [];
  const remember = (level, values) => {
    const message = values.map((value) => {
      if (value instanceof Error) return `${value.name}: ${value.message}`;
      if (typeof value === 'string') return value;
      try { return JSON.stringify(value); } catch { return String(value); }
    }).join(' ').slice(0, 1_000);
    recentLogs.push({ level, message, at: new Date().toISOString() });
    if (recentLogs.length > 40) recentLogs.shift();
  };
  for (const level of ['warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...values) => { remember(level, values); original(...values); };
  }
  window.addEventListener('error', (event) => remember('error', [event.message]));
  window.addEventListener('unhandledrejection', (event) => remember('error', [event.reason]));

  function diagnostics() {
    const navigation = performance.getEntriesByType('navigation')[0];
    return {
      capturedAt: new Date().toISOString(),
      viewport: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio || 1}`,
      language: navigator.language,
      userAgent: navigator.userAgent.slice(0, 500),
      design: document.documentElement.dataset.design || null,
      online: navigator.onLine,
      navigation: navigation ? {
        type: navigation.type,
        domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
        loadMs: Math.round(navigation.loadEventEnd),
      } : null,
      recentWarningsAndErrors: recentLogs.slice(-20),
    };
  }

  async function captureViewport() {
    // html2canvas is not on the page until something asks for it (see loadExportLibrary in main.js).
    if (!window.html2canvas && window.TechumLoadExportLibrary) await window.TechumLoadExportLibrary('html2canvas');
    if (!window.html2canvas) throw new Error('Screenshot tool did not load.');
    document.documentElement.classList.add('feedback-capturing');
    try {
      return await window.html2canvas(document.documentElement, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#fffaf0',
        scale: Math.min(1.5, window.devicePixelRatio || 1),
        logging: false,
        imageTimeout: 5_000,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        // Capture the page behind the open feedback dialog without hiding the form from the user.
        ignoreElements: (element) => element.id === 'feedback-dialog',
        // Without this the map's boundary shapes are drawn offset, and html2canvas renders closed <details> bodies.
        onclone: (clonedDocument) => {
          clonedDocument.getElementById('feedback-dialog')?.remove();
          clonedDocument.querySelectorAll('details:not([open])').forEach((details) => {
            [...details.children].forEach((child) => {
              if (child.tagName !== 'SUMMARY') child.style.display = 'none';
            });
          });
          clonedDocument.querySelectorAll('.leaflet-popup-content-wrapper').forEach((el) => {
            el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, .14)';
          });
          if (window.TechumNormalizeMapClone) window.TechumNormalizeMapClone(clonedDocument);
        },
      });
    } finally {
      document.documentElement.classList.remove('feedback-capturing');
    }
  }

  function installAnnotation(canvas, screenshot) {
    canvas.width = screenshot.width;
    canvas.height = screenshot.height;
    const base = document.createElement('canvas');
    base.width = screenshot.width;
    base.height = screenshot.height;
    base.getContext('2d').drawImage(screenshot, 0, 0);
    const context = canvas.getContext('2d');
    context.drawImage(base, 0, 0);
    context.strokeStyle = '#e22139';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = Math.max(5, canvas.width / 300);
    let drawing = false;

    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height };
    };
    canvas.addEventListener('pointerdown', (event) => {
      drawing = true;
      canvas.setPointerCapture(event.pointerId);
      const p = point(event);
      context.beginPath();
      context.moveTo(p.x, p.y);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!drawing) return;
      const p = point(event);
      context.lineTo(p.x, p.y);
      context.stroke();
    });
    const stop = () => { drawing = false; context.closePath(); };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    return () => { context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(base, 0, 0); };
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare screenshot.')), 'image/png'));
  }

  function ensureDialog() {
    let dialog = document.getElementById('feedback-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'feedback-dialog';
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    document.body.append(dialog);
    return dialog;
  }

  let openGeneration = 0;

  function openFeedbackImmediate() {
    const generation = ++openGeneration;
    const dialog = ensureDialog();
    dialog.innerHTML = `
      <div class="feedback-shell">
        <header class="feedback-header">
          <div><h2>Send feedback</h2><p>Tell us what happened or what should change. You can also mark up the screenshot.</p></div>
          <button class="feedback-close" type="button" aria-label="Close feedback">×</button>
        </header>
        <div class="feedback-body">
          <section class="feedback-preview">
            <div class="feedback-preview-toolbar">
              <div><strong>Screenshot</strong><br><span id="feedback-preview-hint">Capturing page in the background…</span></div>
              <div class="feedback-preview-actions">
                <label class="feedback-include-toggle"><input id="feedback-include-screenshot" type="checkbox" checked /> Include</label>
                <button id="feedback-clear" type="button" disabled>Clear drawing</button>
              </div>
            </div>
            <div id="feedback-preview-stage" class="feedback-preview-stage">
              <div class="feedback-capture-loading">Preparing screenshot preview…</div>
            </div>
          </section>
          <form class="feedback-form" id="feedback-form">
            <label>What should we fix or improve?
              <textarea id="feedback-description" maxlength="5000" required autofocus placeholder="Describe what happened and what you expected instead."></textarea>
            </label>
            <label>Email <small>Optional — only used if we need to ask about this report.</small>
              <input id="feedback-email" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com" />
            </label>
            <small>The page URL, browser details, recent warnings/errors, and optional screenshot will be stored privately for review.</small>
            <button class="feedback-submit" type="submit">Send feedback</button>
            <div class="feedback-form-status" role="status" aria-live="polite"></div>
          </form>
        </div>
      </div>`;

    dialog.querySelector('.feedback-close').addEventListener('click', () => dialog.close());
    const clearButton = dialog.querySelector('#feedback-clear');
    const includeCheckbox = dialog.querySelector('#feedback-include-screenshot');
    const stage = dialog.querySelector('#feedback-preview-stage');
    const hint = dialog.querySelector('#feedback-preview-hint');

    let readyCanvas = null;
    let clearFn = null;
    clearButton.addEventListener('click', () => clearFn?.());
    includeCheckbox.addEventListener('change', () => {
      stage.classList.toggle('excluded', !includeCheckbox.checked);
    });

    const capturePromise = captureViewport().then((screenshot) => {
      if (generation !== openGeneration || !dialog.open) return;
      const canvas = document.createElement('canvas');
      canvas.id = 'feedback-canvas';
      canvas.setAttribute('aria-label', 'Screenshot annotation canvas');
      clearFn = installAnnotation(canvas, screenshot);
      readyCanvas = canvas;
      stage.replaceChildren(canvas);
      hint.textContent = 'Draw in red to point something out.';
      clearButton.disabled = false;
    }).catch((error) => {
      if (generation !== openGeneration || !dialog.open) return;
      const msg = error instanceof Error ? error.message : 'Unknown screenshot error';
      const warn = document.createElement('div');
      warn.className = 'feedback-capture-warning';
      warn.textContent = `The screenshot could not be captured, but you can still send written feedback: ${msg}`;
      stage.replaceChildren(warn);
      hint.textContent = 'Screenshot unavailable.';
    });

    const form = dialog.querySelector('#feedback-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('.feedback-submit');
      const status = form.querySelector('.feedback-form-status');
      submit.disabled = true;
      submit.textContent = 'Sending…';
      status.className = 'feedback-form-status';
      status.textContent = '';
      try {
        if (includeCheckbox.checked && !readyCanvas) {
          await Promise.race([capturePromise, new Promise((resolve) => setTimeout(resolve, 2500))]);
        }
        const data = new FormData();
        data.set('description', dialog.querySelector('#feedback-description').value);
        data.set('reporterEmail', dialog.querySelector('#feedback-email').value);
        data.set('pageUrl', location.href);
        data.set('diagnostics', JSON.stringify(diagnostics()));
        if (includeCheckbox.checked && readyCanvas) data.set('screenshot', await canvasBlob(readyCanvas), 'feedback.png');
        const result = await fetch('/api/feedback', { method: 'POST', body: data });
        const payload = await result.json().catch(() => ({}));
        if (!result.ok) throw new Error(payload.error || `HTTP ${result.status}`);
        dialog.querySelector('.feedback-shell').innerHTML = `<div class="feedback-success"><h2>Thanks — feedback sent.</h2><p>It is now in the private feedback inbox.</p><p><code>${payload.reportId}</code></p><button type="button" class="feedback-success-close">Close</button></div>`;
        dialog.querySelector('.feedback-success-close').addEventListener('click', () => dialog.close());
      } catch (error) {
        status.className = 'feedback-form-status error';
        status.textContent = error instanceof Error ? error.message : 'Feedback could not be sent.';
        submit.disabled = false;
        submit.textContent = 'Send feedback';
      }
    });

    dialog.showModal();
    dialog.querySelector('#feedback-description').focus();
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-feedback-trigger]');
    if (!trigger) return;
    openFeedbackImmediate();
  });
})();
