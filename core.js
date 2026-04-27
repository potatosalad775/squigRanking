// Device Ranking List Page Script — v2 (config-driven)
// Reads window.RANKING_CONFIG (populated by ranking-config.js, loaded before this file)
// and renders filterable/sortable device cards per the declared columns/types/source.

const DEFAULT_CONFIG = { types: {}, columns: [], search: {}, sort: {}, stats: {}, deepLink: {} };
const CONFIG = window.RANKING_CONFIG || DEFAULT_CONFIG;

const ICONPATH_EXTERNALLINK = '<path d="M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19L18.9999 6.413L11.2071 14.2071L9.79289 12.7929L17.5849 5H13V3H21Z"></path>';

// ---------------- Config helpers ----------------
function getConfig(path, fallback) {
	const parts = String(path).split('.');
	let v = CONFIG;
	for (const p of parts) {
		if (v == null) return fallback;
		v = v[p];
	}
	return v === undefined ? fallback : v;
}

function resolveI18n(value, lang) {
	if (value == null) return '';
	if (typeof value === 'object' && (Object.prototype.hasOwnProperty.call(value, 'default') || Object.prototype.hasOwnProperty.call(value, 'i18n'))) {
		const t = value.i18n && value.i18n[lang];
		return t != null ? t : (value.default != null ? value.default : '');
	}
	return value;
}

function getColumn(id) {
	return (CONFIG.columns || []).find(c => c.id === id);
}

function getRankColumn() {
	return (CONFIG.columns || []).find(c => c.role === 'rank');
}

function visibleColumns(type) {
	return (CONFIG.columns || []).filter(c => !c.showForTypes || c.showForTypes.includes(type));
}

function getColumnFieldName(column, lang) {
	if (column.i18nSource) {
		return column.i18nSource[lang] || column.i18nSource.default || column.source;
	}
	return column.source;
}

function getColumnValue(row, column, lang) {
	const l = lang || currentLang;
	const field = getColumnFieldName(column, l);
	if (field && row[field] != null && row[field] !== '') return row[field];
	if (column.source && row[column.source] != null) return row[column.source];
	return '';
}

function interpolate(template, row) {
	return String(template).replace(/\{([^}]+)\}/g, (_, k) => row[k] != null ? row[k] : '');
}

