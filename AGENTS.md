# squigRanking

A static, config-driven ranking page for CrinGraph and modernGraphTool squig deployments. 

---

## What is in this repo

Nothing at the root is deployable. The thing you host is `dist/`, which the build assembles.

| Path | What it is |
|------|------------|
| `src/` | The page's TypeScript. Bundled into one plain script. |
| `site/` | The page shell: `index.html` and `style.css`. The HTML is three empty landmarks; core builds the header, footer and body from the config. |
| `cdn/` | `loader.js`, which resolves a version and injects the build. Published to the `cdn` branch, and copied into `dist/` so a self-hosted folder needs nothing else. |
| `presets/` | Three rank styles, each a config plus matching `TEMPLATE.csv` and `TEMPLATE.xlsx`. `letter` is also the default config. |
| `docs/` | The documentation site, the config editor and the phone book converter. Its own package. |
| `test/` | Unit tests, plus a jsdom pass over the built bundle. |
| `scripts/` | The deploy-folder assembler, the CDN payload stager and the spreadsheet generator. |
| `dist/` | Build output, and a complete self-hosted deploy folder. Not committed. |
| `dist-cdn/` | What `npm run build:cdn` stages for the `cdn` branch. Not committed. |

---

## Development

```bash
npm install
npm run check      # typecheck, then build, then tests
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
├── render/           chrome, modal, cards, blocks, controls, skeleton
└── main.ts           Startup and event wiring.
```

The docs site is a separate package. Its two browser tools are covered by tests here rather than there, because what they produce has to line up with things they cannot see. `test/editor.test.ts` asserts that the config the editor generates is something `core.js` actually reads; `test/phonebook-converter.test.ts` asserts that the converter's header row matches the shipped `TEMPLATE.csv`, and that every row it writes still resolves to its own measurement through `src/phonebook.ts`:

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