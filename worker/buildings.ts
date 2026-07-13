/**
 * Shared Overture building tile cache: fixed-degree grid → R2 payloads + D1 metadata.
 * Pure tile math is exported for unit tests; the Worker fills misses from Overture PMTiles.
 */

import { fetchOvertureBuildings, OVERTURE_RELEASE } from './overture.ts';
import { applyAcceptedCorrections } from './corrections.ts';

export const TILE_DEG = 0.02; // ~2.2 km at mid-latitudes
export const MAX_TILES_PER_REQUEST = 36; // 6×6 cells ≈ 7 km × 7 km
export const BUILDINGS_CACHE_VERSION = 2;

export type BBox = { south: number; west: number; north: number; east: number };

export type Building = {
  id: string;
  tags: Record<string, string>;
  ringLatLon: { lat: number; lon: number }[];
};

export type TileCoord = { i: number; j: number; key: string };

export function isValidBBox(bbox: BBox): boolean {
  return Number.isFinite(bbox.south) && Number.isFinite(bbox.west) &&
    Number.isFinite(bbox.north) && Number.isFinite(bbox.east) &&
    bbox.south >= -90 && bbox.north <= 90 && bbox.south < bbox.north &&
    bbox.west >= -180 && bbox.east <= 180 && bbox.west < bbox.east &&
    (bbox.north - bbox.south) <= TILE_DEG * Math.sqrt(MAX_TILES_PER_REQUEST) * 1.01 &&
    (bbox.east - bbox.west) <= TILE_DEG * Math.sqrt(MAX_TILES_PER_REQUEST) * 1.01;
}

export function tileIndex(deg: number): number {
  return Math.floor(deg / TILE_DEG + 1e-12);
}

export function tileKey(i: number, j: number): string {
  return `v${BUILDINGS_CACHE_VERSION}/${i}/${j}`;
}

export function parseTileKey(key: string): TileCoord | null {
  const m = key.match(/^v(\d+)\/(-?\d+)\/(-?\d+)$/);
  if (!m || Number(m[1]) !== BUILDINGS_CACHE_VERSION) return null;
  return { i: Number(m[2]), j: Number(m[3]), key };
}

export function tileBBox(i: number, j: number): BBox {
  return {
    south: i * TILE_DEG,
    north: (i + 1) * TILE_DEG,
    west: j * TILE_DEG,
    east: (j + 1) * TILE_DEG,
  };
}

/** Inclusive grid of tiles covering the bbox (no dateline wrap in v1). */
export function tilesForBBox(bbox: BBox): TileCoord[] {
  const i0 = tileIndex(bbox.south);
  const i1 = tileIndex(bbox.north - 1e-12);
  const j0 = tileIndex(bbox.west);
  const j1 = tileIndex(bbox.east - 1e-12);
  const out: TileCoord[] = [];
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      out.push({ i, j, key: tileKey(i, j) });
    }
  }
  return out;
}

export function parseOverpass(json: { elements?: unknown[] }): Building[] {
  const buildings: Building[] = [];
  for (const el of json.elements || []) {
    if (!el || typeof el !== 'object') continue;
    const item = el as {
      type?: string; id?: number; tags?: Record<string, string>;
      geometry?: { lat: number; lon: number }[];
      members?: { role?: string; geometry?: { lat: number; lon: number }[] }[];
    };
    const tags = item.tags || {};
    if (item.type === 'way' && Array.isArray(item.geometry) && item.geometry.length >= 3) {
      buildings.push({
        id: 'w' + item.id,
        tags,
        ringLatLon: item.geometry.map((g) => ({ lat: g.lat, lon: g.lon })),
      });
    } else if (item.type === 'relation' && Array.isArray(item.members)) {
      let part = 0;
      for (const m of item.members) {
        if (m.role !== 'outer' || !Array.isArray(m.geometry) || m.geometry.length < 3) continue;
        buildings.push({
          id: 'r' + item.id + '_' + part++,
          tags,
          ringLatLon: m.geometry.map((g) => ({ lat: g.lat, lon: g.lon })),
        });
      }
    }
  }
  return buildings;
}

export function mergeBuildings(groups: Building[][]): Building[] {
  const byId = new Map<string, Building>();
  for (const group of groups) {
    for (const b of group) {
      if (b && b.id && !byId.has(b.id)) byId.set(b.id, b);
    }
  }
  return [...byId.values()];
}

