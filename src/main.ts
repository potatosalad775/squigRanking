// Entry point: wires config, data loading, and the page chrome together.

import {
  columnValue, getConfig, getRoleColumn, getType, getTypeIds, getTypes,
  resolveI18n, setConfig, visibleColumns,
} from './config.ts';
import { loadCsv } from './csv.ts';
import { buildCardId } from './deeplink.ts';
import { el } from './dom.ts';
import { applyStrings, detectLanguage, nextLanguage, t } from './i18n.ts';
import { loadPhonebook, resolveMeasurementUrl, type Phonebook } from './phonebook.ts';
import { filterAndSort, initialFilterState, type FilterState } from './query.ts';
import { renderCards } from './render/cards.ts';
import { renderControls } from './render/controls.ts';
import { renderSkeletons } from './render/skeleton.ts';
import { renderStats } from './stats.ts';
import { setupTheme } from './theme.ts';
import type { Lang, Row } from './types.ts';

const LANG_STORAGE_KEY = 'preferred-lang';

interface AppState {
  lang: Lang;
  type: string | null;
  rowsByType: Record<string, Row[]>;
  rows: Row[];
  filters: FilterState;
  loadFailed: boolean;
}

const state: AppState = {
  lang: 'en',
  type: null,
  rowsByType: {},
  rows: [],
  filters: { search: '', sort: '', columns: {} },
  loadFailed: false,
};

const phonebookCache = new Map<string, Promise<Phonebook | null>>();

function byId<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/** Trim cells and apply the type's blank-cell defaults. */
function normalizeRow(row: Row, type: string): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) out[key] = String(value ?? '').trim();
  const defaults = getType(type)?.defaults ?? {};
  for (const [key, value] of Object.entries(defaults)) if (!out[key]) out[key] = value;
  return out;
}

/** Keep only rows this type claims, for deploys serving several types from one sheet. */
function applyRowFilter(rows: Row[], type: string): Row[] {
  const filter = getType(type)?.rowFilter;
  if (!filter) return rows;
  const wanted = new Set(filter.values.map(value => value.toLowerCase().trim()));
  return rows.filter(row => wanted.has((row[filter.field] ?? '').toLowerCase().trim()));
}

// ---------------- Rendering ----------------

function renderList(): void {
  const container = byId('device-card-list');
  if (!container) return;

  if (state.loadFailed && !state.rows.length) {
    container.replaceChildren(el('p', { class: 'list-error', text: t('loadError', state.lang) }));
    return;
  }

  const columns = visibleColumns(state.type);
  const rows = filterAndSort(state.rows, state.type, state.filters, state.lang);
  renderCards(container, rows, columns, state.lang);
  void resolveMeasurementLinks(rows);
}

function renderFilterPanel(): void {
  const container = byId('filter-controls');
  if (!container) return;
  renderControls({
    container,
    type: state.type,
    rows: state.rows,
    state: state.filters,
    lang: state.lang,
    onChange: renderList,
    onReset: next => {
      state.filters = next;
      renderFilterPanel();
      renderList();
    },
  });
}

/** Fill in measurement hrefs once the active type's phonebook has loaded. */
async function resolveMeasurementLinks(rows: Row[]): Promise<void> {
  const type = state.type;
  if (!type) return;
  const config = getType(type);
  const url = config?.phonebook;
  const template = config?.measurementUrl;
  if (!url || !template) return;

  if (!phonebookCache.has(url)) phonebookCache.set(url, loadPhonebook(url));
  const phonebook = await phonebookCache.get(url)!;
  if (!phonebook || state.type !== type) return;

  const brandColumn = getRoleColumn('brand');
  const modelColumn = getRoleColumn('model');
  if (!brandColumn || !modelColumn) return;

  for (const row of rows) {
    const card = document.getElementById(buildCardId(row));
    const link = card?.querySelector<HTMLAnchorElement>('.device-card-measurement');
    if (!link) continue;
    // Cards are reused across renders, so a link resolved on an earlier pass is
    // already correct. Only the ones still hidden need looking up.
    if (!link.hidden) continue;
    const href = resolveMeasurementUrl(
      phonebook,
      columnValue(row, brandColumn, state.lang),
      columnValue(row, modelColumn, state.lang),
      template,
    );
    if (!href) continue;
    link.href = href;
    link.hidden = false;
  }
}

function renderTypeToggles(): void {
  const container = document.querySelector('.toggle-group');
  if (!container) return;
  container.replaceChildren();
  for (const [id, config] of getTypes()) {
    const button = el('button', {
      type: 'button',
      class: 'toggle-btn',
      id: `toggle-${id}`,
      'data-type': id,
      text: resolveI18n(config.label, state.lang),
      'aria-pressed': String(state.type === id),
    });
    button.addEventListener('click', () => setType(id));
    container.appendChild(button);
  }
}

