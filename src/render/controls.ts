// Filter and sort controls. Rebuilt only when the type or language changes;
// typing in the search box re-renders cards alone, so focus is never lost.

import {
  columnValue, getColumn, getConfig, rankEntry, resolveI18n, visibleColumns,
} from '../config.ts';
import { el, svgIcon } from '../dom.ts';
import { ICON_CHEVRON_DOWN } from '../icons.ts';
import { t } from '../i18n.ts';
import type { FilterState } from '../query.ts';
import { initialFilterState } from '../query.ts';
import type { ColumnConfig, Lang, Row } from '../types.ts';

/** Collapsed state survives re-renders so a type switch does not close the panel. */
let collapsed = true;

/** Label for a sort key: config override, else column label plus direction. */
export function sortLabel(key: string, lang: Lang): string {
  const override = getConfig().sort?.labels?.[key];
  if (override) return resolveI18n(override, lang);
  const match = /^(.*)-(asc|desc)$/.exec(key);
  if (!match) return key;
  const column = getColumn(match[1] ?? '');
  const name = column ? resolveI18n(column.label, lang) : (match[1] ?? key);
  const direction = t(match[2] === 'desc' ? 'descending' : 'ascending', lang);
  return `${name} (${direction})`;
}

/**
 * Options for a `select` filter: the declared values, else the column's rank
 * scale. Letting the scale supply them is what keeps the dropdown, the sort
 * order and the badge colors from drifting apart.
 */
function selectValues(column: ColumnConfig): string[] {
  if (column.filter?.kind === 'select' && column.filter.values?.length) return column.filter.values;
  return (column.scale ?? []).map(entry => entry.value);
}

/** Distinct values for a `select-auto` filter, in first-seen order. */
function autoValues(rows: Row[], column: ColumnConfig, lang: Lang): string[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const value = columnValue(row, column, lang).trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (!seen.has(key)) seen.set(key, value);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export interface ControlsOptions {
  container: HTMLElement;
  type: string | null;
  rows: Row[];
  state: FilterState;
  lang: Lang;
  /** Called after any control mutates `state`. */
  onChange: () => void;
  /** Called when the reset button replaces `state` wholesale. */
  onReset: (next: FilterState) => void;
}

export function renderControls(options: ControlsOptions): void {
  const { container, type, rows, state, lang, onChange, onReset } = options;
  container.replaceChildren();

  const wrapper = el('div', { class: 'filter-collapse-wrapper' });
  const toggle = el('button', {
    type: 'button',
    class: 'filter-collapse-toggle',
    'aria-expanded': String(!collapsed),
    'aria-controls': 'filter-collapse-content',
  });
  const toggleInner = el('div', { class: 'filter-collapse-content-header' });
  const icon = el('span', { class: 'filter-toggle-icon' });
  icon.appendChild(svgIcon([ICON_CHEVRON_DOWN]));
  toggleInner.appendChild(icon);
  toggleInner.appendChild(el('span', { text: t('filterAndSort', lang) }));
  toggle.appendChild(toggleInner);
  wrapper.appendChild(toggle);

  // Always-visible row: free-text search and the sort dropdown.
  const topRow = el('div', { class: 'filter-collapse-content-controls' });
  if (getConfig().search?.enabled !== false) {
    const search = el('input', {
      id: 'input-search',
      type: 'search',
      value: state.search,
      placeholder: resolveI18n(getConfig().search?.label, lang) || t('search', lang),
      'aria-label': t('search', lang),
    });
    search.addEventListener('input', () => {
      state.search = search.value;
      onChange();
    });
    topRow.appendChild(search);
  }

  const sortOptions = getConfig().sort?.options ?? [];
  if (sortOptions.length) {
    const select = el('select', { id: 'select-sort', 'aria-label': t('sortBy', lang) });
    select.title = t('sortBy', lang);
    for (const key of sortOptions) {
      select.appendChild(el('option', { value: key, text: sortLabel(key, lang) }));
    }
    select.value = state.sort;
    select.addEventListener('change', () => {
      state.sort = select.value;
      onChange();
    });
    topRow.appendChild(select);
  }
  wrapper.appendChild(topRow);

  // Collapsible panel: one control per filterable column, plus reset.
  const content = el('div', {
    id: 'filter-collapse-content',
    class: 'filter-collapse-content',
    'aria-hidden': String(collapsed),
  });

  for (const column of visibleColumns(type)) {
    const filter = column.filter;
    if (!filter) continue;
    const label = el('label', { class: 'filter-field' });
    const labelText = resolveI18n(column.label, lang);
    label.appendChild(el('span', { id: `filter-label-${column.id}`, text: labelText }));

    if (filter.kind === 'select' || filter.kind === 'select-auto') {
      const values = filter.kind === 'select' ? selectValues(column) : autoValues(rows, column, lang);
      const select = el('select', { id: `filter-input-${column.id}` });
      select.appendChild(el('option', { value: '', text: t('all', lang) }));
      for (const value of values) {
        const entry = filter.kind === 'select' ? rankEntry(value) : undefined;
        const text = entry?.label ? resolveI18n(entry.label, lang) : value;
        select.appendChild(el('option', { value, text }));
      }
      select.value = state.columns[column.id] ?? '';
      select.addEventListener('change', () => {
        state.columns[column.id] = select.value;
        onChange();
      });
      label.appendChild(select);
    } else {
      const input = el('input', {
        id: `filter-input-${column.id}`,
        type: 'text',
        value: state.columns[column.id] ?? '',
        placeholder: labelText,
      });
      input.addEventListener('input', () => {
        state.columns[column.id] = input.value;
        onChange();
      });
      label.appendChild(input);
    }
    content.appendChild(label);
  }

  const reset = el('button', { type: 'button', id: 'reset-filters-btn', text: t('resetFilters', lang) });
  reset.addEventListener('click', () => {
    onReset(initialFilterState(type, getConfig().sort?.default ?? state.sort));
  });
  content.appendChild(reset);
  wrapper.appendChild(content);

  const applyCollapsed = (): void => {
    wrapper.classList.toggle('collapsed', collapsed);
    content.classList.toggle('collapsed', collapsed);
    content.setAttribute('aria-hidden', String(collapsed));
    toggle.setAttribute('aria-expanded', String(!collapsed));
  };
  applyCollapsed();
  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    applyCollapsed();
  });

  container.appendChild(wrapper);
}
