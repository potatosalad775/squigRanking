---
title: Choosing a rank style
description: Letter grades, five stars or a numeric score. What each looks like,
  what goes in the Rank cell, and how to switch.
editUrl: true
head: []
template: doc
sidebar:
  order: 1
  hidden: false
  attrs: {}
pagefind: true
draft: false
---

Three rank styles ship ready to use. Each one is a pair of files: a `ranking-config.js` and a `TEMPLATE.csv` whose Rank column already matches.

| Style           | Rank cell holds | Badge                          | Good when                                          |
|-----------------|-----------------|--------------------------------|----------------------------------------------------|
| Letter grades   | `S` … `F`       | A colored grade badge          | You think in tiers and want the tiers named        |
| Five stars      | `0.5` … `5`     | A row of stars, halves shown   | Readers should grasp a rating without a legend     |
| Numeric score   | `0` … `10`      | A colored number pill          | You want fine distinctions between close devices   |

Letter grades are the default because a named tier is easier to defend than a number. "This is a B+" invites less argument than "this is a 7.4".

## Switching

Copy the pair you want from `presets/` over the two files at the root of your deploy:

```bash
cp presets/stars/ranking-config.js ranking-config.js
cp presets/stars/TEMPLATE.csv TEMPLATE.csv
```

Then put your sheet URL back into the new config, because each preset ships pointing at the demo sheet.

Each preset also has a `TEMPLATE.xlsx` next to its CSV, with the rank dropdown, the guide and the chart already set to that scale.

If you already have rows written against a different scale, translate the Rank column too. A value that is not on the scale shows no badge and sinks to the bottom of the list, which is deliberate: a typo should be visible rather than silently sorted somewhere plausible.

## Half steps and decimals

The star preset uses half steps, from `0.5` to `5`. The badge draws them by clipping a row of stars, so a rating of `4.5` shows four full stars and one half.

The score preset lists whole numbers `0` to `10`, but your sheet may hold decimals. A value of `8.6` counts in the `9` bar of the chart, displays as `8.6`, and averages as `8.6`. You do not have to list every decimal you might use.

This only applies to numeric scales. A letter scale never guesses: `A-` on an S-through-F scale stays unranked.

## Building your own

None of the three is special. Each is just a `scale` list in the config, and you can edit one or write your own from scratch. [How a scale works](/ranks/scale/) covers the mechanics, and the [config editor](/config-editor/) has a scale builder that previews the badges as you type.