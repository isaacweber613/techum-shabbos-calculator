import { sendTelegram, type TelegramEnv } from './telegram.ts';

export interface GoogleMapConfigEnv extends TelegramEnv {
  DB: D1Database;
  MAP_CONFIG_RATE_LIMITER: RateLimit;
  GOOGLE_MAPS_BROWSER_KEY?: string;
  GOOGLE_MAPS_DAILY_CAP?: string;
  GOOGLE_STATIC_MAPS_DAILY_CAP?: string;
}

/** Runs work after the response is sent (ctx.waitUntil in the Worker). */
export type Background = (work: Promise<unknown>) => void;
type LimitKind = 'map' | 'static';

export const DEFAULT_GOOGLE_MAPS_DAILY_CAP = 30;

// Google resets Maps quotas at midnight Pacific time, so this counter uses the same day.
export function googleQuotaDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now);
}

function secondsUntilNextGoogleQuotaDay(now = new Date()): number {
  const today = googleQuotaDay(now);
  let low = now.getTime();
  let high = low + 26 * 3600_000;
  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    if (googleQuotaDay(new Date(mid)) === today) low = mid; else high = mid;
  }
  return Math.max(1, Math.ceil((high - now.getTime()) / 1000));
}

export function normalizeGoogleMapsBrowserKey(value?: string): string {
  return value?.trim() || '';
}

export function parseGoogleMapsDailyCap(value?: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_GOOGLE_MAPS_DAILY_CAP;
  return Math.min(10_000, Math.max(1, Math.floor(parsed)));
}

export function isTrustedMapConfigRequest(request: Request): boolean {
  const requestUrl = new URL(request.url);
  if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') return true;
  const referer = request.headers.get('Referer');
  if (!referer) return false;
  try { return new URL(referer).hostname === requestUrl.hostname; }
  catch { return false; }
}

function noStore(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export function googleLimitMessage(kind: LimitKind, cap: number): string {
  return kind === 'map'
    ? `Techum hit today's Google map limit of ${cap}. Visitors after this see the free map until midnight Pacific.`
    : `Techum hit today's Google export limit of ${cap} map images (a PNG or PDF uses up to 4). Exports after this use the free map until midnight Pacific.`;
}

// The first refusal of the day claims the alert row, so Isaac gets one message per kind per day.
// A failed send releases the row so the next refusal tries again.
export async function alertGoogleLimitReached(env: GoogleMapConfigEnv, day: string, kind: LimitKind, cap: number): Promise<void> {
  try {
    const claimed = await env.DB.prepare(`INSERT INTO google_limit_alerts (usage_date, kind, sent_at)
      VALUES (?1, ?2, ?3) ON CONFLICT(usage_date, kind) DO NOTHING RETURNING kind`)
      .bind(day, kind, Date.now()).first<{ kind: string }>();
    if (!claimed) return;
    if (!await sendTelegram(env, googleLimitMessage(kind, cap), `google_${kind}_limit`)) {
      await env.DB.prepare('DELETE FROM google_limit_alerts WHERE usage_date = ?1 AND kind = ?2').bind(day, kind).run();
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'google_limit_alert_failed', kind,
      error: error instanceof Error ? error.message : String(error) }));
  }
}

async function guardGoogleRequest(request: Request, env: GoogleMapConfigEnv, purpose: string): Promise<Response | null> {
  if (!isTrustedMapConfigRequest(request)) return noStore({ error: 'same-site request required' }, 403);
  if (!normalizeGoogleMapsBrowserKey(env.GOOGLE_MAPS_BROWSER_KEY)) return noStore({ error: 'Google Maps is not configured' }, 503);
  const rateKey = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimit = await env.MAP_CONFIG_RATE_LIMITER.limit({ key: `${purpose}:${rateKey}` });
  if (!rateLimit.success) {
    console.warn(JSON.stringify({ event: 'google_map_config_rate_limited', purpose }));
    return noStore({ error: 'Too many map configuration requests', fallback: 'original' }, 429, { 'Retry-After': '60' });
  }
  return null;
}

// Claims `count` of today's Google requests of this kind; false if that would pass the cap.
async function claimGoogleDailySlot(env: GoogleMapConfigEnv, day: string, kind: LimitKind, cap: number, count = 1): Promise<boolean> {
  if (count > cap) return false;
  const sql = kind === 'map'
    ? `INSERT INTO google_map_daily_usage (usage_date, load_count)
    VALUES (?1, ?3)
    ON CONFLICT(usage_date) DO UPDATE SET load_count = load_count + ?3
      WHERE load_count + ?3 <= ?2
    RETURNING load_count`
    : `INSERT INTO google_map_daily_usage (usage_date, load_count, static_count)
    VALUES (?1, 0, ?3)
    ON CONFLICT(usage_date) DO UPDATE SET static_count = static_count + ?3
      WHERE static_count + ?3 <= ?2
    RETURNING static_count`;
  return Boolean(await env.DB.prepare(sql).bind(day, cap, count).first());
}

// A PNG/PDF export asks for one slot per Google image it will request (1 to 4).
export const MAX_EXPORT_IMAGES = 4;
export function exportImageCount(request: Request): number {
  const parsed = Number(new URL(request.url).searchParams.get('images') || 1);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_EXPORT_IMAGES ? parsed : 0;
}

async function refuseForToday(env: GoogleMapConfigEnv, day: string, kind: LimitKind, cap: number, background: Background): Promise<Response> {
  console.warn(JSON.stringify({ event: kind === 'map' ? 'google_map_daily_allowance_reached' : 'google_static_daily_allowance_reached',
    usage_date: day, daily_cap: cap }));
  background(alertGoogleLimitReached(env, day, kind, cap));
  return noStore({ error: 'Google Maps daily allowance reached', fallback: 'original' }, 429,
    { 'Retry-After': String(secondsUntilNextGoogleQuotaDay()) });
}

export async function issueGoogleMapConfig(request: Request, env: GoogleMapConfigEnv, background: Background = () => {}): Promise<Response> {
  const refused = await guardGoogleRequest(request, env, 'map-config');
  if (refused) return refused;
  const day = googleQuotaDay();
  const dailyCap = parseGoogleMapsDailyCap(env.GOOGLE_MAPS_DAILY_CAP);
  if (!await claimGoogleDailySlot(env, day, 'map', dailyCap)) return refuseForToday(env, day, 'map', dailyCap, background);
  return Response.json({ provider: 'google', key: normalizeGoogleMapsBrowserKey(env.GOOGLE_MAPS_BROWSER_KEY) }, {
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
  });
}

/** Up to four Static Maps images per PNG/PDF export; the browser claims them before requesting. */
export async function claimGoogleExportSlot(request: Request, env: GoogleMapConfigEnv, background: Background = () => {}): Promise<Response> {
  const images = exportImageCount(request);
  if (!images) return noStore({ error: `images must be 1 to ${MAX_EXPORT_IMAGES}` }, 400);
  const refused = await guardGoogleRequest(request, env, 'map-export');
  if (refused) return refused;
  const day = googleQuotaDay();
  const dailyCap = parseGoogleMapsDailyCap(env.GOOGLE_STATIC_MAPS_DAILY_CAP);
  if (!await claimGoogleDailySlot(env, day, 'static', dailyCap, images)) return refuseForToday(env, day, 'static', dailyCap, background);
  return noStore({ ok: true });
}
