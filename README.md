# squigRanking

Static, config-driven ranking page for CrinGraph / modernGraphTool squig deployments. Loads device data from a published Google Sheet CSV and renders filterable, sortable, deep-linkable device cards with rank badges and review notes.

**[Documentation](https://potatosalad775.github.io/squigRanking/docs/)** · **[Config editor](https://potatosalad775.github.io/squigRanking/docs/config-editor/)** · **[Live demo](https://potatosalad775.github.io/squigRanking/)**

Try `Earphones Archive Ranking page` as a reference: [EA Ranking](https://earphonesarchive.squig.link/ranking)

---

## Managing ranking list

The ranking page reads its data from a CSV source (typically a published Google Sheet). Two starting points are available:

- **Google Sheets template** — copy [this template spreadsheet](https://docs.google.com/spreadsheets/d/1YIXLswsOCEt-p0UWrP9_64n-xl5qC_fV-s0MThXeEDk/edit?usp=sharing) and edit it as your own. (Use `File → Make a copy` to create your own copy in your drive.)
- **Self-hosted CSV** — if you'd rather host the CSV yourself, use [TEMPLATE.csv](TEMPLATE.csv) as a starting point.
- **Excel workbook** — [TEMPLATE.xlsx](TEMPLATE.xlsx) is the same sheet with a rank dropdown, a Guide tab explaining every column, and a Stats tab that counts and charts your grades. Import it into Google Sheets with `File → Import`, or edit it locally.

### Pick a rank style

The page ships three ready-made rank styles. Each is a `ranking-config.js` and a matching `TEMPLATE.csv` under [presets/](presets/); copy the pair you want over the two files at the root.

| preset                                 | Rank cell holds | Badge                        |
|----------------------------------------|-----------------|------------------------------|
| [`letter`](presets/letter/) *(default)* | `S` … `F`       | colored grade badge          |
| [`stars`](presets/stars/)               | `0.5` … `5`     | a row of stars, halves shown |
| [`score`](presets/score/)               | `0` … `10`      | a colored number pill        |

The grades, their colors and what each is worth all live in one `scale` list in the config, so changing a scale is one edit. See [CONFIGURATION.md](CONFIGURATION.md#scale--defining-a-rank).

### Sheet columns

Each part of a review lives in its own column. There is no markup to learn and no ordering rule to remember — a blank cell simply renders nothing.

| Column    | Renders as                                        |
|-----------|---------------------------------------------------|
| `Brand`, `Model` | Card heading                               |
| `Rank`    | Colored badge, ordered by your rank scale         |
| `Score`   | Feeds the average readout and the score sort. Optional: a rank scale can supply it |
| `Type`, `F/F` | Chips in the meta row                         |
| `Comment` | Main paragraph                                    |
| `Pros`    | Green block                                       |
| `Cons`    | Red block                                         |
| `Notes`   | Muted block for caveats and measurement remarks   |
| `Tags`    | Comma-separated pills, also searchable            |

Notes on authoring:

- **Line breaks are preserved.** Put each bullet on its own line inside the cell (`Alt+Enter` in Google Sheets).
- **Korean text goes in a parallel column.** `Comment_KR`, `Pros_KR`, `Cons_KR` and `Notes_KR` are used when the page is in Korean, and fall back to the English column when blank.
- **Header names are wired in [ranking-config.js](ranking-config.js).** Rename a header there and the page follows; rename it only in the sheet and the column goes blank.
- **Add a column without touching code.** Add the header to your sheet, add a matching entry to `columns`, reload. See [CONFIGURATION.md](CONFIGURATION.md).

### Connecting a Google Sheet

1. Select **File → Share → Publish to web**.
2. In the **Link** section, set the two dropdowns to **List (Sheet)** and **Comma-separated values (.csv)** respectively.
3. Click **Publish** to generate a URL containing the spreadsheet data. Copy this URL.
4. Open [ranking-config.js](ranking-config.js) and replace `source.url` with the URL you just copied.

---

## Deploying

The page is a pure static bundle that sits next to a CrinGraph-style measurement site:

```
<deploy-root>/
├── index.html                   # CrinGraph earphone measurement page
├── data/phone_book.json
├── headphones/
│   ├── index.html               # CrinGraph headphone measurement page
│   └── data/phone_book.json
└── ranking/                     # ← this repo's output goes here
    ├── index.html
    ├── ranking-config.js
    ├── core.js
    └── style.css
```

Four files, no build step on the server, no `lang/` folder — the interface strings ship inside `core.js`.

### Getting the files

**Option A — download a release.** Grab the four files from the latest release and edit `ranking-config.js`. Nothing to install.

**Option B — load core from a CDN.** Keep `index.html`, `ranking-config.js` and `style.css` local, and point the script tag at jsDelivr:

```html
<script defer src="ranking-config.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/squig-ranking@1/dist/core.min.js"></script>
```

Pin the major version (`@1`) so bug fixes arrive automatically and breaking changes never do. Never point at a branch — jsDelivr caches branch URLs for 12 hours and would ship breaking changes unannounced.

**Option C — build from source.** See Development below; `npm run build` writes a complete deployable folder to `dist/`.

The default config resolves measurements via `../data/phone_book.json` (earphone) and `../headphones/data/phone_book.json` (headphone), and links to `../?share={file}` / `../headphones/?share={file}`. Adjust `types.*.phonebook` and `types.*.measurementUrl` for non-standard layouts.

To test locally, serve the folder (e.g. `python -m http.server` from `dist/`) — `file://` won't resolve the `fetch()` calls.

---

## Configuration

All schema, filter, sort, data-source, and URL behavior lives in [`ranking-config.js`](ranking-config.js) via `window.RANKING_CONFIG`. See **[CONFIGURATION.md](CONFIGURATION.md)** for the full reference.

Not comfortable editing the file directly? The **[config editor](https://potatosalad775.github.io/squigRanking/docs/config-editor/)** builds it from a form, previews the rank badges as you set them, and reads an existing config back in.

The config file opens with a JSDoc annotation:

```js
/** @type {import('squig-ranking').RankingConfig} */
window.RANKING_CONFIG = { ... };
```

With the package installed as a dev dependency, that one line gives any editor autocomplete for every key and a red squiggle on every typo. It is a comment, so deleting it changes nothing at runtime.

---

## Graph-tool integration

Upstream graph tools link to this page from their review-score badges via a URL template with `{type}`, `{brand}`, `{model}`, `{slug}`, and `{fullName}` placeholders. A template with no placeholders (e.g. a raw spreadsheet URL) is used as-is — no device info is appended.

- **CrinGraph** (any fork: Squiglink Lab, PublicGraphTool, etc.) → **[INTEGRATION-CRINGRAPH.md](INTEGRATION-CRINGRAPH.md)**. Operators add `ranking_url` to `config.js` and a small `buildRankingUrl` helper to `listAugment.js`.
- **modernGraphTool** → **[INTEGRATION-MODERNGRAPHTOOL.md](INTEGRATION-MODERNGRAPHTOOL.md)**. Operators only set `RANKING_URL` in `defaults/config.js` — the component wiring ships with mGT.

Both integrations default to no-op when the knob is unset, so existing deploys see zero change until an operator opts in.

---

## Development

The spreadsheet templates are generated from the preset configs, so a grade renamed in a config does not leave a workbook behind:

```bash
pip install openpyxl
python scripts/build-templates.py           # rebuild every TEMPLATE.xlsx
python scripts/build-templates.py --check   # what CI runs
```

Python is needed to rebuild them, never to use them. The generated files are committed.

```bash
npm install
npm run check      # typecheck, then tests, then build
npm run build      # bundles src/ into dist/ and assembles the deploy folder
npm test           # unit tests plus a jsdom pass over the built bundle
```

The source is TypeScript, bundled by [rolldown](https://rolldown.rs/) into one plain IIFE. Nothing at runtime needs a module loader.

```
docs/                 Astro Starlight documentation site and the config editor.
presets/              Three ready-made config and TEMPLATE.csv pairs.
src/
├── types.ts          Public config surface. Also emitted as dist/types.d.ts.
├── config.ts         Config access. No other module reads RANKING_CONFIG.
├── csv.ts            RFC 4180 parser.
├── i18n.ts           Built-in chrome strings and language selection.
├── query.ts          Filtering and sorting. Pure functions.
├── phonebook.ts      Fuzzy matching of a row to a measurement file.
├── deeplink.ts       Card id and hash slugs.
├── stats.ts          Rank chart; loads Chart.js on first open.
├── theme.ts          Light/dark preference.
├── dom.ts, icons.ts  Element helpers and SVG path data.
├── render/           cards, blocks, controls, skeleton
└── main.ts           Startup and event wiring.
```

`test/` covers the parser, the query layer, phonebook matching, and config resolution as pure units, then boots the real `index.html` and the built bundle in jsdom to check the wiring end to end.

---

## Contracts

These are load-bearing across files and across other people's deploys. Changing one is a breaking change.

- **`window.RANKING_CONFIG` shape** — versioned by `configVersion`. Core warns when a config declares a version it does not understand.
- **Card anchors** — `#{brand}-{model}`, lowercased with whitespace hyphenated. CrinGraph and modernGraphTool build the same string to link into a card.
- **DOM class names** — `device-card`, `device-card-rank`, `device-card-body`, `card-block-*`, `card-tag`, `rank-S` through `rank-F`. They are the contract between `core.js` and `style.css`.
- **No hardcoded CSV headers in `src/`** — sorting and phonebook matching find their columns through `role`, never through a literal like `Brand`. There is a test for this.
- **Spreadsheet content is never HTML** — every cell reaches the page as a text node. There is a test for this too.

When adding a `render.kind`, add it to the `RenderConfig` union in `src/types.ts`, a case in `renderColumn`, and a default slot in `slotFor`.
