// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import svelte from '@astrojs/svelte';
import { sidebar } from './src/sidebar.ts';

const SITE = 'https://potatosalad775.github.io';
// GitHub Pages serves this repo from a subpath and Astro does not derive `base`
// from `site`. Without this, every internal link resolves one level too high.
// The live demo page sits at the repo root; the docs sit under /docs.
const BASE = '/squigRanking/docs';

export default defineConfig({
	site: SITE,
	base: BASE,
	integrations: [
		// Only the config editor route hydrates; every other page ships zero JS.
		svelte(),
		starlight({
			title: { en: 'squigRanking', ko: 'squigRanking' },
			description: 'A static, config-driven ranking page for CrinGraph and modernGraphTool squigs.',
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				ko: { label: '한국어', lang: 'ko' },
			},
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/potatosalad775/squigRanking',
				},
			],
			editLink: {
				baseUrl: 'https://github.com/potatosalad775/squigRanking/edit/main/docs/',
			},
			customCss: ['./src/styles/custom.css'],
			sidebar,
		}),
	],
});