function normalize(s) {
	if (!s) return '';
	return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeHtml(s) {
	return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------------- Deep-link hash ----------------
function buildCardId(row) {
	const tpl = getConfig('deepLink.template', '{Brand}-{Model}');
	const mode = getConfig('deepLink.slugify', 'lowercase-hyphen');
	return String(tpl).replace(/\{([^}]+)\}/g, (_, k) => {
		const v = row[k] != null ? String(row[k]) : '';
		return mode === 'lowercase-hyphen' ? v.toLowerCase().replace(/\s+/g, '-') : v;
	});
}

// ---------------- State ----------------
let currentLang = 'en';
const translations = {};
let currentType = null;
let deviceData = [];
const allDeviceData = {};
let filterState = {};

function initFilterState() {
	const sortDefault = getConfig('sort.default', '');
	filterState = { _sort: sortDefault, _search: '' };
	visibleColumns(currentType).forEach(c => { if (c.filter) filterState[c.id] = ''; });
}

// ---------------- Language (page chrome only) ----------------
function detectInitialLanguage() {
	const stored = localStorage.getItem('preferred-lang');
	if (stored === 'en' || stored === 'ko') return stored;
	const navLangs = (navigator.languages || [navigator.language || 'en']).map(l => String(l).toLowerCase());
	if (navLangs.some(l => l.startsWith('ko'))) return 'ko';
	return 'en';
}

async function loadLanguage(lang) {
	if (translations[lang]) return translations[lang];
	try {
		const res = await fetch(`lang/${lang}.json`, { cache: 'no-store' });
		if (!res.ok) throw new Error('Failed language load: ' + res.status);
		translations[lang] = await res.json();
	} catch (e) {
		console.error(e);
		translations[lang] = {};
	}
	return translations[lang];
}

function applyTranslations() {
	const dict = translations[currentLang] || {};
	Object.entries(dict).forEach(([key, value]) => {
		if (key.startsWith('#')) {
			const el = document.getElementById(key.slice(1));
			if (!el) return;
			if (typeof value === 'string' && /<[^>]+>/.test(value)) el.innerHTML = value;
			else el.textContent = value;
		} else if (key.startsWith('.')) {
			Array.from(document.getElementsByClassName(key.slice(1))).forEach(el => {
				if (typeof value === 'string' && /<[^>]+>/.test(value)) el.innerHTML = value;
				else el.textContent = value;
			});
		}
	});
	const langBtn = document.getElementById('toggle-language');
	if (langBtn) langBtn.title = currentLang === 'en' ? '한국어로 보기' : 'View in English';
	updateTypeToggleLabels();
	updateMeasurementsPageLink();
}

function updateTypeToggleLabels() {
	Object.entries(CONFIG.types || {}).forEach(([typeId, t]) => {
		const btn = document.querySelector(`.toggle-btn[data-type="${typeId}"]`);
		if (btn) btn.textContent = resolveI18n(t.label, currentLang);
	});
}

function updateMeasurementsPageLink() {
	const link = document.getElementById('link-measurements-page');
	if (!link || !currentType) return;
	const url = getConfig(`types.${currentType}.measurementsPageUrl`, '../');
	link.href = url;
}

async function initLanguage() {
	currentLang = detectInitialLanguage();
	await loadLanguage(currentLang);
	applyTranslations();
	const langBtn = document.getElementById('toggle-language');
	if (langBtn && !langBtn.dataset.i18nBound) {
		langBtn.addEventListener('click', async () => {
			currentLang = currentLang === 'en' ? 'ko' : 'en';
			localStorage.setItem('preferred-lang', currentLang);
			await loadLanguage(currentLang);
			applyTranslations();
			renderFilterControls();
			rerender();
		});
		langBtn.dataset.i18nBound = 'true';
	}
}

// ---------------- CSV loader (preserved from v1) ----------------
async function loadCSV(url) {
	const res = await fetch(url, { cache: 'no-store' });
	if (!res.ok) throw new Error('Failed to fetch CSV: ' + res.status);
	const text = await res.text();
	const rows = [];
	let cur = '';
	let inQuotes = false;
	const parsedRows = [];
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '"') {
			if (inQuotes && text[i+1] === '"') { cur += '"'; i++; }
			else inQuotes = !inQuotes;
		} else if (c === ',' && !inQuotes) {
			rows.push(cur); cur = '';
		} else if ((c === '\n' || c === '\r') && !inQuotes) {
			if (cur !== '' || rows.length) rows.push(cur);
			if (rows.length) parsedRows.push(rows.slice());
			rows.length = 0; cur = '';
			if (c === '\r' && text[i+1] === '\n') i++;
		} else {
			cur += c;
		}
	}
	if (cur.length || rows.length) { rows.push(cur); parsedRows.push(rows.slice()); }
	if (!parsedRows.length) return [];
	const header = parsedRows[0].map(h => h.trim());
	return parsedRows.slice(1)
		.filter(r => r.some(cell => cell.trim().length))
		.map(r => {
			const obj = {};
			header.forEach((h, idx) => { obj[h] = (r[idx] !== undefined ? r[idx] : '').trim(); });
			return obj;
		});
}

// ---------------- Normalize rows & setType ----------------
function normalizeRow(row, type) {
	const out = {};
	for (const k in row) out[k] = String(row[k] == null ? '' : row[k]).trim();
	const defaults = getConfig(`types.${type}.defaults`, {}) || {};
	for (const k in defaults) if (!out[k]) out[k] = defaults[k];
	out.__measurement = null;
	return out;
}

function setType(type) {
	const url = new URL(window.location);
	url.searchParams.set('type', type);
	window.history.replaceState({}, '', url);
	currentType = type;
	document.querySelectorAll('.toggle-btn').forEach(btn => {
		btn.classList.toggle('active', btn.dataset.type === type);
	});
	updateMeasurementsPageLink();
	deviceData = (allDeviceData[type] || []).map(r => normalizeRow(r, type));
	initFilterState();
	renderFilterControls();
	rerender();
}

// ---------------- Type toggle buttons (rendered from config) ----------------
function renderTypeToggles() {
	const container = document.querySelector('.toggle-group');
	if (!container) return;
	container.innerHTML = '';
	Object.entries(CONFIG.types || {}).forEach(([id, t]) => {
		const btn = document.createElement('button');
		btn.className = 'toggle-btn';
		btn.dataset.type = id;
		btn.id = `toggle-${id}`;
		btn.textContent = resolveI18n(t.label, currentLang);
		btn.onclick = () => setType(id);
		container.appendChild(btn);
	});
}

// ---------------- Filter & sort controls ----------------
function sortOptionLabel(key) {
	const labels = getConfig('sort.labels', {}) || {};
	if (labels[key]) return resolveI18n(labels[key], currentLang);
	const dict = translations[currentLang] || {};
	if (dict[key]) return dict[key];
	const m = key.match(/^(.+)-(asc|desc)$/);
	if (m) {
		const col = getColumn(m[1]);
		const colLabel = col ? resolveI18n(col.label, currentLang) : m[1];
		const dir = m[2] === 'asc' ? 'A to Z' : 'Z to A';
		return `${colLabel} (${dir})`;
	}
	return key;
}

