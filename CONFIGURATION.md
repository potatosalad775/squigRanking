# Configuration reference (`ranking-config.js`)

A single `window.RANKING_CONFIG` object, loaded via a `<script>` tag before `core.js`. Unknown or unset keys fall back to sensible defaults. Edit this file to change schema, filters, sort options, data sources, and redirect URLs — no `core.js` changes required.

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
    defaults: { 'F/F': 'Open' },         // optional per-type field defaults
  },
}
```

- `source.url` — published Google Sheet CSV URL (File → Share → Publish to web → CSV).
- `measurementUrl` — template; `{file}` is replaced with the URL-encoded phonebook filename.
- `measurementsPageUrl` — where the top-right measurements icon sends the user for this type.

---

## `columns`

An ordered list. Each column declares data source, filter, sort, and renderer independently.

```js
{
  id: 'rank',               // unique; referenced by sort keys and filterState
  source: 'Rank',           // CSV field name (optional if render is template-only)
  role: 'rank',             // hints rank-index comparator + stats bucketing
  label: { default: 'Rank', i18n: { ko: '등급' } },
  sortable: true,
  filter: { kind: 'select', values: ['S','A+','A', /* ... */] },
  render: { kind: 'rank-badge', classMap: { 'S': 'rank-S', /* ... */ } },
  showForTypes: ['headphone'],   // optional allowlist
  placement: 'meta',             // optional slot override (see below)
}
```

### Renderer kinds (`render.kind`)

| kind              | default slot | purpose                                                        |
|-------------------|--------------|----------------------------------------------------------------|
| `rank-badge`      | `rank`       | colored badge via `classMap[value]`                            |
| `title`           | `title`      | heading; uses `render.template` with `{Field}` placeholders    |
| `meta-chip`       | `meta`       | chip in the meta row; multiple chips get `\|` separators       |
| `text` / `numeric`| `meta`       | plain span; `numeric` also hints the sort comparator           |
| `link`            | `actions`    | anchor; uses `render.hrefTemplate` or `render.href`            |
| `comment`         | `body`       | passed through `divComment()` — `*..*` `※` `\+` `\-` `\?` markup |
| `measurement-link`| `actions`    | anchor whose href is resolved via the per-type phonebook       |
| `none`            | —            | skip rendering; keep column for filter/sort only               |

### Slots (card layout)

`rank` (left block) · `title` (top of header) · `meta` (chip row) · `actions` (below meta) · `body` (right content column). Override per column via `placement`.

### Filter kinds (`filter.kind`)

- `text` — substring match on `filter.match` (array of CSV field names) or `column.source`.
- `select` — exact-match dropdown built from `filter.values`.

### i18n data fields

Use `i18nSource: { en: 'Comment_English', ko: 'Comment' }` when the same logical column reads from different CSV columns per locale.

---

## `search`, `sort`, `stats`, `deepLink`

```js
search: {
  enabled: true,
  fields: ['Brand','Model','Type','F/F','Comment','Comment_English'],
  label: { default: 'Search', i18n: { ko: '검색' } },
},

sort: {
  default: 'rank-asc',
  options: ['rank-asc','rank-desc','brand-asc','brand-desc','model-asc','model-desc'],
  labels: { 'rank-asc': { default: 'Rank (Best First)', i18n: { ko: '등급순 (높은 순)' } }, /* ... */ },
},

stats: {
  enabled: true,
  average: { source: 'Score', denominator: '5.00' },
  chartColors: ['#6c63ff', /* ... */],
},

deepLink: {
  template: '{Brand}-{Model}',
  slugify: 'lowercase-hyphen',   // '#apple-airpods-max-usb-c'
},
```

Sort keys follow `{columnId|fieldName}-{asc|desc}`. Unknown column IDs fall back to a string sort on the title-cased row field.

---

## Common edits

### Add a new column (e.g. Price)

No code changes. Add to [`ranking-config.js`](ranking-config.js):

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

Then add `'price-asc'` / `'price-desc'` to `sort.options` if desired, and add a `Price` header to your Google Sheet. Reload — column appears in the card meta row, filter input, and sort dropdown.

### Change the measurement URL scheme

Edit `types.*.measurementUrl`. Any `{file}` placeholder is replaced; operators without CrinGraph can point at arbitrary URLs.

### Hide a column on one type

Add `showForTypes: ['headphone']` (or the relevant subset).

### Translate a label

Inline on the column: `label: { default: 'Rank', i18n: { ko: '등급', ja: 'ランク' } }`. The language toggle cycles EN ↔ KR out of the box.

---

## Deep links

- URL: `.../ranking/?type=earphone#apple-airpods-max-usb-c`
- `?type=` selects the tab; `#<slug>` scrolls to and highlights the matching card.
- Slug format is controlled by `deepLink.template` + `deepLink.slugify`. CrinGraph's `listAugment.js` and modernGraphTool's `PhoneSelector.svelte` build links in this format — see [INTEGRATION-CRINGRAPH.md](INTEGRATION-CRINGRAPH.md) and [INTEGRATION-MODERNGRAPHTOOL.md](INTEGRATION-MODERNGRAPHTOOL.md).
