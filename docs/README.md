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
├── plugins/docs-links.mjs   Resolves content links against the deployment base
├── routeData.ts             The same, for links Starlight builds rather than parses
├── sidebar.ts               Section order, written out rather than generated
├── llms-txt.config.ts       starlight-llms-txt options, imported by astro.config.mjs
└── styles/custom.css        Tokens the editor borrows from Starlight's palette

scripts/check-links.mjs      Post-build check that every internal link resolves
```

## Links and the deployment base

The site is served from `/squigRanking/docs`, not from `/`. Astro puts that base
on its own asset URLs and on Starlight's navigation, but not on anything written
inside a page — so `[llms.txt](/llms.txt)` renders fine, reads correctly in the
source, and 404s in production. A relative link is worse: the browser resolves it
against the current URL, so where it lands depends on whether the page was served
with a trailing slash.

**Author internal links without the base**, either site-absolute
(`/ranks/scale/`, `/llms.txt`) or relative to the file (`./scale.md#steps`).
Three pieces put the base back, and `BASE` in `astro.config.mjs` stays the only
place the subpath is written down:

| | |
|---|---|
| `src/plugins/docs-links.mjs` | Every link in a page body — Markdown links and JSX `href` attributes alike. A Sätteri mdast plugin rather than a remark one, because Sätteri is Astro's default Markdown processor now. |
| `src/routeData.ts` | The two links the plugin cannot see. The landing page's `hero.actions[].link` is frontmatter, read off `entry.data` long after the Markdown pipeline runs. The sidebar and prev/next links to `/config-editor/` and `/phonebook-converter/` are built by Starlight, which localizes them into `/ko/…` — but those two are Astro pages with no per-locale build, so the locale is stripped back off. |
| `scripts/check-links.mjs` | Proves the other two reached everything. Runs as part of `npm run build`, so CI already covers it. |

The checker fails the build on an internal link that is not absolute under the
base, and on a base-absolute link with no built page behind it — a mistyped
sidebar `slug`, or a page that was renamed. Nothing in `src/content/` should
spell `/squigRanking/docs` out; a link to somewhere else on the same GitHub Pages
site (the demo page at the repo root) needs its full `https://` URL, since the
build has no way to check it.

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
