// The editor's form model, and the presets it starts from.
//
// This is deliberately narrower than `RankingConfig`: it covers the decisions a
// first-time operator actually makes, and the generator fills in the rest. An
// operator who needs the full surface edits the generated file, which is why
// the output is a readable, commented file rather than minified JSON.

export interface ScaleStep {
	/** Stable key for the keyed each block; never written to the output. */
	id: string;
	value: string;
	score: string;
	color: string;
}

export type BadgeKind = 'rank-badge' | 'stars' | 'score-badge';

export interface TypeForm {
	id: string;
	enabled: boolean;
	labelEn: string;
	url: string;
	phonebook: string;
	measurementUrl: string;
	measurementsPageUrl: string;
}

export interface ColumnToggle {
	id: string;
	header: string;
	labelEn: string;
	enabled: boolean;
	/** Shown in the form so an operator knows what the column does. */
	hint: string;
}

/**
 * One language beyond English, which is always the base.
 *
 * `text` holds the operator's own wording keyed by slot id (see
 * `translationSlots`); `strings` holds overrides for the interface strings core
 * writes itself. Both are sparse: an empty entry is left out of the output and
 * the page falls back, so a half-filled language is a working language.
 */
export interface LanguageForm {
	/** Stable key for the keyed each block; never written to the output. */
	id: string;
	/** BCP 47 tag, e.g. `ko`. Written into `languages` and every `i18n` map. */
	tag: string;
	/** English name of the language. Shown in the form, and used for `View in ...`. */
	name: string;
	/** Suffix on this language's CSV headers, e.g. `_KR` for `Comment_KR`. */
	suffix: string;
	/** Operator wording, keyed by slot id. */
	text: Record<string, string>;
	/** Interface string overrides, keyed by the ids in `INTERFACE_STRINGS`. */
	strings: Record<string, string>;
}

export interface FormState {
	preset: string;
	badge: BadgeKind;
	starsMax: number;
	scoreMin: number;
	scoreMax: number;
	scoreDecimals: number;
	scale: ScaleStep[];
	rankLabelEn: string;
	types: TypeForm[];
	columns: ColumnToggle[];
	/** Languages beyond English, in the order the toggle cycles through them. */
	languages: LanguageForm[];
	statsEnabled: boolean;
	deepLinkTemplate: string;
	/** Page chrome. index.html carries none of this, so the form has to. */
	siteTitle: string;
	footerNoteEn: string;
	footerLinkLabel: string;
	footerLinkUrl: string;
}

let nextId = 0;

/** A scale row. The id exists only to key the each block. */
export function step(value: string, score: string, color: string): ScaleStep {
	nextId += 1;
	return { id: `s${nextId}`, value, score, color };
}

const LETTER: Array<[string, string, string]> = [
	['S', '5', '#6c63ff'],
	['A+', '4.5', '#00bfae'],
	['A', '4', '#00bfff'],
	['B+', '3.5', '#4caf50'],
	['B', '3', '#8bc34a'],
	['C+', '2.5', '#ffb347'],
	['C', '2', '#ffc107'],
	['D+', '1.5', '#ff9800'],
	['D', '1', '#ff5722'],
	['F', '0', '#b71c1c'],
];

const STARS: Array<[string, string]> = [
	['5', '5'],
	['4.5', '4.5'],
	['4', '4'],
	['3.5', '3.5'],
	['3', '3'],
	['2.5', '2.5'],
	['2', '2'],
	['1.5', '1.5'],
	['1', '1'],
	['0.5', '0.5'],
];

export const DEFAULT_SCORE_RAMP = ['#b71c1c', '#ffc107', '#4caf50', '#6c63ff'];

/** The demo sheet every preset ships pointing at. */
export const DEMO_SHEET =
	'https://docs.google.com/spreadsheets/d/e/2PACX-1vSks_18k_uClvDeIliTDCEILHXkKEltrE5wEiUfQAIwq1NvlFkB49OTFmfazjx7FFJC8alqW-0nXZhI/pub?gid=667242096&single=true&output=csv';

function defaultTypes(): TypeForm[] {
	return [
		{
			id: 'earphone',
			enabled: true,
			labelEn: 'Earphones',
			url: DEMO_SHEET,
			phonebook: '../data/phone_book.json',
			measurementUrl: '../?share={file}',
			measurementsPageUrl: '../',
		},
		{
			id: 'headphone',
			enabled: true,
			labelEn: 'Headphones',
			url: DEMO_SHEET,
			phonebook: '../headphones/data/phone_book.json',
			measurementUrl: '../headphones/?share={file}',
			measurementsPageUrl: '../headphones/',
		},
	];
}

