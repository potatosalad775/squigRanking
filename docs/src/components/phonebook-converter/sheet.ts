// Devices to the spreadsheet the page reads.
//
// The header row is not invented here. It is the header row of the chosen
// preset's `TEMPLATE.csv`, so what an operator pastes into `TEMPLATE.xlsx` can
// never disagree with the workbook they pasted it into.
//
// Everything the phone book knows goes into a column; everything else is left
// blank, because a blank cell renders nothing and the review is the part the
// operator is here to write.

import type { Device } from './convert.ts';

/** A device plus the one thing the editable list adds: whether it goes in the sheet. */
export interface DeviceRow extends Device {
	include: boolean;
}

/** Columns for the data the shipped template has no home for. */
export const EXTRA_COLUMNS = {
	price: 'Price',
	reviewLink: 'Review',
	shopLink: 'Shop',
} as const;

export interface SheetOptions {
	/** The chosen preset's `TEMPLATE.csv` header row. */
	template: string[];
	/** Keep the parallel `_KR` columns for a bilingual sheet. */
	korean: boolean;
	/** Which template column a `description` lands in, or `''` to leave it behind. */
	descriptionInto: string;
	price: boolean;
	reviewLink: boolean;
	shopLink: boolean;
}

/** The header row for these options: the template, trimmed and extended. */
export function sheetHeaders(options: SheetOptions): string[] {
	const headers = options.korean
		? [...options.template]
		: options.template.filter(header => !header.endsWith('_KR'));
	if (options.price) headers.push(EXTRA_COLUMNS.price);
	if (options.reviewLink) headers.push(EXTRA_COLUMNS.reviewLink);
	if (options.shopLink) headers.push(EXTRA_COLUMNS.shopLink);
	return headers;
}

/** Header row plus one row per device, in the header's column order. */
export function sheetGrid(devices: Device[], options: SheetOptions): string[][] {
	const headers = sheetHeaders(options);
	const rows = devices.map(device => {
		const cells: Record<string, string> = {
			Brand: device.brand,
			Model: device.model,
			Rank: device.rank,
			[EXTRA_COLUMNS.price]: options.price ? device.price : '',
			[EXTRA_COLUMNS.reviewLink]: options.reviewLink ? device.reviewLink : '',
			[EXTRA_COLUMNS.shopLink]: options.shopLink ? device.shopLink : '',
		};
		// Set after the fixed cells, so a description can never displace a Brand.
		if (options.descriptionInto && headers.includes(options.descriptionInto)) {
			cells[options.descriptionInto] = device.description;
		}
		return headers.map(header => cells[header] ?? '');
	});
	return [headers, ...rows];
}

/** RFC 4180. Quoted only where it has to be, so the file stays readable. */
function csvCell(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(grid: string[][]): string {
	return `${grid.map(row => row.map(csvCell).join(',')).join('\n')}\n`;
}

/**
 * Tab-separated, for pasting straight into an open sheet.
 *
 * A spreadsheet's paste parser has no quoting: a tab or a newline inside a cell
 * ends it, wherever it came from. Both are collapsed to spaces rather than
 * escaped, because a row that silently splits in two is worse than a lost tab.
 */
export function toTsv(grid: string[][]): string {
	return grid.map(row => row.map(cell => cell.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
}

/** Rank values the chosen scale does not list, so an operator can fix one or the other. */
export function offScaleRanks(devices: Device[], scale: string[]): string[] {
	const known = new Set(scale.map(value => value.trim().toUpperCase()));
	const unknown = new Set<string>();
	for (const device of devices) {
		const rank = device.rank.trim();
		if (rank && !known.has(rank.toUpperCase())) unknown.add(rank);
	}
	return [...unknown];
}
