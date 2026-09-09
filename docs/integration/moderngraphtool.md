---
title: modernGraphTool
description: Point modernGraphTool at your ranking page with one config value.
editUrl: true
head: []
template: doc
sidebar:
  hidden: false
  attrs: {}
pagefind: true
draft: false
---

modernGraphTool (mGT) ships with a `RANKING_URL` knob that drives the review-score link in `PhoneSelector.svelte`. If the knob is unset or empty, the score renders as plain text (mGT's legacy behavior). If it's set, the score becomes a clickable link.

**Operators only need to edit `defaults/config.js`.** The `PhoneSelector.svelte` wiring is maintained upstream — no component edits required (version v2.1.0 and up is required).

---

## Setup

Open your mGT deploy's `defaults/config.js` and set `RANKING_URL` in the `GRAPHTOOL_CONFIG` object:

```js
GRAPHTOOL_CONFIG: {
    // ...
    RANKING_URL: '/ranking/?type={type}#{slug}',
}
```

The value is a URL template. mGT substitutes placeholder tokens per row at render time.

### Placeholder tokens

| placeholder | expands to                                      |
|-------------|-------------------------------------------------|
| `{type}`    | always `'earphone'` — mGT does not track per-phone type (see note below) |
| `{brand}`   | URL-encoded brand                               |
| `{model}`   | URL-encoded model                               |
| `{slug}`    | `{brand}-{model}` lowercased, whitespace → `-`  |
| `{fullName}`| URL-encoded `'{brand} {model}'`                 |

If the template contains **no** placeholder tokens, it's used verbatim — useful when the review-score link should always go to the same URL (a raw Google Sheet, a Notion page, etc.) regardless of which phone is selected.

> **`{type}` on headphone deploys.** mGT's `phone_book.json` has no per-phone type field, so `{type}` resolves to the fixed literal `'earphone'`. For a headphone-only mGT deploy, hardcode the type in your URL instead of using the placeholder — e.g. `RANKING_URL: '/ranking/?type=headphone#{slug}'`.

### Example values

```js
// Default squigRanking page on the same deploy:
RANKING_URL: '/ranking/?type={type}#{slug}',

// External squigRanking deploy:
RANKING_URL: 'https://reviews.example.com/?type={type}#{slug}',

// Raw Google Sheet (no per-device anchoring):
RANKING_URL: 'https://docs.google.com/spreadsheets/.../pubhtml',

// Custom page with query params:
RANKING_URL: '/custom-ranking/?brand={brand}&model={model}',

// Disabled (mGT default — review score stays display-only):
RANKING_URL: '',
```

---

## Verify

1. **Default (knob unset).** Leave `RANKING_URL: ''` (or remove the key). Reload the tool — review scores should render as plain text with no link decoration, exactly as before.
2. **Link renders.** Set `RANKING_URL: '/ranking/?type={type}#{slug}'`. Reload. Review-scored phones now show a clickable score; clicking opens the ranking page scrolled to the matching device card.
3. **No-placeholder template.** Set `RANKING_URL` to a plain URL with no `{...}` tokens. Click any review-scored phone — it should open that exact URL with nothing appended.

---

## Common gotchas

- **Empty string vs missing key.** Both are treated as "no link." No errors are thrown.
- **Same-tab vs new-tab.** mGT opens the link in a new tab by default. If you want same-tab navigation, that's a component-level preference — file an issue upstream rather than patching the Svelte file locally.
- **Hash-only navigation.** If the target URL changes only the `#hash` on a page the user is already viewing (e.g. the ranking page), the browser scrolls without reloading. The ranking page listens for `hashchange` and handles this.
- **CrinGraph parallel.** The CrinGraph equivalent is `ranking_url` in `config.js`. Same placeholder tokens, different casing. See [the CrinGraph guide](/squigRanking/docs/integration/cringraph/).