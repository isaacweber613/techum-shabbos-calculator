import { handleBuildings } from './buildings';
import { submitBuildingCorrection } from './corrections';
import { issueGoogleMapConfig } from './map-config';
import { sha256Hex, validateRegistrySubmission } from './registry';

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BUILDINGS: R2Bucket;
  EVENT_RATE_LIMITER: RateLimit;
  GEOCODE_RATE_LIMITER: RateLimit;
  BUILDINGS_RATE_LIMITER: RateLimit;
  MAP_CONFIG_RATE_LIMITER: RateLimit;
  IP_HASH_SECRET: string;
  REQUIRE_ACCESS: string;
  RAW_RETENTION_DAYS: string;
  GEOCODER_CONTACT: string;
  REGISTRY_WRITES?: string;
  GOOGLE_MAPS_BROWSER_KEY?: string;
  GOOGLE_MAPS_DAILY_CAP?: string;
}

function accessEmail(request: Request): string | null {
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) return null;
  return request.headers.get('Cf-Access-Authenticated-User-Email')?.trim().toLowerCase() || null;
}

function requireRegistryAdmin(request: Request, env: Env): string | null {
  if (env.REGISTRY_WRITES !== 'true') return null;
  return accessEmail(request);
}

type EventType = 'visit' | 'search' | 'calc' | 'export' | 'snapshot';
type EventPayload = Record<string, unknown> & { type: EventType; vid?: string };
const EVENT_TYPES = new Set<EventType>(['visit', 'search', 'calc', 'export', 'snapshot']);
const MAX_STRING = 300;
const MAX_KEYS = 40;

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function cleanValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.slice(0, MAX_STRING);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean' || value === null) return value;
  if (depth < 3 && Array.isArray(value)) {
    return value.slice(0, 10).map((child) => cleanValue(child, depth + 1)).filter((child) => child !== undefined);
  }
  if (depth < 3 && value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value).slice(0, MAX_KEYS)) {
      const cleaned = cleanValue(child, depth + 1);
      if (cleaned !== undefined) out[key.slice(0, 60)] = cleaned;
    }
    return out;
  }
  return undefined;
}

function sanitizeEvent(raw: unknown): EventPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  if (typeof input.type !== 'string' || !EVENT_TYPES.has(input.type as EventType)) return null;
  const event: EventPayload = { type: input.type as EventType, vid: String(input.vid || 'anon').slice(0, 40) };
  for (const [key, value] of Object.entries(input)) {
    if (key === 'type' || key === 'vid' || key === 't') continue;
    const cleaned = cleanValue(value);
    if (cleaned !== undefined) event[key.slice(0, 60)] = cleaned;
  }
  return event;
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function eventColumn(type: EventType): string {
  return ({ visit: 'visits', search: 'searches', calc: 'calcs', export: 'exports', snapshot: 'snapshots' })[type];
}

