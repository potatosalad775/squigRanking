---
title: How a scale works
description: "One ordered list defines a rank: the dropdown, the sort order, the
  badge colors, the chart, and what each grade is worth."
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

A rank used to be spread across four separate lists that had to stay lined up by hand. It is now one list, best first.

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

From that list the page derives all five of:

- the options in the rank dropdown
- the sort order, since the list is best first
- each badge's background color
- the bars in the rank distribution chart
- the score each grade is worth

Adding a grade is one line. Recoloring one is one word.

## What goes in a step

| Key         | Effect                                                                |
|-------------|------------------------------------------------------------------------|
| `value`     | The cell value exactly as written in your sheet                         |
| `score`     | What the grade is worth. Feeds the score sort and the average readout   |
| `color`     | The badge background, and this step's bar in the chart                  |
| `textColor` | The badge text. Defaults to white or near-black, whichever is readable  |
| `label`     | Display text for the badge and dropdown. Defaults to `value`            |
| `class`     | An extra CSS class, if a flat color is not enough                       |

Only `value` is required. A scale of bare values still gives you a dropdown and a sort order.

## The Score column becomes optional

When a row has no numeric Score cell, its score is whatever its grade is worth. A sheet holding only `Brand`, `Model` and `Rank` still sorts by score and still shows an average.

That is why the star and score presets ship without a Score column at all. On those, the Rank cell is the number.

## Numeric scales tolerate values in between

If every step in a scale is a number, a value that falls between two steps snaps to the nearer one for the chart and the sort order, while keeping its own value everywhere it is shown or averaged.

So on a `10` down to `0` scale, a device rated `8.6`:

- counts in the `9` bar of the distribution chart
- displays as `8.6` on its badge
- averages as `8.6`, not as `9`

Letter scales never snap. An unknown grade stays unranked and sinks, so a typo is visible.

## Three badge styles

```js
render: { kind: 'rank-badge' }                                    // colored grade badge
render: { kind: 'stars', max: 5 }                                 // 4.5 draws four and a half
render: { kind: 'score-badge', min: 0, max: 10, decimals: 1 }     // colored number pill
```

`stars` clips a row of star icons to a percentage, so any fraction works without half-star artwork.

`score-badge` interpolates its color along a ramp between `min` and `max`. A 0-to-100 scale therefore needs no per-value color list: give it two or three stops and every value in between gets a color.

## Older configs

A config written before scales existed keeps working with no edits. If a rank column has no `scale`, one is built from its `filter.values`, which preserves the order, the dropdown and the chart.

`render.classMap` also still takes precedence over a scale color, so if you style badges from your own stylesheet you lose nothing by upgrading.

The reverse is not true. A `core.js` older than the config it reads cannot understand a scale, and says so in the browser console rather than failing quietly. If you add a scale, update `core.js` at the same time.