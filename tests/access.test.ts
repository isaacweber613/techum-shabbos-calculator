import assert from 'node:assert/strict';
import { accessToken, verifyAccessJwt } from '../worker/access.ts';

const teamDomain = 'team.cloudflareaccess.com';
const aud = 'app-aud';
const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'k1' };
const certs = (async () => Response.json({ keys: [jwk] })) as typeof fetch;

const b64 = (value: string | Uint8Array) => Buffer.from(value).toString('base64url');
async function sign(claims: Record<string, unknown>, kid = 'k1', key = pair.privateKey): Promise<string> {
  const head = `${b64(JSON.stringify({ alg: 'RS256', kid }))}.${b64(JSON.stringify(claims))}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head));
  return `${head}.${b64(new Uint8Array(signature))}`;
}

const now = Date.now();
const valid = { iss: `https://${teamDomain}`, aud: [aud], email: 'Owner@Example.com', exp: now / 1000 + 600 };
const config = { teamDomain, aud };
assert.equal(await verifyAccessJwt(await sign(valid), config, certs, now), 'owner@example.com');
assert.equal(await verifyAccessJwt('x', config, certs, now), null, 'a bare header value is not an identity');
assert.equal(await verifyAccessJwt(await sign({ ...valid, aud: ['other'] }), config, certs, now), null);
assert.equal(await verifyAccessJwt(await sign({ ...valid, iss: 'https://evil.cloudflareaccess.com' }), config, certs, now), null);
assert.equal(await verifyAccessJwt(await sign({ ...valid, exp: now / 1000 - 1 }), config, certs, now), null);
const forger = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
assert.equal(await verifyAccessJwt(await sign(valid, 'k1', forger.privateKey), config, certs, now), null);
assert.equal(await verifyAccessJwt(await sign(valid), {}, certs, now), null, 'unconfigured Access trusts nobody');
assert.equal(accessToken(new Request('https://x/', { headers: { Cookie: 'a=1; CF_Authorization=tok; b=2' } })), 'tok');
console.log('access verification: 8 tests passed');