function defaultColumns(): ColumnToggle[] {
	return [
		{
			id: 'driver',
			header: 'Driver',
			labelEn: 'Driver',
			enabled: true,
			hint: 'Hybrid, DD, BA, planar. A chip in the meta row, with a dropdown filter built from your rows.',
		},
		{
			id: 'style',
			header: 'Style',
			labelEn: 'Style',
			enabled: true,
			hint: 'Open, closed, IEM, earbud. A chip in the meta row, with its own dropdown filter.',
		},
		{
			id: 'comment',
			header: 'Comment',
			labelEn: 'Comment',
			enabled: true,
			hint: 'The main paragraph of the review.',
		},
		{
			id: 'pros',
			header: 'Pros',
			labelEn: 'Pros',
			enabled: true,
			hint: 'A green block. One point per line.',
		},
		{
			id: 'cons',
			header: 'Cons',
			labelEn: 'Cons',
			enabled: true,
			hint: 'A red block. One point per line.',
		},
		{
			id: 'notes',
			header: 'Notes',
			labelEn: 'Notes',
			enabled: true,
			hint: 'A muted block for caveats and measurement remarks.',
		},
		{
			id: 'tags',
			header: 'Tags',
			labelEn: 'Tags',
			enabled: true,
			hint: 'Comma-separated pills, also covered by search.',
		},
		{
			id: 'score',
			header: 'Score',
			labelEn: 'Score',
			enabled: true,
			hint: 'A numeric column in your sheet. Turn it off to let the rank scale supply the score.',
		},
	];
}

// --- Languages ---------------------------------------------------------------

/**
 * The interface strings core writes itself, with their English text.
 *
 * Duplicated from `src/i18n.ts` for the same reason the color math below is:
 * the docs site builds without the root package. A test asserts the two lists
 * stay identical, so a string added to core surfaces here rather than quietly
 * going untranslatable.
 */
export const INTERFACE_STRINGS: Array<{ key: string; en: string; hint?: string }> = [
	{
		key: 'toggleLanguage',
		en: 'View in Korean',
		hint: 'The tooltip on the language button. Built from the names above unless you word it yourself.',
	},
	{ key: 'filterAndSort', en: 'Filter & Sort' },
	{ key: 'resetFilters', en: 'Reset Filters' },
	{ key: 'search', en: 'Search' },
	{ key: 'sortBy', en: 'Sort by' },
	{ key: 'all', en: 'All' },
	{ key: 'statsTitle', en: 'Ranking Statistics' },
	{ key: 'averageScore', en: 'Average Score:' },
	{ key: 'deviceCount', en: 'Device Count' },
	{ key: 'closeStats', en: 'Close statistics' },
	{ key: 'openStats', en: 'Open statistics' },
	{ key: 'measurementsPage', en: 'Go to Measurements Page' },
	{ key: 'toggleTheme', en: 'Toggle Light/Dark Theme' },
	{ key: 'scrollTop', en: 'Scroll to top' },
	{ key: 'noResults', en: 'No devices match the current filters.' },
	{
		key: 'loadError',
		en: 'Could not load the ranking data. Check the source URL in ranking-config.js.',
	},
	{ key: 'ascending', en: 'A to Z' },
	{ key: 'descending', en: 'Z to A' },
];

/** Languages whose interface strings ship inside the bundle. */
export const BUILT_IN_LANGUAGES = ['en', 'ko'];

/** Offered by the add-a-language menu. Only the tag and the suffix reach the output. */
export const LANGUAGE_PRESETS: Array<{ tag: string; name: string; suffix: string }> = [
	{ tag: 'ko', name: 'Korean', suffix: '_KR' },
	{ tag: 'ja', name: 'Japanese', suffix: '_JA' },
	{ tag: 'zh', name: 'Chinese', suffix: '_ZH' },
	{ tag: 'es', name: 'Spanish', suffix: '_ES' },
	{ tag: 'fr', name: 'French', suffix: '_FR' },
	{ tag: 'de', name: 'German', suffix: '_DE' },
	{ tag: 'pt', name: 'Portuguese', suffix: '_PT' },
	{ tag: 'ru', name: 'Russian', suffix: '_RU' },
];

