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
├── llms-txt.config.ts       starlight-llms-txt options, imported by astro.config.mjs
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

## Machine-readable output

Two Starlight plugins publish the docs in a form an agent can read. Both write into
`dist/` only — **nothing under `dist/` is a source file.** Never edit one, and never cite
`dist/**.md` as the content; the sources are `src/content/docs/**`.

- **`starlight-dot-md`** — appending `.md` to any page URL serves its raw Markdown. No
  configuration and no index: it only answers a request you already knew to make.
- **`starlight-llms-txt`** — the discovery layer, configured in `src/llms-txt.config.ts`.
  Writes `llms.txt` (the index), `llms-small.txt` and `llms-full.txt`.

The deploy workflow copies `docs/dist/*` as-is, so all of this ships with the site;
nothing needs adding there when the config changes.

Two things about that config are worth knowing:

- **`promote` lists nearly every page.** Unpromoted pages come out ordered by slug, which
  splits the three setup pages apart and leaves *Deploying* after the configuration
  reference. The list restores the sidebar's reading order. `integration/**` is left out of
  it because it trails correctly on its own.
- **Do not set `rawContent: true`.** It bypasses the HTML pipeline, so `customSelectors`
  stops applying and every heading regains the "Section titled …" anchor link Starlight
  renders beside it. It is only needed for content built from framework components, and
  the docs collection has none — the Svelte islands live in `src/pages/`, outside it.

`exclude` and `demote` are unset. The corpus is nine pages, so `llms-full.txt` is small
enough to read end to end and there is no superseded section to steer around. If a frozen
or deprecated section is ever added, note that `exclude` filters `llms-small.txt` only —
`llms-full.txt` is the complete corpus by definition, and `demote` is what keeps a page
out of the way there.