function renderFilterControls() {
	const container = document.getElementById('filter-controls');
	if (!container) return;
	container.innerHTML = '';

	const wrapper = document.createElement('div');
	wrapper.className = 'filter-collapse-wrapper collapsed';

	// Collapse toggle
	const toggleBtn = document.createElement('button');
	toggleBtn.className = 'filter-collapse-toggle';
	toggleBtn.setAttribute('aria-expanded', 'false');
	toggleBtn.innerHTML = `
		<div class="filter-collapse-content-header">
			<span class="filter-toggle-icon">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z"></path></svg>
			</span>
			<span id="filter-toggle-label">Filter &amp; Sort</span>
		</div>
	`;
	wrapper.appendChild(toggleBtn);

	// Top row: search + sort (always visible)
	const topRow = document.createElement('div');
	topRow.className = 'filter-collapse-content-controls';

	if (getConfig('search.enabled', true)) {
		const searchInput = document.createElement('input');
		searchInput.id = 'input-search';
		searchInput.type = 'text';
		searchInput.value = filterState._search || '';
		searchInput.placeholder = resolveI18n(getConfig('search.label', { default: 'Search' }), currentLang);
		searchInput.oninput = e => { filterState._search = e.target.value.toLowerCase(); rerender(); };
		topRow.appendChild(searchInput);
	}

	const sortSelect = document.createElement('select');
	sortSelect.id = 'select-sort';
	sortSelect.title = 'Sort by';
	(getConfig('sort.options', []) || []).forEach(key => {
		const opt = document.createElement('option');
		opt.value = key;
		opt.textContent = sortOptionLabel(key);
		sortSelect.appendChild(opt);
	});
	sortSelect.value = filterState._sort;
	sortSelect.onchange = e => { filterState._sort = e.target.value; rerender(); };
	topRow.appendChild(sortSelect);

	wrapper.appendChild(topRow);

	// Per-column filters (collapsible)
	const content = document.createElement('div');
	content.className = 'filter-collapse-content collapsed';
	content.setAttribute('aria-hidden', 'true');

	visibleColumns(currentType).forEach(column => {
		if (!column.filter) return;
		const label = document.createElement('label');
		const labelText = document.createElement('span');
		labelText.id = `filter-label-${column.id}`;
		labelText.textContent = resolveI18n(column.label, currentLang);
		label.appendChild(labelText);

		let input;
		if (column.filter.kind === 'select') {
			input = document.createElement('select');
			const allOpt = document.createElement('option');
			allOpt.value = '';
			allOpt.textContent = 'All';
			input.appendChild(allOpt);
			(column.filter.values || []).forEach(v => {
				const o = document.createElement('option');
				o.value = v;
				o.textContent = v;
				input.appendChild(o);
			});
			input.value = filterState[column.id] || '';
			input.onchange = e => { filterState[column.id] = e.target.value.replace(/\s+/g, '').toUpperCase(); rerender(); };
		} else {
			input = document.createElement('input');
			input.type = 'text';
			input.value = filterState[column.id] || '';
			input.placeholder = resolveI18n(column.label, currentLang);
			input.oninput = e => { filterState[column.id] = e.target.value.toLowerCase(); rerender(); };
		}
		input.id = `filter-input-${column.id}`;
		label.appendChild(input);
		content.appendChild(label);
	});

	const resetBtn = document.createElement('button');
	resetBtn.id = 'reset-filters-btn';
	resetBtn.textContent = 'Reset Filters';
	resetBtn.onclick = () => {
		initFilterState();
		renderFilterControls();
		rerender();
	};
	content.appendChild(resetBtn);

	wrapper.appendChild(content);
	container.appendChild(wrapper);

	let collapsed = true;
	toggleBtn.addEventListener('click', () => {
		collapsed = !collapsed;
		wrapper.classList.toggle('collapsed', collapsed);
		content.classList.toggle('collapsed', collapsed);
		content.setAttribute('aria-hidden', String(collapsed));
		toggleBtn.setAttribute('aria-expanded', String(!collapsed));
		const icon = toggleBtn.querySelector('.filter-toggle-icon');
		if (icon) icon.style.transform = collapsed ? 'rotate(0deg)' : 'rotate(-180deg)';
	});

	applyTranslations();
}

// ---------------- Filter + sort ----------------
function rankIndexFactory() {
	const rc = getRankColumn();
	const values = rc ? ((rc.filter && rc.filter.values) || []) : [];
	return v => {
		const idx = values.indexOf(String(v || '').toUpperCase().replace(/\s+/g, ''));
		return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
	};
}

function getSortComparator(key) {
	const column = getColumn(key);
	if (column) {
		if (column.role === 'rank') return { kind: 'rank', column };
		if ((column.render && column.render.kind === 'numeric') || column.role === 'score') return { kind: 'numeric', column };
		if (column.render && column.render.kind === 'title' && column.render.template) return { kind: 'template', column };
		return { kind: 'string', column };
	}
	const titleCase = key.charAt(0).toUpperCase() + key.slice(1);
	return { kind: 'string', field: titleCase };
}

