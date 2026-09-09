// Form state to `ranking-config.js` text.
//
// The output is a readable, commented file, not serialized JSON. An operator
// will open it again later to change a URL or add a column, and the comments are
// what make that possible without coming back to the docs. Pure, so it is
// testable without a DOM.

import type { ColumnToggle, FormState, TypeForm } from './form.ts';

const TAB = '\t';

function indent(depth: number): string {
	return TAB.repeat(depth);
}

/** A single-quoted JS string literal. */
function q(value: string): string {
	return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** An I18nString: a bare string when there is no translation to carry. */
function i18nString(en: string, ko: string, korean: boolean): string {
	if (!korean || !ko || ko === en) return q(en);
	return `{ default: ${q(en)}, i18n: { ko: ${q(ko)} } }`;
}

function typeBlock(type: TypeForm, korean: boolean, depth: number): string {
	const pad = indent(depth);
	const inner = indent(depth + 1);
	const lines = [
		`${pad}${type.id}: {`,
		`${inner}label: ${i18nString(type.labelEn, type.labelKo, korean)},`,
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
		`${inner}label: ${i18nString(form.rankLabelEn, form.rankLabelKo, form.korean)},`,
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
			`label: ${i18nString('Device', '기기', form.korean)},`,
			`render: { kind: 'title', template: ${q('{Brand} {Model}')} },`,
		]),
		block([
			`id: 'brand',`,
			`source: 'Brand',`,
			`role: 'brand',`,
			`label: ${i18nString('Brand', '브랜드', form.korean)},`,
			`sortable: true,`,
			`filter: { kind: 'text' },`,
			`render: { kind: 'none' },`,
		]),
		block([
			`id: 'model',`,
			`source: 'Model',`,
			`role: 'model',`,
			`label: ${i18nString('Model', '모델', form.korean)},`,
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
	if (shape.i18n && form.korean) {
		lines.push(`i18nSource: { en: ${q(column.header)}, ko: ${q(`${column.header}_KR`)} },`);
	}
	lines.push(`label: ${i18nString(column.labelEn, column.labelKo, form.korean)},`);
	if (column.id === 'score') lines.push(`sortable: true,`);
	if (shape.filter) lines.push(`filter: ${shape.filter},`);
	lines.push(`render: ${shape.render},`);
	return [`${pad}{`, ...lines.map(l => inner + l), `${pad}},`].join('\n');
}

function sortBlock(form: FormState, depth: number): string {
	const pad = indent(depth);
	const inner = indent(depth + 1);
	const hasScore = form.columns.some(c => c.id === 'score' && c.enabled) || form.scale.some(s => s.score);
	const options = ['rank-asc', 'rank-desc'];
	if (hasScore) options.push('score-desc', 'score-asc');
	options.push('brand-asc', 'brand-desc', 'model-asc', 'model-desc');

	const rankEn = form.rankLabelEn;
	const rankKo = form.rankLabelKo;
	const labels = [
		`${inner}${TAB}'rank-asc': ${i18nString(`${rankEn} (Best First)`, `${rankKo}순 (높은 순)`, form.korean)},`,
		`${inner}${TAB}'rank-desc': ${i18nString(`${rankEn} (Worst First)`, `${rankKo}순 (낮은 순)`, form.korean)},`,
	];
	if (hasScore) {
		labels.push(
			`${inner}${TAB}'score-desc': ${i18nString('Score (High to Low)', '점수순 (높은 순)', form.korean)},`,
			`${inner}${TAB}'score-asc': ${i18nString('Score (Low to High)', '점수순 (낮은 순)', form.korean)},`,
		);
	}

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
	if (form.siteTitle.trim()) lines.push(`${inner}title: ${q(form.siteTitle.trim())},`);

	const note = form.footerNoteEn.trim();
	const link = form.footerLinkUrl.trim();
	if (note || link) {
		lines.push(`${inner}footer: {`);
		if (note) {
			lines.push(`${inner}${TAB}note: ${i18nString(note, form.footerNoteKo.trim(), form.korean)},`);
		}
		if (link) {
			const label = q(form.footerLinkLabel.trim() || link);
			lines.push(`${inner}${TAB}links: [{ href: ${q(link)}, label: ${label}, newTab: true }],`);
		}
		lines.push(`${inner}},`);
	}
	lines.push(`${pad}},`);
	return lines.join('\n');
}

export function generateConfig(form: FormState): string {
	const types = form.types.filter(t => t.enabled);
	const columns = [
		rankColumn(form, 2),
		...fixedColumns(form, 2),
		...form.columns.filter(c => c.enabled).map(c => optionalColumn(c, form, 2)),
	];

	const measurement = [
		`${indent(2)}{`,
		`${indent(3)}id: 'measurement',`,
		`${indent(3)}label: ${i18nString('View Measurement', '측정 보기', form.korean)},`,
		`${indent(3)}render: { kind: 'measurement-link' },`,
		`${indent(2)}},`,
	].join('\n');

	const languages = form.korean ? `${indent(1)}languages: ['en', 'ko'],\n` : '';

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
		`${indent(1)}configVersion: 3,`,
		'',
		`${indent(1)}types: {`,
		types.map(t => typeBlock(t, form.korean, 2)).join('\n'),
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
		`${indent(2)}label: ${i18nString('Search', '검색', form.korean)},`,
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
		languages ? languages.trimEnd() : '',
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
	if (form.korean) {
		for (const id of ['comment', 'pros', 'cons', 'notes']) {
			const column = form.columns.find(c => c.id === id);
			if (column?.enabled) headers.push(`${column.header}_KR`);
		}
	}
	return headers;
}
