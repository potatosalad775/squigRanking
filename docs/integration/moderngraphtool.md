---
title: modernGraphTool
description: Link modernGraphTool's device list to your ranking page, and
  optionally have it show grades from the same sheet.
editUrl: true
head: []
template: doc
sidebar:
  hidden: false
  attrs: {}
pagefind: true
draft: false
---

[modernGraphTool (mGT)](https://potatosalad775.github.io/modernGraphTool/docs) has a `RANKING` section in its `config.js` that does two independent things. Most deploys only need the first:

1. **Link the review score to its card.** The score already in your `phone_book.json` becomes a link into this page. One config value, nothing fetched. Works with any ranking page or spreadsheet, not just this one.
2. **Show grades from your sheet.** mGT reads your `ranking-config.js` and displays each device's grade from the same spreadsheet this page uses, as the same colored badge. The sheet becomes the single place grades live — edit a grade once and both the ranking page and the device list follow.

**Operators only edit mGT's `defaults/config.js`.** No component edits. Part 1 needs mGT v2.1.0 or later; part 2 needs v2.2.0 or later.

The full option list lives in [mGT's `RANKING` reference](https://potatosalad775.github.io/modernGraphTool/docs/guide-for-admins/customize-page/#ranking). This page covers what matters from the ranking side.

---

## 1. Link the review score to its card

```js
RANKING: {
    URL: '/ranking/?type={type}#{slug}',
    TYPE: 'earphone',
},
```

The score on an expanded device row becomes a link that opens this page on that device's card. `URL` is a template; mGT fills these in per device:

| placeholder  | expands to                                     |
|--------------|------------------------------------------------|
| `{type}`     | the `TYPE` value                               |
| `{brand}`    | URL-encoded brand                              |
| `{model}`    | URL-encoded model                              |
| `{slug}`     | `{brand}-{model}` lowercased, whitespace → `-` |
| `{fullName}` | URL-encoded `'{brand} {model}'`                |

A template with **no** placeholders is used verbatim — for pointing every score at one raw Google Sheet or Notion page.

:::note[Set `TYPE` on a headphone deploy]
`phone_book.json` records no device type, so mGT cannot tell an earphone database from a headphone one. `{type}` is whatever you set in `TYPE`, and it defaults to `earphone`. A headphone deploy needs `TYPE: 'headphone'` — or whichever key your `types` uses.
:::

### Example values

```js
// This page, deployed beside the graph tool:
RANKING: { URL: '/ranking/?type={type}#{slug}', TYPE: 'earphone' },

// This page on another host:
RANKING: { URL: 'https://reviews.example.com/?type={type}#{slug}', TYPE: 'headphone' },

// A raw Google Sheet, no per-device anchoring:
RANKING: { URL: 'https://docs.google.com/spreadsheets/.../pubhtml' },

// Unset (mGT default) — the score stays plain text.
```

:::note[Older deploys: `RANKING_URL`]
Before v2.2.0 this was a flat `RANKING_URL` key. It still works, and is read whenever `RANKING.URL` is absent. It has no `TYPE`, so there `{type}` is always `earphone`.
:::

---

## 2. Show grades from your sheet

Add `CONFIG_URL`, pointing at the `ranking-config.js` this page loads:

```js
RANKING: {
    URL: '/ranking/?type={type}#{slug}',
    TYPE: 'earphone',
    CONFIG_URL: '/ranking/ranking-config.js',
},
```

mGT loads that file the same way this page does, picks the type named by `TYPE`, fetches its sheet, and matches rows to devices by brand and model. A matched device shows its grade from the sheet, drawn with your `scale` — same label, same color, same text color as the badge on its card here.

### What mGT reads from your config

Only these, and nothing else:

- `types[TYPE].source.url` — the sheet
- `types[TYPE].rowFilter` — so a sheet shared between types stays split
- the `role: 'rank'` column's `source` and `scale`
- the `role: 'brand'` and `role: 'model'` columns' `source`
- `deepLink` — so links land on the anchor this page actually gives each card

Everything else — columns, renderers, chrome, languages, stats — is ignored, so you can keep changing this page freely. Removing `role: 'rank'` from your rank column, or renaming the keys above, is the one thing that silently stops mGT showing grades.

### How rows are matched

A sheet row and a phone book entry are the same device when their brand and model are equal after case, spacing and punctuation are ignored — `True-Ear` / `Projekt.Wen` matches `TrueEar` / `Projekt Wen`.

That is **stricter than this page's own measurement links**, on purpose. Here, a loose match that picks the wrong measurement is obvious the moment it is clicked. In mGT, a loose match would put someone else's grade on a device and nothing would look wrong, so mGT would rather show no grade than a wrong one. Operators who prefer more matches can set `MATCH: 'loose'` on the mGT side.

The easy way to make names line up is to not type them: start your sheet from the [phone book converter](/phonebook-converter/), which copies `Brand` and `Model` straight out of the same `phone_book.json` mGT reads.

### What the device list shows

| The sheet has…                     | mGT shows                              |
|------------------------------------|----------------------------------------|
| a row with a grade                 | that grade, as your scale's badge      |
| a row with a blank `Rank` cell     | the phone book's `reviewScore`, if any |
| no matching row                    | the phone book's `reviewScore`, if any |
| nothing, because it failed to load | the phone book's `reviewScore`, if any |

Turning this on can only add grades, never hide ones mGT already showed. A sheet that fails to load leaves the device list exactly as it was, and logs the reason to the browser console.

When a row matched, the link to this page is built from the **sheet's** spelling of the device, not the phone book's, so it lands on the card that exists even where the two files disagree.

### How quickly edits appear

mGT re-reads the sheet when a visitor opens the device list after its cache has expired — 15 minutes by default, set with `CACHE_TTL` on the mGT side. Google also caches a published sheet for a few minutes on its own, so allow for both. No redeploy of either site is needed.

---

## Verify

1. **Link.** Set `URL` and `TYPE`. Load a device in mGT that has a review score, and click the score. This page opens on that device's card.
2. **Grades.** Add `CONFIG_URL`. Reload mGT and load a device your sheet ranks. Its badge matches the one on its card here — label and color.
3. **Edits flow through.** Change that device's grade in the sheet. After the cache window, reopen mGT's device list: the new grade shows.
4. **Nothing in the console.** A `Ranking sheet could not be loaded` or `RANKING.TYPE ... is not one of the ranking config's types` warning means one of the gotchas below.

---

## Common gotchas

- **`TYPE` does not name one of your types.** With more than one entry in `types`, mGT refuses to guess — a headphone site showing earphone grades would be worse than none — and falls back to phone book scores. A config with a single type needs no `TYPE`.
- **A relative `source.url`.** mGT fetches the sheet from its own page, not from `/ranking/`, so `source.url: 'ranks.csv'` resolves to the wrong folder there. Published Google Sheet URLs are absolute and unaffected; for a self-hosted CSV use a root-relative (`/ranking/ranks.csv`) or absolute URL. `phonebook` and `measurementUrl` are not read by mGT, so their relative paths are fine.
- **A CSV on another domain.** The config loads as a script and needs nothing, but the sheet is fetched, so a self-hosted CSV on a different host must be served with CORS headers. Google Sheets already is.
- **A grade missing from `scale`.** mGT still shows it, as plain text rather than a badge — the same value this page would sink as unranked. Add it to the scale.
- **A numeric scale replaces stars.** An mGT deploy that drew `reviewScore: 4` as ★★★★☆ draws a badge once your scale defines `4`. `DISPLAY: 'stars'` on the mGT side keeps the stars.
- **Same-tab vs new-tab.** mGT opens the link in a new tab. Changing that is an upstream component preference, not a config value.
- **Hash-only navigation.** If the link only changes the `#hash` on an already-open ranking page, the browser scrolls without reloading. This page listens for `hashchange` and handles it.
- **No ranking page at all?** mGT can read any published CSV directly with `RANKING.SOURCE`, declaring the columns and scale inline. See [mGT's `RANKING` reference](https://potatosalad775.github.io/modernGraphTool/docs/guide-for-admins/customize-page/#ranking).
- **CrinGraph parallel.** CrinGraph has the link half only, as `ranking_url` in its `config.js`, with the same placeholders. See [the CrinGraph guide](/integration/cringraph/).