async function recordEvent(request: Request, env: Env): Promise<Response> {
  let raw: unknown;
  try { raw = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  const event = sanitizeEvent(raw);
  if (!event) return json({ error: 'invalid event' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const host = new URL(request.url).hostname;
  const localRequest = host === '127.0.0.1' || host === 'localhost';
  if (!env.IP_HASH_SECRET && !localRequest) return json({ error: 'analytics secret is not configured' }, 503);
  const month = new Date().toISOString().slice(0, 7);
  const networkId = await hmacHex(env.IP_HASH_SECRET || 'local-development-only', month + '|' + ip);
  const rateKey = `${event.vid || 'anon'}:${networkId}`;
  const { success } = await env.EVENT_RATE_LIMITER.limit({ key: rateKey });
  if (!success) return json({ error: 'rate limit exceeded' }, 429, { 'Retry-After': '60' });

  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const type = event.type;
  const vid = String(event.vid || 'anon');
  const country = request.cf?.country || null;
  const colo = request.cf?.colo || null;
  const userAgent = (request.headers.get('User-Agent') || '').slice(0, 200);
  const payload = Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'type' && key !== 'vid'));
  const metricColumns = [eventColumn(type)];
  if (type === 'search' && event.found) metricColumns.push('search_found');
  if (type === 'calc' && event.mode === 'city') metricColumns.push('city_calcs');
  if (type === 'calc' && event.mode === 'point') metricColumns.push('point_calcs');
  if (type === 'calc' && event.fromCache) metricColumns.push('cache_hits');
  const insertColumns = metricColumns.join(', ');
  const insertValues = metricColumns.map(() => '1').join(', ');
  const updates = metricColumns.map((column) => `${column} = ${column} + 1`).join(', ');

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO events (t, day, type, vid, payload, country, colo, network_id, user_agent)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
      .bind(now, day, type, vid, JSON.stringify(payload), country, colo, networkId, userAgent),
    env.DB.prepare(`INSERT INTO daily_totals (day, ${insertColumns}) VALUES (?1, ${insertValues})
      ON CONFLICT(day) DO UPDATE SET ${updates}`).bind(day),
    env.DB.prepare(`INSERT INTO visitors (vid, first_seen, last_seen, country) VALUES (?1, ?2, ?2, ?3)
      ON CONFLICT(vid) DO UPDATE SET last_seen = excluded.last_seen,
      country = COALESCE(excluded.country, visitors.country)`).bind(vid, now, country),
  ]);
  return new Response(null, { status: 204 });
}

type StoredEvent = { t: number; type: EventType; vid: string; payload: string; country: string | null; colo: string | null; user_agent: string | null };
type DailyTotal = { day: string; visits: number; searches: number; calcs: number; exports: number; snapshots: number;
  search_found: number; city_calcs: number; point_calcs: number; cache_hits: number };
type AnalyticsEvent = StoredEvent & {
  found?: unknown; q?: unknown; label?: unknown; mode?: unknown; fromCache?: unknown;
  profile?: unknown; nonDefaults?: unknown; page?: unknown; format?: unknown;
  action?: unknown; buildings?: unknown; ref?: unknown; ms?: unknown; performance?: unknown;
};
function topCounts(map: Map<string, { count: number; [key: string]: unknown }>, limit: number) {
  return [...map.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, limit).map(([key, value]) => ({ key, ...value }));
}