/** Drop buildings fully outside the request bbox (tile fetches can slightly overspill). */
export function filterBuildingsToBBox(buildings: Building[], bbox: BBox): Building[] {
  return buildings.filter((b) => {
    const ring = b.ringLatLon;
    if (!Array.isArray(ring) || ring.length < 3) return false;
    let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
    for (const p of ring) {
      south = Math.min(south, p.lat); north = Math.max(north, p.lat);
      west = Math.min(west, p.lon); east = Math.max(east, p.lon);
    }
    return south <= bbox.north && north >= bbox.south && west <= bbox.east && east >= bbox.west;
  });
}

export function oldestIso(dates: string[]): string {
  if (!dates.length) return new Date().toISOString();
  return dates.reduce((a, b) => (a < b ? a : b));
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function fetchOverpassBuildings(
  bbox: BBox,
  contact: string,
  timeoutSec = 90,
): Promise<Building[]> {
  const bb = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const query = `[out:json][timeout:${timeoutSec}];
(
  way["building"](${bb});
  relation["building"]["type"="multipolygon"](${bb});
);
out geom;`;
  let lastErr: Error | undefined;
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': `TechumShabbosCalculator/1.0 (${contact})`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      const json = await res.json() as { elements?: unknown[] };
      return parseOverpass(json);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr || new Error('Overpass failed');
}

type TileMeta = {
  tile_key: string;
  fetched_at: string;
  checked_at: string;
  building_count: number;
  bytes: number;
  r2_key: string;
};

export type BuildingsEnv = {
  DB: D1Database;
  BUILDINGS: R2Bucket;
  BUILDINGS_RATE_LIMITER: RateLimit;
  IP_HASH_SECRET?: string;
  GEOCODER_CONTACT: string;
};

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function loadTile(env: BuildingsEnv, key: string): Promise<{ meta: TileMeta; buildings: Building[] } | null> {
  const meta = await env.DB.prepare(
    'SELECT tile_key, fetched_at, checked_at, building_count, bytes, r2_key FROM building_tiles WHERE tile_key = ?1',
  ).bind(key).first<TileMeta>();
  if (!meta) return null;
  const obj = await env.BUILDINGS.get(meta.r2_key);
  if (!obj) return null;
  try {
    const buildings = JSON.parse(await obj.text()) as Building[];
    if (!Array.isArray(buildings)) return null;
    return { meta, buildings };
  } catch {
    return null;
  }
}

async function storeTile(env: BuildingsEnv, coord: TileCoord, buildings: Building[], nowIso: string): Promise<void> {
  const r2Key = `tiles/${coord.key}.json`;
  const body = JSON.stringify(buildings);
  await env.BUILDINGS.put(r2Key, body, {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { fetchedAt: nowIso, count: String(buildings.length) },
  });
  await env.DB.prepare(`INSERT INTO building_tiles (tile_key, fetched_at, checked_at, building_count, bytes, r2_key)
    VALUES (?1, ?2, ?2, ?3, ?4, ?5)
    ON CONFLICT(tile_key) DO UPDATE SET
      fetched_at = excluded.fetched_at,
      checked_at = excluded.checked_at,
      building_count = excluded.building_count,
      bytes = excluded.bytes,
      r2_key = excluded.r2_key`)
    .bind(coord.key, nowIso, buildings.length, body.length, r2Key).run();
}

async function reserveFillSlot(env: BuildingsEnv): Promise<void> {
  // Global 1 fill / second so public Overpass is not hammered by concurrent cold users.
  const second = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare('INSERT INTO building_fill_slots (second) VALUES (?1)').bind(second).run();
  } catch {
    // Slot taken this second — wait briefly and retry once.
    await new Promise((r) => setTimeout(r, 1100));
    const next = Math.floor(Date.now() / 1000);
    try {
      await env.DB.prepare('INSERT INTO building_fill_slots (second) VALUES (?1)').bind(next).run();
    } catch {
      throw new Error('building fill rate limited; retry in one second');
    }
  }
}

/** Bounding box covering a non-empty set of whole tiles. */
export function bboxForTiles(tiles: TileCoord[]): BBox {
  if (!tiles.length) throw new Error('at least one tile is required');
  const boxes = tiles.map((tile) => tileBBox(tile.i, tile.j));
  return {
    south: Math.min(...boxes.map((box) => box.south)),
    west: Math.min(...boxes.map((box) => box.west)),
    north: Math.max(...boxes.map((box) => box.north)),
    east: Math.max(...boxes.map((box) => box.east)),
  };
}

