/**
 * Two link fixes that have to happen after the Markdown pipeline, because
 * neither link is in the Markdown: one lives in frontmatter, the other is built
 * by Starlight from the sidebar config.
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';
// @ts-expect-error - plain .mjs plugin, no type declarations
import { resolveUrl } from './plugins/docs-links.mjs';
import { UNLOCALIZED_LINKS } from './sidebar.ts';

const CONTENT_ROOT = 'src/content/docs/';

/**
 * Drops the locale segment Starlight adds to a link to one of the two browser
 * tools. They are Astro pages rather than content entries, so each is built once
 * and `/ko/config-editor/` never exists — see `UNLOCALIZED_LINKS`.
 */
function unlocalize(link: { href: string } | undefined, base: string) {
	if (!link) return;
	const target = UNLOCALIZED_LINKS.find((href) => link.href.endsWith(href));
	if (target) link.href = `${base}${target}`;
}

/** Every sidebar entry, groups walked through. */
function unlocalizeSidebar(items: StarlightRouteData['sidebar'], base: string) {
	for (const item of items) {
		if (item.type === 'group') unlocalizeSidebar(item.entries, base);
		else unlocalize(item, base);
	}
}

/**
 * Base-resolves the landing page's hero action links.
 *
 * `docs-links` handles every other authored link, but it cannot reach these:
 * `hero.actions[].link` is frontmatter, which the content layer validates and
 * stores before the Markdown pipeline runs, and Starlight reads it back off
 * `entry.data` rather than from the rendered file.
 *
 * Left alone, `link: /setup/quick-start/` reaches the browser verbatim and lands
 * outside the site's base. It is the primary call to action on the landing page,
 * so it is worth a hook rather than a hardcoded base in content.
 */
function resolveHeroActions(entry: StarlightRouteData['entry'], base: string) {
	const actions = entry?.data?.hero?.actions;
	if (!actions?.length) return;

	/*
	 * Derived from `filePath`, not `id`: a trailing `/index` is collapsed, so the
	 * root landing page has the id `""` — which a dirname cannot be taken from.
	 * `filePath` is the same string the Markdown plugin sees, so both resolve
	 * relative links identically.
	 */
	const filePath: string = entry.filePath ?? '';
	const idx = filePath.indexOf(CONTENT_ROOT);
	if (idx === -1) return;
	const rel = filePath.slice(idx + CONTENT_ROOT.length);
	const selfDir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '.';

	for (const action of actions) {
		const next = resolveUrl(action.link, selfDir, base, true);
		if (next !== undefined) action.link = next;
	}
}

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	if (!route) return;

	const base = import.meta.env.BASE_URL.replace(/\/$/, '');

	if (route.sidebar) unlocalizeSidebar(route.sidebar, base);
	// The footer's prev/next are derived from the sidebar but held separately, so
	// they need the same treatment.
	unlocalize(route.pagination?.prev, base);
	unlocalize(route.pagination?.next, base);
	resolveHeroActions(route.entry, base);
});
