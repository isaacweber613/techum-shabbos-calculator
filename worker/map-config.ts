export interface GoogleMapConfigEnv {
  DB: D1Database;
  MAP_CONFIG_RATE_LIMITER: RateLimit;
  GOOGLE_MAPS_BROWSER_KEY?: string;
  GOOGLE_MAPS_DAILY_CAP?: string;
}

export const DEFAULT_GOOGLE_MAPS_DAILY_CAP = 10;

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

export async function issueGoogleMapConfig(request: Request, env: GoogleMapConfigEnv): Promise<Response> {
  if (!isTrustedMapConfigRequest(request)) {
    return Response.json({ error: 'same-site request required' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  const browserKey = normalizeGoogleMapsBrowserKey(env.GOOGLE_MAPS_BROWSER_KEY);
  if (!browserKey) {
    return Response.json({ error: 'Google Maps is not configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const rateKey = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimit = await env.MAP_CONFIG_RATE_LIMITER.limit({ key: `map-config:${rateKey}` });
  if (!rateLimit.success) {
    console.warn(JSON.stringify({ event: 'google_map_config_rate_limited' }));
    return Response.json({ error: 'Too many map configuration requests', fallback: 'original' }, {
      status: 429,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
    });
  }

  const day = googleQuotaDay();
  const dailyCap = parseGoogleMapsDailyCap(env.GOOGLE_MAPS_DAILY_CAP);
  const claimed = await env.DB.prepare(`INSERT INTO google_map_daily_usage (usage_date, load_count)
    VALUES (?1, 1)
    ON CONFLICT(usage_date) DO UPDATE SET load_count = load_count + 1
      WHERE load_count < ?2
    RETURNING load_count`).bind(day, dailyCap).first<{ load_count: number }>();

  if (!claimed) {
    const retryAfter = secondsUntilNextGoogleQuotaDay();
    console.warn(JSON.stringify({ event: 'google_map_daily_allowance_reached', usage_date: day, daily_cap: dailyCap }));
    return Response.json({ error: 'Google Maps daily allowance reached', fallback: 'original' }, {
      status: 429,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) },
    });
  }

  return Response.json({ provider: 'google', key: browserKey }, {
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
  });
}