/** English text for the labels the generator writes without asking the form. */
export const FIXED_LABELS: Record<string, string> = {
	device: 'Device',
	brand: 'Brand',
	model: 'Model',
	measurement: 'View Measurement',
	search: 'Search',
};

/**
 * English sort labels. `{rank}` is replaced with the rank column's label in the
 * language being written, so renaming the rank column renames its sort options
 * in every language at once.
 */
export const SORT_PATTERNS: Record<string, string> = {
	'rank-asc': '{rank} (Best First)',
	'rank-desc': '{rank} (Worst First)',
	'score-desc': 'Score (High to Low)',
	'score-asc': 'Score (Low to High)',
};

/** What the editor knows how to say in Korean. Every other language starts blank. */
const KOREAN_TEXT: Record<string, string> = {
	rank: '등급',
	'type:earphone': '이어폰',
	'type:headphone': '헤드폰',
	'column:driver': '드라이버',
	'column:style': '형태',
	'column:comment': '코멘트',
	'column:pros': '장점',
	'column:cons': '단점',
	'column:notes': '추가 의견',
	'column:tags': '태그',
	'column:score': '점수',
	device: '기기',
	brand: '브랜드',
	model: '모델',
	measurement: '측정 보기',
	search: '검색',
	'sort:rank-asc': '{rank}순 (높은 순)',
	'sort:rank-desc': '{rank}순 (낮은 순)',
	'sort:score-desc': '점수순 (높은 순)',
	'sort:score-asc': '점수순 (낮은 순)',
	footerNote:
		"'랭킹 리스트'는 운영자의 개인적인 청음 경험과 " +
		'음질에 대한 주관적 평가를 바탕으로 작성되었습니다.',
};

let nextLangId = 0;

/** A language row. Korean arrives with the wording the editor already knows. */
export function language(tag: string, name: string, suffix: string): LanguageForm {
	nextLangId += 1;
	return {
		id: `l${nextLangId}`,
		tag,
		name,
		suffix,
		text: tag === 'ko' ? { ...KOREAN_TEXT } : {},
		strings: {},
	};
}

/** A translatable piece of the operator's own wording. */
export interface TranslationSlot {
	id: string;
	/** Section heading in the form. */
	group: string;
	/** What this slot is. */
	label: string;
	/** The English text being translated. */
	en: string;
	/** Long enough to want a textarea. */
	long?: boolean;
	/** Interpolates `{rank}`, so the form can say so. */
	pattern?: boolean;
}

/** Whether the sort dropdown offers the score options. Mirrors `sortBlock`. */
export function hasScoreSort(form: FormState): boolean {
	return form.columns.some(c => c.id === 'score' && c.enabled) || form.scale.some(s => s.score);
}

/**
 * Every slot a language can translate, in the order the form shows them.
 * Derived from the rest of the form, so turning a column off drops its row.
 */
export function translationSlots(form: FormState): TranslationSlot[] {
	const slots: TranslationSlot[] = [];
	if (form.siteTitle.trim()) {
		slots.push({ id: 'title', group: 'Page', label: 'Header title', en: form.siteTitle.trim() });
	}
	if (form.footerNoteEn.trim()) {
		slots.push({
			id: 'footerNote',
			group: 'Page',
			label: 'Footer note',
			en: form.footerNoteEn.trim(),
			long: true,
		});
	}
	if (form.footerLinkUrl.trim() && form.footerLinkLabel.trim()) {
		slots.push({
			id: 'footerLink',
			group: 'Page',
			label: 'Footer link text',
			en: form.footerLinkLabel.trim(),
		});
	}
	slots.push({ id: 'search', group: 'Page', label: 'Search box', en: FIXED_LABELS['search']! });

	slots.push({ id: 'rank', group: 'Columns', label: 'Rank column', en: form.rankLabelEn });
	slots.push({ id: 'device', group: 'Columns', label: 'Card heading', en: FIXED_LABELS['device']! });
	slots.push({ id: 'brand', group: 'Columns', label: 'Brand', en: FIXED_LABELS['brand']! });
	slots.push({ id: 'model', group: 'Columns', label: 'Model', en: FIXED_LABELS['model']! });
	for (const column of form.columns) {
		if (!column.enabled) continue;
		slots.push({
			id: `column:${column.id}`,
			group: 'Columns',
			label: `${column.labelEn} column`,
			en: column.labelEn,
		});
	}
	slots.push({
		id: 'measurement',
		group: 'Columns',
		label: 'Measurement link',
		en: FIXED_LABELS['measurement']!,
	});

	for (const type of form.types) {
		if (!type.enabled) continue;
		slots.push({
			id: `type:${type.id}`,
			group: 'Device types',
			label: `${type.labelEn} tab`,
			en: type.labelEn,
		});
	}

	const sortKeys = ['rank-asc', 'rank-desc'];
	if (hasScoreSort(form)) sortKeys.push('score-desc', 'score-asc');
	for (const key of sortKeys) {
		slots.push({
			id: `sort:${key}`,
			group: 'Sort options',
			label: key,
			en: SORT_PATTERNS[key]!,
			pattern: key.startsWith('rank-'),
		});
	}
	return slots;
}