function getSortValue(row, cmp, rankIdx) {
	if (cmp.kind === 'rank') return rankIdx(getColumnValue(row, cmp.column));
	if (cmp.kind === 'numeric') return parseFloat(getColumnValue(row, cmp.column)) || 0;
	if (cmp.kind === 'template') return interpolate(cmp.column.render.template, row);
	if (cmp.column) return String(getColumnValue(row, cmp.column));
	return String(row[cmp.field] || '');
}

function filterAndSortData(data) {
	const search = filterState._search || '';
	const searchFields = getConfig('search.fields', []) || [];
	const cols = visibleColumns(currentType).filter(c => c.filter);

	let filtered = data.filter(row => {
		for (const c of cols) {
			const val = filterState[c.id];
			if (!val) continue;
			if (c.filter.kind === 'select') {
				const rowVal = String(getColumnValue(row, c)).replace(/\s+/g, '').toUpperCase();
				if (rowVal !== String(val).replace(/\s+/g, '').toUpperCase()) return false;
			} else {
				const fields = (c.filter.match && c.filter.match.length) ? c.filter.match : (c.source ? [c.source] : []);
				const hit = fields.some(f => String(row[f] || '').toLowerCase().includes(val));
				if (!hit) return false;
			}
		}
		if (search) {
			const hit = searchFields.some(f => String(row[f] || '').toLowerCase().includes(search));
			if (!hit) return false;
		}
		return true;
	});

	const sortKey = String(filterState._sort || '').replace(/-(asc|desc)$/, '');
	const sortDir = String(filterState._sort || '').endsWith('-asc') ? 1 : -1;
	const rankIdx = rankIndexFactory();
	const cmp = getSortComparator(sortKey);

	filtered.sort((a, b) => {
		const vA = getSortValue(a, cmp, rankIdx);
		const vB = getSortValue(b, cmp, rankIdx);
		if (vA < vB) return -1 * sortDir;
		if (vA > vB) return 1 * sortDir;
		// secondary: rank
		if (cmp.kind !== 'rank') {
			const rA = rankIdx(a.Rank);
			const rB = rankIdx(b.Rank);
			if (rA < rB) return -1;
			if (rA > rB) return 1;
		}
		// tertiary: Brand
		const bA = String(a.Brand || '');
		const bB = String(b.Brand || '');
		if (bA < bB) return -1;
		if (bA > bB) return 1;
		// quaternary: Model
		const mA = String(a.Model || '');
		const mB = String(b.Model || '');
		if (mA < mB) return -1;
		if (mA > mB) return 1;
		return 0;
	});
	return filtered;
}

// ---------------- Card rendering ----------------
function pickSlot(column) {
	if (column.placement) return column.placement;
	const kind = column.render && column.render.kind;
	switch (kind) {
		case 'rank-badge': return 'rank';
		case 'title': return 'title';
		case 'comment': return 'body';
		case 'measurement-link': return 'actions';
		case 'link': return 'actions';
		case 'meta-chip':
		case 'text':
		case 'numeric':
			return 'meta';
		case 'none':
		default:
			return null;
	}
}

function renderColumn(row, column) {
	if (!column.render) return null;
	switch (column.render.kind) {
		case 'rank-badge': return renderRankBadge(row, column);
		case 'title': return renderTitle(row, column);
		case 'meta-chip': return renderMetaChip(row, column);
		case 'text':
		case 'numeric': return renderText(row, column);
		case 'link': return renderLink(row, column);
		case 'comment': return renderCommentCell(row, column);
		case 'measurement-link': return renderMeasurementCell(row, column);
		case 'none':
		default: return null;
	}
}

function renderRankBadge(row, column) {
	const raw = String(getColumnValue(row, column) || '').replace(/\s+/g, '');
	const classMap = (column.render && column.render.classMap) || {};
	const cls = classMap[raw] || classMap.default || 'rank-F';
	const el = document.createElement('div');
	el.className = 'device-card-rank ' + cls;
	el.textContent = raw;
	return el;
}

function renderTitle(row, column) {
	const text = (column.render && column.render.template)
		? interpolate(column.render.template, row)
		: String(getColumnValue(row, column));
	const el = document.createElement('span');
	el.className = 'device-card-header';
	el.textContent = text;
	return el;
}

function renderMetaChip(row, column) {
	const v = getColumnValue(row, column);
	if (!v) return null;
	const el = document.createElement('span');
	el.className = `device-card-${column.id}`;
	el.textContent = v;
	return el;
}

function renderText(row, column) {
	const v = getColumnValue(row, column);
	if (!v) return null;
	const el = document.createElement('span');
	el.className = `device-card-${column.id}`;
	el.textContent = v;
	return el;
}