async function analytics(request: Request, env: Env): Promise<Response> {
  if (env.REQUIRE_ACCESS === 'true' &&
      (!request.headers.get('Cf-Access-Authenticated-User-Email') || !request.headers.get('Cf-Access-Jwt-Assertion'))) {
    return json({ error: 'Cloudflare Access authentication required' }, 403);
  }
  const url = new URL(request.url);
  const finite = (name: string, fallback: number) => {
    const value = Number(url.searchParams.get(name));
    return Number.isFinite(value) ? value : fallback;
  };
  const from = finite('from', 0), to = finite('to', Date.now() + 86400000);
  const tz = finite('tz', 0);
  const rows = await env.DB.prepare(`SELECT t, type, vid, payload, country, colo, user_agent FROM events
    WHERE t >= ?1 AND t < ?2 ORDER BY t ASC LIMIT 50000`).bind(from, to).all<StoredEvent>();
  const fromDay = new Date(Math.max(0, from)).toISOString().slice(0, 10);
  const toDay = new Date(Math.max(0, to - 1)).toISOString().slice(0, 10);
  const dailyRows = await env.DB.prepare(`SELECT day, visits, searches, calcs, exports, snapshots,
    search_found, city_calcs, point_calcs, cache_hits
    FROM daily_totals WHERE day >= ?1 AND day <= ?2 ORDER BY day ASC`).bind(fromDay, toDay).all<DailyTotal>();
  const events: AnalyticsEvent[] = rows.results.map((row) => ({ ...row, ...JSON.parse(row.payload) as Record<string, unknown> }));
  const totals = dailyRows.results.reduce((sum, day) => ({
    visits: sum.visits + day.visits, uniqueVisitors: 0,
    searches: sum.searches + day.searches, calcs: sum.calcs + day.calcs,
    exports: sum.exports + day.exports, snapshots: sum.snapshots + day.snapshots,
  }), { visits: 0, uniqueVisitors: 0, searches: 0, calcs: 0, exports: 0, snapshots: 0 });
  const vids = new Set<string>();
  const byDay = new Map(dailyRows.results.map((day) => [day.day,
    { day: day.day, visits: day.visits, searches: day.searches, calcs: day.calcs }]));
  const searches = new Map<string, { count: number; found: number; example: string }>();
  const places = new Map<string, { count: number }>(), settings = new Map<string, { count: number }>();
  const profiles = new Map<string, { count: number }>(), countries = new Map<string, { count: number }>();
  const devices = new Map<string, { count: number }>();
  const modes = dailyRows.results.reduce((sum, day) => ({
    city: sum.city + day.city_calcs, point: sum.point + day.point_calcs,
  }), { city: 0, point: 0 });
  const cacheHits = dailyRows.results.reduce((sum, day) => sum + day.cache_hits, 0);
  const searchFound = dailyRows.results.reduce((sum, day) => sum + day.search_found, 0);
  for (const event of events) {
    vids.add(event.vid);
    const ua = event.user_agent || '';
    const device = /tablet|ipad/i.test(ua) ? 'tablet' : /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop';
    if (!devices.has(device)) devices.set(device, { count: 0 }); devices.get(device)!.count++;
    if (event.country) {
      if (!countries.has(event.country)) countries.set(event.country, { count: 0 });
      countries.get(event.country)!.count++;
    }
    if (event.type === 'visit') { /* totals come from permanent daily rollups */ }
    else if (event.type === 'search') {
      const query = String(event.q || '').trim();
      if (query) {
        const key = query.toLowerCase();
        if (!searches.has(key)) searches.set(key, { count: 0, found: 0, example: query });
        const item = searches.get(key)!; item.count++; if (event.found) item.found++;
      }
    } else if (event.type === 'calc') {
      const place = String(event.label || event.q || 'unknown').trim();
      if (!places.has(place)) places.set(place, { count: 0 }); places.get(place)!.count++;
      if (event.profile) {
        const profile = String(event.profile); if (!profiles.has(profile)) profiles.set(profile, { count: 0 }); profiles.get(profile)!.count++;
      }
      if (event.nonDefaults && typeof event.nonDefaults === 'object') {
        for (const [key, value] of Object.entries(event.nonDefaults)) {
          const label = `${key} = ${JSON.stringify(value)}`;
          if (!settings.has(label)) settings.set(label, { count: 0 }); settings.get(label)!.count++;
        }
      }
    }
  }
  if (from === 0) {
    const allVisitors = await env.DB.prepare('SELECT COUNT(*) AS count FROM visitors WHERE first_seen < ?1').bind(to).first<{ count: number }>();
    totals.uniqueVisitors = allVisitors?.count || 0;
  } else totals.uniqueVisitors = vids.size;
  const recent = events.slice(-120).reverse().map((event) => ({
    t: event.t, type: event.type,
    detail: event.type === 'search' ? event.q : event.type === 'calc' ? (event.label || event.q) : event.type === 'visit' ? event.page : event.format || event.action || '',
    extra: event.type === 'search' ? (event.found ? event.label || 'found' : 'NOT FOUND') :
      event.type === 'calc' ? `${event.mode || '?'} · ${event.buildings ?? '?'} bldgs` : event.ref || '',
  }));
  const performanceReports = events.filter((event) => event.type === 'calc' && event.performance)
    .slice(-120).reverse().map((event) => ({
      t: event.t, place: event.label || event.q || '', mode: event.mode,
      buildings: event.buildings, totalMs: event.ms, performance: event.performance,
    }));
  return json({ totals, modes, cacheHits, searchFound, byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    topSearches: topCounts(searches, 40), topPlaces: topCounts(places, 40), nonDefaultSettings: topCounts(settings, 60),
    profiles: topCounts(profiles, 10), countries: topCounts(countries, 30), devices: topCounts(devices, 10), recent, performanceReports,
    firstEventAt: events[0]?.t || null, generatedAt: Date.now(), truncated: rows.results.length === 50000 });
}

