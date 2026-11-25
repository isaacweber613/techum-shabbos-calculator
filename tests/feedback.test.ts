import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCodexFeedbackPrompt,
  feedbackTelegramMessage,
  submitFeedback,
  MAX_FEEDBACK_DESCRIPTION_LENGTH,
  MAX_FEEDBACK_SCREENSHOT_BYTES,
  parseFeedbackForm,
  VALID_FEEDBACK_STATUSES,
} from '../worker/feedback.ts';
import { shouldRedirectToCanonical } from '../worker/routing.ts';

function form(overrides: Record<string, string | Blob> = {}) {
  const data = new FormData();
  const values: Record<string, string | Blob> = {
    description: 'The map controls overlap the result on a narrow screen.',
    pageUrl: 'https://tchumshabbos.com/?design=10',
    reporterEmail: 'reviewer@example.com',
    diagnostics: JSON.stringify({ viewport: '390x844', errors: ['example warning'] }),
    screenshot: new Blob(['png'], { type: 'image/png' }),
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const valid = parseFeedbackForm(form());
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.equal(valid.value.description, 'The map controls overlap the result on a narrow screen.');
  assert.equal(valid.value.screenshot?.type, 'image/png');
}

assert.equal(parseFeedbackForm(form({ description: '' })).ok, false);
assert.equal(parseFeedbackForm(form({ description: 'x'.repeat(MAX_FEEDBACK_DESCRIPTION_LENGTH + 1) })).ok, false);
assert.equal(parseFeedbackForm(form({ screenshot: new Blob(['x'], { type: 'image/jpeg' }) })).ok, false);
assert.equal(parseFeedbackForm(form({ screenshot: new Blob([new Uint8Array(MAX_FEEDBACK_SCREENSHOT_BYTES + 1)], { type: 'image/png' }) })).ok, false);
assert.deepEqual([...VALID_FEEDBACK_STATUSES], ['new', 'planned', 'done', 'archived']);

const prompt = buildCodexFeedbackPrompt({
  id: 'feedback-123',
  description: 'The map controls overlap the result on a narrow screen.',
  pageUrl: 'https://tchumshabbos.com/?design=10',
  reporterEmail: 'reviewer@example.com',
  diagnostics: { viewport: '390x844' },
});
assert.match(prompt, /Tchum Calculator/);
assert.match(prompt, /feedback-123/);
assert.match(prompt, /reproduce/i);
assert.match(prompt, /test/i);
assert.match(prompt, /ship/i);

if (valid.ok) {
  const message = feedbackTelegramMessage(valid.value, 'https://tchumshabbos.com/analytics-feedback');
  assert.match(message, /The map controls overlap/);
  assert.match(message, /Page: https:\/\/tchumshabbos\.com\/\?design=10/);
  assert.match(message, /Email: reviewer@example\.com/);
  const long = feedbackTelegramMessage({ ...valid.value, description: 'x'.repeat(5_000), reporterEmail: null }, 'https://x/');
  assert.ok(long.length < 4_096);
  assert.match(long, /Email: not given/);
}

// A saved report sends one Telegram message after the response; a Telegram failure never breaks the save.
for (const telegramWorks of [true, false]) {
  const sent: string[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent.push((JSON.parse(String(init.body)) as { text: string }).text);
    if (!telegramWorks) throw new Error('network down');
    return Response.json({ ok: true, result: { message_id: 1 } });
  }) as typeof fetch;
  const env = {
    TELEGRAM_BOT_TOKEN: 'TEST-TOKEN', TELEGRAM_CHAT_ID: '12345',
    BUILDINGS: { put: async () => undefined, delete: async () => undefined },
    DB: { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) }) },
  } as unknown as Parameters<typeof submitFeedback>[1];
  const background: Promise<unknown>[] = [];
  const saved = await submitFeedback(new Request('https://tchumshabbos.com/api/feedback', { method: 'POST', body: form() }),
    env, (work) => background.push(work));
  assert.equal(saved.status, 201);
  await Promise.all(background);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /New Techum feedback/);
  assert.match(sent[0], /Inbox: https:\/\/tchumshabbos\.com\/analytics-feedback/);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inboxHtml = fs.readFileSync(path.join(root, 'feedback.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'worker', 'index.ts'), 'utf8');
const feedbackScript = fs.readFileSync(path.join(root, 'js', 'feedback.js'), 'utf8');
const feedbackCss = fs.readFileSync(path.join(root, 'css', 'feedback.css'), 'utf8');
assert.match(appHtml, /id="send-feedback-button"/);
assert.match(appHtml, /id="banner-feedback-button"/);
assert.match(appHtml, /greatly appreciated/i);
assert.match(feedbackScript, /\[data-feedback-trigger\]/);
assert.match(feedbackCss, /#send-feedback-button \[data-feedback-label\][^{]*\{[^}]*max-width:\s*0/s);
assert.match(feedbackCss, /#send-feedback-button:is\(:hover,:focus-visible\) \[data-feedback-label\]/);
assert.match(feedbackCss, /#send-feedback-button[^{}]*\{[^}]*width:\s*38px/s);
assert.match(feedbackCss, /#send-feedback-button \[data-feedback-label\][^{]*\{[^}]*position:\s*absolute/s);
assert.doesNotMatch(feedbackCss, /#send-feedback-button:is\(:hover,:focus-visible\)[^{]*\{[^}]*width:\s*auto/s);
assert.match(appHtml, /js\/feedback\.js/);
assert.match(inboxHtml, /noindex,nofollow,noarchive/);
assert.match(inboxHtml, /Copy for Codex/);
assert.match(worker, /FEEDBACK_RATE_LIMITER/);
assert.match(worker, /\/api\/analytics-feedback/);
assert.match(worker, /url\.pathname === '\/api\/feedback' && request\.method === 'POST'/);
assert.doesNotMatch(worker, /api\.github\.com|GITHUB_TOKEN/);
assert.equal(shouldRedirectToCanonical(new URL('http://127.0.0.1:8787/')), false);
assert.equal(shouldRedirectToCanonical(new URL('http://localhost:8787/')), false);
assert.equal(shouldRedirectToCanonical(new URL('http://lvh.me:8787/')), false);
assert.equal(shouldRedirectToCanonical(new URL('http://tchumshabbos.com/')), true);
assert.equal(shouldRedirectToCanonical(new URL('https://www.tchumshabbos.com/')), true);

console.log('feedback validation, stationary non-obstructive launcher, private inbox, Codex handoff, and local routing: 28 tests passed');
