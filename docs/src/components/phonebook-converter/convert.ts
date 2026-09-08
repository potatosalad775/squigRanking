// `phone_book.json` to a list of devices a ranking sheet can be started from.
//
// One filename, two dialects. CrinGraph reads `file`, `suffix` and `prefix` and
// nothing else; modernGraphTool layers `variants[]`, `hptfs[]` and `samples` on
// top of that same shape. Both are read here, because a squig deploy's phone
// book is usually authored for one tool and served to both, and an operator
// converting one should not have to know which dialect theirs is in.
//
// What comes out is one device per row: the `Brand` and `Model` cells a sheet
// needs, plus the review metadata the phone book already carries. The names
// written here are the names `src/phonebook.ts` has to match back to the same
// entry when the page resolves a measurement link, so the two are tested
// together rather than trusted to stay in step.
//
// Pure: nothing here touches the DOM or the network.

export interface Variation {
	/** The label the graph tool shows after the model name. Often empty. */
	label: string;
	/** Base measurement filename, without the ` L.txt` the tool appends. */
	file: string;
}

export interface Device {
	/**
	 * Where the device sat in the source file. Stable across a re-convert, so a
	 * changed option does not have to throw away the operator's edits.
	 */
	key: string;
	brand: string;
	model: string;
	/** The variation label, set only when variations became rows of their own. */
	variant: string;
	/** The `Rank` cell, seeded from `reviewScore` and editable afterwards. */
	rank: string;
	/** First measurement filename. What the page will match this row against. */
	file: string;
	reviewScore: string;
	price: string;
	/** Flattened to text: a sheet cell never reaches the page as HTML. */
	description: string;
	reviewLink: string;
	shopLink: string;
	/** How many measurements the source entry declares. Shown as a hint. */
	variations: number;
}

export interface ConvertOptions {
	/** One row per measurement instead of one per model. */
	splitVariations: boolean;
	/** Seed the `Rank` cells from the phone book's own `reviewScore`. */
	rankFromReviewScore: boolean;
	/**
	 * Whether a `reviewScore` of `0` means "not reviewed yet".
	 *
	 * It usually does. CrinGraph forks write `0` into every entry that has no
	 * score, so a squig with a few hundred devices typically has a quarter of
	 * them sitting at zero — which as a grade would read as a bottom rank.
	 */
	zeroIsUnrated: boolean;
}

export interface Conversion {
	devices: Device[];
	brands: number;
	/**
	 * Which dialect the file is written in. Informational only, because both are
	 * read the same way.
	 */
	dialect: 'cringraph' | 'moderngraphtool';
	/** Anything guessed, flattened or skipped, so nothing is lost quietly. */
	notes: string[];
	error?: string;
}

/** Keys only modernGraphTool defines. Their presence is what names the dialect. */
const MGT_KEYS = ['variants', 'hptfs', 'samples', 'links', 'description', 'defaultSamples'];

interface RawPhone {
	name?: unknown;
	file?: unknown;
	suffix?: unknown;
	prefix?: unknown;
	variants?: unknown;
	hptfs?: unknown;
	reviewScore?: unknown;
	reviewLink?: unknown;
	shopLink?: unknown;
	price?: unknown;
	description?: unknown;
}

function text(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return '';
}

