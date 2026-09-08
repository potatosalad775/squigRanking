// Stages the CDN payload: everything that gets published to the `cdn` branch,
// laid out exactly as it will be served.
//
//   dist-cdn/
//   ├── loader.js            ← always the newest; the one mutable entry point
//   ├── versions.json        ← major → newest full version, merged not replaced
//   └── v<version>/
//       ├── core.min.js      ← what deployed pages actually run
//       ├── core.js          ← the readable build, for `cdn: { debug: true }`
//       └── style.css
//
// Versioned folders are immutable: a published version is never rewritten, so
// jsDelivr can cache them forever and a deploy can never change under a page
// that already resolved it. versions.json is the only thing that moves, which
// is what makes an update a one-line change and a rollback the same.
//
// The workflow merges this into a checkout of the cdn branch. Run it locally to
// see what would be published: `node scripts/build-cdn.js`.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'dist-cdn');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// A version override keeps the workflow's input and this script agreeing on the
// folder name, so a one-off publish does not need a package.json commit first.
const versionFlag = process.argv.indexOf('--version');
const version = versionFlag !== -1 ? process.argv[versionFlag + 1] : pkg.version;

if (!/^\d+\.\d+\.\d+/.test(version ?? '')) {
  throw new Error(`Not a publishable version: ${version}`);
}
const major = version.split('.')[0];

// The payload is the build plus the stylesheet. style.css ships with core
// rather than being copied by the operator, because the two are one artifact:
// a class core renders and a rule that styles it change in the same commit, and
// a page that mixed versions of them would be subtly broken rather than broken.
const VERSIONED_FILES = ['core.min.js', 'core.js', 'style.css'];

for (const name of VERSIONED_FILES) {
  if (!existsSync(join(dist, name))) {
    throw new Error(`dist/${name} is missing — run \`npm run build\` first.`);
  }
}

// A stale folder from an earlier version would otherwise be published too.
if (existsSync(out)) rmSync(out, { recursive: true });

const versionDir = join(out, `v${version}`);
mkdirSync(versionDir, { recursive: true });
for (const name of VERSIONED_FILES) {
  copyFileSync(join(dist, name), join(versionDir, name));
}

copyFileSync(join(root, 'cdn', 'loader.js'), join(out, 'loader.js'));

// The cdn branch carries its own .gitignore, and it has to arrive with the
// payload rather than being assumed present. Publishing checks out an orphan
// branch on the first run, which leaves main's .gitignore deleted but every
// untracked build folder still sitting in the working tree — without this, the
// `git add -A` that follows would commit node_modules to a CDN.
writeFileSync(
  join(out, '.gitignore'),
  ['node_modules/', 'dist/', 'dist-cdn/', 'docs/', '*.tsbuildinfo', ''].join('\n'),
  'utf8',
);

// Seed versions.json from the branch when the workflow has fetched it, so a
// publish adds a major without dropping the others. Absent, this is a first
// publish and a fresh map is correct.
const existing = join(out, 'versions.json');
const branchCopy = process.env['SQUIG_VERSIONS_JSON'];
let versions = {};
if (branchCopy && existsSync(branchCopy)) {
  try {
    const parsed = JSON.parse(readFileSync(branchCopy, 'utf8'));
    // A corrupt map must not take the whole CDN down with it: the majors it
    // held are recoverable from the branch history, a failed publish is not.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) versions = parsed;
    else console.warn('versions.json was not an object — starting a fresh map.');
  } catch (error) {
    console.warn(`versions.json was unreadable (${error.message}) — starting a fresh map.`);
  }
}

versions[major] = version;
writeFileSync(existing, `${JSON.stringify(versions, null, 2)}\n`, 'utf8');

console.log(`cdn payload ready in dist-cdn/`);
console.log(`  v${version}/{${VERSIONED_FILES.join(', ')}}`);
console.log(`  loader.js`);
console.log(`  versions.json  ${JSON.stringify(versions)}`);
