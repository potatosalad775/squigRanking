// Form state to `ranking-config.js` text.
//
// The output is a readable, commented file, not serialized JSON. An operator
// will open it again later to change a URL or add a column, and the comments are
// what make that possible without coming back to the docs. Pure, so it is
// testable without a DOM.

import type { ColumnToggle, FormState, LanguageForm, TypeForm } from './form.ts';
import { FIXED_LABELS, INTERFACE_STRINGS, SORT_PATTERNS, hasScoreSort } from './form.ts';

const TAB = '\t';

function indent(depth: number): string {
	return TAB.repeat(depth);
}

/** A single-quoted JS string literal. */
function q(value: string): string {
	return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** This language's rank label, for the `{rank}` in a sort pattern. */
function rankLabel(form: FormState, lang: LanguageForm | undefined): string {
	return lang?.text['rank']?.trim() || form.rankLabelEn;
}

/** One slot's text in one language. Empty when untranslated. */
function slotText(form: FormState, lang: LanguageForm, slot: string): string {
	const value = lang.text[slot]?.trim();
	if (!value) return '';
	// Only the sort labels interpolate. A footer note is free to contain braces.
	if (!slot.startsWith('sort:')) return value;
	return value.replace(/\{rank\}/g, rankLabel(form, lang));
}

/**
 * An I18nString for one slot: a bare string while nothing translates it, and
 * `{ default, i18n }` as soon as something does. Languages that leave the slot
 * empty are left out, so the page falls back to `default` for them.
 */
function i18nString(form: FormState, slot: string, en: string): string {
	const parts: string[] = [];
	for (const lang of form.languages) {
		const tag = lang.tag.trim();
		const text = slotText(form, lang, slot);
		if (!tag || !text || text === en) continue;
		parts.push(`${tag}: ${q(text)}`);
	}
	if (!parts.length) return q(en);
	return `{ default: ${q(en)}, i18n: { ${parts.join(', ')} } }`;
}

function typeBlock(form: FormState, type: TypeForm, depth: number): string {
	const pad = indent(depth);
	const inner = indent(depth + 1);
	const lines = [
		`${pad}${type.id}: {`,
		`${inner}label: ${i18nString(form, `type:${type.id}`, type.labelEn)},`,
		`${inner}source: {`,
		`${inner}${TAB}kind: 'csv',`,
		`${inner}${TAB}url: ${q(type.url)},`,
		`${inner}},`,
	];
	if (type.phonebook) lines.push(`${inner}phonebook: ${q(type.phonebook)},`);
	if (type.measurementUrl) lines.push(`${inner}measurementUrl: ${q(type.measurementUrl)},`);
	if (type.measurementsPageUrl) {
		lines.push(`${inner}measurementsPageUrl: ${q(type.measurementsPageUrl)},`);
	}
	lines.push(`${pad}},`);
	return lines.join('\n');
}

function renderClause(form: FormState): string {
	if (form.badge === 'stars') return `{ kind: 'stars', max: ${form.starsMax} }`;
	if (form.badge === 'score-badge') {
		return (
			`{ kind: 'score-badge', min: ${form.scoreMin}, max: ${form.scoreMax}, ` +
			`decimals: ${form.scoreDecimals} }`
		);
	}
	return `{ kind: 'rank-badge' }`;
}

function rankColumn(form: FormState, depth: number): string {
	const pad = indent(depth);
	const inner = indent(depth + 1);
	const scaleRows = form.scale.map(s => {
		const parts = [`value: ${q(s.value.trim())}`];
		const score = Number.parseFloat(s.score);
		if (!Number.isNaN(score)) parts.push(`score: ${score}`);
		if (s.color.trim()) parts.push(`color: ${q(s.color.trim())}`);
		return `${inner}${TAB}{ ${parts.join(', ')} },`;
	});

	return [
		`${pad}{`,
		`${inner}id: 'rank',`,
		`${inner}source: 'Rank',`,
		`${inner}role: 'rank',`,
		`${inner}label: ${i18nString(form, 'rank', form.rankLabelEn)},`,
		`${inner}sortable: true,`,
		`${inner}// The scale is the whole rank definition: order, dropdown options,`,
		`${inner}// badge colors, chart colors, and the score each step is worth.`,
		`${inner}scale: [`,
		...scaleRows,
		`${inner}],`,
		`${inner}filter: { kind: 'select' },`,
		`${inner}render: ${renderClause(form)},`,
		`${pad}},`,
	].join('\n');
}

function fixedColumns(form: FormState, depth: number): string[] {
	const pad = indent(depth);
	const inner = indent(depth + 1);
	const block = (lines: string[]): string => [`${pad}{`, ...lines.map(l => inner + l), `${pad}},`].join('\n');

	return [
		block([
			`id: 'title',`,
			`label: ${i18nString(form, 'device', FIXED_LABELS['device']!)},`,
			`render: { kind: 'title', template: ${q('{Brand} {Model}')} },`,
		]),
		block([
			`id: 'brand',`,
			`source: 'Brand',`,
			`role: 'brand',`,
			`label: ${i18nString(form, 'brand', FIXED_LABELS['brand']!)},`,
			`sortable: true,`,
			`filter: { kind: 'text' },`,
			`render: { kind: 'none' },`,
		]),
		block([
			`id: 'model',`,
			`source: 'Model',`,
			`role: 'model',`,
			`label: ${i18nString(form, 'model', FIXED_LABELS['model']!)},`,
			`sortable: true,`,
			`filter: { kind: 'text' },`,
			`render: { kind: 'none' },`,
		]),
	];
}

/** How each optional column renders. Mirrors the shipped presets. */
const COLUMN_SHAPES: Record<string, { render: string; filter?: string; i18n?: boolean }> = {
	driver: { render: `{ kind: 'meta-chip' }`, filter: `{ kind: 'select-auto' }` },
	style: { render: `{ kind: 'meta-chip' }`, filter: `{ kind: 'select-auto' }` },
	comment: { render: `{ kind: 'block', style: 'plain' }`, i18n: true },
	pros: { render: `{ kind: 'block', style: 'up' }`, i18n: true },
	cons: { render: `{ kind: 'block', style: 'down' }`, i18n: true },
	notes: { render: `{ kind: 'block', style: 'note' }`, i18n: true },
	tags: { render: `{ kind: 'tags', separator: ',' }`, filter: `{ kind: 'text' }` },
	score: { render: `{ kind: 'none' }` },
};

function optionalColumn(column: ColumnToggle, form: FormState, depth: number): string {
	const pad = indent(depth);
	const inner = indent(depth + 1);
	const shape = COLUMN_SHAPES[column.id]!;
	const lines = [`id: ${q(column.id)},`, `source: ${q(column.header)},`];
	if (column.id === 'score') lines.push(`role: 'score',`);
	if (shape.i18n) {
		// Where this column's text lives per language. The suffix is the operator's
		// to choose; core only ever reads the headers named here.
		const sources = form.languages
			.filter(l => l.tag.trim() && l.suffix.trim())
			.map(l => `${l.tag.trim()}: ${q(`${column.header}${l.suffix.trim()}`)}`);
		if (sources.length) {
			lines.push(`i18nSource: { en: ${q(column.header)}, ${sources.join(', ')} },`);
		}
	}
	lines.push(`label: ${i18nString(form, `column:${column.id}`, column.labelEn)},`);
	if (column.id === 'score') lines.push(`sortable: true,`);
	if (shape.filter) lines.push(`filter: ${shape.filter},`);
	lines.push(`render: ${shape.render},`);
	return [`${pad}{`, ...lines.map(l => inner + l), `${pad}},`].join('\n');
}

function sortBlock(form: FormState, depth: number): string {
	const pad = indent(depth);
	const inner = indent(depth + 1);
	const hasScore = hasScoreSort(form);
	const options = ['rank-asc', 'rank-desc'];
	if (hasScore) options.push('score-desc', 'score-asc');
	options.push('brand-asc', 'brand-desc', 'model-asc', 'model-desc');

	const keys = hasScore ? ['rank-asc', 'rank-desc', 'score-desc', 'score-asc'] : ['rank-asc', 'rank-desc'];
	const labels = keys.map(key => {
		const en = SORT_PATTERNS[key]!.replace(/\{rank\}/g, form.rankLabelEn);
		return `${inner}${TAB}${q(key)}: ${i18nString(form, `sort:${key}`, en)},`;
	});

	return [
		`${pad}sort: {`,
		`${inner}default: 'rank-asc',`,
		`${inner}options: [${options.map(q).join(', ')}],`,
		`${inner}labels: {`,
		...labels,
		`${inner}},`,
		`${pad}},`,
	].join('\n');
}

function statsBlock(form: FormState, depth: number): string {
	const pad = indent(depth);
	const inner = indent(depth + 1);
	if (!form.statsEnabled) return `${pad}stats: { enabled: false },`;
	const best = form.scale.length ? Number.parseFloat(form.scale[0]!.score) : Number.NaN;
	const denominator = Number.isNaN(best) ? '5.00' : best.toFixed(2);
	return [
		`${pad}// Chart bars take their colors from the rank scale. Add \`chartColors\``,
		`${pad}// here only to override them.`,
		`${pad}stats: {`,
		`${inner}enabled: true,`,
		`${inner}average: { source: 'Score', denominator: ${q(denominator)} },`,
		`${pad}},`,
	].join('\n');
}

/**
 * The `chrome` block: the header title and the footer.
 *
 * index.html is three empty landmarks, so anything the form omits here is
 * simply absent from the page rather than falling back to markup.
 */
function chromeBlock(form: FormState, depth: number): string {
	const pad = indent(depth);
	const inner = indent(depth + 1);
	const lines = [
		`${pad}// The header and footer. index.html carries no copy of its own.`,
		`${pad}chrome: {`,
	];
	if (form.siteTitle.trim()) {
		lines.push(`${inner}title: ${i18nString(form, 'title', form.siteTitle.trim())},`);
	}

	const note = form.footerNoteEn.trim();
	const link = form.footerLinkUrl.trim();
	if (note || link) {
		lines.push(`${inner}footer: {`);
		if (note) {
			lines.push(`${inner}${TAB}note: ${i18nString(form, 'footerNote', note)},`);
		}
		if (link) {
			const text = form.footerLinkLabel.trim();
			const label = text ? i18nString(form, 'footerLink', text) : q(link);
			lines.push(`${inner}${TAB}links: [{ href: ${q(link)}, label: ${label}, newTab: true }],`);
		}
		lines.push(`${inner}},`);
	}
	lines.push(`${pad}},`);
	return lines.join('\n');
}

/**
 * `languages`, once there is more than English to cycle through.
 *
 * Named rather than listed, because core builds the language button's tooltip
 * out of the names: without them it can only fall back to a string that names
 * Korean, whatever this page's languages actually are.
 */
function languagesBlock(form: FormState, depth: number): string {
	const named = form.languages.filter(l => l.tag.trim());
	if (!named.length) return '';
	const entries = [`en: ${q('English')}`];
	for (const lang of named) {
		entries.push(`${lang.tag.trim()}: ${q(lang.name.trim() || lang.tag.trim())}`);
	}
	return `${indent(depth)}languages: { ${entries.join(', ')} },`;
}

/**
 * Interface string overrides.
 *
 * English and Korean ship inside the bundle and `toggleLanguage` comes from the
 * names in `languages`, so this is only what the operator typed themselves.
 * Everything omitted falls back to the built-in string, then to English.
 */
function i18nBlock(form: FormState, depth: number): string {
	const pad = indent(depth);
	const inner = indent(depth + 1);
	const entries: Array<[string, Array<[string, string]>]> = [];

	for (const lang of form.languages) {
		const tag = lang.tag.trim();
		if (!tag) continue;
		const filled = INTERFACE_STRINGS.map(
			({ key }) => [key, lang.strings[key]?.trim() ?? ''] as [string, string],
		).filter(([, value]) => value !== '');
		if (filled.length) entries.push([tag, filled]);
	}
	if (!entries.length) return '';

	const lines = [
		`${pad}// Interface strings. English and Korean ship inside the bundle, and the`,
		`${pad}// language button is built from the names above, so this is only what`,
		`${pad}// you worded yourself. Anything left out falls back to English.`,
		`${pad}i18n: {`,
	];
	for (const [tag, pairs] of entries) {
		lines.push(`${inner}${tag}: {`);
		for (const [key, value] of pairs) lines.push(`${inner}${TAB}${key}: ${q(value)},`);
		lines.push(`${inner}},`);
	}
	lines.push(`${pad}},`);
	return lines.join('\n');
}

export function generateConfig(form: FormState): string {
	const columns = [
		rankColumn(form, 2),
		...fixedColumns(form, 2),
		...form.columns.filter(c => c.enabled).map(c => optionalColumn(c, form, 2)),
	];

	const measurement = [
		`${indent(2)}{`,
		`${indent(3)}id: 'measurement',`,
		`${indent(3)}label: ${i18nString(form, 'measurement', FIXED_LABELS['measurement']!)},`,
		`${indent(3)}render: { kind: 'measurement-link' },`,
		`${indent(2)}},`,
	].join('\n');

	const types = form.types.filter(t => t.enabled);

	return [
		'// Generated by the squigRanking config editor.',
		'// https://potatosalad775.github.io/squigRanking/docs/config-editor/',
		'//',
		'// Loaded as a plain <script> before core.js, so window.RANKING_CONFIG is set',
		'// at parse time. Edit it by hand freely: this is a normal JavaScript file.',
		'//',
		'// The JSDoc line below gives editors autocomplete and inline validation once',
		'// `npm install squig-ranking` has run. It is a comment, so deleting it changes',
		'// nothing at runtime.',
		'',
		`/** @type {import('squig-ranking').RankingConfig} */`,
		'window.RANKING_CONFIG = {',
		`${indent(1)}configVersion: 4,`,
		'',
		`${indent(1)}types: {`,
		types.map(t => typeBlock(form, t, 2)).join('\n'),
		`${indent(1)}},`,
		'',
		`${indent(1)}columns: [`,
		columns.join('\n'),
		measurement,
		`${indent(1)}],`,
		'',
		`${indent(1)}// Omitting \`search.fields\` searches every header any column declares.`,
		`${indent(1)}search: {`,
		`${indent(2)}enabled: true,`,
		`${indent(2)}label: ${i18nString(form, 'search', FIXED_LABELS['search']!)},`,
		`${indent(1)}},`,
		'',
		sortBlock(form, 1),
		'',
		statsBlock(form, 1),
		'',
		chromeBlock(form, 1),
		'',
		`${indent(1)}deepLink: {`,
		`${indent(2)}template: ${q(form.deepLinkTemplate)},`,
		`${indent(2)}slugify: 'lowercase-hyphen',`,
		`${indent(1)}},`,
		'',
		...[languagesBlock(form, 1), i18nBlock(form, 1)].filter(Boolean),
		'};',
		'',
	]
		.join('\n')
		// Optional blocks leave blank lines behind when they are omitted.
		.replace(/\n{3,}/g, '\n\n');
}

/** The CSV header row a sheet needs for this form. */
export function generateTemplateHeaders(form: FormState): string[] {
	const headers = ['Brand', 'Model', 'Rank'];
	for (const column of form.columns) {
		if (!column.enabled || column.id === 'score') continue;
		headers.push(column.header);
	}
	const score = form.columns.find(c => c.id === 'score');
	if (score?.enabled) headers.splice(3, 0, 'Score');
	for (const lang of form.languages) {
		const suffix = lang.suffix.trim();
		if (!lang.tag.trim() || !suffix) continue;
		for (const id of ['comment', 'pros', 'cons', 'notes']) {
			const column = form.columns.find(c => c.id === id);
			if (column?.enabled) headers.push(`${column.header}${suffix}`);
		}
	}
	return headers;
}
