// Reading an existing `ranking-config.js` back into the form.
//
// The file is JavaScript, not JSON, so it is evaluated rather than parsed. It is
// run through `new Function` with a stand-in `window` and nothing else in scope:
// the operator pasted their own file, and the result never leaves their browser.
// A config that assigns anything other than the object is rejected rather than
// silently half-imported.

import type { ColumnToggle, FormState } from './form.ts';
import { presetState, step } from './form.ts';

export interface ParseResult {
	form?: FormState;
	error?: string;
	/** Parts of the file the form cannot represent, so nothing is lost silently. */
	warnings: string[];
}

interface LooseColumn {
	id?: string;
	source?: string;
	role?: string;
	label?: unknown;
	scale?: Array<{ value?: string; score?: number; color?: string }>;
	filter?: { kind?: string; values?: string[] };
	render?: { kind?: string; max?: number; min?: number; decimals?: number; classMap?: unknown };
	i18nSource?: Record<string, string>;
}

interface LooseConfig {
	configVersion?: number;
	types?: Record<string, Record<string, unknown>>;
	columns?: LooseColumn[];
	stats?: { enabled?: boolean; average?: { denominator?: string } };
	deepLink?: { template?: string };
	languages?: string[];
}

/** Pull the English text out of either I18nString shape. */
function textOf(value: unknown, fallback: string): { en: string; ko: string } {
	if (typeof value === 'string') return { en: value, ko: '' };
	if (value && typeof value === 'object') {
		const record = value as { default?: string; i18n?: Record<string, string> };
		return { en: record.default ?? fallback, ko: record.i18n?.['ko'] ?? '' };
	}
	return { en: fallback, ko: '' };
}

function evaluate(source: string): { config?: LooseConfig; error?: string } {
	const holder: { RANKING_CONFIG?: LooseConfig } = {};
	try {
		// `window` is the only binding the file gets. A config that reaches for
		// document, fetch or globals throws here rather than doing anything.
		new Function('window', `"use strict";\n${source}`)(holder);
	} catch (error) {
		return { error: `That file did not run: ${(error as Error).message}` };
	}
	const config = holder.RANKING_CONFIG;
	if (!config || typeof config !== 'object') {
		return { error: 'No window.RANKING_CONFIG assignment was found in that file.' };
	}
	if (!Array.isArray(config.columns)) {
		return { error: 'That config has no `columns` array, so it is not a ranking config.' };
	}
	return { config };
}

export function parseConfig(source: string): ParseResult {
	const warnings: string[] = [];
	const { config, error } = evaluate(source);
	if (!config) return { error, warnings };

	const rank = config.columns!.find(c => c.role === 'rank');
	if (!rank) return { error: 'No column carries `role: "rank"`, so there is no scale to edit.', warnings };

	const badgeKind = rank.render?.kind;
	const preset = badgeKind === 'stars' ? 'stars' : badgeKind === 'score-badge' ? 'score' : 'letter';
	const form = presetState(preset);
	form.preset = 'custom';

	// The scale, or the pre-scale filter values it can be rebuilt from.
	if (rank.scale?.length) {
		form.scale = rank.scale.map(entry =>
			step(String(entry.value ?? ''), entry.score === undefined ? '' : String(entry.score), entry.color ?? ''),
		);
	} else if (rank.filter?.values?.length) {
		const values = rank.filter.values;
		form.scale = values.map((value, index) => step(value, String(values.length - 1 - index), ''));
		warnings.push(
			'That config predates rank scales. Its grade order was kept and each step was given a score; check the scores and colors below.',
		);
	} else {
		warnings.push('The rank column had no scale and no filter values, so the default scale was used.');
	}

	if (rank.render?.classMap) {
		warnings.push('Its `classMap` was dropped. Colors now come from the scale, so set them there.');
	}

	const rankLabel = textOf(rank.label, form.rankLabelEn);
	form.rankLabelEn = rankLabel.en;
	if (rankLabel.ko) form.rankLabelKo = rankLabel.ko;

	if (badgeKind === 'stars') form.starsMax = rank.render?.max ?? 5;
	if (badgeKind === 'score-badge') {
		form.scoreMin = rank.render?.min ?? 0;
		form.scoreMax = rank.render?.max ?? 10;
		form.scoreDecimals = rank.render?.decimals ?? 1;
	}
	form.badge = badgeKind === 'stars' || badgeKind === 'score-badge' ? badgeKind : 'rank-badge';

	// Types. Ones the form has no slot for are reported rather than dropped quietly.
	const declared = Object.entries(config.types ?? {});
	for (const type of form.types) {
		const match = declared.find(([id]) => id === type.id);
		type.enabled = Boolean(match);
		if (!match) continue;
		const [, body] = match;
		const label = textOf(body['label'], type.labelEn);
		type.labelEn = label.en;
		if (label.ko) type.labelKo = label.ko;
		const source = body['source'] as { url?: string } | undefined;
		if (source?.url) type.url = source.url;
		type.phonebook = (body['phonebook'] as string) ?? '';
		type.measurementUrl = (body['measurementUrl'] as string) ?? '';
		type.measurementsPageUrl = (body['measurementsPageUrl'] as string) ?? '';
	}
	for (const [id] of declared) {
		if (!form.types.some(t => t.id === id)) {
			warnings.push(`The type "${id}" is not one the editor knows, so it was left out. Add it back by hand.`);
		}
	}

	// Optional columns: on when the file declares them.
	const byId = new Map(config.columns!.map(c => [c.id, c]));
	form.columns = form.columns.map((column): ColumnToggle => {
		const found = byId.get(column.id);
		if (!found) return { ...column, enabled: false };
		const label = textOf(found.label, column.labelEn);
		return {
			...column,
			enabled: true,
			header: found.source ?? column.header,
			labelEn: label.en,
			labelKo: label.ko || column.labelKo,
		};
	});

	const known = new Set(['rank', 'title', 'brand', 'model', 'measurement', ...form.columns.map(c => c.id)]);
	for (const column of config.columns!) {
		if (column.id && !known.has(column.id)) {
			warnings.push(`The column "${column.id}" is a custom one, so it was left out. Add it back by hand.`);
		}
	}

	form.korean = Boolean(config.languages?.includes('ko')) || config.columns!.some(c => c.i18nSource?.['ko']);
	form.statsEnabled = config.stats?.enabled !== false;
	if (config.deepLink?.template) form.deepLinkTemplate = config.deepLink.template;

	return { form, warnings };
}
