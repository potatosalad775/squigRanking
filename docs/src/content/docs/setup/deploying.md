---
title: 'Deploying'
description: 'The two-file auto-updating deploy, the self-hosted one, and what the default paths assume.'
sidebar:
  order: 3
---

The page is a static bundle that sits next to a CrinGraph-style measurement site.

```
<deploy-root>/
├── index.html                   ← your measurement page
├── data/phone_book.json
├── headphones/
│   ├── index.html
│   └── data/phone_book.json
└── ranking/                     ← this project's files
    ├── index.html
    └── ranking-config.js
```

Two files. No build step on the server, and no `lang/` folder: the interface strings ship inside the bundle.

`index.html` names no version and no script of its own. It loads a small `loader.js`, which resolves the current build and injects it along with its stylesheet. That indirection is what lets a deploy update itself, and it is also what lets the same `index.html` run from disk instead — see [self-hosting](#self-hosting-the-build) below.

## Getting the files

### Download a release

Grab the latest release, and copy out `index.html` and `ranking-config.js`. Edit the config to point at your sheet. Nothing to install, and nothing to come back for: the page fetches the newest published build every time it loads.

The zip holds more than those two files. The rest is for self-hosting, and for switching rank style.

### Build from source

```bash
npm install
npm run build
```

`dist/` becomes a complete deployable folder, presets included. Because a copy of `loader.js` ends up next to `index.html` there, serving `dist/` runs the build you just made rather than the published one — which is what you want while developing.

## Staying up to date

By default a page tracks the newest major version published. Most deploys want the narrower promise instead: bug fixes automatically, breaking changes never.

```js
window.RANKING_CONFIG = {
	cdn: {
		majorVersion: 1,
	},
	// ...
};
```

Pin an exact build with `version: '1.4.2'` when you need a deploy frozen — during an event, or while you work out whether a regression is yours. Both keys are described in [`cdn`](/config/reference/#cdn).

Versioned builds are immutable: `v1.4.2` is published once and never rewritten. Updating moves a pointer in `versions.json`, so rolling back is the same move in reverse and takes effect on the next page load.

:::caution
Do not point a deploy at a branch URL by hand. jsDelivr caches those for twelve hours, so a breaking change would ship unannounced and then stay put. The version indirection exists precisely to avoid that.
:::

## Self-hosting the build

Copy five files rather than two, and the page never contacts the CDN at all:

```
ranking/
├── index.html
├── ranking-config.js
├── loader.js
├── core.min.js
└── style.css
```

`loader.js` served from your own site means the build is there too, so that is all it takes — no config change. Use this for a deploy that has to work offline or behind a firewall, or when you would rather not depend on a third party staying up. The trade is that updating becomes your job again: copy the files from a newer release.

`core.js` in the release zip is the same build unminified. Load it instead with `cdn: { debug: true }` when you need readable stack traces from a deploy.

## What the default paths assume

Out of the box the config resolves measurements against `../data/phone_book.json` for earphones and `../headphones/data/phone_book.json` for headphones, and links to `../?share={file}` and `../headphones/?share={file}`.

If your site is laid out differently, change `phonebook` and `measurementUrl` on each type. Nothing else depends on the layout.

## Testing locally

Serve the folder rather than opening the file directly:

```bash
cd dist
python -m http.server
```

Opening `index.html` from `file://` fails, because the browser blocks the `fetch()` calls that load your sheet and phonebook.
