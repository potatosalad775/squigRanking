// Config access helpers. Every lookup goes through here so that no other module
// needs to know the shape of RANKING_CONFIG or hardcode a CSV header name.

import type {
  ColumnConfig, ColumnRole, I18nString, Lang, RankScaleEntry, RankingConfig, Row, TypeConfig,
} from './types.ts';
import { CONFIG_VERSION } from './types.ts';

const EMPTY: RankingConfig = { types: {}, columns: [] };

let config: RankingConfig = EMPTY;

/** Install the operator config. Called once at startup. */
export function setConfig(next: RankingConfig | undefined): void {
  config = next ?? EMPTY;
  // Only a config from the future is a problem. Older configs keep working,
  // so bumping the schema must not fill every existing deploy's console.
  const declared = config.configVersion;
  if (declared !== undefined && declared > CONFIG_VERSION) {
    console.warn(
      `[squigRanking] ranking-config.js declares configVersion ${declared}, ` +
      `but this core understands ${CONFIG_VERSION}. Update core.js.`,
    );
  }
}

export function getConfig(): RankingConfig {
  return config;
}

export function getTypes(): Array<[string, TypeConfig]> {
  return Object.entries(config.types ?? {});
}

export function getTypeIds(): string[] {
  return Object.keys(config.types ?? {});
}

export function getType(id: string | null): TypeConfig | undefined {
  if (!id) return undefined;
  return (config.types ?? {})[id];
}

export function getColumns(): ColumnConfig[] {
  return config.columns ?? [];
}

export function getColumn(id: string): ColumnConfig | undefined {
  return getColumns().find(c => c.id === id);
}

/** The column carrying a semantic role, e.g. the rank column used for badge order. */
export function getRoleColumn(role: ColumnRole): ColumnConfig | undefined {
  return getColumns().find(c => c.role === role);
}

/** Columns applicable to a type, honoring `showForTypes`. */
export function visibleColumns(type: string | null): ColumnConfig[] {
  return getColumns().filter(c => !c.showForTypes || (type !== null && c.showForTypes.includes(type)));
}

/**
 * The rank column's scale, best first.
 *
 * A declared `scale` wins. Otherwise one is synthesized from a `select` filter's
 * values so that configs written before scales existed keep their order,
 * their dropdown, and their chart, just without colors or scores.
 */
export function getRankScale(): RankScaleEntry[] {
  const col = getRoleColumn('rank');
  if (!col) return [];
  if (col.scale?.length) return col.scale;
  if (col.filter?.kind === 'select' && col.filter.values?.length) {
    return col.filter.values.map(value => ({ value }));
  }
  return [];
}

/** Ordered rank values, best first. */
export function getRankValues(): string[] {
  return getRankScale().map(entry => entry.value);
}

/** The scale as numbers, or null when any step is not numeric. */
function numericScale(): number[] | null {
  const scale = getRankScale();
  if (scale.length < 2) return null;
  const numbers = scale.map(entry => Number.parseFloat(entry.value));
  return numbers.every(n => !Number.isNaN(n)) ? numbers : null;
}

/**
 * Position of a cell value in the scale, best first; -1 when it is off-scale.
 *
 * Matching ignores case and spacing. On an all-numeric scale a value between
 * two steps snaps to the nearer one, so a sheet holding 8.5 against a
 * whole-number scale still sorts, still tallies in the chart, and still gets a badge.
 */
export function rankIndexOf(value: string | undefined | null): number {
  const key = compareKey(value);
  if (!key) return -1;
  const scale = getRankScale();
  const exact = scale.findIndex(entry => compareKey(entry.value) === key);
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
export function rankEntry(value: string | undefined | null): RankScaleEntry | undefined {
  const index = rankIndexOf(value);
  return index === -1 ? undefined : getRankScale()[index];
}

/** Scale colors in rank order. Empty when no step declares one. */
export function rankColors(): string[] {
  const colors = getRankScale().map(entry => entry.color ?? '');
  return colors.some(Boolean) ? colors : [];
}

/**
 * A row's numeric score. Reads the score column, and falls back to the score
 * the rank scale assigns, so a sheet that only has a Rank column still sorts
 * by score and still feeds the average readout.
 */
export function rowScore(row: Row, lang: Lang, field?: string): number | null {
  const header = field ?? (getRoleColumn('score') ? columnField(getRoleColumn('score')!, lang) : undefined);
  if (header) {
    const parsed = Number.parseFloat(row[header] ?? '');
    if (!Number.isNaN(parsed)) return parsed;
  }
  const rankColumn = getRoleColumn('rank');
  if (rankColumn) {
    const raw = columnValue(row, rankColumn, lang);
    // On a numeric scale the cell itself is the score, so an off-step value
    // like 8.5 averages as 8.5 rather than as the step it snapped to.
    if (numericScale()) {
      const parsed = Number.parseFloat(raw);
      if (!Number.isNaN(parsed)) return parsed;
    }
    const entry = rankEntry(raw);
    if (entry?.score !== undefined) return entry.score;
  }
  return null;
}

/** Resolve an I18nString for a language, falling back to `default`. */
export function resolveI18n(value: I18nString | undefined, lang: Lang): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  const translated = value.i18n?.[lang];
  if (translated != null) return translated;
  return value.default ?? '';
}

/** The CSV header a column reads for a given language. */
export function columnField(column: ColumnConfig, lang: Lang): string | undefined {
  return column.i18nSource?.[lang] ?? column.source;
}

/**
 * A column's value on a row for a language. Falls back to the language-neutral
 * `source` header when the localized column is missing or blank.
 */
export function columnValue(row: Row, column: ColumnConfig, lang: Lang): string {
  const field = columnField(column, lang);
  if (field) {
    const v = row[field];
    if (v != null && v !== '') return v;
  }
  if (column.source) {
    const v = row[column.source];
    if (v != null && v !== '') return v;
  }
  return '';
}

/** Replace `{Header}` placeholders in a template with row values. */
export function interpolate(template: string, row: Row): string {
  return String(template).replace(/\{([^}]+)\}/g, (_, key: string) => row[key] ?? '');
}

/** Lowercase, collapse whitespace, trim. Used for matching, not for display. */
export function normalize(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Strip everything but alphanumerics. Last-resort matching key. */
export function simplify(value: string | undefined | null): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Comparison key for select filters and rank lookups. */
export function compareKey(value: string | undefined | null): string {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}

/** CSV headers the free-text search covers, defaulting to every declared source. */
export function searchFields(lang: Lang): string[] {
  const declared = config.search?.fields;
  if (declared?.length) return declared;
  const fields = new Set<string>();
  for (const column of getColumns()) {
    const field = columnField(column, lang);
    if (field) fields.add(field);
    if (column.source) fields.add(column.source);
    if (column.i18nSource) for (const f of Object.values(column.i18nSource)) fields.add(f);
  }
  return [...fields];
}