async function fillTiles(
  env: BuildingsEnv,
  tiles: TileCoord[],
): Promise<Map<string, { buildings: Building[]; fetchedAt: string }>> {
  await reserveFillSlot(env);

  // Fetch the cold area once, then partition the response into cache tiles. The public
  // Overture PMTiles archive serves byte ranges, so only intersecting vector tiles move.
  const allBuildings = await fetchOvertureBuildings(bboxForTiles(tiles));
  const nowIso = new Date().toISOString();
  const filled = new Map<string, { buildings: Building[]; fetchedAt: string }>();
  for (const tile of tiles) {
    const buildings = filterBuildingsToBBox(allBuildings, tileBBox(tile.i, tile.j));
    await storeTile(env, tile, buildings, nowIso);
    filled.set(tile.key, { buildings, fetchedAt: nowIso });
  }
  return filled;
}

export function parseBBoxParams(params: URLSearchParams): BBox | null {
  const num = (name: string) => {
    const raw = params.get(name);
    return raw === null || raw.trim() === '' ? NaN : Number(raw);
  };
  const south = num('south'), west = num('west'), north = num('north'), east = num('east');
  if (![south, west, north, east].every(Number.isFinite)) return null;
  return { south, west, north, east };
}

/**
 * GET /api/buildings?south=&west=&north=&east=&force=0|1
 * Unions fixed-degree tiles covering the bbox. Cold tiles are filled from Overture into R2.
 */
export async function handleBuildings(request: Request, env: BuildingsEnv): Promise<Response> {
  if (!env.BUILDINGS) return json({ error: 'building cache is not configured' }, 503);

  const url = new URL(request.url);
  const bbox = parseBBoxParams(url.searchParams);
  if (!bbox || !isValidBBox(bbox)) {
    return json({
      error: 'valid south,west,north,east required (max span ~7 km)',
      tileDeg: TILE_DEG,
      maxTiles: MAX_TILES_PER_REQUEST,
    }, 400);
  }

  const tiles = tilesForBBox(bbox);
  if (!tiles.length || tiles.length > MAX_TILES_PER_REQUEST) {
    return json({ error: `bbox covers ${tiles.length} tiles; max is ${MAX_TILES_PER_REQUEST}` }, 400);
  }

  const force = url.searchParams.get('force') === '1' || url.searchParams.get('force') === 'true';

  const network = await hmacHex(env.IP_HASH_SECRET || 'local-development-only',
    request.headers.get('CF-Connecting-IP') || 'unknown');
  const limited = await env.BUILDINGS_RATE_LIMITER.limit({ key: network });
  if (!limited.success) return json({ error: 'buildings rate limit exceeded' }, 429, { 'Retry-After': '60' });

  const groups: Building[][] = [];
  const fetchedAts: string[] = [];
  const checkedAts: string[] = [];
  let hits = 0;
  let misses = 0;
  const coldTiles: TileCoord[] = [];

  for (const tile of tiles) {
    if (!force) {
      const cached = await loadTile(env, tile.key);
      if (cached) {
        groups.push(cached.buildings);
        fetchedAts.push(cached.meta.fetched_at);
        checkedAts.push(cached.meta.checked_at || cached.meta.fetched_at);
        hits++;
        continue;
      }
    }
    coldTiles.push(tile);
  }

  if (coldTiles.length) {
    try {
      const filledTiles = await fillTiles(env, coldTiles);
      for (const tile of coldTiles) {
        const filled = filledTiles.get(tile.key);
        if (!filled) throw new Error(`tile fill missing ${tile.key}`);
        groups.push(filled.buildings);
        fetchedAts.push(filled.fetchedAt);
        checkedAts.push(filled.fetchedAt);
        misses++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('rate limited')) return json({ error: msg }, 429, { 'Retry-After': '1' });
      return json({ error: 'map-data error: ' + msg }, 502);
    }
  }

  const baseBuildings = filterBuildingsToBBox(mergeBuildings(groups), bbox);
  const corrected = await applyAcceptedCorrections(env.DB, bbox, baseBuildings);
  const buildings = filterBuildingsToBBox(corrected.buildings, bbox);
  const fromCache = misses === 0 && hits > 0;
  return json({
    buildings,
    fetchedAt: oldestIso(fetchedAts),
    checkedAt: oldestIso(checkedAts),
    fromCache,
    source: 'overture-tiles',
    release: OVERTURE_RELEASE,
    correctionsApplied: corrected.applied,
    tiles: { hit: hits, miss: misses, count: tiles.length, keys: tiles.map((t) => t.key) },
    tileDeg: TILE_DEG,
  }, 200, {
    // Short browser cache only on full hits — force always bypasses via query string.
    'Cache-Control': fromCache ? 'private, max-age=60' : 'no-store',
  });
}
