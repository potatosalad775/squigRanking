// Reading an existing `ranking-config.js` back into the form.
//
// The file is JavaScript, not JSON, so it is evaluated rather than parsed. It is
// run through `new Function` with a stand-in `window` and nothing else in scope:
// the operator pasted their own file, and the result never leaves their browser.
// A config that assigns anything other than the object is rejected rather than
// silently half-imported.

import type { ColumnToggle, FormState, LanguageForm } from './form.ts';
import { INTERFACE_STRINGS, LANGUAGE_PRESETS, language, nextLanguageName, presetState, step } from './form.ts';

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
	languages?: string[] | Record<string, string>;
	i18n?: Record<string, Record<string, string>>;
	search?: { label?: unknown };
	sort?: { labels?: Record<string, unknown> };
	chrome?: {
		title?: unknown;
		footer?: { note?: unknown; links?: Array<{ href?: string; label?: unknown }> };
	};
}

/** Pull both halves out of either I18nString shape. */
function textOf(value: unknown, fallback: string): { en: string; i18n: Record<string, string> } {
	if (typeof value === 'string') return { en: value, i18n: {} };
	if (value && typeof value === 'object') {
		const record = value as { default?: string; i18n?: Record<string, string> };
		return { en: record.default ?? fallback, i18n: { ...record.i18n } };
	}
	return { en: fallback, i18n: {} };
}

/**
 * The languages a config carries, English aside.
 *
 * A hand-edited file may declare `languages` and nothing else, or add an
 * `i18nSource` without listing the tag, so all three places are read and the
 * union is what the form shows.
 */
function collectTags(config: LooseConfig): string[] {
	const tags: string[] = [];
	const add = (tag: string | undefined): void => {
		if (tag && tag !== 'en' && !tags.includes(tag)) tags.push(tag);
	};
	const declared = config.languages;
	for (const tag of Array.isArray(declared) ? declared : Object.keys(declared ?? {})) add(tag);
	for (const column of config.columns ?? []) {
		for (const tag of Object.keys(column.i18nSource ?? {})) add(tag);
	}
	for (const tag of Object.keys(config.i18n ?? {})) add(tag);
	return tags;
}

/**
 * The suffix a language's headers use, read back off the first translated
 * column: `Comment` plus `Comment_KR` is a `_KR` suffix.
 */
function suffixFor(config: LooseConfig, tag: string): string | undefined {
	for (const column of config.columns ?? []) {
		const header = column.i18nSource?.[tag];
		const base = column.source;
		if (header && base && header.startsWith(base) && header.length > base.length) {
			return header.slice(base.length);
		}
	}
	return undefined;
}

/**
 * Put `{rank}` back into a sort label. The form holds these as patterns so that
 * renaming the rank column renames its sort options too; the file holds them
 * already filled in.
 */