/** The tags the toggle cycles through, English first. */
export function languageTags(form: FormState): string[] {
	return ['en', ...form.languages.map(l => l.tag.trim()).filter(Boolean)];
}

/**
 * The language the toggle moves to from `tag`. `toggleLanguage` is read in the
 * current language and names the next one, so every language needs to know this
 * before it can be labelled honestly.
 */
export function nextLanguageName(form: FormState, tag: string): string {
	const tags = languageTags(form);
	const index = tags.indexOf(tag);
	if (index === -1 || tags.length < 2) return '';
	const next = tags[(index + 1) % tags.length]!;
	if (next === 'en') return 'English';
	return form.languages.find(l => l.tag.trim() === next)?.name.trim() || next;
}

export const PRESETS = ['letter', 'stars', 'score'] as const;

export const PRESET_LABELS: Record<string, { title: string; blurb: string }> = {
	letter: { title: 'Letter grades', blurb: 'S down to F, as colored grade badges.' },
	stars: { title: 'Five stars', blurb: 'Half steps from 0.5 to 5, drawn as stars.' },
	score: { title: 'Numeric score', blurb: '0 to 10, as a color-coded number pill.' },
};

/** Set one slot on the language the editor ships translations for. */
function setText(form: FormState, slot: string, value: string): void {
	const korean = form.languages.find(l => l.tag === 'ko');
	if (korean) korean.text[slot] = value;
}

export function presetState(preset: string): FormState {
	const base: FormState = {
		preset,
		badge: 'rank-badge',
		starsMax: 5,
		scoreMin: 0,
		scoreMax: 10,
		scoreDecimals: 1,
		scale: LETTER.map(([value, score, color]) => step(value, score, color)),
		rankLabelEn: 'Rank',
		types: defaultTypes(),
		columns: defaultColumns(),
		languages: [language('ko', 'Korean', '_KR')],
		statsEnabled: true,
		deepLinkTemplate: '{Brand}-{Model}',
		siteTitle: 'SquigRanking',
		footerNoteEn:
			"The 'Ranking List' is based on the operator's personal listening experience " +
			'and subjective evaluation of sound quality.',
		footerLinkLabel: '',
		footerLinkUrl: '',
	};

	if (preset === 'stars') {
		base.badge = 'stars';
		base.scale = STARS.map(([value, score]) => step(value, score, ''));
		base.rankLabelEn = 'Rating';
		setText(base, 'rank', '평점');
		base.columns = base.columns.map(c => (c.id === 'score' ? { ...c, enabled: false } : c));
	} else if (preset === 'score') {
		base.badge = 'score-badge';
		base.scale = Array.from({ length: 11 }, (_, i) => {
			const value = 10 - i;
			return step(String(value), String(value), rampColor(DEFAULT_SCORE_RAMP, value / 10));
		});
		base.rankLabelEn = 'Score';
		setText(base, 'rank', '점수');
		base.columns = base.columns.map(c => (c.id === 'score' ? { ...c, enabled: false } : c));
	}
	return base;
}

// Color math is duplicated from the runtime's src/color.ts rather than imported:
// the docs site builds independently of the root package, and two dozen lines
// are cheaper to keep in step than a cross-package build dependency. The preview
// and the runtime must agree, and a test asserts they do.

