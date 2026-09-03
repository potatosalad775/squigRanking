// Filtering and sorting. Pure functions over rows, so they are unit-testable
// without a DOM. No CSV header name is hardcoded; ordering hints come from
// column roles.

import {
  columnField, columnValue, compareKey, getRoleColumn, interpolate, rankIndexOf, rowScore,
  searchFields, visibleColumns,
} from './config.ts';
import type { ColumnConfig, Lang, Row } from './types.ts';

export interface FilterState {
  search: string;
  sort: string;
  /** Column id -> raw filter input. Empty string means "no constraint". */
  columns: Record<string, string>;
}

export function initialFilterState(type: string | null, sortDefault: string): FilterState {
  const columns: Record<string, string> = {};
  for (const column of visibleColumns(type)) {
    if (column.filter) columns[column.id] = '';
  }
  return { search: '', sort: sortDefault, columns };
}

/** Maps a rank value to its position in the configured order; -1 when unranked. */
export function rankIndexer(): (value: string) => number {
  const cache = new Map<string, number>();
  return value => {
    const hit = cache.get(value);
    if (hit !== undefined) return hit;
    const index = rankIndexOf(value);
    cache.set(value, index);
    return index;
  };
}

export function matchesFilters(
  row: Row, columns: ColumnConfig[], state: FilterState, lang: Lang,
): boolean {
  for (const column of columns) {
    const filter = column.filter;
    if (!filter) continue;
    const needle = state.columns[column.id];
    if (!needle) continue;
    if (filter.kind === 'select' || filter.kind === 'select-auto') {
      if (compareKey(columnValue(row, column, lang)) !== compareKey(needle)) return false;
    } else {
      const fields = filter.match?.length ? filter.match : (column.source ? [column.source] : []);
      const lowered = needle.toLowerCase();
      const hit = fields.some(field => (row[field] ?? '').toLowerCase().includes(lowered));
      if (!hit) return false;
    }
  }
  if (state.search) {
    const lowered = state.search.toLowerCase();
    const hit = searchFields(lang).some(field => (row[field] ?? '').toLowerCase().includes(lowered));
    if (!hit) return false;
  }
  return true;
}

type SortValue = { missing: true } | { missing: false; value: string | number };

function sortValue(row: Row, column: ColumnConfig, lang: Lang, rankIndex: (v: string) => number): SortValue {
  if (column.role === 'rank') {
    const index = rankIndex(columnValue(row, column, lang));
    return index === -1 ? { missing: true } : { missing: false, value: index };
  }
  const render = column.render;
  if (render?.kind === 'title' && render.template) {
    const text = interpolate(render.template, row).trim();
    return text ? { missing: false, value: text.toLowerCase() } : { missing: true };
  }
  // The score column resolves through the rank scale, so a sheet that ranks
  // without a Score cell still sorts by score.
  if (column.role === 'score') {
    const num = rowScore(row, lang, columnField(column, lang));
    return num === null ? { missing: true } : { missing: false, value: num };
  }
  const raw = columnValue(row, column, lang).trim();
  if (!raw) return { missing: true };
  if (render?.kind === 'numeric' || render?.kind === 'stars' || render?.kind === 'score-badge') {
    const num = Number.parseFloat(raw);
    return Number.isNaN(num) ? { missing: true } : { missing: false, value: num };
  }
  return { missing: false, value: raw.toLowerCase() };
}

/** Compare two sort values. Missing values always sink, whichever direction. */
function compare(a: SortValue, b: SortValue, direction: 1 | -1): number {
  if (a.missing && b.missing) return 0;
  if (a.missing) return 1;
  if (b.missing) return -1;
  if (typeof a.value === 'number' && typeof b.value === 'number') {
    return (a.value - b.value) * direction;
  }
  const result = String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: 'base' });
  return result * direction;
}

/** Split `'rank-asc'` into a column id and a direction. */
export function parseSortKey(key: string): { id: string; direction: 1 | -1 } {
  const match = /^(.*)-(asc|desc)$/.exec(key ?? '');
  if (!match) return { id: key ?? '', direction: 1 };
  return { id: match[1] ?? '', direction: match[2] === 'desc' ? -1 : 1 };
}

/**
 * Sort rows by a sort key, then by rank, brand and model so that equal
 * primary values keep a stable, meaningful order.
 */
export function sortRows(rows: Row[], sortKey: string, lang: Lang): Row[] {
  const { id, direction } = parseSortKey(sortKey);
  const rankIndex = rankIndexer();
  const columns = visibleColumns(null);
  const primary = columns.find(c => c.id === id);
  const tiebreakers = ['rank', 'brand', 'model']
    .map(role => getRoleColumn(role as 'rank' | 'brand' | 'model'))
    .filter((c): c is ColumnConfig => Boolean(c) && c!.id !== primary?.id);

  return [...rows].sort((a, b) => {
    if (primary) {
      const result = compare(
        sortValue(a, primary, lang, rankIndex),
        sortValue(b, primary, lang, rankIndex),
        direction,
      );
      if (result !== 0) return result;
    }
    for (const column of tiebreakers) {
      const result = compare(
        sortValue(a, column, lang, rankIndex),
        sortValue(b, column, lang, rankIndex),
        1,
      );
      if (result !== 0) return result;
    }
    return 0;
  });
}

export function filterAndSort(
  rows: Row[], type: string | null, state: FilterState, lang: Lang,
): Row[] {
  const columns = visibleColumns(type).filter(c => c.filter);
  const filtered = rows.filter(row => matchesFilters(row, columns, state, lang));
  return sortRows(filtered, state.sort, lang);
}
