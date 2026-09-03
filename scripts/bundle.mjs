// Assembles dist/ into a complete, deployable folder: the bundled core plus the
// static files an operator copies next to their graph tool. Run after rolldown.

import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** Files copied verbatim into the deploy bundle. */
const STATIC_FILES = [
  'index.html', 'style.css', 'ranking-config.js', 'TEMPLATE.csv', 'TEMPLATE.xlsx',
];

mkdirSync(dist, { recursive: true });
for (const name of STATIC_FILES) {
  copyFileSync(join(root, name), join(dist, name));
}

// The presets ride along so an operator can switch rank style from the same
// download, without going back to the repo for a second file.
const presetsRoot = join(root, 'presets');
const presets = readdirSync(presetsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);
for (const preset of presets) {
  mkdirSync(join(dist, 'presets', preset), { recursive: true });
  for (const name of ['ranking-config.js', 'TEMPLATE.csv', 'TEMPLATE.xlsx']) {
    copyFileSync(join(presetsRoot, preset, name), join(dist, 'presets', preset, name));
  }
}

// dist/core.js is the readable build, so a deployed page stays debuggable in
// place; dist/core.min.js is what the CDN documentation points at.
const sizes = ['core.js', 'core.min.js', ...STATIC_FILES].map(name => {
  const bytes = statSync(join(dist, name)).size;
  return `${name.padEnd(20)} ${(bytes / 1024).toFixed(1)} kB`;
});

// A manifest makes it obvious what belongs in a deploy without reading docs.
writeFileSync(
  join(dist, 'DEPLOY.txt'),
  [
    'Copy index.html, style.css, core.js and ranking-config.js into your',
    'ranking/ directory, then edit ranking-config.js to point at your sheet.',
    'Skip the .map files and this one.',
    '',
    `To use a different rank style, copy the pair from presets/<name>/ over`,
    `ranking-config.js and your sheet. Available: ${presets.join(', ')}.`,
    '',
    ...sizes,
    '',
  ].join('\n'),
  'utf8',
);

// Sanity check: the page must reference the bundled script, not a source path.
const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (!html.includes('src="core.js"')) {
  throw new Error('index.html does not load core.js — the deploy bundle would be broken.');
}

console.log(`bundle ready in dist/\n${sizes.join('\n')}`);
