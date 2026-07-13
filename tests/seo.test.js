const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pages = [
  ['index.html', 'https://tchumshabbos.com/'],
  ['about.html', 'https://tchumshabbos.com/about'],
  ['guide.html', 'https://tchumshabbos.com/guide'],
  ['he/index.html', 'https://tchumshabbos.com/he/'],
];

const titles = new Set();
for (const [file, canonical] of pages) {
  const html = read(file);
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1]?.trim();
  const canonicals = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/gi)];
  assert.ok(title, `${file} has a title`);
  assert.ok(description && description.length >= 50, `${file} has a useful description`);
  assert.equal(canonicals.length, 1, `${file} has exactly one canonical`);
  assert.equal(canonicals[0][1], canonical, `${file} uses its canonical public URL`);
  assert.ok(!titles.has(title), `${file} has a unique title`);
  titles.add(title);
}

assert.match(read('analytics.html'), /name="robots" content="noindex,nofollow,noarchive"/i);
assert.match(read('404.html'), /name="robots" content="noindex"/i);

const robots = read('robots.txt');
assert.match(robots, /^Sitemap: https:\/\/tchumshabbos\.com\/sitemap\.xml$/m);
assert.match(robots, /^Disallow: \/api\/$/m);

const sitemap = read('sitemap.xml');
for (const [, canonical] of pages) assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
assert.doesNotMatch(sitemap, /<loc>[^<]*(?:\.html|\/analytics|\/api\/|TECHUM-SPEC)/i);

const redirects = read('_redirects');
assert.match(redirects, /^\/index\.html\s+\/\s+301$/m);
assert.match(redirects, /^\/about\.html\s+\/about\s+301$/m);
assert.match(read('_headers'), /\/TECHUM-SPEC\.md[\s\S]*X-Robots-Tag: noindex/i);
assert.match(read('scripts/build-static.mjs'), /'robots\.txt'.*'sitemap\.xml'.*'_headers'.*'_redirects'/s);
assert.match(read('he/index.html'), /תחום שבת/);

for (const design of ['9', '10']) {
  assert.match(read(`designtest/${design}/index.html`), /name="robots" content="noindex,nofollow"/i);
}

console.log(`\n${pages.length} indexable pages passed SEO contract checks`);
