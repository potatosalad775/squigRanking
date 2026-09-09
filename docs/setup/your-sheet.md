---
title: Filling in your sheet
description: What each column in the spreadsheet does, how line breaks and
  translations work, and how to add a column of your own.
editUrl: true
head: []
template: doc
sidebar:
  order: 2
  hidden: false
  attrs: {}
pagefind: true
draft: false
---

Each part of a review lives in its own column. There is no markup to learn and no ordering rule to remember, because the config decides the order and a blank cell renders nothing.

## The columns

| Column           | Renders as                                              |
|------------------|---------------------------------------------------------|
| `Brand`, `Model` | The card heading                                         |
| `Rank`           | The colored badge, ordered by your rank scale            |
| `Score`          | The average readout and the score sort. Optional         |
| `Driver`, `Style` | Small chips in the meta row                             |
| `Comment`        | The main paragraph                                       |
| `Pros`           | A green block                                            |
| `Cons`           | A red block                                              |
| `Notes`          | A muted block, for caveats and measurement remarks       |
| `Tags`           | Comma-separated pills, which are also searchable         |

`Score` is optional because a rank scale can say what each grade is worth. A sheet with only `Brand`, `Model` and `Rank` still sorts by score and still shows an average. See [How a scale works](/ranks/scale/).

## Starting from your phone book

`Brand` and `Model` are exactly what your measurement site already lists. Rather than retyping a few hundred of them, feed your `phone_book.json` to the [phone book converter](/phonebook-converter/): it reads both the CrinGraph and the modernGraphTool dialect, lets you uncheck what you do not want ranked, and hands back rows with the same header as the template above. If your phone book already carries `reviewScore` values, it can seed the `Rank` column from them too.

## What is in the workbook

If you started from the spreadsheet template rather than a bare CSV, it has three tabs.

**List** is where you type. The header row is frozen, the Rank column is a dropdown so you cannot invent a grade by accident, and each grade colors its own cell the way it will look on the page.

**Guide** holds the scale: every grade, what it is worth, and its color. The Score column and the Stats tab both read this table, so adding a grade here adds it everywhere in the workbook at once. Below the table is a description of each column and the publishing steps, so the sheet explains itself without this page open.

**Stats** counts your devices per grade, works out the average, and charts it. Nothing to maintain; the formulas cover a thousand rows.

Adding a grade to the sheet does not add it to the page. The `scale` in your config is what the page reads, so change both. The [config editor](/config-editor/) is the easy way to keep them lined up.

## Line breaks are preserved

Put each bullet on its own line inside the cell. In Google Sheets that is **Alt+Enter** (**Option+Enter** on a Mac). The page renders those breaks exactly as you typed them, so a Pros cell reading

```
Even tonality
Excellent detail retrieval
```

becomes two lines in the green block, not one run-on sentence.

## Writing in more than one language

Translations live in parallel columns, and the config is what ties a header to a language. Nothing about `_KR` is built into the page — it is only the name the template happens to use. The `Comment` column in a bilingual config reads:

```js
{
	id: 'comment',
	source: 'Comment',
	i18nSource: { en: 'Comment', ko: 'Comment_KR' },
	label: { default: 'Comment', i18n: { ko: '코멘트' } },
	render: { kind: 'block' },
}
```

`i18nSource` maps each language to the header it reads; `label` translates the heading drawn above it. The template wires that up for `Comment`, `Pros`, `Cons` and `Notes`, which is where those four `_KR` columns come from.

A blank translated cell falls back to `source`, the language-neutral header, per row and per column. A half-translated sheet degrades one cell at a time instead of showing gaps.

### Using another language

The [config editor](/config-editor/) has a language step. Give it a tag, a name and a column suffix — `ja`, Japanese, `_JA` — and it writes the four pieces a language needs:

- `languages: { en: 'English', ja: 'Japanese' }`, which is the order the toggle cycles through;
- an `i18nSource` entry per translated column, pointing at `Comment_JA` and its siblings;
- your own wording — the page title, the footer note, every column and tab and sort option — with the English text beside each box, so you can see what you are translating;
- the interface strings, the buttons and labels the page writes itself.

Korean is the one language it knows the words for, so it arrives already filled in. Everything else starts empty, and every box you leave empty falls back to English. Its header row grows to match, so the sheet it hands you already has the columns for each language you added.

It asks for both a tag and a name because they do different jobs. The tag is what the page matches against the reader's browser, so `ja` and not `Japanese`. The name is what the language button calls that language: the tooltip names the language it switches to, and the page builds that sentence out of these names rather than guessing. Word it yourself in the interface strings if you would rather it read in the language itself.

Readers land on their stored choice if they have one, then on a match for their browser's language, then on the first entry in `languages`. Removing every language leaves an English-only page, and the toggle disappears along with it, since there is nothing to switch to. [`languages` and `i18n`](/config/reference/#languages-and-i18n) has the whole surface for editing the file by hand.

## Header names are wired in the config

The page finds columns by the header names listed in `ranking-config.js`. Rename a header in your sheet only, and that column goes blank. Rename it in both places, and everything keeps working.

The exception is anything with a `role`. Core finds the brand, model, rank and score columns by role, never by name, so you can call the brand column `Maker` as long as the role stays put.

## Adding a column

Say you want a price column.

1. Add a `Price` header to your sheet and fill it in.
2. Add one entry to `columns` in your config:

```js
{
	id: 'price',
	source: 'Price',
	label: { default: 'Price', i18n: { ko: '가격' } },
	filter: { kind: 'text' },
	render: { kind: 'meta-chip' },
}
```

3. Reload.

No core changes, no build step. The [configuration reference](/config/reference/) lists every renderer and filter kind you can use there.

## Keeping one sheet for two device types

If earphones and headphones share a sheet, add a column that says which is which and filter on it per type:

```js
types: {
	earphone: {
		// ...
		rowFilter: { field: 'Type', values: ['IEM', 'Earbud'] },
	},
},
```

Rows that do not match are dropped for that type. The alternative is two sheets and two URLs, which is simpler if the lists have little in common.