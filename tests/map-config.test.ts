import assert from 'node:assert/strict';
import type { GoogleMapConfigEnv } from '../worker/map-config.ts';
import {
  alertGoogleLimitReached,
  claimGoogleExportSlot,
  DEFAULT_GOOGLE_MAPS_DAILY_CAP,
  googleLimitMessage,
  googleQuotaDay,
  issueGoogleMapConfig,
  isTrustedMapConfigRequest,
  normalizeGoogleMapsBrowserKey,
  parseGoogleMapsDailyCap,
} from '../worker/map-config.ts';

assert.equal(parseGoogleMapsDailyCap(), DEFAULT_GOOGLE_MAPS_DAILY_CAP);
assert.equal(parseGoogleMapsDailyCap('300'), 300);
assert.equal(googleQuotaDay(new Date('2026-11-26T07:59:00Z')), '2026-11-25');
assert.equal(googleQuotaDay(new Date('2026-11-26T08:00:00Z')), '2026-11-26');
assert.equal(googleQuotaDay(new Date('2026-07-01T06:59:00Z')), '2026-06-30');
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

type FakeOptions = { claimed?: { load_count: number } | null; rateAllowed?: boolean; key?: string;
  telegram?: boolean; telegramOk?: boolean; alertRows?: Set<string> };

function envFor(options: FakeOptions = {}) {
  let dbCalls = 0;
  const alertRows = options.alertRows || new Set<string>();
  const sent: string[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    assert.match(String(url), /^https:\/\/api\.telegram\.org\/botTEST-TOKEN\/sendMessage$/);
    const body = JSON.parse(String(init.body)) as { chat_id: string; text: string };
    assert.equal(body.chat_id, '12345');
    sent.push(body.text);
    return Response.json(options.telegramOk === false ? { ok: false, description: 'chat not found' } : { ok: true, result: { message_id: 7 } },
      { status: options.telegramOk === false ? 400 : 200 });
  }) as typeof fetch;
  const env = {
    GOOGLE_MAPS_BROWSER_KEY: options.key === undefined ? '\uFEFFAIza-test\r\n' : options.key,
    GOOGLE_MAPS_DAILY_CAP: '2',
    GOOGLE_STATIC_MAPS_DAILY_CAP: '3',
    ...(options.telegram === false ? {} : { TELEGRAM_BOT_TOKEN: 'TEST-TOKEN', TELEGRAM_CHAT_ID: '12345' }),
    MAP_CONFIG_RATE_LIMITER: { limit: async ({ key }: { key: string }) => {
      assert.match(key, /^map-(config|export):/);
      return { success: options.rateAllowed !== false };
    } },
    DB: { prepare: (sql: string) => ({ bind: (...args: unknown[]) => ({
      first: async () => {
        if (sql.includes('google_limit_alerts')) {
          const id = `${args[0]}|${args[1]}`;
          if (alertRows.has(id)) return null;
          alertRows.add(id);
          return { kind: args[1] };
        }
        dbCalls += 1;
        const [day, cap] = args as [string, number];
        assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
        if (sql.includes('static_count')) {
          assert.match(sql, /WHERE static_count < \?2/);
          assert.equal(cap, 3);
        } else {
          assert.match(sql, /WHERE load_count < \?2/);
          assert.equal(cap, 2);
        }
        return options.claimed === undefined ? { load_count: 1 } : options.claimed;
      },
      run: async () => {
        assert.match(sql, /^DELETE FROM google_limit_alerts/);
        alertRows.delete(`${args[0]}|${args[1]}`);
        return { meta: { changes: 1 } };
      },
    }) }) },
  } as unknown as GoogleMapConfigEnv;
  return { env, dbCalls: () => dbCalls, sent, alertRows };
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

// Limit alerts: one Telegram message per kind per day, sent after the refusal.
{
  const rows = new Set<string>();
  const fake = envFor({ claimed: null, alertRows: rows });
  const background: Promise<unknown>[] = [];
  const first = await issueGoogleMapConfig(trustedRequest, fake.env, (work) => background.push(work));
  const second = await issueGoogleMapConfig(trustedRequest, fake.env, (work) => background.push(work));
  await Promise.all(background);
  assert.equal(first.status, 429);
  assert.equal(second.status, 429);
  assert.deepEqual(fake.sent, [googleLimitMessage('map', 2)]);
  assert.match(fake.sent[0], /Google map limit of 2/);
  assert.match(fake.sent[0], /midnight Pacific/);
}
{
  const fake = envFor({ claimed: null });
  const background: Promise<unknown>[] = [];
  const exportRefused = await claimGoogleExportSlot(trustedRequest, fake.env, (work) => background.push(work));
  await Promise.all(background);
  assert.equal(exportRefused.status, 429);
  assert.equal((await exportRefused.json() as { fallback: string }).fallback, 'original');
  assert.deepEqual(fake.sent, [googleLimitMessage('static', 3)]);
  assert.match(fake.sent[0], /export limit of 3/);
}
{
  const fake = envFor();
  const allowed = await claimGoogleExportSlot(trustedRequest, fake.env);
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { ok: true });
  assert.equal(fake.sent.length, 0);
}
{
  // A failed send releases the day's alert so the next refusal tries again.
  const fake = envFor({ telegramOk: false });
  await alertGoogleLimitReached(fake.env, '2026-11-25', 'map', 10);
  assert.equal(fake.sent.length, 1);
  assert.equal(fake.alertRows.size, 0);
}
{
  // Missing secrets never throw and never reach Telegram.
  const fake = envFor({ telegram: false });
  await alertGoogleLimitReached(fake.env, '2026-11-25', 'static', 10);
  assert.equal(fake.sent.length, 0);
  assert.equal(fake.alertRows.size, 0);
}
{
  // A database failure in the alert never surfaces to the visitor.
  const env = { DB: { prepare: () => { throw new Error('D1 down'); } } } as unknown as GoogleMapConfigEnv;
  await alertGoogleLimitReached(env, '2026-11-25', 'map', 10);
}

console.log('Google map configuration and limit alerts: assertions passed');