async function geocode(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim().slice(0, 300);
  if (!query) return json({ error: 'query required' }, 400);
  if (!env.GEOCODER_CONTACT || env.GEOCODER_CONTACT === 'SET_BEFORE_PRODUCTION') {
    return json({ error: 'geocoder contact is not configured' }, 503);
  }
  const hasLat = url.searchParams.has('lat');
  const hasLon = url.searchParams.has('lon');
  const latRaw = Number(url.searchParams.get('lat'));
  const lonRaw = Number(url.searchParams.get('lon'));
  const hasBias = hasLat && hasLon && Number.isFinite(latRaw) && Number.isFinite(lonRaw) &&
    latRaw >= -90 && latRaw <= 90 && lonRaw >= -180 && lonRaw <= 180;
  const lat = hasBias ? Math.round(latRaw * 100) / 100 : 0;
  const lon = hasBias ? Math.round(lonRaw * 100) / 100 : 0;
  const normalized = query.toLowerCase().replace(/\s+/g, ' ') + (hasBias ? `|${lat},${lon}` : '');
  const cached = await env.DB.prepare('SELECT response FROM geocode_cache WHERE query = ?1').bind(normalized).first<{ response: string }>();
  if (cached) return new Response(cached.response, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });

  const network = await hmacHex(env.IP_HASH_SECRET || 'local-development-only', request.headers.get('CF-Connecting-IP') || 'unknown');
  const limited = await env.GEOCODE_RATE_LIMITER.limit({ key: network });
  if (!limited.success) return json({ error: 'geocoder rate limit exceeded' }, 429, { 'Retry-After': '60' });
  const second = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare('INSERT INTO geocode_slots (second) VALUES (?1)').bind(second).run();
  } catch {
    return json({ error: 'geocoder is busy; retry in one second' }, 429, { 'Retry-After': '1' });
  }
  const endpoint = new URL('https://nominatim.openstreetmap.org/search');
  endpoint.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', addressdetails: '1' }).toString();
  if (hasBias) endpoint.searchParams.set('viewbox', `${lon - 0.5},${lat + 0.5},${lon + 0.5},${lat - 0.5}`);
  const upstream = await fetch(endpoint, { headers: {
    'User-Agent': `TechumShabbosCalculator/1.0 (${env.GEOCODER_CONTACT})`,
    'Accept': 'application/json',
  } });
  if (!upstream.ok) return json({ error: `geocoder HTTP ${upstream.status}` }, 502);
  const text = await upstream.text();
  await env.DB.prepare(`INSERT INTO geocode_cache (query, response, cached_at) VALUES (?1, ?2, ?3)
    ON CONFLICT(query) DO UPDATE SET response = excluded.response, cached_at = excluded.cached_at`)
    .bind(normalized, text, Date.now()).run();
  return new Response(text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });
}

