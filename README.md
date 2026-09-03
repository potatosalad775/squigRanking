# squigRanking

A static, config-driven ranking page for CrinGraph and modernGraphTool squig deployments. Your reviews live in a spreadsheet; the page reads it and renders filterable, sortable, deep-linkable cards with rank badges and review notes.

**[Documentation](https://potatosalad775.github.io/squigRanking/docs/)** · **[Quick start](https://potatosalad775.github.io/squigRanking/docs/setup/quick-start/)** · **[Config editor](https://potatosalad775.github.io/squigRanking/docs/config-editor/)** · **[Live demo](https://potatosalad775.github.io/squigRanking/)**

A page in the wild: [Earphones Archive Ranking](https://earphonesarchive.squig.link/ranking).

---

## Using it

Download the latest release, copy four files into a `ranking/` folder next to your measurement site, and point `ranking-config.js` at your published sheet. That is the whole deployment: no build step on the server and nothing to install.

The **[quick start](https://potatosalad775.github.io/squigRanking/docs/setup/quick-start/)** walks through it in about fifteen minutes, including publishing a Google Sheet as CSV. The **[config editor](https://potatosalad775.github.io/squigRanking/docs/config-editor/)** builds the config file from a form if you would rather not edit code.

Three rank styles ship ready to use, and the [comparison page](https://potatosalad775.github.io/squigRanking/docs/ranks/choosing/) helps pick one:

| Preset | Rank cell holds | Badge |
|--------|-----------------|-------|
| [`letter`](presets/letter/) *(default)* | `S` … `F` | a colored grade badge |
| [`stars`](presets/stars/) | `0.5` … `5` | a row of stars, halves shown |
| [`score`](presets/score/) | `0` … `10` | a colored number pill |

Grades, their colors, their order and what each is worth all live in one `scale` list, so changing a scale is one edit. See [how a scale works](https://potatosalad775.github.io/squigRanking/docs/ranks/scale/).

---

## What is in this repo

Nothing at the root is deployable. The thing you host is `dist/`, which the build assembles.

| Path | What it is |
|------|------------|
| `src/` | The page's TypeScript. Bundled into one plain script. |
| `site/` | The page shell: `index.html` and `style.css`. |
| `presets/` | Three rank styles, each a config plus matching `TEMPLATE.csv` and `TEMPLATE.xlsx`. `letter` is also the default config. |
| `docs/` | The documentation site and the config editor. Its own package. |
| `test/` | Unit tests, plus a jsdom pass over the built bundle. |
| `scripts/` | The deploy-folder assembler and the spreadsheet generator. |
| `dist/` | Build output. Not committed. |

---

## Development

```bash
npm install
npm run check      # typecheck, then tests, then build
npm run build      # bundles src/ into dist/ and assembles the deploy folder
npm test           # unit tests plus a jsdom pass over the built bundle
```

The source is TypeScript, bundled by [rolldown](https://rolldown.rs/) into one plain IIFE. Nothing at runtime needs a module loader.

```
src/
├── types.ts          Public config surface. Also emitted as dist/types.d.ts.
├── config.ts         Config access. No other module reads RANKING_CONFIG.
├── csv.ts            RFC 4180 parser.
├── color.ts          Color ramps for scale-driven badges. Pure.
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

The docs site is a separate package. Its config editor is covered by `test/editor.test.ts` here, which asserts that what the editor generates is something `core.js` actually reads:

```bash
cd docs && npm install && npm run dev
```

The spreadsheet templates are generated from the preset configs, so a grade renamed in a config cannot leave a stale workbook behind:

```bash
pip install openpyxl
npm run templates          # rebuild every TEMPLATE.xlsx
npm run templates:check    # what CI runs
```

Python is needed to rebuild them, never to use them. The generated files are committed.

---

## Contracts

These are load-bearing across files and across other people's deploys. Changing one is a breaking change.

- **`window.RANKING_CONFIG` shape** — versioned by `configVersion`. Core warns when a config declares a version newer than it understands. Older configs keep working.
- **Rank scales stay backward compatible** — a rank column with no `scale` falls back to its `filter.values`, and `render.classMap` still wins over a scale color. There are tests for both.
- **Card anchors** — `#{brand}-{model}`, lowercased with whitespace hyphenated. CrinGraph and modernGraphTool build the same string to link into a card.
- **DOM class names** — `device-card`, `device-card-rank`, `device-card-body`, `card-block-*`, `card-tag`, `rank-S` through `rank-F`. They are the contract between `core.js` and `style.css`.
- **No hardcoded CSV headers in `src/`** — sorting and phonebook matching find their columns through `role`, never through a literal like `Brand`. There is a test for this.
- **Spreadsheet content is never HTML** — every cell reaches the page as a text node. There is a test for this too.

When adding a `render.kind`, add it to the `RenderConfig` union in `src/types.ts`, a case in `renderColumn`, and a default slot in `slotFor`.

Documentation lives in `docs/src/content/docs/`, not in markdown files at the root. Editing it in one place is the point.
