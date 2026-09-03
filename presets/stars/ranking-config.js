// Preset: five stars, in half steps.
// The Rank column holds a number from 0.5 to 5 and the badge draws the stars.
// There is no Score column: the scale supplies the numbers.
// Loaded as a plain <script> before core.js, so window.RANKING_CONFIG is set at parse time.
//
// The JSDoc line below gives editors autocomplete and inline validation for the
// whole object once `npm install squig-ranking` has run. It is a comment, so it
// costs nothing at runtime and is safe to delete.

/** @type {import('squig-ranking').RankingConfig} */
window.RANKING_CONFIG = {
	configVersion: 2,

	types: {
		earphone: {
			label: { default: 'Earphones', i18n: { ko: '이어폰' } },
			source: {
				kind: 'csv',
				url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSks_18k_uClvDeIliTDCEILHXkKEltrE5wEiUfQAIwq1NvlFkB49OTFmfazjx7FFJC8alqW-0nXZhI/pub?gid=0&single=true&output=csv',
			},
			phonebook: '../data/phone_book.json',
			measurementUrl: '../?share={file}',
			measurementsPageUrl: '../',
		},
		headphone: {
			label: { default: 'Headphones', i18n: { ko: '헤드폰' } },
			source: {
				kind: 'csv',
				url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSks_18k_uClvDeIliTDCEILHXkKEltrE5wEiUfQAIwq1NvlFkB49OTFmfazjx7FFJC8alqW-0nXZhI/pub?gid=0&single=true&output=csv',
			},
			phonebook: '../headphones/data/phone_book.json',
			measurementUrl: '../headphones/?share={file}',
			measurementsPageUrl: '../headphones/',
			defaults: { 'F/F': 'Open' },
		},
	},

	columns: [
		{
			id: 'rank',
			source: 'Rank',
			role: 'rank',
			label: { default: 'Rating', i18n: { ko: '평점' } },
			sortable: true,
			// Half steps are the whole scale. The badge draws them by clipping a row
			// of stars, so any fraction works without half-star artwork.
			scale: [
				{ value: '5', score: 5 },
				{ value: '4.5', score: 4.5 },
				{ value: '4', score: 4 },
				{ value: '3.5', score: 3.5 },
				{ value: '3', score: 3 },
				{ value: '2.5', score: 2.5 },
				{ value: '2', score: 2 },
				{ value: '1.5', score: 1.5 },
				{ value: '1', score: 1 },
				{ value: '0.5', score: 0.5 },
			],
			filter: { kind: 'select' },
			render: { kind: 'stars', max: 5 },
		},
		{
			id: 'title',
			label: { default: 'Device', i18n: { ko: '기기' } },
			render: { kind: 'title', template: '{Brand} {Model}' },
		},
		{
			id: 'brand',
			source: 'Brand',
			role: 'brand',
			label: { default: 'Brand', i18n: { ko: '브랜드' } },
			sortable: true,
			filter: { kind: 'text' },
			render: { kind: 'none' },
		},
		{
			id: 'model',
			source: 'Model',
			role: 'model',
			label: { default: 'Model', i18n: { ko: '모델' } },
			sortable: true,
			filter: { kind: 'text' },
			render: { kind: 'none' },
		},
		// No Score column in the sheet: the rank scale supplies the number used
		// by the score sort and the average readout.
		{
			id: 'score',
			role: 'score',
			label: { default: 'Score', i18n: { ko: '점수' } },
			sortable: true,
			render: { kind: 'none' },
		},
		{
			id: 'type',
			source: 'Type',
			label: { default: 'Type', i18n: { ko: '종류' } },
			filter: { kind: 'select-auto' },
			render: { kind: 'meta-chip' },
		},
		{
			id: 'ff',
			source: 'F/F',
			label: { default: 'Formfactor', i18n: { ko: '형태' } },
			showForTypes: ['headphone'],
			filter: { kind: 'select-auto' },
			render: { kind: 'meta-chip' },
		},
		{
			id: 'comment',
			source: 'Comment',
			i18nSource: { en: 'Comment', ko: 'Comment_KR' },
			label: { default: 'Comment', i18n: { ko: '코멘트' } },
			render: { kind: 'block', style: 'plain' },
		},
		{
			id: 'pros',
			source: 'Pros',
			i18nSource: { en: 'Pros', ko: 'Pros_KR' },
			label: { default: 'Pros', i18n: { ko: '장점' } },
			render: { kind: 'block', style: 'up' },
		},
		{
			id: 'cons',
			source: 'Cons',
			i18nSource: { en: 'Cons', ko: 'Cons_KR' },
			label: { default: 'Cons', i18n: { ko: '단점' } },
			render: { kind: 'block', style: 'down' },
		},
		{
			id: 'notes',
			source: 'Notes',
			i18nSource: { en: 'Notes', ko: 'Notes_KR' },
			label: { default: 'Notes', i18n: { ko: '추가 의견' } },
			render: { kind: 'block', style: 'note' },
		},
		{
			id: 'tags',
			source: 'Tags',
			label: { default: 'Tags', i18n: { ko: '태그' } },
			filter: { kind: 'text' },
			render: { kind: 'tags', separator: ',' },
		},
		{
			id: 'measurement',
			label: { default: 'View Measurement', i18n: { ko: '측정 보기' } },
			render: { kind: 'measurement-link' },
		},
	],

	// Omitting `search.fields` searches every header any column declares.
	search: {
		enabled: true,
		label: { default: 'Search', i18n: { ko: '검색' } },
	},

	sort: {
		default: 'rank-asc',
		options: [
			'rank-asc', 'rank-desc',
			'score-desc', 'score-asc',
			'brand-asc', 'brand-desc',
			'model-asc', 'model-desc',
		],
		labels: {
			'rank-asc': { default: 'Rating (Best First)', i18n: { ko: '평점 (높은 순)' } },
			'rank-desc': { default: 'Rating (Worst First)', i18n: { ko: '평점 (낮은 순)' } },
			'score-desc': { default: 'Score (High to Low)', i18n: { ko: '점수순 (높은 순)' } },
			'score-asc': { default: 'Score (Low to High)', i18n: { ko: '점수순 (낮은 순)' } },
		},
	},

	// Chart bars take their colors from the rank scale. Set `chartColors` here
	// only to override them.
	stats: {
		enabled: true,
		average: { source: 'Score', denominator: '5.00' },
	},

	deepLink: {
		template: '{Brand}-{Model}',
		slugify: 'lowercase-hyphen',
	},
};
