const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function shouldRedirectToCanonical(url: URL): boolean {
  if (LOCAL_HOSTS.has(url.hostname) || url.port) return false;
  return url.protocol === 'http:' || url.hostname === 'www.tchumshabbos.com';
}