function renderLink(row, column) {
	const href = (column.render && column.render.hrefTemplate)
		? interpolate(column.render.hrefTemplate, row)
		: ((column.render && column.render.href) || '#');
	const el = document.createElement('a');
	el.className = `device-card-${column.id}`;
	el.href = href;
	el.target = '_blank';
	el.rel = 'noopener';
	el.textContent = resolveI18n((column.render && column.render.text) || column.label, currentLang);
	return el;
}

function renderCommentCell(row, column) {
	const text = getColumnValue(row, column);
	const fallback = column.source ? row[column.source] : '';
	const el = document.createElement('div');
	el.className = 'device-card-comment';
	el.appendChild(divComment(text || fallback));
	return el;
}

function renderMeasurementCell(row, column) {
	const el = document.createElement('a');
	el.className = 'device-card-measurement';
	el.href = row.__measurement || '#';
	el.target = '_blank';
	el.rel = 'noopener';
	const label = resolveI18n(column.label, currentLang);
	el.title = label;
	el.innerHTML = `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">${ICONPATH_EXTERNALLINK}</svg>
		<span class="device-card-measurement-label">${escapeHtml(label)}</span>
	`;
	return el;
}

function renderDeviceCards(data) {
	const container = document.getElementById('device-card-list');
	if (!container) return;
	container.innerHTML = '';
	const cols = visibleColumns(currentType);

	data.forEach(row => {
		const card = document.createElement('div');
		card.className = 'device-card';
		card.dataset.brand = normalize(row.Brand);
		card.dataset.model = normalize(row.Model);
		card.id = buildCardId(row);

		const headerDiv = document.createElement('div');
		headerDiv.className = 'device-card-header-div';
		const metaDiv = document.createElement('div');
		metaDiv.className = 'device-card-meta';
		let metaHasContent = false;
		let metaChipAdded = false;
		const actionsBuffer = [];
		const bodyBuffer = [];

		cols.forEach(column => {
			const el = renderColumn(row, column);
			if (!el) return;
			const slot = pickSlot(column);
			if (slot === 'rank') {
				card.appendChild(el);
			} else if (slot === 'title') {
				headerDiv.appendChild(el);
			} else if (slot === 'meta') {
				if (column.render && column.render.kind === 'meta-chip' && metaChipAdded) {
					metaDiv.appendChild(document.createTextNode(' | '));
				}
				metaDiv.appendChild(el);
				if (column.render && column.render.kind === 'meta-chip') metaChipAdded = true;
				metaHasContent = true;
			} else if (slot === 'actions') {
				actionsBuffer.push(el);
			} else if (slot === 'body') {
				bodyBuffer.push(el);
			}
		});

		if (metaHasContent) headerDiv.appendChild(metaDiv);
		actionsBuffer.forEach(e => headerDiv.appendChild(e));
		card.appendChild(headerDiv);
		bodyBuffer.forEach(e => card.appendChild(e));

		container.appendChild(card);
	});

	updateMeasurementURLs(currentType, deviceData);
}

// ---------------- Measurement URL resolver (preserved fuzzy matching) ----------------
async function updateMeasurementURLs(type, data) {
	const typeCfg = getConfig(`types.${type}`, {}) || {};
	const phonebookUrl = typeCfg.phonebook;
	const template = typeCfg.measurementUrl;
	if (!phonebookUrl || !template) return;

	const pb = await fetch(phonebookUrl).then(res => res.json()).catch(() => null);

	function removeUnavailableLinks(linkElement) {
		if (linkElement) linkElement.remove();
	}

	data.forEach(entry => {
		const brandRaw = entry.Brand || '';
		const modelRaw = entry.Model || '';
		const brand = normalize(brandRaw);
		const model = normalize(modelRaw);
		if (!brand || !model) return;

		let linkElement = document.querySelector(`.device-card[data-brand="${brand}"][data-model="${model}"] .device-card-measurement`);
		if (!linkElement) {
			linkElement = Array.from(document.querySelectorAll('.device-card')).find(el => {
				return (el.getAttribute('data-brand') || '') === (entry.Brand || '') && (el.getAttribute('data-model') || '') === (entry.Model || '');
			})?.querySelector('.device-card-measurement') || null;
		}
		if (!linkElement) return;
		if (!pb) { removeUnavailableLinks(linkElement); return; }

		let matchBrand = pb.find(b => normalize(b.name) === brand);
		if (!matchBrand) matchBrand = pb.find(b => normalize(b.name).includes(brand) || brand.includes(normalize(b.name)));
		if (!matchBrand) {
			const simple = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
			const simpleBrand = simple(brand);
			matchBrand = pb.find(b => simple(b.name) === simpleBrand);
			if (!matchBrand) matchBrand = pb.find(b => simple(b.name).includes(simpleBrand) || simpleBrand.includes(simple(b.name)));
		}
		if (!matchBrand) { removeUnavailableLinks(linkElement); return; }

		const phones = matchBrand.phones || [];
		let matchModel = phones.find(m => normalize(m.name) === model);
		if (!matchModel) matchModel = phones.find(m => normalize(m.name).includes(model) || model.includes(normalize(m.name)));
		if (!matchModel) matchModel = phones.find(m => (m.prefix && normalize(m.prefix).includes(model)) || (m.suffix && normalize(m.suffix).includes(model)));
		if (!matchModel) matchModel = phones.find(m => normalize(m.name).startsWith(model) || model.startsWith(normalize(m.name)));
		if (!matchModel) {
			const simple = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
			const simpleModel = simple(model);
			matchModel = phones.find(m => simple(m.name) === simpleModel);
			if (!matchModel) matchModel = phones.find(m => simple(m.name).includes(simpleModel) || simpleModel.includes(simple(m.name)));
		}
		if (!matchModel) { removeUnavailableLinks(linkElement); return; }

		let matchFile = null;
		if (Array.isArray(matchModel.file)) matchFile = String(matchModel.file[0] || '').trim();
		else if (matchModel.file) matchFile = String(matchModel.file).trim();
		if (!matchFile) { removeUnavailableLinks(linkElement); return; }
		matchFile = encodeURIComponent(matchFile.replace(/\s+/g, '_'));

		entry.__measurement = String(template).replace('{file}', matchFile);
		linkElement.href = entry.__measurement;
	});
}

