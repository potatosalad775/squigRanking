import type starlightLlmsTxt from 'starlight-llms-txt';

type LlmsTxtOptions = Parameters<typeof starlightLlmsTxt>[0];

export const llmsTxtConfig: LlmsTxtOptions = {
	projectName: 'squigRanking',
	description:
		'A static, config-driven ranking page for CrinGraph and modernGraphTool measurement ' +
		'sites (squigs). Reviews live in a spreadsheet published as CSV; the page reads that ' +
		'sheet at load and renders one card per device. Deployed as two files beside an ' +
		'existing measurement site, with no build step and nothing to install on the server.',
	details: [
		'- The audience is an operator setting up their own page, not an end user browsing one.',
		'  Almost every question is about the spreadsheet, `ranking-config.js`, or wiring the',
		'  badge link in CrinGraph or modernGraphTool.',
		'- `config/reference` is the authoritative page for config keys, but the real source of',
		'  truth is `src/types.ts` in the repository, published with the build as',
		'  `dist/types.d.ts`. Prefer the shipped types over anything inferred from an example.',
		'- Two pages of the site are interactive tools rather than documentation and so carry no',
		'  text here: `/config-editor/` builds a `ranking-config.js`, and `/phonebook-converter/`',
		'  turns the spreadsheet into a CrinGraph `phone_book.json`.',
		'- Every page is also available as raw Markdown by appending `.md` to its URL.'
	].join('\n'),
	optionalLinks: [
		{
			label: 'Source repository',
			url: 'https://github.com/potatosalad775/squigRanking',
			description:
				'the squigRanking source, including the config type definitions in `src/types.ts` ' +
				'and the three shipped presets under `presets/`'
		}
	],
	// Unpromoted pages are ordered by slug, which would break the three setup pages apart and
	// leave "Deploying" after the config reference. Listing them restores the sidebar's reading
	// order, which is what orients an agent handed a bare question about setting a page up.
	// `integration/**` is left to trail on its own — it is last in both orders.
	// Nothing is excluded or demoted: the whole corpus is nine pages, so `llms-full.txt` stays
	// small enough to read end to end, and there is no frozen or superseded section to steer
	// around.
	promote: [
		'index*',
		'setup/quick-start*',
		'setup/your-sheet*',
		'setup/deploying*',
		'ranks/choosing*',
		'ranks/scale*',
		'config/reference*'
	],
	// Starlight renders a "Section titled …" link beside every heading. It is pure noise once
	// the HTML is flattened to Markdown.
	customSelectors: { all: ['.sl-anchor-link'] }
};