function syncTypeToggles(): void {
  document.querySelectorAll<HTMLElement>('.toggle-btn').forEach(button => {
    const active = button.dataset['type'] === state.type;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function syncMeasurementsLink(): void {
  const link = byId<HTMLAnchorElement>('link-measurements-page');
  if (!link) return;
  const url = getType(state.type)?.measurementsPageUrl;
  if (url) {
    link.href = url;
    link.hidden = false;
  } else {
    link.hidden = true;
  }
}

// ---------------- Type and language switching ----------------

function setType(type: string, options: { updateUrl?: boolean } = {}): void {
  state.type = type;
  state.rows = state.rowsByType[type] ?? [];
  state.filters = initialFilterState(type, getConfig().sort?.default ?? '');

  if (options.updateUrl !== false) {
    const url = new URL(window.location.href);
    url.searchParams.set('type', type);
    window.history.replaceState({}, '', url);
  }

  syncTypeToggles();
  syncMeasurementsLink();
  renderFilterPanel();
  renderList();
}

function applyLanguage(lang: Lang): void {
  state.lang = lang;
  document.documentElement.lang = lang;
  applyStrings(document, lang);
  renderTypeToggles();
  syncTypeToggles();
  renderFilterPanel();
  renderList();
}

function setupLanguageToggle(): void {
  const button = byId('toggle-language');
  button?.addEventListener('click', () => {
    const next = nextLanguage(state.lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* storage blocked; the choice lasts for this page view only */
    }
    applyLanguage(next);
  });
}

// ---------------- Stats modal ----------------

function setupStatsModal(): void {
  const modal = byId('stats-modal');
  const openButton = byId('open-stats-modal');
  const closeButton = byId('close-stats-modal');
  if (!modal || !openButton || !closeButton) return;

  if (getConfig().stats?.enabled === false) {
    openButton.hidden = true;
    return;
  }

  let lastFocused: HTMLElement | null = null;

  const open = (): void => {
    lastFocused = document.activeElement as HTMLElement | null;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    void renderStats(state.rows, state.lang);
    closeButton.focus();
  };
  const close = (): void => {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    (lastFocused ?? openButton).focus();
  };

  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  modal.querySelector('.stats-modal-backdrop')?.addEventListener('click', close);

  modal.addEventListener('keydown', event => {
    if (!modal.classList.contains('open')) return;
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
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

// ---------------- Deep links ----------------

function typeForCardId(cardId: string): string | null {
  for (const id of getTypeIds()) {
    if ((state.rowsByType[id] ?? []).some(row => buildCardId(row) === cardId)) return id;
  }
  return null;
}

function highlightCard(card: HTMLElement): void {
  card.classList.add('hash-highlight');
  card.setAttribute('tabindex', '-1');
  // Scrolling and focus are best-effort: a failure here must not stop the
  // caller, which still has the hashchange listener to register.
  try {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.focus({ preventScroll: true });
  } catch {
    /* not supported in this environment */
  }
  window.setTimeout(() => {
    card.classList.remove('hash-highlight');
    card.removeAttribute('tabindex');
  }, 6000);
}

function handleHash(): void {
  const cardId = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (!cardId) return;
  const target = typeForCardId(cardId);
  if (target && target !== state.type) setType(target);
  // Cards render synchronously, so the element exists by now if it exists at all.
  const card = document.getElementById(cardId);
  if (card) highlightCard(card);
}

// ---------------- Startup ----------------

async function loadAllTypes(): Promise<void> {
  const entries = getTypes();
  const results = await Promise.allSettled(
    entries.map(([, config]) => (config.source?.url ? loadCsv(config.source.url) : Promise.resolve([]))),
  );
  results.forEach((result, i) => {
    const entry = entries[i];
    if (!entry) return;
    const [id] = entry;
    if (result.status === 'fulfilled') {
      state.rowsByType[id] = applyRowFilter(result.value, id).map(row => normalizeRow(row, id));
    } else {
      state.loadFailed = true;
      state.rowsByType[id] = [];
      console.error(`[squigRanking] failed to load data for type "${id}"`, result.reason);
    }
  });
}

async function start(): Promise<void> {
  setConfig(window.RANKING_CONFIG);

  const typeIds = getTypeIds();
  if (!typeIds.length) {
    console.error('[squigRanking] RANKING_CONFIG.types is empty — nothing to render.');
    return;
  }

  state.lang = detectLanguage(LANG_STORAGE_KEY);
  document.documentElement.lang = state.lang;
  applyStrings(document, state.lang);

  setupTheme(byId('toggle-theme'));
  setupLanguageToggle();
  setupStatsModal();
  renderTypeToggles();

  const list = byId('device-card-list');
  if (list) renderSkeletons(list);

  byId('scroll-to-top-btn')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  await loadAllTypes();

  const requested = new URLSearchParams(window.location.search).get('type');
  const hashType = typeForCardId(decodeURIComponent(window.location.hash.replace(/^#/, '')));
  const initial = hashType ?? (requested && getType(requested) ? requested : typeIds[0]!);
  setType(initial);

  // Register before the first call, so a failure inside it cannot leave the
  // page without deep-link handling for the rest of the session.
  window.addEventListener('hashchange', handleHash);
  handleHash();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void start());
} else {
  void start();
}