async function reverseGeocode(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return json({ error: 'valid latitude and longitude required' }, 400);
  }
  if (!env.GEOCODER_CONTACT || env.GEOCODER_CONTACT === 'SET_BEFORE_PRODUCTION') {
    return json({ error: 'geocoder contact is not configured' }, 503);
  }

  const cacheKey = `reverse:${lat.toFixed(5)},${lon.toFixed(5)}`;
  const cached = await env.DB.prepare('SELECT response FROM geocode_cache WHERE query = ?1')
    .bind(cacheKey).first<{ response: string }>();
  if (cached) {
    return new Response(cached.response, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  const network = await hmacHex(env.IP_HASH_SECRET || 'local-development-only', request.headers.get('CF-Connecting-IP') || 'unknown');
  const limited = await env.GEOCODE_RATE_LIMITER.limit({ key: `reverse:${network}` });
  if (!limited.success) return json({ error: 'geocoder rate limit exceeded' }, 429, { 'Retry-After': '60' });
  const second = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare('INSERT INTO geocode_slots (second) VALUES (?1)').bind(second).run();
  } catch {
    return json({ error: 'geocoder is busy; retry in one second' }, 429, { 'Retry-After': '1' });
  }

  const endpoint = new URL('https://nominatim.openstreetmap.org/reverse');
  endpoint.search = new URLSearchParams({
    lat: String(lat), lon: String(lon), format: 'jsonv2', zoom: '18', addressdetails: '1',
  }).toString();
  const upstream = await fetch(endpoint, { headers: {
    'User-Agent': `TechumShabbosCalculator/1.0 (${env.GEOCODER_CONTACT})`,
    'Accept': 'application/json',
  } });
  if (!upstream.ok) return json({ error: `geocoder HTTP ${upstream.status}` }, 502);
  const text = await upstream.text();
  if (text.length > 100_000) return json({ error: 'geocoder response too large' }, 502);
  await env.DB.prepare(`INSERT INTO geocode_cache (query, response, cached_at) VALUES (?1, ?2, ?3)
    ON CONFLICT(query) DO UPDATE SET response = excluded.response, cached_at = excluded.cached_at`)
    .bind(cacheKey, text, Date.now()).run();
  return new Response(text, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
  });
}

async function autocomplete(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim().slice(0, 300);
  if (query.length < 3) return json({ error: 'query must be at least 3 characters' }, 400);
  const hasLat = url.searchParams.has('lat');
  const hasLon = url.searchParams.has('lon');
  const latRaw = Number(url.searchParams.get('lat'));
  const lonRaw = Number(url.searchParams.get('lon'));
  const hasBias = hasLat && hasLon && Number.isFinite(latRaw) && Number.isFinite(lonRaw) &&
    latRaw >= -90 && latRaw <= 90 && lonRaw >= -180 && lonRaw <= 180;
  const lat = hasBias ? Math.round(latRaw * 100) / 100 : 0;
  const lon = hasBias ? Math.round(lonRaw * 100) / 100 : 0;
  const cacheKey = 'photon:' + query.toLowerCase().replace(/\s+/g, ' ') + (hasBias ? `|${lat},${lon}` : '');
  const cached = await env.DB.prepare('SELECT response FROM geocode_cache WHERE query = ?1').bind(cacheKey).first<{ response: string }>();
  if (cached) return new Response(cached.response, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });

  const network = await hmacHex(env.IP_HASH_SECRET || 'local-development-only', request.headers.get('CF-Connecting-IP') || 'unknown');
  const limited = await env.GEOCODE_RATE_LIMITER.limit({ key: 'autocomplete:' + network });
  if (!limited.success) return json({ error: 'autocomplete rate limit exceeded' }, 429, { 'Retry-After': '60' });

  const endpoint = new URL('https://photon.komoot.io/api/');
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('limit', '5');
  if (hasBias) {
    endpoint.searchParams.set('lat', String(lat));
    endpoint.searchParams.set('lon', String(lon));
  }
  const upstream = await fetch(endpoint, { headers: {
    'User-Agent': `TechumShabbosCalculator/1.0 (${env.GEOCODER_CONTACT})`,
    'Accept': 'application/json',
  } });
  if (!upstream.ok) return json({ error: `autocomplete HTTP ${upstream.status}` }, 502);
  const text = await upstream.text();
  if (text.length > 1_000_000) return json({ error: 'autocomplete response too large' }, 502);
  await env.DB.prepare(`INSERT INTO geocode_cache (query, response, cached_at) VALUES (?1, ?2, ?3)
    ON CONFLICT(query) DO UPDATE SET response = excluded.response, cached_at = excluded.cached_at`)
    .bind(cacheKey, text, Date.now()).run();
  return new Response(text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });
}

