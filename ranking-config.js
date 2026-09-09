// Letter grades, S through F. This is the default configuration: the build
// copies it into dist/ as ranking-config.js. The other rank styles are the
// sibling folders in presets/.
//
// The `scale` on the rank column is the only place the grades are defined: it
// sets the order, the dropdown, the badge colors, the chart, and the scores.
// Loaded as a plain <script> before core.js, so window.RANKING_CONFIG is set at parse time.
//
// The JSDoc line below gives editors autocomplete and inline validation for the
// whole object once `npm install squig-ranking` has run. It is a comment, so it
// costs nothing at runtime and is safe to delete.

/** @type {import('squig-ranking').RankingConfig} */
window.RANKING_CONFIG = {
	configVersion: 4,

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
			defaults: { Style: 'IEM' },
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
			defaults: { Style: 'Open' },
		},
	},

	columns: [
		{
			id: 'rank',
			source: 'Rank',
			role: 'rank',
			label: { default: 'Rank', i18n: { ko: '등급' } },
			sortable: true,
			// The scale is the whole rank definition: order, dropdown options,
			// badge colors, chart colors, and the score each grade is worth.
			// Add, remove or recolor a step here and every one of those follows.
			scale: [
				{ value: 'S', score: 5, color: '#6c63ff' },
				{ value: 'A+', score: 4.5, color: '#00bfae' },
				{ value: 'A', score: 4, color: '#00bfff' },
				{ value: 'B+', score: 3.5, color: '#4caf50' },
				{ value: 'B', score: 3, color: '#8bc34a' },
				{ value: 'C+', score: 2.5, color: '#ffb347' },
				{ value: 'C', score: 2, color: '#ffc107' },
				{ value: 'D+', score: 1.5, color: '#ff9800' },
				{ value: 'D', score: 1, color: '#ff5722' },
				{ value: 'F', score: 0, color: '#b71c1c' },
			],
			filter: { kind: 'select' },
			render: { kind: 'rank-badge' },
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
		{
			id: 'score',
			source: 'Score',
			role: 'score',
			label: { default: 'Score', i18n: { ko: '점수' } },
			sortable: true,
			render: { kind: 'none' },
		},
		{
			id: 'driver',
			source: 'Driver',
			label: { default: 'Driver', i18n: { ko: '드라이버' } },
			filter: { kind: 'select-auto' },
			render: { kind: 'meta-chip' },
		},
		{
			id: 'style',
			source: 'Style',
			label: { default: 'Style', i18n: { ko: '형태' } },
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
			'rank-asc': { default: 'Rank (Best First)', i18n: { ko: '등급순 (높은 순)' } },
			'rank-desc': { default: 'Rank (Worst First)', i18n: { ko: '등급순 (낮은 순)' } },
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

	// The page shell. index.html is three empty landmarks; everything visible in
	// the header and footer is built from here, so branding the page never means
	// editing markup.
	chrome: {
		title: 'SquigRanking',
		// subtitle: 'IEM and headphone rankings',
		// titleUrl: '../',
		footer: {
			note: {
				default:
					"The 'Ranking List' is based on the operator's personal listening " +
					'experience and subjective evaluation of sound quality.',
				i18n: {
					ko: "'랭킹 리스트'는 운영자의 개인적인 청음 경험과 음질에 대한 주관적 평가를 바탕으로 작성되었습니다.",
				},
			},
			// links: [
			// 	{ href: 'https://example.com', label: 'My site', newTab: true },
			// ],
		},
	},

	deepLink: {
		template: '{Brand}-{Model}',
		slugify: 'lowercase-hyphen',
	},
};
