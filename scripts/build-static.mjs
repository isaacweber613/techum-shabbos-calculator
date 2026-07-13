import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ['index.html', 'about.html', 'guide.html', 'analytics.html', 'robots.txt', 'sitemap.xml', '404.html', '_headers', '_redirects', 'TECHUM-SPEC.md', 'LICENSE']) {
  await copyFile(new URL('../' + file, import.meta.url), new URL('../dist/' + file, import.meta.url));
}
for (const dir of ['css', 'js', 'he', 'designtest']) {
  await cp(new URL('../' + dir + '/', import.meta.url), new URL('../dist/' + dir + '/', import.meta.url), { recursive: true });
}

console.log('Built explicit public assets in ' + join(new URL('.', dist).pathname));