type RegistryRow = { id: string; slug: string; revision: number; city_label: string; snapshot_json?: string;
  snapshot_sha256: string; reviewer_name: string; reviewed_at: string; review_decision: string;
  review_conditions: string | null; source_notes: string; created_at: number };

function publicRegistryEntry(row: RegistryRow, includeSnapshot = false) {
  return { id: row.id, slug: row.slug, revision: row.revision, cityLabel: row.city_label,
    snapshotSha256: row.snapshot_sha256, review: { reviewerName: row.reviewer_name,
      reviewedAt: row.reviewed_at, decision: row.review_decision, conditions: row.review_conditions,
      sourceNotes: row.source_notes }, publishedAt: row.created_at,
    ...(includeSnapshot && row.snapshot_json ? { snapshot: JSON.parse(row.snapshot_json) as unknown } : {}) };
}

async function listRegistry(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(`SELECT id, slug, revision, city_label, snapshot_sha256,
    reviewer_name, reviewed_at, review_decision, review_conditions, source_notes, created_at
    FROM reviewed_snapshots WHERE status = 'published' ORDER BY city_label, revision DESC`).all<RegistryRow>();
  const seen = new Set<string>();
  return json({ entries: rows.results.filter((row) => !seen.has(row.slug) && Boolean(seen.add(row.slug))).map((row) => publicRegistryEntry(row)) },
    200, { 'Cache-Control': 'public, max-age=300' });
}

async function getRegistry(slug: string, env: Env): Promise<Response> {
  const row = await env.DB.prepare(`SELECT id, slug, revision, city_label, snapshot_json, snapshot_sha256,
    reviewer_name, reviewed_at, review_decision, review_conditions, source_notes, created_at
    FROM reviewed_snapshots WHERE slug = ?1 AND status = 'published' ORDER BY revision DESC LIMIT 1`)
    .bind(slug).first<RegistryRow>();
  return row ? json(publicRegistryEntry(row, true), 200, { 'Cache-Control': 'public, max-age=300' }) : json({ error: 'not found' }, 404);
}

