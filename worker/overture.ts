import { VectorTile } from '@mapbox/vector-tile';
import { PMTiles } from 'pmtiles';
import { PbfReader } from 'pbf';

import type { BBox, Building } from './buildings';

export const OVERTURE_RELEASE = '2026-06-17.0';
export const OVERTURE_ZOOM = 14;
const OVERTURE_ARCHIVE = `https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${OVERTURE_RELEASE}/buildings.pmtiles`;

type GeoJsonGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
};

type GeoJsonFeature = {
  geometry: GeoJsonGeometry | null;
  properties?: Record<string, unknown> | null;
};

export type OvertureTile = { z: number; x: number; y: number };

function tileX(lon: number, zoom: number): number {
  const n = 2 ** zoom;
  return Math.max(0, Math.min(n - 1, Math.floor(((lon + 180) / 360) * n)));
}

function tileY(lat: number, zoom: number): number {
  const n = 2 ** zoom;
  const clamped = Math.max(-85.0511287, Math.min(85.0511287, lat));
  const rad = clamped * Math.PI / 180;
  return Math.max(0, Math.min(n - 1,
    Math.floor((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * n)));
}

export function tilesForOvertureBBox(bbox: BBox, zoom = OVERTURE_ZOOM): OvertureTile[] {
  const x0 = tileX(bbox.west, zoom), x1 = tileX(bbox.east, zoom);
  const y0 = tileY(bbox.north, zoom), y1 = tileY(bbox.south, zoom);
  const tiles: OvertureTile[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push({ z: zoom, x, y });
  return tiles;
}

function sourceDataset(properties: Record<string, unknown>): string {
  if (typeof properties['@geometry_source'] === 'string') return properties['@geometry_source'];
  if (typeof properties.sources === 'string') {
    try {
      const sources = JSON.parse(properties.sources) as unknown;
      if (Array.isArray(sources)) {
        const primary = sources.find((source) => source && typeof source === 'object' &&
          (source as Record<string, unknown>).property === '');
        const dataset = primary && (primary as Record<string, unknown>).dataset;
        if (typeof dataset === 'string') return dataset;
      }
    } catch { /* malformed source metadata remains auditable as unknown */ }
  }
  return 'Overture Maps';
}

function buildingTag(properties: Record<string, unknown>): string {
  if (typeof properties.class === 'string' && properties.class.trim()) return properties.class.trim();
  if (properties.subtype === 'residential') return 'residential';
  return 'yes';
}

function geometryRings(geometry: GeoJsonGeometry): number[][][] {
  if (geometry.type === 'Polygon') return [geometry.coordinates[0] as number[][]];
  return (geometry.coordinates as number[][][][]).map((polygon) => polygon[0]);
}

function ringArea(ring: { lat: number; lon: number }[]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    area += a.lon * b.lat - b.lon * a.lat;
  }
  return Math.abs(area / 2);
}

export function overtureFeatureToBuildings(feature: GeoJsonFeature): Building[] {
  const geometry = feature.geometry;
  const properties = feature.properties || {};
  const rawId = typeof properties.id === 'string' ? properties.id : '';
  if (!geometry || !rawId || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return [];
  const dataset = sourceDataset(properties);
  const tags: Record<string, string> = {
    building: buildingTag(properties),
    source: 'Overture Maps',
    overture_id: rawId,
    overture_release: OVERTURE_RELEASE,
    geometry_source: dataset,
  };
  if (typeof properties.class === 'string') tags.overture_class = properties.class;
  if (typeof properties.subtype === 'string') tags.overture_subtype = properties.subtype;

  return geometryRings(geometry).map((coordinates, index) => {
    const ringLatLon = coordinates
      .map((point) => ({ lon: Number(point[0]), lat: Number(point[1]) }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
    if (ringLatLon.length > 1) {
      const first = ringLatLon[0], last = ringLatLon[ringLatLon.length - 1];
      if (first.lat === last.lat && first.lon === last.lon) ringLatLon.pop();
    }
    return {
      id: `ovt:${rawId}${index ? `:${index}` : ''}`,
      tags: { ...tags },
      ringLatLon,
    };
  }).filter((building) => building.ringLatLon.length >= 3);
}

export function decodeOvertureTile(data: ArrayBuffer, tile: OvertureTile): Building[] {
  const vector = new VectorTile(new PbfReader(data));
  const layer = vector.layers.building;
  if (!layer) return [];
  const buildings: Building[] = [];
  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i).toGeoJSON(tile.x, tile.y, tile.z) as GeoJsonFeature;
    buildings.push(...overtureFeatureToBuildings(feature));
  }
  return buildings;
}

export function preferLargestDuplicate(buildings: Building[]): Building[] {
  const byId = new Map<string, { building: Building; area: number }>();
  for (const building of buildings) {
    const area = ringArea(building.ringLatLon);
    const current = byId.get(building.id);
    if (!current || area > current.area) byId.set(building.id, { building, area });
  }
  return [...byId.values()].map((entry) => entry.building);
}

export async function fetchOvertureBuildings(bbox: BBox): Promise<Building[]> {
  const tiles = tilesForOvertureBBox(bbox);
  if (tiles.length > 64) throw new Error(`Overture request covers ${tiles.length} tiles; max is 64`);
  const archive = new PMTiles(OVERTURE_ARCHIVE);
  const decoded = await Promise.all(tiles.map(async (tile) => {
    const response = await archive.getZxy(tile.z, tile.x, tile.y);
    return response ? decodeOvertureTile(response.data, tile) : [];
  }));
  return preferLargestDuplicate(decoded.flat());
}
