# squigRanking

A static, config-driven ranking page for CrinGraph and modernGraphTool squig deployments. 

Your reviews live in a spreadsheet; the page reads it and renders filterable, sortable, deep-linkable cards with rank badges and review notes.

**[Documentation](https://potatosalad775.github.io/squigRanking/docs/)** · **[Quick start](https://potatosalad775.github.io/squigRanking/docs/setup/quick-start/)** · **[Config editor](https://potatosalad775.github.io/squigRanking/docs/config-editor/)** · **[Phone book converter](https://potatosalad775.github.io/squigRanking/docs/phonebook-converter/)** · **[Live demo](https://potatosalad775.github.io/squigRanking/)**

This project is built upon the [Earphones Archive Ranking](https://earphonesarchive.squig.link/ranking) page. 

It is now a standalone project, with a more flexible config and a more robust build.

---

## Using it

Download the latest release, copy `index.html` and `ranking-config.js` into a `ranking/` folder next to your measurement site, and point the config at your published sheet. That is the whole deployment: no build step on the server, nothing to install, and the page pulls its own updates. [Self-hosting](https://potatosalad775.github.io/squigRanking/docs/setup/deploying/#self-hosting-the-build) the script and stylesheet is three more files and no CDN.

The **[quick start](https://potatosalad775.github.io/squigRanking/docs/setup/quick-start/)** walks through it in about fifteen minutes, including publishing a Google Sheet as CSV. The **[config editor](https://potatosalad775.github.io/squigRanking/docs/config-editor/)** builds the config file from a form if you would rather not edit code.

Three rank styles ship ready to use, and the [comparison page](https://potatosalad775.github.io/squigRanking/docs/ranks/choosing/) helps pick one:

| Preset | Rank cell holds | Badge |
|--------|-----------------|-------|
| [`letter`](presets/letter/) *(default)* | `S` … `F` | a colored grade badge |
| [`stars`](presets/stars/) | `0.5` … `5` | a row of stars, halves shown |
| [`score`](presets/score/) | `0` … `10` | a colored number pill |

Grades, their colors, their order and what each is worth all live in one `scale` list, so changing a scale is one edit. See [how a scale works](https://potatosalad775.github.io/squigRanking/docs/ranks/scale/).

---

## Development

```bash
npm install
npm run check      # typecheck, then tests, then build
npm run build      # bundles src/ into dist/ and assembles the deploy folder
npm test           # unit tests plus a jsdom pass over the built bundle
```

The source is TypeScript, bundled by [rolldown](https://rolldown.rs/) into one plain IIFE. Nothing at runtime needs a module loader.

## License

MIT License. See [LICENSE](LICENSE) for details.