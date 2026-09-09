---
title: 'Configuration reference'
description: 'Every key in ranking-config.js: types, columns, rank scales, filters, sorting, stats and deep links.'
---

A single `window.RANKING_CONFIG` object, loaded via a `<script>` tag before `core.js`. Unknown or unset keys fall back to sensible defaults. Edit this file to change schema, filters, sort options, data sources, and redirect URLs — no core changes required.

The authoritative definition is [`src/types.ts`](https://github.com/potatosalad775/squigRanking/blob/main/src/types.ts), published as `dist/types.d.ts`. With the JSDoc annotation at the top of `ranking-config.js`, your editor validates the whole object as you type.

---

## `configVersion`

```js
configVersion: 3,
```

The schema version this file targets. Core warns when a config declares a version newer than it understands, so a stale `core.js` after a CDN major bump says so in the console instead of silently half-working. An older config raises no warning: it still works. Optional, but recommended.

| version | added                                                                       |
|---------|-----------------------------------------------------------------------------|
| 1       | the original schema                                                          |
| 2       | `scale` on the rank column, and the `stars` and `score-badge` renderers      |
| 3       | `chrome`: the header and footer moved out of `index.html` and into the config |

---

## `types`

One entry per device category. Each key becomes a toggle button and a valid `?type=` URL param.

```js
types: {
  earphone: {
    label: { default: 'Earphones', i18n: { ko: '이어폰' } },
    source: { kind: 'csv', url: 'https://docs.google.com/.../pub?output=csv' },
    phonebook: '../data/phone_book.json',
    measurementUrl: '../?share={file}',
    measurementsPageUrl: '../',          // header "measurements" icon link
    defaults: { Style: 'Open' },         // fills blank cells on this type
    rowFilter: { field: 'Category', values: ['iem'] },   // optional, see below
  },
}
```

- `source.url` — published Google Sheet CSV URL (File → Share → Publish to web → CSV).
- `phonebook` — CrinGraph `phone_book.json`. Omit it and measurement links are simply never shown.
- `measurementUrl` — template; `{file}` is replaced with the URL-encoded phonebook filename.
- `measurementsPageUrl` — where the top-right measurements icon sends the user for this type. Omit it and the icon is hidden.

### One sheet, several types

By default each type fetches its own CSV. To serve several types from a single sheet, give them the same `source.url` and add a `rowFilter`:

```js
earphone:  { rowFilter: { field: 'Category', values: ['iem', 'earbud'] }, /* ... */ },
headphone: { rowFilter: { field: 'Category', values: ['headphone'] },    /* ... */ },
```

Matching is case-insensitive. Rows whose `Category` matches nothing appear under no type.

---

## `columns`

An ordered list. Each column declares its data source, filter, sort behavior and renderer independently. Card order follows this list.

```js
{
  id: 'rank',               // unique; referenced by sort keys and filter state
  source: 'Rank',           // CSV header (optional for template-only columns)
  role: 'rank',             // semantic hint; see below
  label: { default: 'Rank', i18n: { ko: '등급' } },
  sortable: true,
  scale: [                       // rank columns only; see below
    { value: 'S', score: 5, color: '#6c63ff' },
    { value: 'A', score: 4, color: '#00bfff' },
  ],
  filter: { kind: 'select' },
  render: { kind: 'rank-badge' },
  showForTypes: ['headphone'],   // optional allowlist
  placement: 'meta',             // optional slot override
}
```

### `role`

Roles are how core finds a column without hardcoding a header name. Rename `Brand` to `Maker` in your sheet and everything keeps working, as long as the role stays put.

| role      | used for                                                        |
|-----------|-----------------------------------------------------------------|
| `rank`    | Badge ordering, the rank chart, the scale, and the primary tie-breaker |
| `brand`   | Phonebook brand matching, second tie-breaker                     |
| `model`   | Phonebook model matching, third tie-breaker                      |
| `score`   | Numeric sorting and the average readout; falls back to the rank scale |

### `scale` — defining a rank

A rank used to be spread across four lists that had to stay index-aligned by hand: the filter values, the badge `classMap`, `stats.chartColors`, and a Score formula in the sheet. `scale` replaces all four. It is an ordered list, **best first**, and it is the only place a rank is defined.

```js
{
  id: 'rank', source: 'Rank', role: 'rank', label: 'Rank',
  sortable: true,
  scale: [
    { value: 'S', score: 5, color: '#6c63ff' },
    { value: 'A', score: 4, color: '#00bfff' },
    { value: 'B', score: 3, color: '#8bc34a' },
  ],
  filter: { kind: 'select' },
  render: { kind: 'rank-badge' },
}
```

From that one list core derives the dropdown options, the sort order, the badge color, the chart bar colors, and the score each grade is worth. Add a grade by adding one line.

| key         | effect                                                                  |
|-------------|-------------------------------------------------------------------------|
| `value`     | the cell value as written in the sheet                                   |
| `score`     | what the grade is worth; feeds the score sort and the average readout    |
| `color`     | badge background, and the chart bar for this step                        |
| `textColor` | badge text; defaults to white or near-black, whichever is readable       |
| `label`     | display text for the badge and the dropdown; defaults to `value`         |
| `class`     | an extra CSS class on the badge, for styling beyond a flat color         |

Three consequences worth knowing:

- **The Score column becomes optional.** When a row has no numeric Score cell, its score is the one its grade carries. A sheet with only `Brand`, `Model` and `Rank` still sorts by score and still shows an average.
- **A numeric scale tolerates values between steps.** On an all-numeric scale, `8.6` counts in the `9` bar and shows as `8.6`. Letter scales never snap: an unknown grade stays unranked.
- **`filter.values` and `stats.chartColors` become optional.** Set either one to override what the scale supplies.

#### Star and numeric ranks

```js
render: { kind: 'stars', max: 5 }                                  // 4.5 draws 4 and a half
render: { kind: 'score-badge', min: 0, max: 10, decimals: 1 }      // colored 0-to-10 pill
```

`stars` clips a row of star icons to a percentage, so any fraction works without half-star artwork. `score-badge` interpolates its color across `render.colors` between `min` and `max`, so a 0-to-100 scale needs no per-value color list.

Three ready-made configurations live in [`presets/`](/squigRanking/docs/ranks/choosing/): `letter` (S through F), `stars` (five stars in half steps), and `score` (0 to 10). Each ships its own `TEMPLATE.csv` matching that scale. Copy the pair you want over `ranking-config.js` and `TEMPLATE.csv`.

#### Configs written before scales

`configVersion: 1` configs, which spell out `filter.values`, `render.classMap` and `stats.chartColors`, keep working unchanged. `classMap` still takes precedence over a scale color when both are set, so an operator styling badges from their own stylesheet loses nothing. A version-1 core cannot read a version-2 config, and says so in the console rather than failing quietly.

### Renderer kinds (`render.kind`)

| kind               | default slot | purpose                                                     |
|--------------------|--------------|-------------------------------------------------------------|
| `rank-badge`       | `rank`       | colored badge; color comes from `scale`                     |
| `stars`            | `rank`       | a row of stars out of `render.max`, halves included         |
| `score-badge`      | `rank`       | a number in a pill colored along `render.colors`            |
| `title`            | `title`      | heading; uses `render.template` with `{Header}` placeholders |
| `meta-chip`        | `meta`       | chip in the meta row; consecutive chips get separators      |
| `text` / `numeric` | `meta`       | plain span; `numeric` also sorts numerically                |
| `link`             | `actions`    | anchor; uses `render.hrefTemplate` or `render.href`         |
| `block`            | `body`       | a paragraph in the card body; see below                     |
| `tags`             | `body`       | splits the cell on `separator` and renders pills            |
| `measurement-link` | `actions`    | anchor resolved via the type's phonebook                    |
| `none`             | —            | not rendered; still filterable, sortable and searchable     |

### `block` styles

A `block` renders one cell as a paragraph, preserving the cell's line breaks.

```js
{ id: 'pros', source: 'Pros', label: 'Pros', render: { kind: 'block', style: 'up' } }
```

| style   | appearance                                    |
|---------|-----------------------------------------------|
| `plain` | body text, no icon (the main comment)         |
| `up`    | green block with a plus icon                  |
| `down`  | red block with a minus icon                   |
| `note`  | muted text with a question icon               |
| `muted` | muted text with an asterisk icon              |

A blank cell renders nothing at all, so every block is optional per row and order is set by the config, not by the operator's typing.

Add `blockLabel` to prefix the block with a bold heading (`blockLabel: { default: 'Pros' }`). Omit it and only the icon distinguishes the block, which is usually enough.

### Slots (card layout)

`rank` (left block) · `title` (top of header) · `meta` (chip row) · `actions` (button row) · `body` (right content column). Override per column via `placement`.

### Filter kinds (`filter.kind`)

- `text` — substring match on `filter.match` (array of CSV headers) or the column's own `source`.
- `select` — exact-match dropdown built from `filter.values`, or from the column's `scale` when `values` is omitted.
- `select-auto` — exact-match dropdown whose options are collected from the loaded rows, sorted alphabetically. Good for `Driver` and `Style` columns where the value set changes as the sheet grows.

### Per-language data columns

```js
i18nSource: { en: 'Comment', ko: 'Comment_KR' },
```

The page reads the header for the active language, and falls back to `source` when that cell is blank. Half-translated sheets degrade to English per row rather than showing gaps.

---

## `search`, `sort`, `stats`, `deepLink`

```js
search: {
  enabled: true,
  // Omit `fields` to search every header any column declares, in both languages.
  fields: ['Brand', 'Model', 'Comment', 'Pros', 'Cons', 'Tags'],
  label: { default: 'Search', i18n: { ko: '검색' } },
},

sort: {
  default: 'rank-asc',
  options: ['rank-asc', 'rank-desc', 'score-desc', 'brand-asc'],
  labels: { 'rank-asc': { default: 'Rank (Best First)', i18n: { ko: '등급순 (높은 순)' } } },
},

stats: {
  enabled: true,
  average: { source: 'Score', denominator: '5.00' },
  chartColors: ['#6c63ff', /* ... */],   // optional; defaults to the scale's colors
  chartLibUrl: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
},

deepLink: {
  template: '{Brand}-{Model}',
  slugify: 'lowercase-hyphen',   // '#apple-airpods-max-usb-c'
},
```

Sort keys are `{columnId}-{asc|desc}`. A key with no matching label gets one generated from the column label. Rows with a blank or unrecognized value in the sorted column always sink to the bottom, in both directions.

Chart.js is fetched the first time the statistics modal is opened, so it never delays the first render. Set `stats.enabled: false` to hide the button entirely.

---

## `chrome`

The page shell. `index.html` is three empty landmarks — `#ranking-header`, `#ranking-content` and `#ranking-footer` — and core builds everything inside them, so branding the page never means editing markup.

```js
chrome: {
  title: { default: 'SquigRanking', i18n: { ko: '랭킹' } },
  subtitle: 'IEM and headphone rankings',
  titleUrl: '../',
  links: [
    { href: 'https://example.com/blog', label: 'Blog', icon: 'external', newTab: true },
  ],
  footer: {
    note: { default: 'Rankings reflect my own listening.', i18n: { ko: '...' } },
    links: [{ href: 'https://example.com', label: 'My site', newTab: true }],
  },
},
```

| key                | what it does                                                                        |
|--------------------|-------------------------------------------------------------------------------------|
| `title`            | Header title. An `I18nString`, or `false` for no title. Omitted renders nothing.      |
| `subtitle`         | A second line under the title.                                                        |
| `titleUrl`         | Wraps the title in a link, e.g. back to your measurement page.                         |
| `themeToggle`      | Show the light/dark button. Default `true`.                                            |
| `languageToggle`   | Show the language button. Defaults to on when more than one language is offered.        |
| `measurementsLink` | Show the header measurement icon. Default `true`; it appears only for types declaring `measurementsPageUrl`. |
| `links`            | Extra header links, before the built-in buttons.                                       |
| `footer.note`      | The disclaimer under the list. Pass an array for several paragraphs.                    |
| `footer.links`     | Links along the footer's bottom row.                                                    |

A link takes `href`, an optional `label` (an `I18nString`), an optional `icon` (`measurements`, `external` or `info`), an optional `title` for the tooltip and accessible name, and `newTab`.

There are no defaults for the wording: a config with no `chrome.title` renders no title, and one with no `footer` renders no footer bar at all rather than an empty strip. The shipped presets set both, so a fresh download has them.

What stays in `index.html` is the `<head>`: `<title>`, the `og:` tags, the canonical URL and the favicon. Those are read by crawlers and link previews before any script runs, so they cannot come from a config.

---

## `languages` and `i18n`

Interface strings ship inside the bundle in English and Korean. Override any of them, or add a language:

```js
languages: ['en', 'ko', 'ja'],
i18n: {
  ja: { filterAndSort: 'フィルターと並べ替え', resetFilters: 'リセット' },
},
```

The toggle button cycles through `languages` in order. Any string you do not override falls back to the built-in value, then to English. Available keys: `filterAndSort`, `resetFilters`, `search`, `sortBy`, `all`, `statsTitle`, `averageScore`, `deviceCount`, `closeStats`, `openStats`, `measurementsPage`, `toggleTheme`, `toggleLanguage`, `scrollTop`, `noResults`, `loadError`, `ascending`, `descending`.

Only strings core writes itself live here. Your own wording — the header title, the footer note — belongs in [`chrome`](#chrome), which takes an `I18nString` for each and so carries its own translations.

Declaring a single language hides the language toggle, since there is nothing to switch to. Set `chrome.languageToggle: true` to show it anyway.

If you add markup of your own to `index.html`, `data-i18n="key"` on an element fills it from this table; `data-i18n-title` and `data-i18n-label` do the same for the `title` and `aria-label` attributes.

---

## `cdn`

Where the page loads its own build from. Read by `loader.js` before the bundle exists, so unlike every other key here it never reaches core. Every field is optional, and most deploys set none of them.

```js
cdn: {
	majorVersion: 1,
},
```

| key | default | meaning |
|-----|---------|---------|
| `source` | `'auto'` | `'auto'` follows `loader.js`: a copy in your own folder means the build is there too, the CDN copy means fetch the published one. `'local'` and `'cdn'` force it. |
| `majorVersion` | highest published | Major version to track. Its newest patch is loaded on every visit. |
| `version` | — | An exact build, e.g. `'1.4.2'`. Freezes the deploy and skips the version lookup. |
| `base` | the project's jsDelivr URL | CDN base. Point it at your own mirror of the `cdn` branch. |
| `versionsUrl` | derived from `base` | Full URL to `versions.json`. |
| `debug` | `false` | Load the readable `core.js` instead of `core.min.js`. |

Setting `majorVersion` is the usual choice: bug fixes arrive on their own, and a major bump never does. See [Deploying](/squigRanking/docs/setup/deploying/#staying-up-to-date).

:::note
`source: 'local'` only says *where* to look, not *which* build — the folder's `core.min.js` is whatever you last copied there. Version pinning is a CDN concept.
:::

## Common edits

### Add a column (e.g. Price)

Add a `Price` header to your sheet, then:

```js
{
  id: 'price',
  source: 'Price',
  label: { default: 'Price', i18n: { ko: '가격' } },
  sortable: true,
  filter: { kind: 'text' },
  render: { kind: 'numeric' },
},
```

Add `'price-asc'` to `sort.options` if you want it in the dropdown. No code changes.

### Change the measurement URL scheme

Edit `types.*.measurementUrl`. Operators without CrinGraph can point at arbitrary URLs, or drop `phonebook` to hide measurement links.

### Hide a column on one type

Add `showForTypes: ['headphone']`.

### Translate a label

Inline on the column: `label: { default: 'Rank', i18n: { ko: '등급', ja: 'ランク' } }`.

---

## Deep links

- URL: `.../ranking/?type=earphone#apple-airpods-max-usb-c`
- `?type=` selects the tab; `#<slug>` selects the tab that contains the card, scrolls to it, and highlights it.
- Slug format is controlled by `deepLink.template` + `deepLink.slugify`. CrinGraph's `listAugment.js` and modernGraphTool's `PhoneSelector.svelte` build links in this format — see [the CrinGraph guide](/squigRanking/docs/integration/cringraph/) and [the modernGraphTool guide](/squigRanking/docs/integration/moderngraphtool/).
