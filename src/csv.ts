// RFC 4180 CSV parsing. Handles quoted fields, escaped quotes, embedded
// newlines, and CRLF or LF line endings.

import type { Row } from './types.ts';

/** Split CSV text into a grid of raw cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let cellStarted = false;

  const endCell = (): void => {
    row.push(cell);
    cell = '';
    cellStarted = false;
  };
  const endRow = (): void => {
    endCell();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && !cellStarted) { inQuotes = true; cellStarted = true; continue; }
    if (ch === ',') { endCell(); continue; }
    if (ch === '\r') { if (text[i + 1] === '\n') i++; endRow(); continue; }
    if (ch === '\n') { endRow(); continue; }
    cell += ch;
    cellStarted = true;
  }
  // Trailing cell, unless the input ended exactly on a row terminator.
  if (cell !== '' || row.length) endRow();
  return rows;
}

/** Parse CSV text into objects keyed by trimmed header name, skipping blank rows. */
export function csvToRows(text: string): Row[] {
  const grid = parseCsv(text);
  const header = grid[0];
  if (!header) return [];
  const keys = header.map(h => h.trim());
  return grid.slice(1)
    .filter(cells => cells.some(cell => cell.trim().length > 0))
    .map(cells => {
      const row: Row = {};
      keys.forEach((key, i) => {
        if (!key) return;
        row[key] = (cells[i] ?? '').trim();
      });
      return row;
    });
}

/** Fetch and parse a CSV endpoint. */
export async function loadCsv(url: string): Promise<Row[]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status}): ${url}`);
  return csvToRows(await res.text());
}
