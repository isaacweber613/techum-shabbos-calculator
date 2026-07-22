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
    if (!window.html2canvas) throw new Error('Screenshot tool did not load.');
    document.documentElement.classList.add('feedback-capturing');
    try {
      return await window.html2canvas(document.documentElement, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#f8f8f5',
        scale: Math.min(1.5, window.devicePixelRatio || 1),
        logging: false,
        imageTimeout: 5_000,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
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

  function openFeedback(screenshot, captureError) {
    const dialog = ensureDialog();
    dialog.innerHTML = `
      <div class="feedback-shell">
        <header class="feedback-header">
          <div><h2>Send feedback</h2><p>Draw on the screenshot, then tell us what should change.</p></div>
          <button class="feedback-close" type="button" aria-label="Close feedback">×</button>
        </header>
        <div class="feedback-body">
          <section class="feedback-preview">
            <div class="feedback-preview-toolbar"><div><strong>Screenshot</strong><br><span>Draw in red to point something out.</span></div><button id="feedback-clear" type="button">Clear drawing</button></div>
            ${captureError ? `<div class="feedback-capture-warning">The screenshot could not be captured, but you can still send written feedback: ${captureError}</div>` : '<canvas id="feedback-canvas" aria-label="Screenshot annotation canvas"></canvas>'}
          </section>
          <form class="feedback-form" id="feedback-form">
            <label>What should we fix or improve?
              <textarea id="feedback-description" maxlength="5000" required autofocus placeholder="Describe what happened and what you expected instead."></textarea>
            </label>
            <label>Email <small>Optional—only used if we need to ask about this report.</small>
              <input id="feedback-email" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com" />
            </label>
            <small>The screenshot, this page URL, browser details, and recent warnings/errors will be stored privately for review.</small>
            <button class="feedback-submit" type="submit">Send feedback</button>
            <div class="feedback-form-status" role="status" aria-live="polite"></div>
          </form>
        </div>
      </div>`;
    dialog.querySelector('.feedback-close').addEventListener('click', () => dialog.close());
    const canvas = dialog.querySelector('#feedback-canvas');
    const clear = canvas && screenshot ? installAnnotation(canvas, screenshot) : null;
    const clearButton = dialog.querySelector('#feedback-clear');
    clearButton.disabled = !clear;
    clearButton.addEventListener('click', () => clear?.());
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
        const data = new FormData();
        data.set('description', dialog.querySelector('#feedback-description').value);
        data.set('reporterEmail', dialog.querySelector('#feedback-email').value);
        data.set('pageUrl', location.href);
        data.set('diagnostics', JSON.stringify(diagnostics()));
        if (canvas) data.set('screenshot', await canvasBlob(canvas), 'feedback.png');
        const result = await fetch('/api/feedback', { method: 'POST', body: data });
        const payload = await result.json().catch(() => ({}));
        if (!result.ok) throw new Error(payload.error || `HTTP ${result.status}`);
        dialog.querySelector('.feedback-shell').innerHTML = `<div class="feedback-success"><h2>Thanks—feedback sent.</h2><p>It is now in the private feedback inbox.</p><p><code>${payload.reportId}</code></p><button type="button" class="feedback-success-close">Close</button></div>`;
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

  const button = document.getElementById('send-feedback-button');
  if (!button) return;
  button.addEventListener('click', async () => {
    button.disabled = true;
    const original = button.querySelector('span').textContent;
    button.querySelector('span').textContent = 'Capturing…';
    let screenshot = null;
    let captureError = '';
    try { screenshot = await captureViewport(); }
    catch (error) { captureError = error instanceof Error ? error.message : 'Unknown screenshot error'; }
    finally { button.disabled = false; button.querySelector('span').textContent = original; }
    openFeedback(screenshot, captureError);
  });
})();