function toPattern(text: string, rankLabel: string): string {
	if (!text || !rankLabel || !text.includes(rankLabel)) return text;
	return text.replace(rankLabel, '{rank}');
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

	// Languages, blank until the file fills them in: a config that carries no
	// Korean footer note has to import as one, not as the editor's default.
	const declaredNames = Array.isArray(config.languages) ? {} : (config.languages ?? {});
	form.languages = collectTags(config).map((tag): LanguageForm => {
		const known = LANGUAGE_PRESETS.find(l => l.tag === tag);
		const name = declaredNames[tag] ?? known?.name ?? tag;
		const suffix = suffixFor(config, tag) ?? known?.suffix ?? `_${tag.toUpperCase()}`;
		const lang = language(tag, name, suffix);
		lang.text = {};
		return lang;
	});
	const setText = (tag: string, slot: string, value: string | undefined): void => {
		const lang = form.languages.find(l => l.tag === tag);
		if (lang && value) lang.text[slot] = value;
	};
	/** Copy every translation an I18nString carries into the same slot. */
	const spread = (value: unknown, slot: string, fallback: string): string => {
		const read = textOf(value, fallback);
		for (const [tag, text] of Object.entries(read.i18n)) setText(tag, slot, text);
		return read.en;
	};
	for (const [tag, text] of Object.entries(rankLabel.i18n)) setText(tag, 'rank', text);

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
		type.labelEn = spread(body['label'], `type:${type.id}`, type.labelEn);
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
		return {
			...column,
			enabled: true,
			header: found.source ?? column.header,
			labelEn: spread(found.label, `column:${column.id}`, column.labelEn),
		};
	});

	// The labels the form does not offer an input for still carry translations.
	for (const [id, slot] of [['title', 'device'], ['brand', 'brand'], ['model', 'model'], ['measurement', 'measurement']] as const) {
		const found = byId.get(id);
		if (found) spread(found.label, slot, '');
	}
	spread(config.search?.label, 'search', '');

	// Sort labels come back as patterns, so a later rank rename still reaches them.
	for (const [key, value] of Object.entries(config.sort?.labels ?? {})) {
		const read = textOf(value, '');
		for (const [tag, text] of Object.entries(read.i18n)) {
			const lang = form.languages.find(l => l.tag === tag);
			if (!lang) continue;
			const label = key.startsWith('rank-') ? toPattern(text, lang.text['rank'] ?? '') : text;
			lang.text[`sort:${key}`] = label;
		}
	}

	// Headers that are not `source` plus one suffix cannot be written back.
	for (const lang of form.languages) {
		const mismatch = config.columns!.find(c => {
			const header = c.i18nSource?.[lang.tag];
			return Boolean(header && c.source && header !== `${c.source}${lang.suffix}`);
		});
		if (mismatch) {
			warnings.push(
				`The ${lang.name} headers are not all "${'{column}'}${lang.suffix}", so the editor will rewrite ${mismatch.source}'s to "${mismatch.source}${lang.suffix}". Rename the sheet column or fix it by hand.`,
			);
		}
	}

	const known = new Set(['rank', 'title', 'brand', 'model', 'measurement', ...form.columns.map(c => c.id)]);
	for (const column of config.columns!) {
		if (column.id && !known.has(column.id)) {
			warnings.push(`The column "${column.id}" is a custom one, so it was left out. Add it back by hand.`);
		}
	}

	// Chrome. A config that sets none of it imports as a page with no title and
	// no footer, which is exactly what that config renders.
	const chrome = config.chrome ?? {};
	form.siteTitle = chrome.title === false ? '' : spread(chrome.title, 'title', '');
	form.footerNoteEn = spread(chrome.footer?.note, 'footerNote', '');
	const footerLinks = chrome.footer?.links ?? [];
	const firstLink = footerLinks[0];
	form.footerLinkUrl = firstLink?.href ?? '';
	form.footerLinkLabel = spread(firstLink?.label, 'footerLink', '');
	if (footerLinks.length > 1) {
		warnings.push('Only the first footer link was imported; the editor offers one. Add the rest by hand.');
	}
	if (Array.isArray(chrome.footer?.note)) {
		warnings.push('Its footer note had several paragraphs; only the first was imported.');
	}

	// Interface strings. `en.toggleLanguage` is the one the generator writes for
	// itself, so it is re-derived rather than imported.
	const knownStrings = new Set(INTERFACE_STRINGS.map(s => s.key));
	for (const [tag, strings] of Object.entries(config.i18n ?? {})) {
		const lang = form.languages.find(l => l.tag === tag);
		for (const [key, value] of Object.entries(strings ?? {})) {
			if (tag === 'en') {
				if (key !== 'toggleLanguage') {
					warnings.push(`Its English override of "${key}" was left out; the editor translates away from English, not into it.`);
				}
				continue;
			}
			if (!knownStrings.has(key)) {
				warnings.push(`"${key}" is not an interface string the editor knows, so it was left out.`);
				continue;
			}
			if (lang) lang.strings[key] = String(value);
		}
	}

	// Core derives this from the language names now, so a config carrying the
	// text an older editor wrote is not an override worth keeping.
	for (const lang of form.languages) {
		if (lang.strings['toggleLanguage'] === `View in ${nextLanguageName(form, lang.tag)}`) {
			delete lang.strings['toggleLanguage'];
		}
	}

	form.statsEnabled = config.stats?.enabled !== false;
	if (config.deepLink?.template) form.deepLinkTemplate = config.deepLink.template;

	return { form, warnings };
}