async function publishRegistry(request: Request, env: Env): Promise<Response> {
  const email = requireRegistryAdmin(request, env);
  if (!email) return json({ error: env.REGISTRY_WRITES === 'true' ? 'Cloudflare Access authentication required' : 'registry writes are disabled' }, env.REGISTRY_WRITES === 'true' ? 403 : 503);
  let raw: unknown;
  try { raw = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  const checked = validateRegistrySubmission(raw);
  if (!checked.ok) return json({ error: checked.error }, 400);
  const { value, snapshotJson } = checked;
  const hash = await sha256Hex(snapshotJson);
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO reviewed_snapshots (id, slug, revision, city_label, snapshot_json,
    snapshot_sha256, reviewer_name, reviewed_at, review_decision, review_conditions, source_notes,
    status, created_at, created_by) SELECT ?1, ?2, COALESCE(MAX(revision), 0) + 1, ?3, ?4, ?5,
    ?6, ?7, ?8, ?9, ?10, 'published', ?11, ?12 FROM reviewed_snapshots WHERE slug = ?2`)
    .bind(id, value.slug, value.cityLabel, snapshotJson, hash, value.review.reviewerName,
      value.review.reviewedAt, value.review.decision, value.review.conditions || null, value.review.sourceNotes, now, email).run();
  const created = await env.DB.prepare('SELECT revision FROM reviewed_snapshots WHERE id = ?1').bind(id).first<{ revision: number }>();
  return json({ id, slug: value.slug, revision: created?.revision, snapshotSha256: hash }, 201);
}

async function withdrawRegistry(request: Request, id: string, env: Env): Promise<Response> {
  const email = requireRegistryAdmin(request, env);
  if (!email) return json({ error: env.REGISTRY_WRITES === 'true' ? 'Cloudflare Access authentication required' : 'registry writes are disabled' }, env.REGISTRY_WRITES === 'true' ? 403 : 503);
  let raw: unknown;
  try { raw = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  const reason = raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as Record<string, unknown>).reason === 'string'
    ? ((raw as Record<string, unknown>).reason as string).trim() : '';
  if (!reason || reason.length > 1000) return json({ error: 'withdrawal reason required' }, 400);
  const result = await env.DB.prepare(`UPDATE reviewed_snapshots SET status = 'withdrawn', withdrawn_at = ?1,
    withdrawn_by = ?2, withdrawal_reason = ?3 WHERE id = ?4 AND status = 'published'`)
    .bind(Date.now(), email, reason, id).run();
  return result.meta.changes ? new Response(null, { status: 204 }) : json({ error: 'not found' }, 404);
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/api/event' && request.method === 'POST') return recordEvent(request, env);
  if (url.pathname === '/api/analytics' && request.method === 'GET') return analytics(request, env);
  if (url.pathname === '/api/geocode' && request.method === 'GET') return geocode(request, env);
  if (url.pathname === '/api/reverse-geocode' && request.method === 'GET') return reverseGeocode(request, env);
  if (url.pathname === '/api/autocomplete' && request.method === 'GET') return autocomplete(request, env);
  if (url.pathname === '/api/map-config' && request.method === 'GET') return issueGoogleMapConfig(request, env);
  if (url.pathname === '/api/buildings' && request.method === 'GET') return handleBuildings(request, env);
  if (url.pathname === '/api/building-corrections' && request.method === 'POST') {
    const network = await hmacHex(env.IP_HASH_SECRET || 'local-development-only',
      request.headers.get('CF-Connecting-IP') || 'unknown');
    const limited = await env.BUILDINGS_RATE_LIMITER.limit({ key: `correction:${network}` });
    if (!limited.success) return json({ error: 'correction rate limit exceeded' }, 429, { 'Retry-After': '60' });
    const email = accessEmail(request);
    return submitBuildingCorrection(request, env.DB, email || `network:${network}`, !!email);
  }
  if (url.pathname === '/api/registry' && request.method === 'GET') return listRegistry(env);
  if (url.pathname === '/api/registry' && request.method === 'POST') return publishRegistry(request, env);
  const registryMatch = url.pathname.match(/^\/api\/registry\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (registryMatch && request.method === 'GET') return getRegistry(registryMatch[1], env);
  const withdrawalMatch = url.pathname.match(/^\/api\/registry\/([a-z0-9-]+)\/withdraw$/);
  if (withdrawalMatch && request.method === 'POST') return withdrawRegistry(request, withdrawalMatch[1], env);
  if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.protocol === 'http:' || url.hostname === 'www.tchumshabbos.com') {
        url.protocol = 'https:';
        url.hostname = 'tchumshabbos.com';
        url.port = '';
        return Response.redirect(url.toString(), 308);
      }
      return await handle(request, env);
    }
    catch (error) {
      console.error(JSON.stringify({ message: 'request failed', path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : String(error) }));
      return json({ error: 'internal server error' }, 500);
    }
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const days = Math.max(30, Number(env.RAW_RETENTION_DAYS) || 365);
    const cutoff = Date.now() - days * 86400000;
    await env.DB.batch([
      env.DB.prepare('DELETE FROM events WHERE t < ?1').bind(cutoff),
      env.DB.prepare('DELETE FROM geocode_slots WHERE second < ?1').bind(Math.floor(Date.now() / 1000) - 120),
      env.DB.prepare('DELETE FROM building_fill_slots WHERE second < ?1').bind(Math.floor(Date.now() / 1000) - 120),
      env.DB.prepare('DELETE FROM google_map_daily_usage WHERE usage_date < ?1')
        .bind(new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)),
    ]);
    console.log(JSON.stringify({ message: 'retention cleanup complete', cutoff, days }));
  },
} satisfies ExportedHandler<Env>;
