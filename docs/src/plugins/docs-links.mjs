/**
 * Resolves in-repo documentation links at build time.
 *
 * The site is served from a subpath (`/squigRanking/docs`), so a link authored
 * as `/llms.txt` reaches the browser verbatim and 404s — it is site-absolute,
 * and the site does not start at `/`. Astro adds `base` to asset URLs and to
 * Starlight's own navigation, but not to links written inside content.
 *
 * Handling it here rather than writing `/squigRanking/docs/...` into every page
 * keeps the base in exactly one place — `astro.config.mjs` — and keeps the
 * authored links short.
 *
 * Four shapes are rewritten:
 *   `[x](/llms.txt)`            -> `<base>/llms.txt`        (root-absolute file)
 *   `[x](/ranks/choosing/)`     -> `<base>/ranks/choosing/` (root-absolute route)
 *   `[x](./scale.md#a)`         -> `<base>/ranks/scale/#a`  (relative, per file)
 *   `<LinkCard href="./foo/">`  -> `<base>/ranks/foo/`      (JSX attribute)
 *
 * The relative cases matter because **a relative href that reaches the browser
 * is resolved against the current URL, so where it lands depends on whether the
 * page was served with a trailing slash**. Starlight's `<LinkCard>` and `<Card>`
 * emit `href` untouched, so nothing downstream fixes it. Resolving here removes
 * the dependency on the trailing slash entirely.
 *
 * A link already written with the base is left alone, as is anything external,
 * protocol-relative, a bare `#anchor`, or a non-Markdown asset (images).
 *
 * The hero's `actions[].link` has the same problem but cannot be fixed here: it
 * lives in frontmatter, which the content layer validates and stores before the
 * Markdown pipeline runs, and Starlight reads it back off `entry.data`. That one
 * is handled in `src/routeData.ts`, which reuses `resolveUrl` below.
 *
 * This is a Satteri mdast plugin, not a remark one: Satteri is Astro's default
 * Markdown processor, and `markdown.remarkPlugins` now requires installing the
 * old unified pipeline alongside it. The visitor API differs — nodes are
 * read-only and edits go through `ctx.setProperty` — but the tree is the same
 * mdast, so `resolveUrl` is unaware of which pipeline called it.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTENT_ROOT = 'src/content/docs';
const MARKDOWN = /\.mdx?$/;

/** Split `foo.md#bar` into its path and its `#bar` suffix. */
function splitHash(url) {
	const i = url.indexOf('#');
	return i === -1 ? [url, ''] : [url.slice(0, i), url.slice(i)];
}

/** `setup/index` -> `setup`; root `index` -> ''. */
function toRoute(slug) {
	return slug.replace(/\/index$/, '').replace(/^index$/, '');
}

function isExternal(url) {
	return !url || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//') || url.startsWith('#');
}

/**
 * @param {string} url      the authored link
 * @param {string} selfDir  directory of the page, relative to the content root
 * @param {string} base     deployment base path, without a trailing slash
 * @param {boolean} asRoute Markdown links name a source file (`./foo.md`); JSX
 *   hrefs already name a route (`./foo/`). Only the former needs an extension
 *   stripped, and only the former should skip non-Markdown targets so images
 *   pass through untouched.
 * @returns {string | undefined} the rewritten URL, or undefined to leave it be
 */
function resolveUrl(url, selfDir, base, asRoute) {
	if (isExternal(url)) return;

	const [target, hash] = splitHash(url);

	if (target.startsWith('/')) {
		// Site-internal absolute link authored without the deployment base.
		if (base && target !== base && !target.startsWith(`${base}/`)) {
			// A target that names a file (`/llms.txt`, `/index.md`) is served at
			// exactly that path. Astro's trailing slash belongs on routes only —
			// appending it here produces `/llms.txt/`, which 404s.
			const suffix = path.posix.extname(target) ? '' : '/';
			return `${base}${target.replace(/\/$/, '')}${suffix}${hash}`;
		}
		return;
	}

	if (!asRoute && !MARKDOWN.test(target)) return; // images and other assets

	const resolved = path.posix
		.normalize(path.posix.join(selfDir === '.' ? '' : selfDir, target))
		.replace(MARKDOWN, '')
		.replace(/\/$/, '');
	const route = toRoute(resolved);
	return `${base}/${route}${route ? '/' : ''}${hash}`;
}

/** Directory of the document being compiled, relative to the content root, or
 *  undefined when the document is not a content-collection page. */
function selfDirOf(fileURL) {
	if (!fileURL) return;
	const filePath = fileURLToPath(fileURL).replace(/\\/g, '/');
	const idx = filePath.indexOf(CONTENT_ROOT);
	if (idx === -1) return;
	return path.posix.dirname(filePath.slice(idx + CONTENT_ROOT.length + 1));
}

/**
 * @param {{ base?: string }} options
 * @returns a Satteri mdast plugin entry for `satteri({ mdastPlugins: [...] })`
 */
export default function docsLinksPlugin({ base = '' } = {}) {
	// A factory entry: Satteri calls this once per document, and returning a
	// falsy value leaves the plugin out of that document's pipeline entirely.
	return (ctx) => {
		const selfDir = selfDirOf(ctx.fileURL);
		if (selfDir === undefined) return null;

		/** `<LinkCard href="./foo/">` and friends. An attribute whose value is an
		 *  MDX expression rather than a plain string has a non-string `value` and
		 *  is left alone — the author is computing the URL themselves. */
		const visitJsx = (node, context) => {
			const attributes = node.attributes ?? [];
			let changed = false;
			const next = attributes.map((attr) => {
				if (attr.type !== 'mdxJsxAttribute' || attr.name !== 'href') return attr;
				if (typeof attr.value !== 'string') return attr;
				const value = resolveUrl(attr.value, selfDir, base, true);
				if (value === undefined) return attr;
				changed = true;
				return { ...attr, value };
			});
			if (changed) context.setProperty(node, 'attributes', next);
		};

		return {
			name: 'docs-links',
			link(node, context) {
				const url = resolveUrl(node.url, selfDir, base, false);
				if (url !== undefined) context.setProperty(node, 'url', url);
			},
			mdxJsxFlowElement: visitJsx,
			mdxJsxTextElement: visitJsx,
		};
	};
}

export { resolveUrl };
