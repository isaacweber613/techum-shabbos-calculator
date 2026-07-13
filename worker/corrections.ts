import type { BBox, Building } from './buildings';

type CorrectionRow = {
  id: string;
  source_id: string | null;
  decision: 'include' | 'exclude';
  geometry_json: string | null;
  created_at: number;
};

type CorrectionInput = {
  sourceId: string | null;
  decision: 'include' | 'exclude';
  ringLatLon: { lat: number; lon: number }[] | null;
  note: string | null;
  bbox: BBox;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function validRing(value: unknown): { lat: number; lon: number }[] | null {
  if (!Array.isArray(value) || value.length < 3 || value.length > 128) return null;
  const ring = value.map((point) => {
    if (!point || typeof point !== 'object' || Array.isArray(point)) return null;
    const item = point as Record<string, unknown>;
    const lat = Number(item.lat), lon = Number(item.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
      ? { lat, lon } : null;
  });
  return ring.every(Boolean) ? ring as { lat: number; lon: number }[] : null;
}

function ringBBox(ring: { lat: number; lon: number }[]): BBox {
  return {
    south: Math.min(...ring.map((point) => point.lat)),
    west: Math.min(...ring.map((point) => point.lon)),
    north: Math.max(...ring.map((point) => point.lat)),
    east: Math.max(...ring.map((point) => point.lon)),
  };
}

export function validateCorrectionInput(raw: unknown): CorrectionInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  if (input.decision !== 'include' && input.decision !== 'exclude') return null;
  const sourceId = typeof input.sourceId === 'string' && input.sourceId.trim()
    ? input.sourceId.trim().slice(0, 200) : null;
  const ringLatLon = input.ringLatLon == null ? null : validRing(input.ringLatLon);
  if (!sourceId && !ringLatLon) return null;
  if (input.ringLatLon != null && !ringLatLon) return null;
  const ring = ringLatLon || validRing(input.sourceRing);
  if (!ring) return null;
  const bbox = ringBBox(ring);
  if (bbox.north - bbox.south > 0.02 || bbox.east - bbox.west > 0.02) return null;
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 500) : null;
  return { sourceId, decision: input.decision, ringLatLon, note, bbox };
}

export async function submitBuildingCorrection(
  request: Request,
  db: D1Database,
  actor: string,
  trusted: boolean,
): Promise<Response> {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 32_000) return json({ error: 'correction payload too large' }, 413);
  let raw: unknown;
  try { raw = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  const input = validateCorrectionInput(raw);
  if (!input) return json({ error: 'invalid building correction' }, 400);
  const id = crypto.randomUUID();
  const now = Date.now();
  const status = trusted ? 'accepted' : 'pending';
  await db.prepare(`INSERT INTO building_corrections
    (id, source_id, decision, geometry_json, south, west, north, east, note, status,
     created_at, created_by, reviewed_at, reviewed_by)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`)
    .bind(id, input.sourceId, input.decision,
      input.ringLatLon ? JSON.stringify(input.ringLatLon) : null,
      input.bbox.south, input.bbox.west, input.bbox.north, input.bbox.east,
      input.note, status, now, actor, trusted ? now : null, trusted ? actor : null).run();
  return json({ id, status }, 201);
}

export async function applyAcceptedCorrections(
  db: D1Database,
  bbox: BBox,
  buildings: Building[],
): Promise<{ buildings: Building[]; applied: number }> {
  const result = await db.prepare(`SELECT id, source_id, decision, geometry_json, created_at
    FROM building_corrections
    WHERE status = 'accepted' AND south <= ?1 AND north >= ?2 AND west <= ?3 AND east >= ?4
    ORDER BY created_at ASC LIMIT 1000`)
    .bind(bbox.north, bbox.south, bbox.east, bbox.west).all<CorrectionRow>();
  const rows = result.results || [];
  const decisions = new Map<string, 'include' | 'exclude'>();
  const additions: Building[] = [];
  for (const row of rows) {
    if (row.source_id) decisions.set(row.source_id, row.decision);
    if (!row.source_id && row.decision === 'include' && row.geometry_json) {
      try {
        const ringLatLon = validRing(JSON.parse(row.geometry_json));
        if (ringLatLon) additions.push({
          id: `shared:${row.id}`,
          tags: { building: 'yes', source: 'shared-reviewed-drawing' },
          ringLatLon,
        });
      } catch { /* a malformed stored proposal is ignored instead of breaking calculations */ }
    }
  }
  const kept = buildings.filter((building) => decisions.get(building.id) !== 'exclude');
  return { buildings: kept.concat(additions), applied: rows.length };
}