export function parseHex(value: string): [number, number, number] | null {
	const hex = String(value ?? '')
		.trim()
		.replace(/^#/, '');
	if (hex.length === 3) {
		const parts = [...hex].map(c => Number.parseInt(c + c, 16));
		return parts.some(Number.isNaN) ? null : [parts[0]!, parts[1]!, parts[2]!];
	}
	if (hex.length === 6) {
		const parts = [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
		return parts.some(Number.isNaN) ? null : [parts[0]!, parts[1]!, parts[2]!];
	}
	return null;
}

function toHex(channels: [number, number, number]): string {
	const hex = channels
		.map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0'))
		.join('');
	return `#${hex}`;
}

export function rampColor(colors: string[], t: number): string {
	const stops = colors.map(parseHex).filter((c): c is [number, number, number] => c !== null);
	if (!stops.length) return '';
	if (stops.length === 1) return toHex(stops[0]!);
	const clamped = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
	const span = clamped * (stops.length - 1);
	const index = Math.min(stops.length - 2, Math.floor(span));
	const local = span - index;
	const from = stops[index]!;
	const to = stops[index + 1]!;
	return toHex([
		from[0] + (to[0] - from[0]) * local,
		from[1] + (to[1] - from[1]) * local,
		from[2] + (to[2] - from[2]) * local,
	]);
}

export function readableTextColor(background: string): string {
	const rgb = parseHex(background);
	if (!rgb) return '#fff';
	const channel = (c: number): number => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	const luminance = 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
	return luminance > 0.5 ? '#111' : '#fff';
}

/**
 * Problems worth showing the operator before they copy the file out.
 * Warnings, not errors: the generator always produces something.
 */
export function validate(form: FormState): string[] {
	const problems: string[] = [];
	const enabled = form.types.filter(t => t.enabled);
	if (!enabled.length) problems.push('No device type is enabled, so the page would have nothing to load.');
	for (const type of enabled) {
		if (!type.url.trim()) {
			problems.push(`${type.labelEn} has no sheet URL.`);
		} else if (!/output=csv|\.csv/i.test(type.url)) {
			problems.push(`${type.labelEn}'s URL does not look like a published CSV link.`);
		}
	}
	if (form.scale.length < 2) problems.push('A scale needs at least two steps.');
	if (form.footerLinkUrl.trim() && !form.footerLinkLabel.trim()) {
		problems.push('The footer link has a URL but no text to show for it.');
	}

	const seen = new Set<string>();
	for (const s of form.scale) {
		const key = s.value.trim().toUpperCase();
		if (!key) problems.push('A scale step has no value.');
		else if (seen.has(key)) problems.push(`The scale lists "${s.value}" more than once.`);
		seen.add(key);
	}

	const scores = form.scale.map(s => Number.parseFloat(s.score));
	for (let i = 1; i < scores.length; i++) {
		const previous = scores[i - 1]!;
		const current = scores[i]!;
		if (!Number.isNaN(previous) && !Number.isNaN(current) && current >= previous) {
			problems.push('Scores must decrease down the list, because the best grade comes first.');
			break;
		}
	}
	if (form.badge === 'stars' && form.scale.some(s => Number.parseFloat(s.value) > form.starsMax)) {
		problems.push(`A step is worth more than ${form.starsMax} stars.`);
	}

	const tags = new Set<string>(['en']);
	const suffixes = new Set<string>();
	for (const lang of form.languages) {
		const tag = lang.tag.trim();
		if (!tag) {
			problems.push('A language has no tag. Use the two-letter code, like `ja`.');
		} else if (tag === 'en') {
			problems.push('English is the base language and cannot be listed again.');
		} else if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(tag)) {
			problems.push(`"${tag}" is not a language tag. Use a code like \`ja\` or \`zh-Hant\`.`);
		} else if (tags.has(tag)) {
			problems.push(`The language "${tag}" is listed twice.`);
		}
		tags.add(tag);

		const suffix = lang.suffix.trim();
		if (!suffix) {
			problems.push(`${lang.name || tag} has no column suffix, so its text has nowhere to live in the sheet.`);
		} else if (suffixes.has(suffix)) {
			problems.push(`Two languages both read the "${suffix}" columns.`);
		}
		suffixes.add(suffix);

		// The name reaches the page: core builds the language button's tooltip out
		// of it, so an unnamed language leaves the button naming a tag.
		if (tag && !lang.name.trim()) {
			problems.push(`The "${tag}" language has no name, so its button would read "View in ${tag}".`);
		}
	}
	return problems;
}
