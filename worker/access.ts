/**
 * Cloudflare Access identity. The `Cf-Access-*` headers are only trustworthy on paths an
 * Access application covers; anywhere else a client can send them itself. So identity is
 * taken only from a signed Access JWT (header, or the `CF_Authorization` cookie Access sets
 * for the whole hostname) verified against the team's public keys and the app's audience.
 */

export type AccessConfig = { teamDomain?: string; aud?: string };
type Jwk = JsonWebKey & { kid?: string };
type JwtClaims = { iss?: string; aud?: string | string[]; exp?: number; nbf?: number; email?: string };

let cachedKeys: { teamDomain: string; keys: Jwk[] } | null = null;

function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function base64UrlJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlBytes(value))) as T;
}

async function teamKeys(teamDomain: string, fetcher: typeof fetch, refresh: boolean): Promise<Jwk[]> {
  if (!refresh && cachedKeys?.teamDomain === teamDomain) return cachedKeys.keys;
  const response = await fetcher(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certs HTTP ${response.status}`);
  const body = await response.json() as { keys?: Jwk[] };
  cachedKeys = { teamDomain, keys: Array.isArray(body.keys) ? body.keys : [] };
  return cachedKeys.keys;
}

export function accessToken(request: Request): string | null {
  const header = request.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? match[1] : null;
}

/** Returns the verified Access email, or null when the token is missing or invalid. */
export async function verifyAccessJwt(token: string, config: AccessConfig,
  fetcher: typeof fetch = fetch, now = Date.now()): Promise<string | null> {
  const { teamDomain, aud } = config;
  if (!teamDomain || !aud) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = base64UrlJson<{ alg?: string; kid?: string }>(parts[0]);
    const claims = base64UrlJson<JwtClaims>(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) return null;
    let key = (await teamKeys(teamDomain, fetcher, false)).find((jwk) => jwk.kid === header.kid);
    if (!key) key = (await teamKeys(teamDomain, fetcher, true)).find((jwk) => jwk.kid === header.kid);
    if (!key) return null;
    const publicKey = await crypto.subtle.importKey('jwk', key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, base64UrlBytes(parts[2]), signed)) return null;
    const seconds = now / 1000;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== `https://${teamDomain}` || !audiences.includes(aud)) return null;
    if (typeof claims.exp !== 'number' || claims.exp <= seconds) return null;
    if (typeof claims.nbf === 'number' && claims.nbf > seconds + 60) return null;
    return typeof claims.email === 'string' && claims.email.trim() ? claims.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function accessEmail(request: Request, config: AccessConfig): Promise<string | null> {
  const token = accessToken(request);
  return token ? verifyAccessJwt(token, config) : null;
}
