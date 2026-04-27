// Default ranking-page configuration. Operators edit this file to change
// schema, filters, sort options, and per-type data sources without touching core.js.
// Loaded as a plain <script> before core.js so window.RANKING_CONFIG is set at parse time.

window.RANKING_CONFIG = {
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
			label: { default: 'Rank', i18n: { ko: '등급' } },
			sortable: true,
			filter: {
				kind: 'select',
				values: ['S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'],
			},
			render: {
				kind: 'rank-badge',
				classMap: {
					'S': 'rank-S',
					'A+': 'rank-Aplus',
					'A': 'rank-A',
					'B+': 'rank-Bplus',
					'B': 'rank-B',
					'C+': 'rank-Cplus',
					'C': 'rank-C',
					'D+': 'rank-Dplus',
					'D': 'rank-D',
					'F': 'rank-F',
					default: 'rank-F',
				},
			},
		},
		{
			id: 'title',
			label: { default: 'Device', i18n: { ko: '기기' } },
			render: { kind: 'title', template: '{Brand} {Model}' },
		},
		{
			id: 'brand',
			source: 'Brand',
			label: { default: 'Brand', i18n: { ko: '브랜드' } },
			sortable: true,
			filter: { kind: 'text' },
			render: { kind: 'none' },
		},
		{
			id: 'model',
			source: 'Model',
			label: { default: 'Model', i18n: { ko: '모델' } },
			sortable: true,
			filter: { kind: 'text' },
			render: { kind: 'none' },
		},
		{
			id: 'type',
			source: 'Type',
			label: { default: 'Type', i18n: { ko: '종류' } },
			filter: { kind: 'text' },
			render: { kind: 'meta-chip' },
		},
		{
			id: 'ff',
			source: 'F/F',
			label: { default: 'Formfactor', i18n: { ko: '형태' } },
			showForTypes: ['headphone'],
			filter: { kind: 'text' },
			render: { kind: 'meta-chip' },
		},
		{
			id: 'comment',
			source: 'Comment',
			i18nSource: { en: 'Comment', ko: 'Comment_KR' },
			label: { default: 'Comment', i18n: { ko: '코멘트' } },
			render: { kind: 'comment' },
		},
		{
			id: 'measurement',
			label: { default: 'View Measurement', i18n: { ko: '측정 보기' } },
			render: { kind: 'measurement-link' },
		},
	],

	search: {
		enabled: true,
		fields: ['Brand', 'Model', 'Type', 'F/F', 'Comment', 'Comment_English'],
		label: { default: 'Search', i18n: { ko: '검색' } },
	},

	sort: {
		default: 'rank-asc',
		options: [
			'rank-asc', 'rank-desc',
			'brand-asc', 'brand-desc',
			'model-asc', 'model-desc',
		],
		labels: {
			'rank-asc':  { default: 'Rank (Best First)',  i18n: { ko: '등급순 (높은 순)' } },
			'rank-desc': { default: 'Rank (Worst First)', i18n: { ko: '등급순 (낮은 순)' } },
			'brand-asc':  { default: 'Brand (A to Z)', i18n: { ko: '브랜드순 (오름차순)' } },
			'brand-desc': { default: 'Brand (Z to A)', i18n: { ko: '브랜드순 (내림차순)' } },
			'model-asc':  { default: 'Model (A to Z)', i18n: { ko: '모델순 (오름차순)' } },
			'model-desc': { default: 'Model (Z to A)', i18n: { ko: '모델순 (내림차순)' } },
		},
	},

	stats: {
		enabled: true,
		average: { source: 'Score', denominator: '5.00' },
		chartColors: ['#6c63ff','#00bfae','#00bfff','#4caf50','#8bc34a','#ffb347','#ffc107','#ff9800','#ff5722','#b71c1c'],
	},

	deepLink: {
		template: '{Brand}-{Model}',
		slugify: 'lowercase-hyphen',
	},
};
