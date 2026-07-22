export const MAX_FEEDBACK_DESCRIPTION_LENGTH = 5_000;
export const MAX_FEEDBACK_SCREENSHOT_BYTES = 4_000_000;
export const MAX_FEEDBACK_DIAGNOSTICS_LENGTH = 32_000;
export const VALID_FEEDBACK_STATUSES = ['new', 'planned', 'done', 'archived'] as const;

export type FeedbackStatus = typeof VALID_FEEDBACK_STATUSES[number];

export type FeedbackEnv = {
  DB: D1Database;
  BUILDINGS: R2Bucket;
};

export type ParsedFeedback = {
  description: string;
  pageUrl: string;
  reporterEmail: string | null;
  diagnostics: Record<string, unknown>;
  screenshot: Blob | null;
};

export type FeedbackReportForPrompt = {
  id: string;
  description: string;
  pageUrl: string;
  reporterEmail: string | null;
  diagnostics: unknown;
};

type FeedbackRow = {
  id: string;
  created_at: number;
  reporter_email: string | null;
  description: string;
  page_url: string;
  screenshot_key: string | null;
  diagnostics: string;
  status: FeedbackStatus;
  updated_at: number;
  reviewed_by: string | null;
};

type ParseResult = { ok: true; value: ParsedFeedback } | { ok: false; error: string };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function parseFeedbackForm(form: FormData): ParseResult {
  const description = text(form, 'description');
  if (!description) return { ok: false, error: 'feedback description is required' };
  if (description.length > MAX_FEEDBACK_DESCRIPTION_LENGTH) {
    return { ok: false, error: `feedback must be ${MAX_FEEDBACK_DESCRIPTION_LENGTH.toLocaleString()} characters or fewer` };
  }

  const pageUrl = text(form, 'pageUrl').slice(0, 2_048);
  try {
    const parsed = new URL(pageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
  } catch {
    return { ok: false, error: 'a valid page URL is required' };
  }

  const emailValue = text(form, 'reporterEmail').toLowerCase();
  if (emailValue && (emailValue.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue))) {
    return { ok: false, error: 'email address is invalid' };
  }

  const diagnosticsText = text(form, 'diagnostics');
  if (diagnosticsText.length > MAX_FEEDBACK_DIAGNOSTICS_LENGTH) {
    return { ok: false, error: 'diagnostics are too large' };
  }
  let diagnostics: Record<string, unknown> = {};
  if (diagnosticsText) {
    try {
      const parsed = JSON.parse(diagnosticsText) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      diagnostics = parsed as Record<string, unknown>;
    } catch {
      return { ok: false, error: 'diagnostics must be a JSON object' };
    }
  }

  const screenshotEntry = form.get('screenshot');
  const screenshot = screenshotEntry instanceof Blob && screenshotEntry.size > 0 ? screenshotEntry : null;
  if (screenshot && screenshot.type !== 'image/png') return { ok: false, error: 'screenshot must be a PNG image' };
  if (screenshot && screenshot.size > MAX_FEEDBACK_SCREENSHOT_BYTES) {
    return { ok: false, error: 'screenshot is too large' };
  }

  return { ok: true, value: { description, pageUrl, reporterEmail: emailValue || null, diagnostics, screenshot } };
}

