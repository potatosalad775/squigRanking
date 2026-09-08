---
title: 'Quick start'
description: 'Get a ranking page live in about fifteen minutes, from copying the spreadsheet template to uploading four files.'
sidebar:
  order: 1
---

Five steps. The only thing you write is your own reviews.

## 1. Copy the spreadsheet template

Open the [template spreadsheet](https://docs.google.com/spreadsheets/d/1YIXLswsOCEt-p0UWrP9_64n-xl5qC_fV-s0MThXeEDk/edit?usp=sharing) and use **File → Make a copy** to put it in your own Drive.

The copy is yours. Delete the example rows and start typing your own, or keep them while you get the page working and clear them later.

:::tip
Already have a measurement site? The [phone book converter](/squigRanking/docs/phonebook-converter/) reads its `phone_book.json` and hands you a `Brand` and `Model` row for every device you have measured, so the only thing left to type is the review.
:::

## 2. Publish it as CSV

The page reads a published CSV link, not the spreadsheet itself. In your copy:

1. **File → Share → Publish to web**
2. In the **Link** tab, set the left dropdown to your sheet (**List**) and the right one to **Comma-separated values (.csv)**
3. Click **Publish** and copy the URL it gives you

That URL ends in `output=csv`. Keep it; step 4 needs it.

:::note
Publishing to web makes the sheet's contents readable by anyone with the link. That is the point, since the page has to fetch it from a browser. It does not give anyone edit access.
:::

## 3. Download the page

Grab the latest release and unzip it. You need four files:

```
index.html
style.css
core.js
ranking-config.js
```

## 4. Point the config at your sheet

Open `ranking-config.js` in any text editor. Near the top you will find two `url` lines. Replace both with the URL you copied in step 2.

```js
source: {
	kind: 'csv',
	url: 'https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv',
},
```

There are two because the page supports separate earphone and headphone lists. Using the same URL for both is fine if you keep everything in one sheet.

While you are in there, set the header title and the footer note, a little further down:

```js
chrome: {
	title: 'My Rankings',
	footer: {
		note: 'Rankings reflect my own listening.',
	},
},
```

`index.html` carries no wording of its own, so this is the only place it lives. See [`chrome`](/squigRanking/docs/config/reference/#chrome) for the header links and the rest of the options.

:::tip
Prefer not to edit code at all? The [config editor](/squigRanking/docs/config-editor/) builds this file from a form and hands you the finished text.
:::

## 5. Upload

Put the four files in a `ranking/` folder next to your existing measurement site:

```
your-squig-site/
├── index.html            ← your CrinGraph or modernGraphTool page
├── data/phone_book.json
└── ranking/              ← the four files go here
```

Open `your-site.com/ranking/` and the page should list your devices.

## It loaded, but the list is empty

Almost always the CSV link. Open the URL from step 2 directly in a browser tab: it should download or display raw comma-separated text. If it shows a spreadsheet interface instead, the **Publish to web** step picked the sharing link rather than the CSV one.

## Next

- [Filling in your sheet](/squigRanking/docs/setup/your-sheet/) covers what each column does.
- [Choosing a rank style](/squigRanking/docs/ranks/choosing/) if letter grades are not what you want.
- [Linking from your graph tool](/squigRanking/docs/integration/cringraph/) so review scores become clickable.
