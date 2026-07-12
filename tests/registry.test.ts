import assert from 'node:assert/strict';
import { MAX_SNAPSHOT_BYTES, sha256Hex, validateRegistrySubmission } from '../worker/registry.ts';

const valid = { slug: 'hunter-ny', cityLabel: 'Hunter, NY', snapshot: { version: 1, buildings: [] },
  review: { reviewerName: 'Rabbi Reviewer', reviewedAt: '2026-07-12', decision: 'approved', sourceNotes: 'Reviewed against signed packet.' } };
const checked = validateRegistrySubmission(valid);
assert.equal(checked.ok, true);
if (checked.ok) assert.deepEqual(checked.value, valid);
assert.equal(validateRegistrySubmission({ ...valid, slug: '../hunter' }).ok, false);
assert.equal(validateRegistrySubmission({ ...valid, review: { ...valid.review, decision: 'approved-with-conditions' } }).ok, false);
assert.equal(validateRegistrySubmission({ ...valid, snapshot: { data: 'x'.repeat(MAX_SNAPSHOT_BYTES) } }).ok, false);
assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
console.log('registry validation: 5 tests passed');
