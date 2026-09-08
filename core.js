/*! squigRanking v1.0.0 | MIT | https://github.com/squigRanking */
(function() {
	//#region src/config.ts
	const EMPTY = {
		types: {},
		columns: []
	};
	let config = EMPTY;
	/** Install the operator config. Called once at startup. */
	function setConfig(next) {
		config = next ?? EMPTY;
		const declared = config.configVersion;
		if (declared !== void 0 && declared > 2) console.warn(`[squigRanking] ranking-config.js declares configVersion ${declared}, but this core understands 2. Update core.js.`);
	}
	function getConfig() {
		return config;
	}
	function getTypes() {
		return Object.entries(config.types ?? {});
	}
	function getTypeIds() {
		return Object.keys(config.types ?? {});
	}
	function getType(id) {
		if (!id) return void 0;
		return (config.types ?? {})[id];
	}
	function getColumns() {
		return config.columns ?? [];
	}
	function getColumn(id) {
		return getColumns().find((c) => c.id === id);
	}
	/** The column carrying a semantic role, e.g. the rank column used for badge order. */
	function getRoleColumn(role) {
		return getColumns().find((c) => c.role === role);
	}
	/** Columns applicable to a type, honoring `showForTypes`. */
	function visibleColumns(type) {
		return getColumns().filter((c) => !c.showForTypes || type !== null && c.showForTypes.includes(type));
	}
	/**
	* The rank column's scale, best first.
	*
	* A declared `scale` wins. Otherwise one is synthesized from a `select` filter's
	* values so that configs written before scales existed keep their order,
	* their dropdown, and their chart, just without colors or scores.
	*/
	function getRankScale() {
		const col = getRoleColumn("rank");
		if (!col) return [];
		if (col.scale?.length) return col.scale;
		if (col.filter?.kind === "select" && col.filter.values?.length) return col.filter.values.map((value) => ({ value }));
		return [];
	}
	/** Ordered rank values, best first. */
	function getRankValues() {
		return getRankScale().map((entry) => entry.value);
	}
	/** The scale as numbers, or null when any step is not numeric. */
	function numericScale() {
		const scale = getRankScale();
		if (scale.length < 2) return null;
		const numbers = scale.map((entry) => Number.parseFloat(entry.value));
		return numbers.every((n) => !Number.isNaN(n)) ? numbers : null;
	}
	/**
	* Position of a cell value in the scale, best first; -1 when it is off-scale.
	*
	* Matching ignores case and spacing. On an all-numeric scale a value between
	* two steps snaps to the nearer one, so a sheet holding 8.5 against a
	* whole-number scale still sorts, still tallies in the chart, and still gets a badge.
	*/
	function rankIndexOf(value) {
		const key = compareKey(value);
		if (!key) return -1;
		const exact = getRankScale().findIndex((entry) => compareKey(entry.value) === key);
		if (exact !== -1) return exact;
		const numbers = numericScale();
		if (!numbers) return -1;
		const parsed = Number.parseFloat(key);
		if (Number.isNaN(parsed)) return -1;
		let best = -1;
		let bestDistance = Infinity;
		numbers.forEach((n, i) => {
			const distance = Math.abs(n - parsed);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = i;
			}
		});
		return best;
	}
	/** The scale step a cell value lands on. */
	function rankEntry(value) {
		const index = rankIndexOf(value);
		return index === -1 ? void 0 : getRankScale()[index];
	}
	/** Scale colors in rank order. Empty when no step declares one. */
	function rankColors() {
		const colors = getRankScale().map((entry) => entry.color ?? "");
		return colors.some(Boolean) ? colors : [];
	}
	/**
	* A row's numeric score. Reads the score column, and falls back to the score
	* the rank scale assigns, so a sheet that only has a Rank column still sorts
	* by score and still feeds the average readout.
	*/
	function rowScore(row, lang, field) {
		const header = field ?? (getRoleColumn("score") ? columnField(getRoleColumn("score"), lang) : void 0);
		if (header) {
			const parsed = Number.parseFloat(row[header] ?? "");
			if (!Number.isNaN(parsed)) return parsed;
		}
		const rankColumn = getRoleColumn("rank");
		if (rankColumn) {
			const raw = columnValue(row, rankColumn, lang);
			if (numericScale()) {
				const parsed = Number.parseFloat(raw);
				if (!Number.isNaN(parsed)) return parsed;
			}
			const entry = rankEntry(raw);
			if (entry?.score !== void 0) return entry.score;
		}
		return null;
	}
	/** Resolve an I18nString for a language, falling back to `default`. */
	function resolveI18n(value, lang) {
		if (value == null) return "";
		if (typeof value === "string") return value;
		const translated = value.i18n?.[lang];
		if (translated != null) return translated;
		return value.default ?? "";
	}
	/** The CSV header a column reads for a given language. */
	function columnField(column, lang) {
		return column.i18nSource?.[lang] ?? column.source;
	}
	/**
	* A column's value on a row for a language. Falls back to the language-neutral
	* `source` header when the localized column is missing or blank.
	*/
	function columnValue(row, column, lang) {
		const field = columnField(column, lang);
		if (field) {
			const v = row[field];
			if (v != null && v !== "") return v;
		}
		if (column.source) {
			const v = row[column.source];
			if (v != null && v !== "") return v;
		}
		return "";
	}
	/** Replace `{Header}` placeholders in a template with row values. */
	function interpolate(template, row) {
		return String(template).replace(/\{([^}]+)\}/g, (_, key) => row[key] ?? "");
	}
	/** Lowercase, collapse whitespace, trim. Used for matching, not for display. */
	function normalize(value) {
		if (!value) return "";
		return String(value).toLowerCase().replace(/\s+/g, " ").trim();
	}
	/** Strip everything but alphanumerics. Last-resort matching key. */
	function simplify(value) {
		return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
	}
	/** Comparison key for select filters and rank lookups. */
	function compareKey(value) {
		return String(value ?? "").replace(/\s+/g, "").toUpperCase();
	}
	/** CSV headers the free-text search covers, defaulting to every declared source. */
	function searchFields(lang) {
		const declared = config.search?.fields;
		if (declared?.length) return declared;
		const fields = /* @__PURE__ */ new Set();
		for (const column of getColumns()) {
			const field = columnField(column, lang);
			if (field) fields.add(field);
			if (column.source) fields.add(column.source);
			if (column.i18nSource) for (const f of Object.values(column.i18nSource)) fields.add(f);
		}
		return [...fields];
	}
	//#endregion
	//#region src/csv.ts
	/** Split CSV text into a grid of raw cells. */
	function parseCsv(text) {
		const rows = [];
		let row = [];
		let cell = "";
		let inQuotes = false;
		let cellStarted = false;
		const endCell = () => {
			row.push(cell);
			cell = "";
			cellStarted = false;
		};
		const endRow = () => {
			endCell();
			rows.push(row);
			row = [];
		};
		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			if (inQuotes) {
				if (ch === "\"") {
					if (text[i + 1] === "\"") {
						cell += "\"";
						i++;
					} else inQuotes = false;
				} else cell += ch;
				continue;
			}
			if (ch === "\"" && !cellStarted) {
				inQuotes = true;
				cellStarted = true;
				continue;
			}
			if (ch === ",") {
				endCell();
				continue;
			}
			if (ch === "\r") {
				if (text[i + 1] === "\n") i++;
				endRow();
				continue;
			}
			if (ch === "\n") {
				endRow();
				continue;
			}
			cell += ch;
			cellStarted = true;
		}
		if (cell !== "" || row.length) endRow();
		return rows;
	}
	/** Parse CSV text into objects keyed by trimmed header name, skipping blank rows. */
	function csvToRows(text) {
		const grid = parseCsv(text);
		const header = grid[0];
		if (!header) return [];
		const keys = header.map((h) => h.trim());
		return grid.slice(1).filter((cells) => cells.some((cell) => cell.trim().length > 0)).map((cells) => {
			const row = {};
			keys.forEach((key, i) => {
				if (!key) return;
				row[key] = (cells[i] ?? "").trim();
			});
			return row;
		});
	}
	/** Fetch and parse a CSV endpoint. */
	async function loadCsv(url) {
		const res = await fetch(url, { cache: "no-store" });
		if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status}): ${url}`);
		return csvToRows(await res.text());
	}
	//#endregion
	//#region src/deeplink.ts
	/** The DOM id and URL hash for a row. */
	function buildCardId(row) {
		const deepLink = getConfig().deepLink ?? {};
		const template = deepLink.template ?? "{Brand}-{Model}";
		const mode = deepLink.slugify ?? "lowercase-hyphen";
		return template.replace(/\{([^}]+)\}/g, (_, key) => {
			const value = row[key] ?? "";
			return mode === "lowercase-hyphen" ? value.toLowerCase().replace(/\s+/g, "-") : value;
		});
	}
	//#endregion
	//#region src/dom.ts
	/** Create an element with attributes and children in one call. */
	function el(tag, attrs = {}, children = []) {
		const node = document.createElement(tag);
		for (const [key, value] of Object.entries(attrs)) {
			if (value === void 0 || value === false) continue;
			if (key === "class") node.className = String(value);
			else if (key === "text") node.textContent = String(value);
			else if (key === "html") node.innerHTML = String(value);
			else node.setAttribute(key, value === true ? "" : String(value));
		}
		for (const child of children) node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
		return node;
	}
	/** Append text, turning newlines into `<br>` so sheet line breaks survive. */
	function appendTextWithBreaks(target, value) {
		if (!value) return;
		const parts = String(value).split(/\r\n|\n|\r/);
		parts.forEach((part, i) => {
			target.appendChild(document.createTextNode(part));
			if (i < parts.length - 1) target.appendChild(document.createElement("br"));
		});
	}
	/** Build an inline SVG from a path `d` list. Paths are build-time constants. */
	function svgIcon(paths, size = 24) {
		const NS = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(NS, "svg");
		svg.setAttribute("xmlns", NS);
		svg.setAttribute("viewBox", "0 0 24 24");
		svg.setAttribute("width", String(size));
		svg.setAttribute("height", String(size));
		svg.setAttribute("fill", "currentColor");
		svg.setAttribute("aria-hidden", "true");
		for (const d of paths) {
			const path = document.createElementNS(NS, "path");
			path.setAttribute("d", d);
			svg.appendChild(path);
		}
		return svg;
	}
	//#endregion
	//#region src/i18n.ts
	const STRINGS = {
		en: {
			filterAndSort: "Filter & Sort",
			resetFilters: "Reset Filters",
			search: "Search",
			sortBy: "Sort by",
			all: "All",
			statsTitle: "Ranking Statistics",
			averageScore: "Average Score:",
			deviceCount: "Device Count",
			closeStats: "Close statistics",
			openStats: "Open statistics",
			measurementsPage: "Go to Measurements Page",
			toggleTheme: "Toggle Light/Dark Theme",
			toggleLanguage: "View in Korean",
			scrollTop: "Scroll to top",
			noResults: "No devices match the current filters.",
			loadError: "Could not load the ranking data. Check the source URL in ranking-config.js.",
			ascending: "A to Z",
			descending: "Z to A",
			footerNote: "The 'Ranking List' is based on the operator's personal listening experience and subjective evaluation of sound quality."
		},
		ko: {
			filterAndSort: "필터 & 정렬",
			resetFilters: "필터 초기화",
			search: "검색",
			sortBy: "정렬 기준",
			all: "전체",
			statsTitle: "랭킹 통계",
			averageScore: "평균 점수:",
			deviceCount: "기기 수",
			closeStats: "통계 닫기",
			openStats: "통계 열기",
			measurementsPage: "측정 페이지로 이동",
			toggleTheme: "라이트/다크 테마 전환",
			toggleLanguage: "View in English",
			scrollTop: "맨 위로",
			noResults: "현재 필터 조건에 맞는 기기가 없습니다.",
			loadError: "랭킹 데이터를 불러오지 못했습니다. ranking-config.js의 소스 URL을 확인하세요.",
			ascending: "오름차순",
			descending: "내림차순",
			footerNote: "'랭킹 리스트'는 운영자의 개인적인 청음 경험과 음질에 대한 주관적 평가를 바탕으로 작성되었습니다."
		}
	};
	/** Languages offered by the toggle, in cycle order. */
	function languages() {
		const declared = getConfig().languages;
		if (declared?.length) return declared;
		const overrides = Object.keys(getConfig().i18n ?? {});
		const builtin = Object.keys(STRINGS);
		return [.../* @__PURE__ */ new Set([...builtin, ...overrides])];
	}
	/** Look up a chrome string, preferring config overrides, then English. */
	function t(key, lang) {
		const override = getConfig().i18n?.[lang]?.[key];
		if (override != null) return override;
		const builtin = STRINGS[lang]?.[key];
		if (builtin != null) return builtin;
		return STRINGS["en"]?.[key] ?? key;
	}
	/** The language the page opens in: stored choice, else browser preference. */
	function detectLanguage(storageKey = "preferred-lang") {
		const available = languages();
		const fallback = available[0] ?? "en";
		let stored = null;
		try {
			stored = localStorage.getItem(storageKey);
		} catch {}
		if (stored && available.includes(stored)) return stored;
		const navLangs = (navigator.languages?.length ? navigator.languages : [navigator.language || "en"]).map((l) => String(l).toLowerCase());
		for (const nav of navLangs) {
			const hit = available.find((l) => nav === l.toLowerCase() || nav.startsWith(l.toLowerCase() + "-"));
			if (hit) return hit;
		}
		return fallback;
	}
	/** Next language in the cycle. */
	function nextLanguage(current) {
		const available = languages();
		return available[(available.indexOf(current) + 1) % available.length] ?? current;
	}
	/**
	* Apply chrome strings to the page. Elements opt in with `data-i18n="key"`
	* for text content and `data-i18n-title="key"` / `data-i18n-label="key"`
	* for the `title` and `aria-label` attributes.
	*/
	function applyStrings(root, lang) {
		root.querySelectorAll("[data-i18n]").forEach((el) => {
			const key = el.dataset["i18n"];
			if (key) el.textContent = t(key, lang);
		});
		root.querySelectorAll("[data-i18n-title]").forEach((el) => {
			const key = el.dataset["i18nTitle"];
			if (key) el.title = t(key, lang);
		});
		root.querySelectorAll("[data-i18n-label]").forEach((el) => {
			const key = el.dataset["i18nLabel"];
			if (key) el.setAttribute("aria-label", t(key, lang));
		});
	}
	//#endregion
	//#region src/phonebook.ts
	/** Fetch a phone_book.json. Returns null when it is missing or malformed. */
	async function loadPhonebook(url) {
		try {
			const res = await fetch(url);
			if (!res.ok) return null;
			const data = await res.json();
			return Array.isArray(data) ? data : null;
		} catch {
			return null;
		}
	}
	/** Ordered match strategies, strictest first. */
	function findBy(items, needle, nameOf) {
		if (!needle) return void 0;
		const normalized = items.map((item) => ({
			item,
			name: normalize(nameOf(item))
		}));
		const exact = normalized.find((entry) => entry.name === needle);
		if (exact) return exact.item;
		const contains = normalized.find((entry) => entry.name !== "" && (entry.name.includes(needle) || needle.includes(entry.name)));
		if (contains) return contains.item;
		const simpleNeedle = simplify(needle);
		if (!simpleNeedle) return void 0;
		const simplified = items.map((item) => ({
			item,
			name: simplify(nameOf(item))
		}));
		const simpleExact = simplified.find((entry) => entry.name === simpleNeedle);
		if (simpleExact) return simpleExact.item;
		return simplified.find((entry) => entry.name !== "" && (entry.name.includes(simpleNeedle) || simpleNeedle.includes(entry.name)))?.item;
	}
	/** The terse form expanded, so only one shape reaches the matcher. */
	function asPhone(entry) {
		return typeof entry === "string" ? {
			name: entry,
			file: entry
		} : entry;
	}
	function findPhone(phones, model) {
		const direct = findBy(phones, model, (phone) => phone.name ?? "");
		if (direct) return direct;
		return phones.find((phone) => {
			const prefix = normalize(phone.prefix);
			const suffix = normalize(phone.suffix);
			return prefix !== "" && prefix.includes(model) || suffix !== "" && suffix.includes(model);
		});
	}
	/**
	* The first measurement filename for a phonebook entry.
	*
	* `file` wins whenever it is there, because that is the variant both graph tools
	* draw first. A modernGraphTool phone can declare its measurements only in
	* `variants[]` or the deprecated `hptfs[]`, and those are read next so such a
	* device still gets a measurement link instead of silently losing one.
	*/
	function phoneFile(phone) {
		const candidates = [
			Array.isArray(phone.file) ? phone.file[0] : phone.file,
			phone.hptfs?.[0]?.files?.[0],
			phone.variants?.[0]?.file ?? phone.variants?.[0]?.samples?.files?.[0]
		];
		for (const candidate of candidates) {
			const trimmed = String(candidate ?? "").trim();
			if (trimmed) return trimmed;
		}
		return null;
	}
	/**
	* Resolve a brand and model to a measurement URL, or null when the phonebook
	* has no usable entry. `template` may contain a `{file}` placeholder.
	*/
	function resolveMeasurementUrl(phonebook, brand, model, template) {
		if (!phonebook || !template) return null;
		const brandKey = normalize(brand);
		const modelKey = normalize(model);
		if (!brandKey || !modelKey) return null;
		const matchedBrand = findBy(phonebook, brandKey, (entry) => entry.name ?? "");
		if (!matchedBrand) return null;
		const matchedPhone = findPhone((matchedBrand.phones ?? []).map(asPhone), modelKey);
		if (!matchedPhone) return null;
		const file = phoneFile(matchedPhone);
		if (!file) return null;
		return template.replace("{file}", encodeURIComponent(file.replace(/\s+/g, "_")));
	}
	//#endregion
	//#region src/query.ts
	function initialFilterState(type, sortDefault) {
		const columns = {};
		for (const column of visibleColumns(type)) if (column.filter) columns[column.id] = "";
		return {
			search: "",
			sort: sortDefault,
			columns
		};
	}
	/** Maps a rank value to its position in the configured order; -1 when unranked. */
	function rankIndexer() {
		const cache = /* @__PURE__ */ new Map();
		return (value) => {
			const hit = cache.get(value);
			if (hit !== void 0) return hit;
			const index = rankIndexOf(value);
			cache.set(value, index);
			return index;
		};
	}
	function matchesFilters(row, columns, state, lang) {
		for (const column of columns) {
			const filter = column.filter;
			if (!filter) continue;
			const needle = state.columns[column.id];
			if (!needle) continue;
			if (filter.kind === "select" || filter.kind === "select-auto") {
				if (compareKey(columnValue(row, column, lang)) !== compareKey(needle)) return false;
			} else {
				const fields = filter.match?.length ? filter.match : column.source ? [column.source] : [];
				const lowered = needle.toLowerCase();
				if (!fields.some((field) => (row[field] ?? "").toLowerCase().includes(lowered))) return false;
			}
		}
		if (state.search) {
			const lowered = state.search.toLowerCase();
			if (!searchFields(lang).some((field) => (row[field] ?? "").toLowerCase().includes(lowered))) return false;
		}
		return true;
	}
	function sortValue(row, column, lang, rankIndex) {
		if (column.role === "rank") {
			const index = rankIndex(columnValue(row, column, lang));
			return index === -1 ? { missing: true } : {
				missing: false,
				value: index
			};
		}
		const render = column.render;
		if (render?.kind === "title" && render.template) {
			const text = interpolate(render.template, row).trim();
			return text ? {
				missing: false,
				value: text.toLowerCase()
			} : { missing: true };
		}
		if (column.role === "score") {
			const num = rowScore(row, lang, columnField(column, lang));
			return num === null ? { missing: true } : {
				missing: false,
				value: num
			};
		}
		const raw = columnValue(row, column, lang).trim();
		if (!raw) return { missing: true };
		if (render?.kind === "numeric" || render?.kind === "stars" || render?.kind === "score-badge") {
			const num = Number.parseFloat(raw);
			return Number.isNaN(num) ? { missing: true } : {
				missing: false,
				value: num
			};
		}
		return {
			missing: false,
			value: raw.toLowerCase()
		};
	}
	/** Compare two sort values. Missing values always sink, whichever direction. */
	function compare(a, b, direction) {
		if (a.missing && b.missing) return 0;
		if (a.missing) return 1;
		if (b.missing) return -1;
		if (typeof a.value === "number" && typeof b.value === "number") return (a.value - b.value) * direction;
		return String(a.value).localeCompare(String(b.value), void 0, {
			numeric: true,
			sensitivity: "base"
		}) * direction;
	}
	/** Split `'rank-asc'` into a column id and a direction. */
	function parseSortKey(key) {
		const match = /^(.*)-(asc|desc)$/.exec(key ?? "");
		if (!match) return {
			id: key ?? "",
			direction: 1
		};
		return {
			id: match[1] ?? "",
			direction: match[2] === "desc" ? -1 : 1
		};
	}
	/**
	* Sort rows by a sort key, then by rank, brand and model so that equal
	* primary values keep a stable, meaningful order.
	*/
	function sortRows(rows, sortKey, lang) {
		const { id, direction } = parseSortKey(sortKey);
		const rankIndex = rankIndexer();
		const primary = visibleColumns(null).find((c) => c.id === id);
		const tiebreakers = [
			"rank",
			"brand",
			"model"
		].map((role) => getRoleColumn(role)).filter((c) => Boolean(c) && c.id !== primary?.id);
		return [...rows].sort((a, b) => {
			if (primary) {
				const result = compare(sortValue(a, primary, lang, rankIndex), sortValue(b, primary, lang, rankIndex), direction);
				if (result !== 0) return result;
			}
			for (const column of tiebreakers) {
				const result = compare(sortValue(a, column, lang, rankIndex), sortValue(b, column, lang, rankIndex), 1);
				if (result !== 0) return result;
			}
			return 0;
		});
	}
	function filterAndSort(rows, type, state, lang) {
		const columns = visibleColumns(type).filter((c) => c.filter);
		return sortRows(rows.filter((row) => matchesFilters(row, columns, state, lang)), state.sort, lang);
	}
	//#endregion
	//#region src/color.ts
	/** Parse `#rgb` or `#rrggbb` into channel values. Returns null on anything else. */
	function parseHex(value) {
		const hex = String(value ?? "").trim().replace(/^#/, "");
		if (hex.length === 3) {
			const [r, g, b] = [...hex].map((c) => Number.parseInt(c + c, 16));
			return [
				r,
				g,
				b
			].some(Number.isNaN) ? null : [
				r,
				g,
				b
			];
		}
		if (hex.length === 6) {
			const parts = [
				0,
				2,
				4
			].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
			return parts.some(Number.isNaN) ? null : [
				parts[0],
				parts[1],
				parts[2]
			];
		}
		return null;
	}
	function toHex(channels) {
		return "#" + channels.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");
	}
	/**
	* Color at position `t` (0 to 1) along a ramp of hex stops.
	*
	* A continuous score scale needs a color per value, which no operator wants to
	* type out; two or three stops and this function cover 0 to 100 just as well.
	*/
	function rampColor(colors, t) {
		const stops = colors.map(parseHex).filter((c) => c !== null);
		if (!stops.length) return "";
		if (stops.length === 1) return toHex(stops[0]);
		const span = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (stops.length - 1);
		const index = Math.min(stops.length - 2, Math.floor(span));
		const local = span - index;
		const from = stops[index];
		const to = stops[index + 1];
		return toHex([
			from[0] + (to[0] - from[0]) * local,
			from[1] + (to[1] - from[1]) * local,
			from[2] + (to[2] - from[2]) * local
		]);
	}
	/**
	* `'#fff'` or `'#111'`, whichever reads better on `background`.
	* Uses the WCAG relative-luminance threshold so operator-picked scale colors
	* never produce an unreadable badge.
	*/
	function readableTextColor(background) {
		const rgb = parseHex(background);
		if (!rgb) return "#fff";
		const channel = (c) => {
			const s = c / 255;
			return s <= .03928 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
		};
		return .2126 * channel(rgb[0]) + .7152 * channel(rgb[1]) + .0722 * channel(rgb[2]) > .5 ? "#111" : "#fff";
	}
	//#endregion
	//#region src/icons.ts
	const ICON_EXTERNAL_LINK = "M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19L18.9999 6.413L11.2071 14.2071L9.79289 12.7929L17.5849 5H13V3H21Z";
	const ICON_PLUS = "M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z";
	const ICON_MINUS = "M5 11V13H19V11H5Z";
	const ICON_QUESTION = "M12 19C12.8284 19 13.5 19.6716 13.5 20.5C13.5 21.3284 12.8284 22 12 22C11.1716 22 10.5 21.3284 10.5 20.5C10.5 19.6716 11.1716 19 12 19ZM12 2C15.3137 2 18 4.68629 18 8C18 10.1646 17.2474 11.2907 15.3259 12.9231C13.3986 14.5604 13 15.2969 13 17H11C11 14.526 11.787 13.3052 14.031 11.3989C15.5479 10.1102 16 9.43374 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8V9H6V8C6 4.68629 8.68629 2 12 2Z";
	const ICON_ASTERISK = "M12.9998 3L12.9996 10.267L19.294 6.63397L20.294 8.36602L14.0006 11.999L20.294 15.634L19.294 17.366L12.9996 13.732L12.9998 21H10.9998L10.9996 13.732L4.70557 17.366L3.70557 15.634L9.99857 12L3.70557 8.36602L4.70557 6.63397L10.9996 10.267L10.9998 3H12.9998Z";
	const ICON_CHEVRON_DOWN = "M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z";
	const ICON_STAR = "M12 18.26L4.94729 22.2082L6.52281 14.2799L0.587921 8.7918L8.61494 7.84006L12 0.5L15.3851 7.84006L23.4121 8.7918L17.4772 14.2799L19.0527 22.2082L12 18.26Z";
	//#endregion
	//#region src/render/blocks.ts
	const BLOCK_ICONS = {
		up: ICON_PLUS,
		down: ICON_MINUS,
		note: ICON_QUESTION,
		muted: ICON_ASTERISK
	};
	/**
	* A prose block in the card body. Line breaks in the cell are preserved.
	* `plain` renders bare text; the other styles get an icon and color treatment.
	*/
	function renderBlock(text, style, label, lang) {
		if (!text.trim()) return null;
		const block = el("div", { class: `card-block card-block-${style}` });
		const iconPath = BLOCK_ICONS[style];
		if (iconPath) {
			const icon = el("span", { class: "card-block-icon" });
			icon.appendChild(svgIcon([iconPath]));
			block.appendChild(icon);
		}
		const body = el("span", { class: "card-block-text" });
		const labelText = resolveI18n(label, lang);
		if (labelText) body.appendChild(el("b", {
			class: "card-block-label",
			text: `${labelText}: `
		}));
		appendTextWithBreaks(body, text.trim());
		block.appendChild(body);
		return block;
	}
	/** Split a cell on a separator and render each piece as a pill. */
	function renderTags(text, separator = ",") {
		const tags = text.split(separator).map((tag) => tag.trim()).filter(Boolean);
		if (!tags.length) return null;
		const wrapper = el("div", { class: "card-tags" });
		for (const tag of tags) wrapper.appendChild(el("span", {
			class: "card-tag",
			text: tag
		}));
		return wrapper;
	}
	//#endregion
	//#region src/render/cards.ts
	/** Worst-to-best ramp used by `score-badge` when the config names no colors. */
	const DEFAULT_SCORE_RAMP = [
		"#b71c1c",
		"#ffc107",
		"#4caf50",
		"#6c63ff"
	];
	/** Where a column lands when it declares no explicit `placement`. */
	function slotFor(column) {
		if (column.placement) return column.placement;
		switch (column.render?.kind) {
			case "rank-badge":
			case "stars":
			case "score-badge": return "rank";
			case "title": return "title";
			case "block":
			case "tags": return "body";
			case "link":
			case "measurement-link": return "actions";
			case "meta-chip":
			case "text":
			case "numeric": return "meta";
			default: return null;
		}
	}
	function renderColumn(row, column, lang) {
		const render = column.render;
		if (!render) return null;
		const value = columnValue(row, column, lang);
		switch (render.kind) {
			case "rank-badge": {
				const key = value.replace(/\s+/g, "");
				const entry = rankEntry(key);
				const mapped = render.classMap?.[key];
				const cls = mapped ?? entry?.class ?? render.classMap?.["default"] ?? "";
				const text = entry?.label ? resolveI18n(entry.label, lang) : key;
				const badge = el("div", {
					class: `device-card-rank ${cls}`.trim(),
					text
				});
				if (!mapped && entry?.color) {
					badge.style.background = entry.color;
					badge.style.color = entry.textColor ?? readableTextColor(entry.color);
				}
				return badge;
			}
			case "stars": {
				const max = Math.max(1, Math.round(render.max ?? 5));
				const filled = Number.parseFloat(value);
				if (Number.isNaN(filled)) return null;
				const ratio = Math.min(1, Math.max(0, filled / max));
				const wrap = el("div", {
					class: "device-card-rank device-card-stars",
					role: "img",
					"aria-label": `${value} / ${max}`
				});
				const track = el("span", {
					class: "stars-track",
					"aria-hidden": "true"
				});
				const fill = el("span", {
					class: "stars-fill",
					"aria-hidden": "true"
				});
				fill.style.width = `${ratio * 100}%`;
				for (let i = 0; i < max; i++) {
					track.appendChild(svgIcon([ICON_STAR], 16));
					fill.appendChild(svgIcon([ICON_STAR], 16));
				}
				wrap.appendChild(track);
				wrap.appendChild(fill);
				return wrap;
			}
			case "score-badge": {
				const parsed = Number.parseFloat(value);
				if (Number.isNaN(parsed)) return null;
				const min = render.min ?? 0;
				const max = render.max ?? 5;
				const decimals = render.decimals;
				const badge = el("div", {
					class: "device-card-rank device-card-score-badge",
					text: decimals === void 0 ? String(parsed) : parsed.toFixed(decimals)
				});
				const colors = render.colors ?? DEFAULT_SCORE_RAMP;
				const span = max - min;
				const color = rampColor(colors, span === 0 ? 1 : (parsed - min) / span);
				if (color) {
					badge.style.background = color;
					badge.style.color = readableTextColor(color);
				}
				return badge;
			}
			case "title": return el("span", {
				class: "device-card-header",
				text: render.template ? interpolate(render.template, row) : value
			});
			case "meta-chip":
				if (!value) return null;
				return el("span", {
					class: `device-card-chip device-card-${column.id}`,
					text: value
				});
			case "text":
			case "numeric":
				if (!value) return null;
				return el("span", {
					class: `device-card-${column.id}`,
					text: value
				});
			case "block": return renderBlock(value, render.style ?? "plain", column.blockLabel, lang);
			case "tags": return renderTags(value, render.separator ?? ",");
			case "link": {
				const href = render.hrefTemplate ? interpolate(render.hrefTemplate, row) : render.href ?? "";
				if (!href) return null;
				const anchor = el("a", {
					class: `device-card-link device-card-${column.id}`,
					href,
					text: resolveI18n(render.text ?? column.label, lang)
				});
				if (render.newTab !== false) {
					anchor.target = "_blank";
					anchor.rel = "noopener";
				}
				return anchor;
			}
			case "measurement-link": {
				const label = resolveI18n(column.label, lang);
				const anchor = el("a", {
					class: "device-card-measurement",
					title: label,
					hidden: true,
					target: "_blank",
					rel: "noopener"
				});
				anchor.appendChild(svgIcon([ICON_EXTERNAL_LINK], 16));
				anchor.appendChild(el("span", {
					class: "device-card-measurement-label",
					text: label
				}));
				return anchor;
			}
			default: return null;
		}
	}
	/** Build one card. */
	function renderCard(row, columns, lang) {
		const card = el("div", {
			class: "device-card",
			id: buildCardId(row)
		});
		const brandColumn = getRoleColumn("brand");
		const modelColumn = getRoleColumn("model");
		if (brandColumn) card.dataset["brand"] = normalize(columnValue(row, brandColumn, lang));
		if (modelColumn) card.dataset["model"] = normalize(columnValue(row, modelColumn, lang));
		const header = el("div", { class: "device-card-header-div" });
		const meta = el("div", { class: "device-card-meta" });
		const actions = [];
		const body = [];
		let metaChips = 0;
		for (const column of columns) {
			const node = renderColumn(row, column, lang);
			if (!node) continue;
			switch (slotFor(column)) {
				case "rank":
					card.appendChild(node);
					break;
				case "title":
					header.appendChild(node);
					break;
				case "meta":
					if (column.render?.kind === "meta-chip" && metaChips > 0) meta.appendChild(el("span", {
						class: "device-card-chip-sep",
						"aria-hidden": "true",
						text: "|"
					}));
					meta.appendChild(node);
					if (column.render?.kind === "meta-chip") metaChips++;
					break;
				case "actions":
					actions.push(node);
					break;
				case "body": body.push(node);
			}
		}
		if (meta.childNodes.length) header.appendChild(meta);
		if (actions.length) {
			const actionRow = el("div", { class: "device-card-actions" });
			for (const node of actions) actionRow.appendChild(node);
			header.appendChild(actionRow);
		}
		card.appendChild(header);
		if (body.length) {
			const bodyWrap = el("div", { class: "device-card-body" });
			for (const node of body) bodyWrap.appendChild(node);
			card.appendChild(bodyWrap);
		}
		return card;
	}
	/** Replace the card list with the given rows, or a message when empty. */
	function renderCards(container, rows, columns, lang) {
		container.replaceChildren();
		if (!rows.length) {
			container.appendChild(el("p", {
				class: "list-empty",
				text: t("noResults", lang)
			}));
			return;
		}
		const fragment = document.createDocumentFragment();
		for (const row of rows) fragment.appendChild(renderCard(row, columns, lang));
		container.appendChild(fragment);
	}
	//#endregion
	//#region src/render/controls.ts
	/** Collapsed state survives re-renders so a type switch does not close the panel. */
	let collapsed = true;
	/** Label for a sort key: config override, else column label plus direction. */
	function sortLabel(key, lang) {
		const override = getConfig().sort?.labels?.[key];
		if (override) return resolveI18n(override, lang);
		const match = /^(.*)-(asc|desc)$/.exec(key);
		if (!match) return key;
		const column = getColumn(match[1] ?? "");
		return `${column ? resolveI18n(column.label, lang) : match[1] ?? key} (${t(match[2] === "desc" ? "descending" : "ascending", lang)})`;
	}
	/**
	* Options for a `select` filter: the declared values, else the column's rank
	* scale. Letting the scale supply them is what keeps the dropdown, the sort
	* order and the badge colors from drifting apart.
	*/
	function selectValues(column) {
		if (column.filter?.kind === "select" && column.filter.values?.length) return column.filter.values;
		return (column.scale ?? []).map((entry) => entry.value);
	}
	/** Distinct values for a `select-auto` filter, in first-seen order. */
	function autoValues(rows, column, lang) {
		const seen = /* @__PURE__ */ new Map();
		for (const row of rows) {
			const value = columnValue(row, column, lang).trim();
			if (!value) continue;
			const key = value.toLowerCase();
			if (!seen.has(key)) seen.set(key, value);
		}
		return [...seen.values()].sort((a, b) => a.localeCompare(b, void 0, { numeric: true }));
	}
	function renderControls(options) {
		const { container, type, rows, state, lang, onChange, onReset } = options;
		container.replaceChildren();
		const wrapper = el("div", { class: "filter-collapse-wrapper" });
		const toggle = el("button", {
			type: "button",
			class: "filter-collapse-toggle",
			"aria-expanded": String(!collapsed),
			"aria-controls": "filter-collapse-content"
		});
		const toggleInner = el("div", { class: "filter-collapse-content-header" });
		const icon = el("span", { class: "filter-toggle-icon" });
		icon.appendChild(svgIcon([ICON_CHEVRON_DOWN]));
		toggleInner.appendChild(icon);
		toggleInner.appendChild(el("span", { text: t("filterAndSort", lang) }));
		toggle.appendChild(toggleInner);
		wrapper.appendChild(toggle);
		const topRow = el("div", { class: "filter-collapse-content-controls" });
		if (getConfig().search?.enabled !== false) {
			const search = el("input", {
				id: "input-search",
				type: "search",
				value: state.search,
				placeholder: resolveI18n(getConfig().search?.label, lang) || t("search", lang),
				"aria-label": t("search", lang)
			});
			search.addEventListener("input", () => {
				state.search = search.value;
				onChange();
			});
			topRow.appendChild(search);
		}
		const sortOptions = getConfig().sort?.options ?? [];
		if (sortOptions.length) {
			const select = el("select", {
				id: "select-sort",
				"aria-label": t("sortBy", lang)
			});
			select.title = t("sortBy", lang);
			for (const key of sortOptions) select.appendChild(el("option", {
				value: key,
				text: sortLabel(key, lang)
			}));
			select.value = state.sort;
			select.addEventListener("change", () => {
				state.sort = select.value;
				onChange();
			});
			topRow.appendChild(select);
		}
		wrapper.appendChild(topRow);
		const content = el("div", {
			id: "filter-collapse-content",
			class: "filter-collapse-content",
			"aria-hidden": String(collapsed)
		});
		for (const column of visibleColumns(type)) {
			const filter = column.filter;
			if (!filter) continue;
			const label = el("label", { class: "filter-field" });
			const labelText = resolveI18n(column.label, lang);
			label.appendChild(el("span", {
				id: `filter-label-${column.id}`,
				text: labelText
			}));
			if (filter.kind === "select" || filter.kind === "select-auto") {
				const values = filter.kind === "select" ? selectValues(column) : autoValues(rows, column, lang);
				const select = el("select", { id: `filter-input-${column.id}` });
				select.appendChild(el("option", {
					value: "",
					text: t("all", lang)
				}));
				for (const value of values) {
					const entry = filter.kind === "select" ? rankEntry(value) : void 0;
					const text = entry?.label ? resolveI18n(entry.label, lang) : value;
					select.appendChild(el("option", {
						value,
						text
					}));
				}
				select.value = state.columns[column.id] ?? "";
				select.addEventListener("change", () => {
					state.columns[column.id] = select.value;
					onChange();
				});
				label.appendChild(select);
			} else {
				const input = el("input", {
					id: `filter-input-${column.id}`,
					type: "text",
					value: state.columns[column.id] ?? "",
					placeholder: labelText
				});
				input.addEventListener("input", () => {
					state.columns[column.id] = input.value;
					onChange();
				});
				label.appendChild(input);
			}
			content.appendChild(label);
		}
		const reset = el("button", {
			type: "button",
			id: "reset-filters-btn",
			text: t("resetFilters", lang)
		});
		reset.addEventListener("click", () => {
			onReset(initialFilterState(type, getConfig().sort?.default ?? state.sort));
		});
		content.appendChild(reset);
		wrapper.appendChild(content);
		const applyCollapsed = () => {
			wrapper.classList.toggle("collapsed", collapsed);
			content.classList.toggle("collapsed", collapsed);
			content.setAttribute("aria-hidden", String(collapsed));
			toggle.setAttribute("aria-expanded", String(!collapsed));
		};
		applyCollapsed();
		toggle.addEventListener("click", () => {
			collapsed = !collapsed;
			applyCollapsed();
		});
		container.appendChild(wrapper);
	}
	//#endregion
	//#region src/render/skeleton.ts
	function line(width, height = "0.85rem") {
		const node = el("span", { class: "skeleton-line skeleton-pulse" });
		node.style.width = width;
		node.style.height = height;
		return node;
	}
	function renderSkeletons(container, count = 10) {
		container.replaceChildren();
		const fragment = document.createDocumentFragment();
		for (let i = 0; i < count; i++) {
			const card = el("div", { class: "device-card skeleton-card" });
			card.appendChild(el("div", { class: "device-card-rank skeleton-block skeleton-pulse" }));
			const header = el("div", { class: "device-card-header-div" });
			header.appendChild(line("70%", "1.1em"));
			const meta = el("div", { class: "device-card-meta" });
			for (const width of ["4.5rem", "3.25rem"]) {
				const chip = el("span", { class: "skeleton-chip skeleton-pulse" });
				chip.style.width = width;
				meta.appendChild(chip);
			}
			header.appendChild(meta);
			card.appendChild(header);
			const body = el("div", { class: "device-card-body" });
			for (const width of [
				"95%",
				"88%",
				"70%"
			]) body.appendChild(line(width));
			card.appendChild(body);
			fragment.appendChild(card);
		}
		container.appendChild(fragment);
	}
	//#endregion
	//#region src/stats.ts
	const DEFAULT_CHART_LIB = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
	const DEFAULT_COLORS = [
		"#6c63ff",
		"#00bfae",
		"#00bfff",
		"#4caf50",
		"#8bc34a",
		"#ffb347",
		"#ffc107",
		"#ff9800",
		"#ff5722",
		"#b71c1c"
	];
	let chart = null;
	let libPromise = null;
	/** Load Chart.js once, on demand. Resolves null when the CDN is unreachable. */
	function loadChartLib() {
		if (libPromise) return libPromise;
		const existing = globalThis.Chart;
		if (existing) {
			libPromise = Promise.resolve(existing);
			return libPromise;
		}
		const url = getConfig().stats?.chartLibUrl ?? DEFAULT_CHART_LIB;
		libPromise = new Promise((resolve) => {
			const script = document.createElement("script");
			script.src = url;
			script.async = true;
			script.onload = () => resolve(globalThis.Chart ?? null);
			script.onerror = () => {
				console.warn(`[squigRanking] could not load the chart library from ${url}`);
				resolve(null);
			};
			document.head.appendChild(script);
		});
		return libPromise;
	}
	/** Count rows per rank value, index-aligned with the configured rank order. */
	function rankCounts(rows, lang) {
		const labels = getRankValues();
		const column = getRoleColumn("rank");
		if (!column) return {
			labels: [],
			counts: []
		};
		const counts = labels.map(() => 0);
		for (const row of rows) {
			const index = rankIndexOf(columnValue(row, column, lang));
			if (index !== -1) counts[index] += 1;
		}
		return {
			labels,
			counts
		};
	}
	/**
	* Mean score across rows. A row with no numeric cell in `field` contributes the
	* score its rank scale assigns, so star and letter-grade sheets average without
	* a separate Score column. Rows that resolve to nothing are skipped.
	*/
	function averageScore(rows, field, lang = "en") {
		const values = rows.map((row) => rowScore(row, lang, field)).filter((value) => value !== null);
		if (!values.length) return null;
		return values.reduce((sum, value) => sum + value, 0) / values.length;
	}
	async function renderStats(rows, lang) {
		const stats = getConfig().stats ?? {};
		const averageEl = document.getElementById("avg-score");
		if (averageEl) {
			const average = averageScore(rows, stats.average?.source ?? "Score", lang);
			averageEl.textContent = average === null ? "-" : average.toFixed(2);
		}
		const denominatorEl = document.getElementById("avg-score-denominator");
		if (denominatorEl) {
			const denominator = stats.average?.denominator;
			denominatorEl.textContent = denominator ? `/ ${denominator}` : "";
		}
		const canvas = document.getElementById("rank-bar-chart");
		if (!(canvas instanceof HTMLCanvasElement)) return;
		const { labels, counts } = rankCounts(rows, lang);
		if (!labels.length) return;
		const Chart = await loadChartLib();
		const context = canvas.getContext("2d");
		if (!Chart || !context) return;
		chart?.destroy();
		chart = new Chart(context, {
			type: "bar",
			data: {
				labels,
				datasets: [{
					label: t("deviceCount", lang),
					data: counts,
					backgroundColor: stats.chartColors ?? (rankColors().length ? rankColors() : DEFAULT_COLORS)
				}]
			},
			options: {
				responsive: true,
				plugins: { legend: { display: false } },
				scales: { y: {
					beginAtZero: true,
					ticks: { precision: 0 }
				} }
			}
		});
	}
	//#endregion
	//#region src/theme.ts
	const STORAGE_KEY = "preferred-theme";
	function read() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			return stored === "light" || stored === "dark" ? stored : null;
		} catch {
			return null;
		}
	}
	function write(theme) {
		try {
			localStorage.setItem(STORAGE_KEY, theme);
		} catch {}
	}
	function systemTheme() {
		return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	}
	function apply(theme) {
		document.documentElement.setAttribute("data-theme", theme);
	}
	function setupTheme(button) {
		const stored = read();
		apply(stored ?? systemTheme());
		if (!stored) (globalThis.matchMedia?.("(prefers-color-scheme: dark)"))?.addEventListener("change", (event) => {
			if (!read()) apply(event.matches ? "dark" : "light");
		});
		button?.addEventListener("click", () => {
			const next = (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light") === "dark" ? "light" : "dark";
			apply(next);
			write(next);
		});
	}
	//#endregion
	//#region src/main.ts
	const LANG_STORAGE_KEY = "preferred-lang";
	const state = {
		lang: "en",
		type: null,
		rowsByType: {},
		rows: [],
		filters: {
			search: "",
			sort: "",
			columns: {}
		},
		loadFailed: false
	};
	const phonebookCache = /* @__PURE__ */ new Map();
	function byId(id) {
		return document.getElementById(id);
	}
	/** Trim cells and apply the type's blank-cell defaults. */
	function normalizeRow(row, type) {
		const out = {};
		for (const [key, value] of Object.entries(row)) out[key] = String(value ?? "").trim();
		const defaults = getType(type)?.defaults ?? {};
		for (const [key, value] of Object.entries(defaults)) if (!out[key]) out[key] = value;
		return out;
	}
	/** Keep only rows this type claims, for deploys serving several types from one sheet. */
	function applyRowFilter(rows, type) {
		const filter = getType(type)?.rowFilter;
		if (!filter) return rows;
		const wanted = new Set(filter.values.map((value) => value.toLowerCase().trim()));
		return rows.filter((row) => wanted.has((row[filter.field] ?? "").toLowerCase().trim()));
	}
	function renderList() {
		const container = byId("device-card-list");
		if (!container) return;
		if (state.loadFailed && !state.rows.length) {
			container.replaceChildren(el("p", {
				class: "list-error",
				text: t("loadError", state.lang)
			}));
			return;
		}
		const columns = visibleColumns(state.type);
		const rows = filterAndSort(state.rows, state.type, state.filters, state.lang);
		renderCards(container, rows, columns, state.lang);
		resolveMeasurementLinks(rows);
	}
	function renderFilterPanel() {
		const container = byId("filter-controls");
		if (!container) return;
		renderControls({
			container,
			type: state.type,
			rows: state.rows,
			state: state.filters,
			lang: state.lang,
			onChange: renderList,
			onReset: (next) => {
				state.filters = next;
				renderFilterPanel();
				renderList();
			}
		});
	}
	/** Fill in measurement hrefs once the active type's phonebook has loaded. */
	async function resolveMeasurementLinks(rows) {
		const type = state.type;
		if (!type) return;
		const config = getType(type);
		const url = config?.phonebook;
		const template = config?.measurementUrl;
		if (!url || !template) return;
		if (!phonebookCache.has(url)) phonebookCache.set(url, loadPhonebook(url));
		const phonebook = await phonebookCache.get(url);
		if (!phonebook || state.type !== type) return;
		const brandColumn = getRoleColumn("brand");
		const modelColumn = getRoleColumn("model");
		if (!brandColumn || !modelColumn) return;
		for (const row of rows) {
			const link = document.getElementById(buildCardId(row))?.querySelector(".device-card-measurement");
			if (!link) continue;
			const href = resolveMeasurementUrl(phonebook, columnValue(row, brandColumn, state.lang), columnValue(row, modelColumn, state.lang), template);
			if (!href) continue;
			link.href = href;
			link.hidden = false;
		}
	}
	function renderTypeToggles() {
		const container = document.querySelector(".toggle-group");
		if (!container) return;
		container.replaceChildren();
		for (const [id, config] of getTypes()) {
			const button = el("button", {
				type: "button",
				class: "toggle-btn",
				id: `toggle-${id}`,
				"data-type": id,
				text: resolveI18n(config.label, state.lang),
				"aria-pressed": String(state.type === id)
			});
			button.addEventListener("click", () => setType(id));
			container.appendChild(button);
		}
	}
	function syncTypeToggles() {
		document.querySelectorAll(".toggle-btn").forEach((button) => {
			const active = button.dataset["type"] === state.type;
			button.classList.toggle("active", active);
			button.setAttribute("aria-pressed", String(active));
		});
	}
	function syncMeasurementsLink() {
		const link = byId("link-measurements-page");
		if (!link) return;
		const url = getType(state.type)?.measurementsPageUrl;
		if (url) {
			link.href = url;
			link.hidden = false;
		} else link.hidden = true;
	}
	function setType(type, options = {}) {
		state.type = type;
		state.rows = state.rowsByType[type] ?? [];
		state.filters = initialFilterState(type, getConfig().sort?.default ?? "");
		if (options.updateUrl !== false) {
			const url = new URL(window.location.href);
			url.searchParams.set("type", type);
			window.history.replaceState({}, "", url);
		}
		syncTypeToggles();
		syncMeasurementsLink();
		renderFilterPanel();
		renderList();
	}
	function applyLanguage(lang) {
		state.lang = lang;
		document.documentElement.lang = lang;
		applyStrings(document, lang);
		renderTypeToggles();
		syncTypeToggles();
		renderFilterPanel();
		renderList();
	}
	function setupLanguageToggle() {
		byId("toggle-language")?.addEventListener("click", () => {
			const next = nextLanguage(state.lang);
			try {
				localStorage.setItem(LANG_STORAGE_KEY, next);
			} catch {}
			applyLanguage(next);
		});
	}
	function setupStatsModal() {
		const modal = byId("stats-modal");
		const openButton = byId("open-stats-modal");
		const closeButton = byId("close-stats-modal");
		if (!modal || !openButton || !closeButton) return;
		if (getConfig().stats?.enabled === false) {
			openButton.hidden = true;
			return;
		}
		let lastFocused = null;
		const open = () => {
			lastFocused = document.activeElement;
			modal.classList.add("open");
			document.body.style.overflow = "hidden";
			renderStats(state.rows, state.lang);
			closeButton.focus();
		};
		const close = () => {
			modal.classList.remove("open");
			document.body.style.overflow = "";
			(lastFocused ?? openButton).focus();
		};
		openButton.addEventListener("click", open);
		closeButton.addEventListener("click", close);
		modal.querySelector(".stats-modal-backdrop")?.addEventListener("click", close);
		modal.addEventListener("keydown", (event) => {
			if (!modal.classList.contains("open")) return;
			if (event.key === "Escape") {
				close();
				return;
			}
			if (event.key !== "Tab") return;
			const focusable = modal.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])");
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (!first || !last) return;
			if (event.shiftKey && document.activeElement === first) {
				last.focus();
				event.preventDefault();
			} else if (!event.shiftKey && document.activeElement === last) {
				first.focus();
				event.preventDefault();
			}
		});
	}
	function typeForCardId(cardId) {
		for (const id of getTypeIds()) if ((state.rowsByType[id] ?? []).some((row) => buildCardId(row) === cardId)) return id;
		return null;
	}
	function highlightCard(card) {
		card.classList.add("hash-highlight");
		card.setAttribute("tabindex", "-1");
		try {
			card.scrollIntoView({
				behavior: "smooth",
				block: "start"
			});
			card.focus({ preventScroll: true });
		} catch {}
		window.setTimeout(() => {
			card.classList.remove("hash-highlight");
			card.removeAttribute("tabindex");
		}, 6e3);
	}
	function handleHash() {
		const cardId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
		if (!cardId) return;
		const target = typeForCardId(cardId);
		if (target && target !== state.type) setType(target);
		const card = document.getElementById(cardId);
		if (card) highlightCard(card);
	}
	async function loadAllTypes() {
		const entries = getTypes();
		(await Promise.allSettled(entries.map(([, config]) => config.source?.url ? loadCsv(config.source.url) : Promise.resolve([])))).forEach((result, i) => {
			const entry = entries[i];
			if (!entry) return;
			const [id] = entry;
			if (result.status === "fulfilled") state.rowsByType[id] = applyRowFilter(result.value, id).map((row) => normalizeRow(row, id));
			else {
				state.loadFailed = true;
				state.rowsByType[id] = [];
				console.error(`[squigRanking] failed to load data for type "${id}"`, result.reason);
			}
		});
	}
	async function start() {
		setConfig(window.RANKING_CONFIG);
		const typeIds = getTypeIds();
		if (!typeIds.length) {
			console.error("[squigRanking] RANKING_CONFIG.types is empty — nothing to render.");
			return;
		}
		state.lang = detectLanguage(LANG_STORAGE_KEY);
		document.documentElement.lang = state.lang;
		applyStrings(document, state.lang);
		setupTheme(byId("toggle-theme"));
		setupLanguageToggle();
		setupStatsModal();
		renderTypeToggles();
		const list = byId("device-card-list");
		if (list) renderSkeletons(list);
		byId("scroll-to-top-btn")?.addEventListener("click", () => {
			window.scrollTo({
				top: 0,
				behavior: "smooth"
			});
		});
		await loadAllTypes();
		const requested = new URLSearchParams(window.location.search).get("type");
		setType(typeForCardId(decodeURIComponent(window.location.hash.replace(/^#/, ""))) ?? (requested && getType(requested) ? requested : typeIds[0]));
		window.addEventListener("hashchange", handleHash);
		handleHash();
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void start());
	else start();
	//#endregion
})();

//# sourceMappingURL=core.js.map