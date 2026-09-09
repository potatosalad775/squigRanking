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
	labelKo: string;
	url: string;
	phonebook: string;
	measurementUrl: string;
	measurementsPageUrl: string;
}

export interface ColumnToggle {
	id: string;
	header: string;
	labelEn: string;
	labelKo: string;
	enabled: boolean;
	/** Shown in the form so an operator knows what the column does. */
	hint: string;
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
	rankLabelKo: string;
	types: TypeForm[];
	columns: ColumnToggle[];
	korean: boolean;
	statsEnabled: boolean;
	deepLinkTemplate: string;
	/** Page chrome. index.html carries none of this, so the form has to. */
	siteTitle: string;
	footerNoteEn: string;
	footerNoteKo: string;
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
	'https://docs.google.com/spreadsheets/d/e/2PACX-1vSks_18k_uClvDeIliTDCEILHXkKEltrE5wEiUfQAIwq1NvlFkB49OTFmfazjx7FFJC8alqW-0nXZhI/pub?gid=0&single=true&output=csv';

function defaultTypes(): TypeForm[] {
	return [
		{
			id: 'earphone',
			enabled: true,
			labelEn: 'Earphones',
			labelKo: '이어폰',
			url: DEMO_SHEET,
			phonebook: '../data/phone_book.json',
			measurementUrl: '../?share={file}',
			measurementsPageUrl: '../',
		},
		{
			id: 'headphone',
			enabled: true,
			labelEn: 'Headphones',
			labelKo: '헤드폰',
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
			labelKo: '드라이버',
			enabled: true,
			hint: 'Hybrid, DD, BA, planar. A chip in the meta row, with a dropdown filter built from your rows.',
		},
		{
			id: 'style',
			header: 'Style',
			labelEn: 'Style',
			labelKo: '형태',
			enabled: true,
			hint: 'Open, closed, IEM, earbud. A chip in the meta row, with its own dropdown filter.',
		},
		{
			id: 'comment',
			header: 'Comment',
			labelEn: 'Comment',
			labelKo: '코멘트',
			enabled: true,
			hint: 'The main paragraph of the review.',
		},
		{
			id: 'pros',
			header: 'Pros',
			labelEn: 'Pros',
			labelKo: '장점',
			enabled: true,
			hint: 'A green block. One point per line.',
		},
		{
			id: 'cons',
			header: 'Cons',
			labelEn: 'Cons',
			labelKo: '단점',
			enabled: true,
			hint: 'A red block. One point per line.',
		},
		{
			id: 'notes',
			header: 'Notes',
			labelEn: 'Notes',
			labelKo: '추가 의견',
			enabled: true,
			hint: 'A muted block for caveats and measurement remarks.',
		},
		{
			id: 'tags',
			header: 'Tags',
			labelEn: 'Tags',
			labelKo: '태그',
			enabled: true,
			hint: 'Comma-separated pills, also covered by search.',
		},
		{
			id: 'score',
			header: 'Score',
			labelEn: 'Score',
			labelKo: '점수',
			enabled: true,
			hint: 'A numeric column in your sheet. Turn it off to let the rank scale supply the score.',
		},
	];
}

export const PRESETS = ['letter', 'stars', 'score'] as const;

export const PRESET_LABELS: Record<string, { title: string; blurb: string }> = {
	letter: { title: 'Letter grades', blurb: 'S down to F, as colored grade badges.' },
	stars: { title: 'Five stars', blurb: 'Half steps from 0.5 to 5, drawn as stars.' },
	score: { title: 'Numeric score', blurb: '0 to 10, as a color-coded number pill.' },
};

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
		rankLabelKo: '등급',
		types: defaultTypes(),
		columns: defaultColumns(),
		korean: true,
		statsEnabled: true,
		deepLinkTemplate: '{Brand}-{Model}',
		siteTitle: 'SquigRanking',
		footerNoteEn:
			"The 'Ranking List' is based on the operator's personal listening experience " +
			'and subjective evaluation of sound quality.',
		footerNoteKo:
			"'\uB7AD\uD0B9 \uB9AC\uC2A4\uD2B8'\uB294 \uC6B4\uC601\uC790\uC758 \uAC1C\uC778\uC801\uC778 \uCCAD\uC74C \uACBD\uD5D8\uACFC " +
			'\uC74C\uC9C8\uC5D0 \uB300\uD55C \uC8FC\uAD00\uC801 \uD3C9\uAC00\uB97C \uBC14\uD0D5\uC73C\uB85C \uC791\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
		footerLinkLabel: '',
		footerLinkUrl: '',
	};

	if (preset === 'stars') {
		base.badge = 'stars';
		base.scale = STARS.map(([value, score]) => step(value, score, ''));
		base.rankLabelEn = 'Rating';
		base.rankLabelKo = '평점';
		base.columns = base.columns.map(c => (c.id === 'score' ? { ...c, enabled: false } : c));
	} else if (preset === 'score') {
		base.badge = 'score-badge';
		base.scale = Array.from({ length: 11 }, (_, i) => {
			const value = 10 - i;
			return step(String(value), String(value), rampColor(DEFAULT_SCORE_RAMP, value / 10));
		});
		base.rankLabelEn = 'Score';
		base.rankLabelKo = '점수';
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
	return problems;
}