// ---------------- Comment parser (preserved verbatim from v1) ----------------
function divComment(text) {
	const div = document.createElement('div');
	div.classList.add('comment-container');
	if (!text) {
		const emptySpan = document.createElement('span');
		emptySpan.classList.add('comment-main');
		emptySpan.textContent = 'No comment';
		emptySpan.style.fontStyle = 'italic';
		emptySpan.style.color = 'var(--color-text-muted)';
		div.appendChild(emptySpan);
		return div;
	}
	const asteriskMatches = Array.from(text.matchAll(/\*(.*?)\*/g));
	if (asteriskMatches.length) {
		const asteriskDiv = document.createElement('div');
		asteriskDiv.classList.add('comment-asterisk');
		for (const match of asteriskMatches) {
			if (!match[0] || !match[0].trim()) continue;
			text = text.replace(match[0], '').trim();
			const asteriskSpan = document.createElement('span');
			appendTextWithBreaks(asteriskSpan, match[1].trim());
			asteriskDiv.appendChild(asteriskSpan);
		}
		div.appendChild(asteriskDiv);
	}
	const extraComment = text.split('※')[1] || '';
	if (extraComment) {
		text = text.split('※')[0];
		const extraDiv = document.createElement('div');
		extraDiv.classList.add('comment-extra');
		const extraIcon = document.createElement('span');
		extraIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12.9998 3L12.9996 10.267L19.294 6.63397L20.294 8.36602L14.0006 11.999L20.294 15.634L19.294 17.366L12.9996 13.732L12.9998 21H10.9998L10.9996 13.732L4.70557 17.366L3.70557 15.634L9.99857 12L3.70557 8.36602L4.70557 6.63397L10.9996 10.267L10.9998 3H12.9998Z"></path></svg>';
		extraIcon.classList.add('comment-icon');
		const extraSpan = document.createElement('span');
		appendTextWithBreaks(extraSpan, extraComment.trim());
		extraDiv.appendChild(extraIcon);
		extraDiv.appendChild(extraSpan);
		div.prepend(extraDiv);
	}
	const questionableComment = text.split('\\?')[1] || '';
	if (questionableComment) {
		text = text.split('\\?')[0];
		const questionDiv = document.createElement('div');
		questionDiv.classList.add('comment-question');
		const questionIcon = document.createElement('span');
		questionIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 19C12.8284 19 13.5 19.6716 13.5 20.5C13.5 21.3284 12.8284 22 12 22C11.1716 22 10.5 21.3284 10.5 20.5C10.5 19.6716 11.1716 19 12 19ZM12 2C15.3137 2 18 4.68629 18 8C18 10.1646 17.2474 11.2907 15.3259 12.9231C13.3986 14.5604 13 15.2969 13 17H11C11 14.526 11.787 13.3052 14.031 11.3989C15.5479 10.1102 16 9.43374 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8V9H6V8C6 4.68629 8.68629 2 12 2Z"></path></svg>';
		questionIcon.classList.add('comment-icon');
		const questionSpan = document.createElement('span');
		appendTextWithBreaks(questionSpan, questionableComment.trim());
		questionDiv.appendChild(questionIcon);
		questionDiv.appendChild(questionSpan);
		div.prepend(questionDiv);
	}
	const downSideComment = text.split('\\-')[1] || '';
	if (downSideComment) {
		text = text.split('\\-')[0];
		const downDiv = document.createElement('div');
		downDiv.classList.add('comment-down');
		const downIcon = document.createElement('span');
		downIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 11V13H19V11H5Z"></path></svg>';
		downIcon.classList.add('comment-icon');
		const downSpan = document.createElement('span');
		appendTextWithBreaks(downSpan, downSideComment.trim());
		downDiv.appendChild(downIcon);
		downDiv.appendChild(downSpan);
		div.prepend(downDiv);
	}
	const upSideComment = text.split('\\+')[1] || '';
	if (upSideComment) {
		text = text.split('\\+')[0];
		const upDiv = document.createElement('div');
		upDiv.classList.add('comment-up');
		const upIcon = document.createElement('span');
		upIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z"></path></svg>';
		upIcon.classList.add('comment-icon');
		const upSpan = document.createElement('span');
		appendTextWithBreaks(upSpan, upSideComment.trim());
		upDiv.appendChild(upIcon);
		upDiv.appendChild(upSpan);
		div.prepend(upDiv);
	}
	const mainSpan = document.createElement('span');
	mainSpan.classList.add('comment-main');
	appendTextWithBreaks(mainSpan, text.trim());
	div.prepend(mainSpan);
	return div;
}

