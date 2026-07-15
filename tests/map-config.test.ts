import assert from 'node:assert/strict';
import {
  DEFAULT_GOOGLE_MAPS_DAILY_CAP,
  isTrustedMapConfigRequest,
  normalizeGoogleMapsBrowserKey,
  parseGoogleMapsDailyCap,
} from '../worker/map-config.ts';

assert.equal(parseGoogleMapsDailyCap(), DEFAULT_GOOGLE_MAPS_DAILY_CAP);
assert.equal(parseGoogleMapsDailyCap('300'), 300);
assert.equal(parseGoogleMapsDailyCap('0'), 1);
assert.equal(parseGoogleMapsDailyCap('20000'), 10_000);
assert.equal(parseGoogleMapsDailyCap('not-a-number'), DEFAULT_GOOGLE_MAPS_DAILY_CAP);
assert.equal(normalizeGoogleMapsBrowserKey('\uFEFFAIza-example\r\n'), 'AIza-example');
assert.equal(isTrustedMapConfigRequest(new Request('https://tchumshabbos.com/api/map-config', {
  headers: { Referer: 'https://tchumshabbos.com/' },
})), true);
assert.equal(isTrustedMapConfigRequest(new Request('https://tchumshabbos.com/api/map-config', {
  headers: { Referer: 'https://example.com/' },
})), false);
assert.equal(isTrustedMapConfigRequest(new Request('http://localhost:4173/api/map-config')), true);

console.log('Google map configuration: 9 tests passed');
