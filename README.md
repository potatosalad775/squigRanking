# squigRanking

Static, config-driven ranking page for CrinGraph / modernGraphTool squig deployments. Loads device data from a published Google Sheet CSV and renders filterable, sortable, deep-linkable device cards with rank badges and comments.

Try `Earphones Archive Ranking page` as a reference: [EA Ranking](https://earphonesarchive.squig.link/ranking)

---

## Managing ranking list

The ranking page reads its data from a CSV source (typically a published Google Sheet). Two starting points are available:

- **Google Sheets template** — copy [this template spreadsheet](https://docs.google.com/spreadsheets/d/1YIXLswsOCEt-p0UWrP9_64n-xl5qC_fV-s0MThXeEDk/edit?usp=sharing) and edit it as your own. (Use `File → Make a copy` to create your own copy in your drive.)
- **Self-hosted CSV** — if you'd rather host the CSV yourself, use [TEMPLATE.csv](TEMPLATE.csv) as a starting point.

### Comment field syntax

The Comment field is processed in the following order:

1. Plain text
2. Upside block (content written after `\+`)
3. Downside block (content written after `\-`)
4. Additional remarks (content written after `\?` or `※`)
5. Pill list (content wrapped in `*` is displayed as a single pill, e.g. `*Personal Collection*`)

Any of the above can be added or omitted, but they must appear in the specified order to be processed correctly.

Additional notes:
- The ranking page preserves line breaks from the spreadsheet exactly.
- Modifying the header names in the first row (`Rank`, `Comment`, etc.) may cause errors — make sure they match the entries in [ranking-config.js](ranking-config.js).

### Connecting a Google Sheet

1. Select **File → Share → Publish to web**.
2. In the **Link** section, set the two dropdowns to **List (Sheet)** and **Comma-separated values (.csv)** respectively.
3. Click **Publish** to generate a URL containing the spreadsheet data. Copy this URL.
4. Open [ranking-config.js](ranking-config.js) and replace `source.url` with the URL you just copied.

---

## Layout

```
squigRanking/
├── index.html            # Page shell. Loads ranking-config.js before core.js.
├── ranking-config.js     # Operator-editable config (the "what"). Sets window.RANKING_CONFIG.
├── core.js               # Config-driven runtime (the "how"). Do not edit for schema changes.
├── style.css             # Visual styles.
└── lang/
    ├── en.json           # Page-chrome strings (filter label, footer, etc.) — NOT column labels.
    └── ko.json
```

Four files in the project root (`index.html`, `ranking-config.js`, `core.js`, `style.css`) plus the `lang/` folder are all that gets deployed.

---

## Deploying

The page is a pure static bundle. It assumes it sits next to a CrinGraph-style measurement site:

```
<deploy-root>/
├── index.html                   # CrinGraph earphone measurement page
├── data/phone_book.json
├── headphones/
│   ├── index.html               # CrinGraph headphone measurement page
│   └── data/phone_book.json
└── ranking/                     # ← this repo's contents go here
    ├── index.html
    ├── ranking-config.js
    ├── core.js
    ├── style.css
    └── lang/{en,ko}.json
```

The default config resolves measurements via `../data/phone_book.json` (earphone) and `../headphones/data/phone_book.json` (headphone), and redirects measurement links to `../?share={file}` / `../headphones/?share={file}`. Adjust `types.*.phonebook` and `types.*.measurementUrl` in [`ranking-config.js`](ranking-config.js) for non-standard layouts.

To test locally, serve the folder (e.g. `python -m http.server` from the project root) — `file://` won't resolve the `fetch()` calls.

---

## Configuration

All schema, filter, sort, data-source, and URL behavior lives in [`ranking-config.js`](ranking-config.js) via `window.RANKING_CONFIG`. See **[CONFIGURATION.md](CONFIGURATION.md)** for the full reference — types, columns, renderer kinds, filter/sort/search/stats/deepLink, and common edits (adding columns, hiding per type, translating labels).

---

## Graph-tool integration

Upstream graph tools link to this page from their review-score badges via a URL template with `{type}`, `{brand}`, `{model}`, `{slug}`, and `{fullName}` placeholders. A template with no placeholders (e.g. a raw spreadsheet URL) is used as-is — no device info is appended.

- **CrinGraph** (any fork: Squiglink Lab, PublicGraphTool, etc.) → **[INTEGRATION-CRINGRAPH.md](INTEGRATION-CRINGRAPH.md)**. Operators add `ranking_url` to `config.js` and a small `buildRankingUrl` helper to `listAugment.js`.
- **modernGraphTool** → **[INTEGRATION-MODERNGRAPHTOOL.md](INTEGRATION-MODERNGRAPHTOOL.md)**. Operators only set `RANKING_URL` in `defaults/config.js` — the component wiring ships with mGT.

Both integrations default to no-op when the knob is unset, so existing deploys see zero change until an operator opts in.

---

## Contracts for agents

- Do not hardcode column keys (`Brand`, `Rank`, etc.) into `core.js`. Everything is driven by `window.RANKING_CONFIG`.
- DOM class names (`device-card`, `device-card-rank`, `device-card-comment`, `rank-S` through `rank-F`, `comment-main`, `comment-up`, etc.) are a public contract with `style.css` and with the phonebook matcher's selector lookups. Don't rename them casually.
- When adding a new `render.kind`, register it in both `renderColumn` and `pickSlot` in [core.js](core.js).