/** An array of strings, whatever shape the key came in as. Empty entries are kept. */
function list(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(text);
	const single = text(value);
	return single ? [single] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A count with its noun agreeing. Every note here can be about a single entry. */
function count(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

/**
 * A description reaches the page as a text node, so markup left in it would show
 * up as literal angle brackets. modernGraphTool allows a few inline tags; they
 * are unwrapped here rather than escaped, which is what the graph tool renders.
 */
export function stripHtml(value: string): string {
	return value
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#0?39;|&apos;/gi, "'")
		.replace(/&amp;/gi, '&')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Strip a `prefix` off a filename to recover the label, the way the tools do. */
function stripPrefix(file: string, prefix: string): string {
	if (!prefix) return '';
	return file.toLowerCase().startsWith(prefix.toLowerCase())
		? file.slice(prefix.length).trim()
		: file.trim();
}

/** The label for variation `index` of a phone, mirroring the graph tools' rules. */
function labelAt(phone: RawPhone, files: string[], index: number): string {
	if (Array.isArray(phone.suffix)) return text(phone.suffix[index]);
	const single = text(phone.suffix);
	if (single) return single;
	const prefix = Array.isArray(phone.prefix) ? text(phone.prefix[index]) : text(phone.prefix);
	return stripPrefix(files[index] ?? '', prefix);
}

/**
 * Every measurement a phone entry declares, in the order the graph tool lists
 * them.
 *
 * `variants[]` composes with `file[]` rather than replacing it: an entry naming
 * a file the phone already declared refines that variation in place, and any
 * other entry is appended. That is modernGraphTool's merge rule, and it is what
 * lets one entry serve both tools, so following it here keeps the row count the
 * same as the device count a visitor sees.
 */
export function variationsOf(phone: RawPhone, baseName: string): Variation[] {
	const files = list(phone.file).filter(file => file !== '');
	const hptfs = Array.isArray(phone.hptfs) ? phone.hptfs.filter(isRecord) : [];
	const variants = Array.isArray(phone.variants) ? phone.variants.filter(isRecord) : [];

	// A phone with no `file` falls back to its own name, unless its measurements
	// live entirely in `hptfs[]` or `variants[]` — then the fallback would invent
	// a variation the graph tool never shows.
	const base: Variation[] = files.length
		? files.map((file, index) => ({ label: labelAt(phone, files, index), file }))
		: hptfs.length || variants.length
			? []
			: [{ label: '', file: baseName }];

	for (const entry of hptfs) {
		const entryFiles = Array.isArray(entry['files']) ? entry['files'].map(text) : [];
		base.push({ label: text(entry['suffix']), file: entryFiles[0] ?? baseName });
	}

	for (const entry of variants) {
		const samples = isRecord(entry['samples']) ? entry['samples'] : null;
		const sampleFiles = samples && Array.isArray(samples['files']) ? samples['files'].map(text) : [];
		const file = text(entry['file']) || sampleFiles[0] || baseName;
		const variation = { label: text(entry['suffix']), file };
		const at = base.findIndex(existing => existing.file === file);
		if (at === -1) base.push(variation);
		else base[at] = variation;
	}

	return base;
}

/** The `Rank` cell a phone's `reviewScore` seeds, or `''` when it says nothing. */
export function seedRank(reviewScore: string, options: ConvertOptions): string {
	if (!options.rankFromReviewScore || !reviewScore) return '';
	if (options.zeroIsUnrated && Number.parseFloat(reviewScore) === 0) return '';
	return reviewScore;
}

function deviceFrom(
	key: string,
	brand: string,
	model: string,
	phone: RawPhone,
	variation: Variation,
	count: number,
	options: ConvertOptions,
): Device {
	const variant = options.splitVariations ? variation.label : '';
	const reviewScore = text(phone.reviewScore);
	return {
		key,
		brand,
		model: variant ? `${model} ${variant}`.trim() : model,
		variant,
		rank: seedRank(reviewScore, options),
		file: variation.file,
		reviewScore,
		price: text(phone.price),
		description: stripHtml(text(phone.description)),
		reviewLink: text(phone.reviewLink),
		shopLink: text(phone.shopLink),
		variations: count,
	};
}

/** Read a parsed `phone_book.json` into devices. `data` is whatever JSON gave back. */
export function convert(data: unknown, options: ConvertOptions): Conversion {
	if (!Array.isArray(data)) {
		return {
			devices: [],
			brands: 0,
			dialect: 'cringraph',
			notes: [],
			error: 'A phone book is a JSON array of brands. This file is not an array.',
		};
	}

	const devices: Device[] = [];
	const notes: string[] = [];
	let brands = 0;
	let dialect: Conversion['dialect'] = 'cringraph';
	let skippedBrands = 0;
	let skippedPhones = 0;
	let brandSuffixes = 0;
	let flattened = 0;
	let deprecated = 0;

	data.forEach((rawBrand, brandIndex) => {
		if (!isRecord(rawBrand)) {
			skippedBrands += 1;
			return;
		}
		const brand = text(rawBrand['name']);
		if (!brand) {
			skippedBrands += 1;
			return;
		}
		// A brand `suffix` is a graph-tool display decoration. It stays out of the
		// sheet: the page looks a row up by brand name, and an exact hit beats a
		// fuzzy one against a name the phone book does not actually contain.
		if (text(rawBrand['suffix'])) brandSuffixes += 1;
		brands += 1;

		const phones = Array.isArray(rawBrand['phones']) ? rawBrand['phones'] : [];
		phones.forEach((rawPhone, phoneIndex) => {
			if (typeof rawPhone !== 'string' && !isRecord(rawPhone)) {
				skippedPhones += 1;
				return;
			}
			const phone: RawPhone = typeof rawPhone === 'string' ? { name: rawPhone } : rawPhone;
			if (isRecord(rawPhone)) {
				if (MGT_KEYS.some(key => key in rawPhone)) dialect = 'moderngraphtool';
				if ('hptfs' in rawPhone) deprecated += 1;
			}

			const model = Array.isArray(phone.name) ? text(phone.name[0]) : text(phone.name);
			if (!model) {
				skippedPhones += 1;
				return;
			}
			const description = text(phone.description);
			if (description && stripHtml(description) !== description) flattened += 1;

			const variations = variationsOf(phone, model);
			if (!variations.length) {
				skippedPhones += 1;
				return;
			}

			const key = `b${brandIndex}.p${phoneIndex}`;
			const count = variations.length;
			if (options.splitVariations) {
				variations.forEach((variation, index) => {
					devices.push(
						deviceFrom(`${key}.v${index}`, brand, model, phone, variation, count, options),
					);
				});
			} else {
				devices.push(deviceFrom(key, brand, model, phone, variations[0]!, count, options));
			}
		});
	});

	if (skippedBrands) {
		notes.push(`Skipped ${count(skippedBrands, 'brand entry', 'brand entries')} with no name.`);
	}
	if (skippedPhones) {
		notes.push(`Skipped ${count(skippedPhones, 'device entry', 'device entries')} with no name.`);
	}
	if (brandSuffixes) {
		notes.push(
			`${count(brandSuffixes, 'brand carries', 'brands carry')} a display suffix. The sheet uses ` +
				'the brand name on its own, so the page finds an exact phonebook match.',
		);
	}
	if (flattened) {
		notes.push(
			`Flattened HTML to text in ${count(flattened, 'description', 'descriptions')}, because a ` +
				'sheet cell never reaches the page as markup.',
		);
	}
	if (deprecated) {
		notes.push(
			`${count(deprecated, 'entry uses', 'entries use')} modernGraphTool's deprecated hptfs[] key. ` +
				'Read as written, but worth converting to variants[] while you are in the file.',
		);
	}
	if (!devices.length && !notes.length) notes.push('The file parsed, but it lists no devices.');

	return { devices, brands, dialect, notes };
}

/** The card anchor a row will claim: `{brand}-{model}`, lowercased and hyphenated. */
export function slugOf(device: Pick<Device, 'brand' | 'model'>): string {
	return `${device.brand}-${device.model}`.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Two rows with the same anchor would fight over one card, so the deep link to
 * either lands on whichever rendered first. Returns the names that collide.
 */
export function duplicateNames(devices: Array<Pick<Device, 'brand' | 'model'>>): string[] {
	const counts = new Map<string, number>();
	for (const device of devices) {
		const slug = slugOf(device);
		counts.set(slug, (counts.get(slug) ?? 0) + 1);
	}
	const names = new Set<string>();
	for (const device of devices) {
		if ((counts.get(slugOf(device)) ?? 0) > 1) names.add(`${device.brand} ${device.model}`.trim());
	}
	return [...names];
}