function appendTextWithBreaks(el, str) {
	if (!str) return;
	const parts = String(str).split(/\r\n|\n|\r/);
	for (let i = 0; i < parts.length; i++) {
		el.appendChild(document.createTextNode(parts[i]));
		if (i < parts.length - 1) el.appendChild(document.createElement('br'));
	}
}

// ---------------- Stats ----------------
let chartInstance = null;
function renderStats(data) {
	const rankCol = getRankColumn();
	const labels = rankCol ? ((rankCol.filter && rankCol.filter.values) || []) : [];
	const avgCfg = getConfig('stats.average', { source: 'Score' }) || {};
	const avgEl = document.getElementById('avg-score');
	if (avgEl) {
		const src = avgCfg.source || 'Score';
		const avg = data.length
			? (data.reduce((s, d) => s + (parseFloat(d[src]) || 0), 0) / data.length).toFixed(2)
			: '-';
		avgEl.textContent = avg;
	}
	if (rankCol) {
		const counts = labels.map(r => data.filter(d => String(getColumnValue(d, rankCol)).toUpperCase().replace(/\s+/g,'') === r).length);
		renderBarChart(labels, counts);
	}
}

function renderBarChart(labels, counts) {
	const canvas = document.getElementById('rank-bar-chart');
	if (!canvas || typeof Chart === 'undefined') return;
	const ctx = canvas.getContext('2d');
	if (chartInstance) chartInstance.destroy();
	const colors = getConfig('stats.chartColors', ['#6c63ff','#00bfae','#00bfff','#4caf50','#8bc34a','#ffb347','#ffc107','#ff9800','#ff5722','#b71c1c']);
	chartInstance = new Chart(ctx, {
		type: 'bar',
		data: {
			labels,
			datasets: [{ label: 'Device Count', data: counts, backgroundColor: colors }],
		},
		options: {
			plugins: { legend: { display: false } },
			scales: { y: { beginAtZero: true, precision: 0 } },
		},
	});
}

// ---------------- Skeletons & theme ----------------
function renderSkeletons(count = 10) {
	const container = document.getElementById('device-card-list');
	if (!container) return;
	container.innerHTML = '';
	for (let i = 0; i < count; i++) {
		const card = document.createElement('div');
		card.className = 'device-card skeleton-card';
		card.innerHTML = `
			<div class="device-card-rank skeleton-block skeleton-pulse"></div>
			<div class="device-card-header-div">
				<span class="device-card-header skeleton-line skeleton-pulse" style="width:70%;height:1.1em;"></span>
				<div class="device-card-meta">
					<span class="skeleton-chip skeleton-pulse" style="width:4.5rem;"></span>
					<span class="skeleton-chip skeleton-pulse" style="width:3.25rem;"></span>
				</div>
				<span class="device-card-measurement skeleton-btn skeleton-pulse" style="width:6.5rem;height:1.2rem;"></span>
			</div>
			<div class="device-card-comment" style="flex:1;display:flex;flex-direction:column;gap:0.45rem;">
				<span class="skeleton-line skeleton-pulse" style="width:95%;height:0.85rem;"></span>
				<span class="skeleton-line skeleton-pulse" style="width:88%;height:0.85rem;"></span>
				<span class="skeleton-line skeleton-pulse" style="width:70%;height:0.85rem;"></span>
			</div>
		`;
		container.appendChild(card);
	}
}

