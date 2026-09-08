// Assembles dist/ into a complete, deployable folder: the bundled core plus the
// static files an operator copies next to their graph tool.
//
// Nothing deployable lives at the repo root. The page shell is in site/ and the
// configuration comes from a preset, so there is exactly one copy of each file
// and one answer to "which of these do I host": everything in dist/.
//
// Run after rolldown. `npm run build` does both.

import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const presetsRoot = join(root, 'presets');

/** The rank style a fresh download starts on. */
const DEFAULT_PRESET = 'letter';

/** Files that make up the page itself. */
const SITE_FILES = ['index.html', 'style.css'];

/** Files a preset contributes, and the name each takes in the deploy folder. */
const PRESET_FILES = ['ranking-config.js', 'TEMPLATE.csv', 'TEMPLATE.xlsx'];

mkdirSync(dist, { recursive: true });

for (const name of SITE_FILES) {
  copyFileSync(join(root, 'site', name), join(dist, name));
}
for (const name of PRESET_FILES) {
  copyFileSync(join(presetsRoot, DEFAULT_PRESET, name), join(dist, name));
}

// Every preset rides along so an operator can switch rank style from the same
// download, without going back to the repo for a second file.
const presets = readdirSync(presetsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);
for (const preset of presets) {
  mkdirSync(join(dist, 'presets', preset), { recursive: true });
  for (const name of PRESET_FILES) {
    copyFileSync(join(presetsRoot, preset, name), join(dist, 'presets', preset, name));
  }
}

// dist/core.js is the readable build, so a deployed page stays debuggable in
// place; dist/core.min.js is what the CDN documentation points at.
const listed = ['core.js', 'core.min.js', ...SITE_FILES, ...PRESET_FILES];
const sizes = listed.map(name => {
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
    'TEMPLATE.csv and TEMPLATE.xlsx are starting points for that sheet. Import',
    'the .xlsx into Google Sheets with File > Import to get the rank dropdown,',
    'the column guide and the stats chart.',
    '',
    `To use a different rank style, copy ranking-config.js and the template from`,
    `presets/<name>/ over the ones here. Available: ${presets.join(', ')}.`,
    '',
    'Setup guide: https://potatosalad775.github.io/squigRanking/docs/',
    '',
    ...sizes,
    '',
  ].join('\n'),
  'utf8',
);

// Sanity check: the page must reference the bundled script, and still carry the
// three landmarks core renders into. Either one missing is a blank page.
const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (!html.includes('src="core.js"')) {
  throw new Error('index.html does not load core.js — the deploy bundle would be broken.');
}
for (const id of ['ranking-header', 'ranking-content', 'ranking-footer']) {
  if (!html.includes(`id="${id}"`)) {
    throw new Error(`index.html is missing #${id} — core would have nothing to render into.`);
  }
}

console.log(`bundle ready in dist/\n${sizes.join('\n')}`);
