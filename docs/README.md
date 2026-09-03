# squigRanking docs

The documentation site, built with [Astro](https://astro.build/) and
[Starlight](https://starlight.astro.build/). It also hosts the config editor,
the only part of the site that ships JavaScript.

```bash
npm install
npm run dev      # http://localhost:4321/squigRanking/docs/
npm run build    # writes dist/
```

## Layout

```
src/
├── content/docs/            The pages. Plain Markdown, one folder per section.
├── components/config-editor/  The Svelte island behind /config-editor/
├── pages/config-editor.astro  Its route
├── sidebar.ts               Section order, written out rather than generated
└── styles/custom.css        Tokens the editor borrows from Starlight's palette
```

## The config editor

`form.ts` holds the form model and the presets, `generate.ts` turns it into
`ranking-config.js` text, and `parse.ts` reads an existing file back. All three
are plain TypeScript with no DOM, which is why the root package's
`test/editor.test.ts` can import them directly and assert that what the editor
generates is something `core.js` actually reads. Run that suite after changing
any of them:

```bash
cd .. && npm test
```

`form.ts` duplicates the color math from `src/color.ts` so this site builds
without the root package. A test asserts the two agree.