function setupThemeToggle() {
	const btn = document.getElementById('toggle-theme');
	if (!btn) return;
	const saved = localStorage.getItem('preferred-theme');
	if (saved === 'light' || saved === 'dark') {
		document.documentElement.setAttribute('data-theme', saved);
		btn.setAttribute('aria-label', 'Switch to ' + (saved === 'light' ? 'dark' : 'light') + ' theme');
	} else {
		const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
		const theme = prefersDark ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', theme);
		btn.setAttribute('aria-label', 'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' theme');
	}
	btn.addEventListener('click', () => {
		const cur = document.documentElement.getAttribute('data-theme') || 'light';
		const next = cur === 'light' ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', next);
		localStorage.setItem('preferred-theme', next);
		btn.setAttribute('aria-label', 'Switch to ' + (next === 'light' ? 'dark' : 'light') + ' theme');
	});
}

// ---------------- Rerender ----------------
function rerender() {
	const filtered = filterAndSortData(deviceData);
	renderDeviceCards(filtered);
}

// ---------------- Init ----------------
window.addEventListener('DOMContentLoaded', async () => {
	const typeIds = Object.keys(CONFIG.types || {});
	if (!typeIds.length) {
		console.error('RANKING_CONFIG.types is empty — nothing to render.');
		return;
	}

	renderTypeToggles();
	await initLanguage();
	setupThemeToggle();
	renderSkeletons();

	// Load all per-type CSVs in parallel
	try {
		const entries = Object.entries(CONFIG.types || {});
		const results = await Promise.all(entries.map(([, t]) => {
			const src = t.source || {};
			if (src.kind === 'csv' && src.url) return loadCSV(src.url);
			return Promise.resolve([]);
		}));
		entries.forEach(([id], i) => { allDeviceData[id] = results[i] || []; });
	} catch (err) {
		console.error('Error loading data', err);
		typeIds.forEach(id => { allDeviceData[id] = allDeviceData[id] || []; });
	}

	const typeParam = new URLSearchParams(window.location.search).get('type');
	const initialType = (typeParam && CONFIG.types[typeParam]) ? typeParam : typeIds[0];
	setType(initialType);
	applyTranslations();

	// Stats modal
	const statsModal = document.getElementById('stats-modal');
	const openStatsBtn = document.getElementById('open-stats-modal');
	const closeStatsBtn = document.getElementById('close-stats-modal');
	if (statsModal && openStatsBtn && closeStatsBtn) {
		const modalBackdrop = statsModal.querySelector('.stats-modal-backdrop');
		const openModal = () => {
			statsModal.style.display = 'flex';
			document.body.style.overflow = 'hidden';
			renderStats(deviceData);
			closeStatsBtn.focus();
		};
		const closeModal = () => {
			statsModal.style.display = 'none';
			document.body.style.overflow = '';
			openStatsBtn.focus();
		};
		openStatsBtn.addEventListener('click', openModal);
		closeStatsBtn.addEventListener('click', closeModal);
		if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
		document.addEventListener('keydown', e => {
			if (statsModal.style.display === 'flex' && (e.key === 'Escape' || e.key === 'Esc')) closeModal();
		});
		statsModal.addEventListener('keydown', e => {
			if (statsModal.style.display !== 'flex') return;
			if (e.key !== 'Tab') return;
			const focusable = statsModal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
			if (!focusable.length) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey) {
				if (document.activeElement === first) { last.focus(); e.preventDefault(); }
			} else {
				if (document.activeElement === last) { first.focus(); e.preventDefault(); }
			}
		});
	}

	// Scroll-to-top FAB
	const scrollTopBtn = document.getElementById('scroll-to-top-btn');
	if (scrollTopBtn) scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

	// Hash-based scrolling to device cards
	function findTypeForHashId(hashId) {
		if (!hashId) return null;
		for (const id of typeIds) {
			if ((allDeviceData[id] || []).some(r => buildCardId(r) === hashId)) return id;
		}
		return null;
	}

	function highlightAndScroll(card) {
		if (!card) return;
		card.classList.add('hash-highlight');
		card.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
		card.setAttribute('tabindex', '-1');
		card.focus({ preventScroll: true });
		setTimeout(() => { card.classList.remove('hash-highlight'); card.removeAttribute('tabindex'); }, 6000);
	}

	function attemptScrollToHash(attemptsLeft = 40) {
		const hashId = window.location.hash.replace(/^#/, '');
		if (!hashId) return;
		const card = document.getElementById(hashId);
		if (card) { highlightAndScroll(card); return; }
		if (attemptsLeft <= 0) return;
		setTimeout(() => attemptScrollToHash(attemptsLeft - 1), 100);
	}

	function handleHash() {
		const hashId = window.location.hash.replace(/^#/, '');
		if (!hashId) return;
		const target = findTypeForHashId(hashId);
		if (target && target !== currentType) setType(target);
		attemptScrollToHash();
	}

	handleHash();
	window.addEventListener('hashchange', handleHash);
});
