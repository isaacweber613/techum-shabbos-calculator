/*
 * Analytics store — no dependencies. Events are appended as JSON lines to
 * data/analytics-events.jsonl (one file, append-only, human-readable); aggregation
 * re-reads the file per request, which is fine at this tool's scale.
 *
 * Logged event types (client sends them; server stamps the time):
 *   visit    {page, ref, lang, tz}
 *   search   {q, found, label}                        — every address/geocode search
 *   calc     {q, label, pin, mode, buildings, fromCache, profile, nonDefaults, ms}
 *   export   {format}
 *   snapshot {action}
 * Every event carries vid — an anonymous random visitor id from localStorage.
 * NOTE: searched addresses and pin coordinates are logged by design (site-owner
 * analytics); the About page discloses this.
 */
import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ALLOWED_TYPES = new Set(['visit', 'search', 'calc', 'export', 'snapshot']);
const MAX_STR = 300;
const MAX_KEYS = 40;

function cleanValue(v) {
  if (typeof v === 'string') return v.slice(0, MAX_STR);
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean' || v === null) return v;
  if (typeof v === 'object') {
    const out = {};
    let n = 0;
    for (const k of Object.keys(v)) {
      if (++n > MAX_KEYS) break;
      const cv = cleanValue(v[k]);
      if (cv !== undefined) out[String(k).slice(0, 60)] = cv;
    }
    return out;
  }
  return undefined; // functions etc.
}

// Returns a sanitized event object, or null if the payload is not a valid event.
export function sanitizeEvent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!ALLOWED_TYPES.has(raw.type)) return null;
  const ev = { type: raw.type, vid: String(raw.vid || 'anon').slice(0, 40) };
  for (const k of Object.keys(raw)) {
    if (k === 'type' || k === 'vid' || k === 't') continue;
    const cv = cleanValue(raw[k]);
    if (cv !== undefined) ev[k.slice(0, 60)] = cv;
  }
  return ev;
}

export function makeStore(rootDir) {
  const dir = join(rootDir, 'data');
  const file = join(dir, 'analytics-events.jsonl');
  let dirReady = false;

  async function record(raw) {
    const ev = sanitizeEvent(raw);
    if (!ev) return false;
    ev.t = Date.now();
    if (!dirReady) { await mkdir(dir, { recursive: true }); dirReady = true; }
    await appendFile(file, JSON.stringify(ev) + '\n', 'utf8');
    return true;
  }

  async function loadEvents() {
    let text;
    try { text = await readFile(file, 'utf8'); } catch { return []; }
    const out = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line)); } catch { /* skip torn line */ }
    }
    return out;
  }

  return { record, loadEvents, file };
}

// ---------- aggregation ----------
// tzOffsetMin: the DASHBOARD viewer's Date.getTimezoneOffset() (positive = west of UTC),
// so daily buckets match the viewer's local calendar days.
function dayKey(tMs, tzOffsetMin) {
  return new Date(tMs - tzOffsetMin * 60000).toISOString().slice(0, 10);
}

function topCounts(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, v]) => ({ key, ...v }));
}

export function aggregate(events, { from = 0, to = Infinity, tzOffsetMin = 0 } = {}) {
  const inRange = events.filter((e) => e.t >= from && e.t < to);
  const totals = { visits: 0, uniqueVisitors: 0, searches: 0, calcs: 0, exports: 0, snapshots: 0 };
  const vids = new Set();
  const byDayMap = new Map();
  const searchMap = new Map();   // normalized query -> {count, found, label}
  const placeMap = new Map();    // calc location -> {count}
  const settingMap = new Map();  // "setting = value" -> {count}
  const profileMap = new Map();  // effective profile -> {count}
  const modes = { city: 0, point: 0 };
  let cacheHits = 0, searchFound = 0;

  for (const e of inRange) {
    if (e.vid) vids.add(e.vid);
    const day = dayKey(e.t, tzOffsetMin);
    if (!byDayMap.has(day)) byDayMap.set(day, { day, visits: 0, searches: 0, calcs: 0 });
    const d = byDayMap.get(day);

    if (e.type === 'visit') { totals.visits++; d.visits++; }
    else if (e.type === 'search') {
      totals.searches++; d.searches++;
      if (e.found) searchFound++;
      const q = String(e.q || '').trim();
      if (q) {
        const norm = q.toLowerCase();
        if (!searchMap.has(norm)) searchMap.set(norm, { count: 0, found: 0, example: q });
        const s = searchMap.get(norm);
        s.count++; if (e.found) s.found++;
      }
    } else if (e.type === 'calc') {
      totals.calcs++; d.calcs++;
      if (e.mode === 'city' || e.mode === 'point') modes[e.mode]++;
      if (e.fromCache) cacheHits++;
      const place = String(e.label || e.q || (e.pin ? `${e.pin.lat}, ${e.pin.lon}` : 'unknown')).trim();
      if (!placeMap.has(place)) placeMap.set(place, { count: 0 });
      placeMap.get(place).count++;
      if (e.profile) {
        if (!profileMap.has(e.profile)) profileMap.set(e.profile, { count: 0 });
        profileMap.get(e.profile).count++;
      }
      if (e.nonDefaults && typeof e.nonDefaults === 'object') {
        for (const [k, v] of Object.entries(e.nonDefaults)) {
          const label = `${k} = ${JSON.stringify(v)}`;
          if (!settingMap.has(label)) settingMap.set(label, { count: 0 });
          settingMap.get(label).count++;
        }
      }
    } else if (e.type === 'export') totals.exports++;
    else if (e.type === 'snapshot') totals.snapshots++;
  }
  totals.uniqueVisitors = vids.size;

  const recent = inRange.slice(-120).reverse().map((e) => {
    const r = { t: e.t, type: e.type };
    if (e.type === 'search') { r.detail = e.q; r.extra = e.found ? (e.label || 'found') : 'NOT FOUND'; }
    else if (e.type === 'calc') {
      r.detail = e.label || e.q || (e.pin ? `${e.pin.lat}, ${e.pin.lon}` : '');
      r.extra = `${e.mode || '?'} · ${e.buildings ?? '?'} bldgs` +
        (e.nonDefaults && Object.keys(e.nonDefaults).length
          ? ` · ${Object.keys(e.nonDefaults).length} non-default` : '');
    } else if (e.type === 'visit') { r.detail = e.page || '/'; r.extra = e.ref || ''; }
    else if (e.type === 'export') r.detail = e.format || '';
    else if (e.type === 'snapshot') r.detail = e.action || '';
    return r;
  });

  const performanceReports = inRange.filter((e) => e.type === 'calc' && e.performance)
    .slice(-120).reverse().map((e) => ({
      t: e.t, place: e.label || e.q || (e.pin ? `${e.pin.lat}, ${e.pin.lon}` : ''),
      mode: e.mode, buildings: e.buildings, totalMs: e.ms, performance: e.performance,
    }));

  return {
    totals,
    modes,
    cacheHits,
    searchFound,
    byDay: [...byDayMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
    topSearches: topCounts(searchMap, 40),
    topPlaces: topCounts(placeMap, 40),
    nonDefaultSettings: topCounts(settingMap, 60),
    profiles: topCounts(profileMap, 10),
    recent,
    performanceReports,
    firstEventAt: events.length ? events[0].t : null,
    generatedAt: Date.now(),
  };
}