function response(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function buildCodexFeedbackPrompt(report: FeedbackReportForPrompt): string {
  return `Fix this Tchum Calculator feedback report.

Report ID: ${report.id}
Page: ${report.pageUrl}
Reporter: ${report.reporterEmail || 'Not provided'}

Feedback:
${report.description}

Diagnostics:
${JSON.stringify(report.diagnostics || {}, null, 2)}

The annotated screenshot is stored in the private Feedback inbox at /analytics-feedback.

Reproduce the problem before changing code. Add a focused regression test, implement the smallest complete fix, run the repository checks, verify the behavior in Chrome, then ship it to production following AGENTS.md.`;
}

export async function submitFeedback(request: Request, env: FeedbackEnv): Promise<Response> {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_FEEDBACK_SCREENSHOT_BYTES + 100_000) return response({ error: 'feedback upload is too large' }, 413);

  let form: FormData;
  try { form = await request.formData(); }
  catch { return response({ error: 'invalid feedback form' }, 400); }
  const parsed = parseFeedbackForm(form);
  if (!parsed.ok) return response({ error: parsed.error }, 400);

  const id = crypto.randomUUID();
  const now = Date.now();
  const screenshotKey = parsed.value.screenshot
    ? `feedback/${new Date(now).toISOString().slice(0, 10)}/${id}.png`
    : null;
  let uploaded = false;
  try {
    if (screenshotKey && parsed.value.screenshot) {
      await env.BUILDINGS.put(screenshotKey, parsed.value.screenshot, {
        httpMetadata: { contentType: 'image/png', cacheControl: 'private, no-store' },
      });
      uploaded = true;
    }
    await env.DB.prepare(`INSERT INTO feedback_reports
      (id, created_at, reporter_email, description, page_url, screenshot_key, diagnostics, status, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'new', ?2)`)
      .bind(id, now, parsed.value.reporterEmail, parsed.value.description, parsed.value.pageUrl,
        screenshotKey, JSON.stringify(parsed.value.diagnostics)).run();
  } catch (error) {
    if (uploaded && screenshotKey) await env.BUILDINGS.delete(screenshotKey).catch(() => undefined);
    console.error(JSON.stringify({ event: 'feedback_submit_failed', id, error: error instanceof Error ? error.message : String(error) }));
    return response({ error: 'feedback could not be saved' }, 500);
  }
  return response({ reportId: id }, 201);
}

export async function listFeedback(env: FeedbackEnv): Promise<Response> {
  const rows = await env.DB.prepare(`SELECT id, created_at, reporter_email, description, page_url,
    screenshot_key, diagnostics, status, updated_at, reviewed_by
    FROM feedback_reports ORDER BY created_at DESC LIMIT 500`).all<FeedbackRow>();
  return response({ reports: rows.results.map((row) => {
    let diagnostics: unknown = {};
    try { diagnostics = JSON.parse(row.diagnostics); } catch { diagnostics = {}; }
    const report = {
      id: row.id, createdAt: row.created_at, reporterEmail: row.reporter_email,
      description: row.description, pageUrl: row.page_url, hasScreenshot: Boolean(row.screenshot_key),
      diagnostics, status: row.status, updatedAt: row.updated_at, reviewedBy: row.reviewed_by,
    };
    return { ...report, codexPrompt: buildCodexFeedbackPrompt(report) };
  }) });
}

export async function updateFeedbackStatus(request: Request, id: string, reviewer: string, env: FeedbackEnv): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { return response({ error: 'invalid JSON' }, 400); }
  const status = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>).status : null;
  if (typeof status !== 'string' || !VALID_FEEDBACK_STATUSES.includes(status as FeedbackStatus)) {
    return response({ error: 'invalid feedback status' }, 400);
  }
  const result = await env.DB.prepare(`UPDATE feedback_reports SET status = ?1, updated_at = ?2,
    reviewed_by = ?3 WHERE id = ?4`).bind(status, Date.now(), reviewer, id).run();
  return result.meta.changes ? response({ ok: true }) : response({ error: 'not found' }, 404);
}

export async function feedbackScreenshot(id: string, env: FeedbackEnv): Promise<Response> {
  const row = await env.DB.prepare('SELECT screenshot_key FROM feedback_reports WHERE id = ?1')
    .bind(id).first<{ screenshot_key: string | null }>();
  if (!row?.screenshot_key) return response({ error: 'screenshot not found' }, 404);
  const object = await env.BUILDINGS.get(row.screenshot_key);
  if (!object) return response({ error: 'screenshot not found' }, 404);
  return new Response(object.body, { headers: {
    'Content-Type': object.httpMetadata?.contentType || 'image/png',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
}
