# CrinGraph integration

Wire up any CrinGraph fork so its review-score badges link to your squigRanking page. This is intentionally fork-agnostic — the changes below apply to vanilla CrinGraph and every downstream variant (Squiglink Lab, PublicGraphTool, etc.) that still uses `config.js` + `listAugment.js`.

Two small edits per fork:

1. **`config.js`** (and `config_hp.js` if the fork has a separate headphone build) — add one knob: `ranking_url`.
2. **`listAugment.js`** — substitute placeholders in that template when building the review-score link.

Both edits are additive and default to the current hardcoded behavior when `ranking_url` is unset, so existing deploys see no change.

If you can't find the `listAugment.js` in your fork, you can download it from Squiglink Lab [here](https://github.com/squiglink/lab/blob/main/listAugment.js). Don't forget to hook it up in `index.html` like `<script src="listAugment.js"></script>` if your fork doesn't already include it.

---

## Where these files live

CrinGraph layout varies by fork, but the two files are always at the root of the graph-tool deploy:

```
<crin-graph-root>/
├── config.js               # earphone build config
├── config_hp.js            # (forks with a split headphone build only)
├── listAugment.js          # renders augmented rows in the phone picker
├── graph_free.html
├── graph_hp.html
└── data/phone_book.json
```

If the fork uses a bundler (rare), edit the source file that produces `listAugment.js` — the logic is the same.

---

## Step 1 — Add `ranking_url` to `config.js`

Find the top-level config declarations. They look like a series of `const NAME = value;` lines (or in some forks, assignments on a config object). Add:

```js
// Template for the review-score link in listAugment.js.
// Placeholders: {type}, {brand}, {model}, {slug}, {fullName}.
// If the template contains no placeholders, it is used verbatim.
// Unset or empty string → falls back to the default below (no behavior change).
ranking_url = '../../ranking/?type=earphone#{slug}';
```

For `config_hp.js` (if present), use the headphone type:

```js
ranking_url = '../../ranking/?type=headphone#{slug}';
```

### Placeholder semantics

| placeholder | expands to                                      |
|-------------|-------------------------------------------------|
| `{type}`    | `'earphone'` or `'headphone'` (whichever build this config drives) |
| `{brand}`   | the row's brand, URL-encoded                    |
| `{model}`   | the row's model, URL-encoded                    |
| `{slug}`    | `{brand}-{model}` lowercased, whitespace → `-`  |
| `{fullName}`| `{brand} {model}` URL-encoded                   |

If `ranking_url` contains **no** placeholder tokens (e.g. it's a raw spreadsheet link or a top-level index), the helper uses it as-is — no device identifier is appended. Useful when a deploy wants the badge to open a shared Google Sheet, a Notion page, etc.

### Deciding the template

| operator want                                                        | template                                                             |
|----------------------------------------------------------------------|----------------------------------------------------------------------|
| Default squigRanking page at `../../ranking/` (parity with v1)       | `'../../ranking/?type=earphone#{slug}'`                              |
| Ranking page on a different path                                     | `'/reviews/?type={type}#{slug}'`                                     |
| A raw Google Sheet (no per-device anchoring)                         | `'https://docs.google.com/.../pubhtml'`                              |
| Custom page with query params                                        | `'/custom-ranking/?brand={brand}&model={model}'`                     |

---

## Step 2 — Substitute placeholders in `listAugment.js`

### 2a. Add the helper

At the top of `listAugment.js`, add `buildRankingUrl`:

```js
// Resolve {placeholder} tokens in a ranking_url template.
// Values are URL-encoded. If the template contains no tokens, return it unchanged.
function buildRankingUrl(template, ctx) {
    if (!template) return null;
    if (!/\{[a-zA-Z]+\}/.test(template)) return template;
    const brand = String(ctx.brand || '');
    const model = String(ctx.model || '');
    const slug = (brand + '-' + model).toLowerCase().replace(/\s+/g, '-');
    const fullName = brand + ' ' + model;
    const values = {
        type: ctx.type || '',
        brand: encodeURIComponent(brand),
        model: encodeURIComponent(model),
        slug: encodeURIComponent(slug).replace(/%2D/gi, '-'),
        fullName: encodeURIComponent(fullName),
    };
    return template.replace(/\{([a-zA-Z]+)\}/g, (_, k) => values[k] != null ? values[k] : '');
}
```

### 2b. Use it where the review-score link is built

Somewhere in `listAugment.js` is a block that builds the augmented row for a phone. In vanilla CrinGraph it's around line 313, inside a `reviewScore && !reviewStars` branch that currently does something like:

```js
// BEFORE (hardcoded)
augmentsRow1Col1.href = '../../ranking/?type=earphone#' +
    (phone.brand.name + '-' + phone.phone).toLowerCase().replace(/\s+/g, '-');
```

Replace with:

```js
// AFTER (config-driven)
const template = (typeof ranking_url !== 'undefined' && ranking_url)
    ? ranking_url
    : '../../ranking/?type=earphone#{slug}';   // ← keep the fork's original default here
const resolved = buildRankingUrl(template, {
    type: 'earphone',                          // ← 'headphone' in config_hp.js builds
    brand: phone.brand.name,
    model: phone.phone,
});
if (resolved) augmentsRow1Col1.href = resolved;
```

Notes:

- **Keep the fork's original URL shape as the fallback** on the second line — this preserves zero-diff behavior when the operator hasn't set `ranking_url`.
- The `type` literal switches between `'earphone'` and `'headphone'` depending on which config file drives this build. Forks that merge both builds into one file can read it from an existing variable (e.g. `whichType` or similar) instead.
- If your fork's `listAugment.js` differs structurally (e.g. it builds an `<a>` element with `createElement` instead of writing `.href`), the replacement is the same: compute `resolved` once and set it on whichever element carries the review-score link.

---

## Step 3 — Verify

1. **Default behavior preserved.** Leave `ranking_url` unset in `config.js`. Open `graph_free.html`, find a phone whose review score is a plain number (not star-rated), click its badge. It should open your ranking page at `../../ranking/?type=earphone#<slug>` — exactly as before.
2. **Custom template.** Set `ranking_url = '/custom/?b={brand}&m={model}'`. Click the same badge. The browser should navigate to `/custom/?b=<url-encoded-brand>&m=<url-encoded-model>`.
3. **No-placeholder template.** Set `ranking_url = 'https://docs.google.com/spreadsheets/.../pubhtml'`. Click the badge. The raw spreadsheet URL should open — no slug, no query params appended.
4. **`alt_augment = false` unaffected.** Forks that set `alt_augment = false` bypass `listAugment.js` entirely. Confirm that flipping it off still skips the review-score rendering path (no regression from the edit).
5. **Headphone build.** Repeat with `config_hp.js` + `graph_hp.html` if the fork has a split build.

---

## Common gotchas

- **`ranking_url` is `undefined`.** Some forks use strict mode; referencing an undeclared identifier throws. The `typeof ranking_url !== 'undefined'` guard in the snippet handles this — don't remove it.
- **Double-encoding.** If you manually pre-encode inside the template (e.g. `{brand}` → `%20` in the value), the helper will encode again. Use raw placeholders; encoding happens once, in `buildRankingUrl`.
- **Hash-based templates and history.** Changing only the `#` hash on an existing ranking-page tab triggers `hashchange` and scrolls without reload. The ranking page listens for `hashchange` (see [core.js](core.js)), so this works out of the box.
- **Forks without `listAugment.js`.** A few very old CrinGraph variants built the review-score element inline in `graph.js`. Same edit applies — just find the `.href = ...` assignment that produces the existing ranking link.
