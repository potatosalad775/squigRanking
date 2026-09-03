---
title: 'Deploying'
description: 'Where the four files go, what the default paths assume, and how to load core.js from a CDN instead.'
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
    ├── ranking-config.js
    ├── core.js
    └── style.css
```

Four files. No build step on the server, and no `lang/` folder: the interface strings ship inside `core.js`.

## Getting the files

### Download a release

Grab the four files from the latest release and edit `ranking-config.js`. Nothing to install.

### Load core from a CDN

Keep `index.html`, `ranking-config.js` and `style.css` local, and point the script tag at jsDelivr:

```html
<script defer src="ranking-config.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/squig-ranking@1/dist/core.min.js"></script>
```

Pin the major version so bug fixes arrive automatically and breaking changes never do. Never point at a branch: jsDelivr caches branch URLs for twelve hours, which would ship a breaking change unannounced and then hold it there.

### Build from source

```bash
npm install
npm run build
```

`dist/` becomes a complete deployable folder, presets included.

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
