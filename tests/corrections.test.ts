import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listBuildingCorrections,
  reviewBuildingCorrection,
  VALID_CORRECTION_REVIEW_STATUSES,
} from '../worker/corrections.ts';

assert.deepEqual([...VALID_CORRECTION_REVIEW_STATUSES], ['accepted', 'rejected']);

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page = fs.readFileSync(path.join(root, 'corrections.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'worker', 'index.ts'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts', 'build-static.mjs'), 'utf8');
assert.match(page, /Accept/);
assert.match(page, /Reject/);
assert.match(page, /noindex,nofollow,noarchive/);
assert.match(worker, /url\.pathname === '\/api\/building-corrections' && request\.method === 'GET'/);
assert.match(worker, /correctionReviewMatch = url\.pathname\.match/);
assert.match(worker, /return listBuildingCorrections\(env\.DB\)/);
assert.match(worker, /return reviewBuildingCorrection\(request, correctionReviewMatch\[1\], env\.DB, reviewer\)/);
assert.match(worker, /url\.pathname === '\/corrections'/);
// The worker must fetch the extensionless canonical asset path: with
// html_handling "auto-trailing-slash" the asset binding redirects
// /corrections.html back to /corrections, which loops forever.
assert.match(worker, /assetUrl\.pathname = '\/corrections';/);
assert.doesNotMatch(worker, /assetUrl\.pathname = '\/corrections\.html';/);
assert.match(build, /'corrections\.html'/);

const listDb = {
  prepare() {
    return { all: async () => ({ results: [{
      id: 'correction-1', source_id: 'overture-1', decision: 'include', geometry_json: null,
      south: 41.7, west: -74.6, north: 41.701, east: -74.599, note: 'Front porch is part of the house.',
      created_at: 1_700_000_000_000, created_by: 'network:abc',
    }] }) };
  },
} as unknown as D1Database;
const listed = await listBuildingCorrections(listDb);
const listedBody = await listed.json() as { corrections: Array<Record<string, unknown>> };
assert.equal(listed.status, 200);
assert.equal(listedBody.corrections.length, 1);
const centroid = listedBody.corrections[0].centroid as { lat: number; lon: number };
assert.ok(Math.abs(centroid.lat - 41.7005) < 1e-9 && Math.abs(centroid.lon + 74.5995) < 1e-9);
assert.equal(listedBody.corrections[0].note, 'Front porch is part of the house.');

const calls: unknown[][] = [];
const reviewDb = {
  prepare(sql: string) {
    calls.push([sql]);
    return { bind(...args: unknown[]) {
      calls.push(args);
      return { run: async () => ({ meta: { changes: 1 } }) };
    } };
  },
} as unknown as D1Database;
const accepted = await reviewBuildingCorrection(
  new Request('https://tchumshabbos.com/api/building-corrections/correction-1', {
    method: 'PATCH', body: JSON.stringify({ status: 'accepted' }),
  }), 'correction-1', reviewDb, 'rav@example.com');
assert.equal(accepted.status, 200);
assert.match(calls[0][0] as string, /status = 'pending'/);
assert.deepEqual(calls[1].slice(0, 3), ['accepted', calls[1][1], 'rav@example.com']);

const rejected = await reviewBuildingCorrection(
  new Request('https://tchumshabbos.com/api/building-corrections/correction-1', {
    method: 'PATCH', body: JSON.stringify({ status: 'maybe' }),
  }), 'correction-1', reviewDb, 'rav@example.com');
assert.equal(rejected.status, 400);

console.log('building correction review: pending list, accept/reject, private route, and build asset passed');
