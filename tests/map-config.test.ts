import assert from 'node:assert/strict';
import type { GoogleMapConfigEnv } from '../worker/map-config.ts';
import {
  DEFAULT_GOOGLE_MAPS_DAILY_CAP,
  issueGoogleMapConfig,
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

function envFor(options: { claimed?: { load_count: number } | null; rateAllowed?: boolean; key?: string } = {}) {
  let dbCalls = 0;
  const env = {
    GOOGLE_MAPS_BROWSER_KEY: options.key === undefined ? '\uFEFFAIza-test\r\n' : options.key,
    GOOGLE_MAPS_DAILY_CAP: '2',
    MAP_CONFIG_RATE_LIMITER: { limit: async ({ key }: { key: string }) => {
      assert.match(key, /^map-config:/);
      return { success: options.rateAllowed !== false };
    } },
    DB: { prepare: (sql: string) => ({ bind: (day: string, cap: number) => ({ first: async () => {
      dbCalls += 1;
      assert.match(sql, /WHERE load_count < \?2/);
      assert.equal(cap, 2);
      assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
      return options.claimed === undefined ? { load_count: 1 } : options.claimed;
    } }) }) },
  } as unknown as GoogleMapConfigEnv;
  return { env, dbCalls: () => dbCalls };
}

const trustedRequest = new Request('https://tchumshabbos.com/api/map-config', {
  headers: { Referer: 'https://tchumshabbos.com/', 'CF-Connecting-IP': '192.0.2.1' },
});
{
  const fake = envFor();
  const response = await issueGoogleMapConfig(trustedRequest, fake.env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
  assert.deepEqual(await response.json(), { provider: 'google', key: 'AIza-test' });
  assert.equal(fake.dbCalls(), 1);
}
{
  const fake = envFor({ rateAllowed: false });
  const response = await issueGoogleMapConfig(trustedRequest, fake.env);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(fake.dbCalls(), 0);
}
{
  const fake = envFor({ claimed: null });
  const response = await issueGoogleMapConfig(trustedRequest, fake.env);
  assert.equal(response.status, 429);
  assert.equal((await response.json() as { fallback: string }).fallback, 'original');
  assert.ok(Number(response.headers.get('Retry-After')) > 0);
}
{
  const fake = envFor({ key: '' });
  const response = await issueGoogleMapConfig(trustedRequest, fake.env);
  assert.equal(response.status, 503);
  assert.equal(fake.dbCalls(), 0);
}
{
  const fake = envFor();
  const response = await issueGoogleMapConfig(new Request('https://tchumshabbos.com/api/map-config'), fake.env);
  assert.equal(response.status, 403);
  assert.equal(fake.dbCalls(), 0);
}

console.log('Google map configuration: 23 assertions passed');
