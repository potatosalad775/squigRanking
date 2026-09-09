// Chrome strings. Shipped inside the bundle so a CDN-hosted core.js needs no
// sibling files; operators override individual strings via RANKING_CONFIG.i18n.
//
// Only strings core itself writes live here. Operator copy — the header title,
// the footer note — is `RANKING_CONFIG.chrome`, so there is one place to look
// for it rather than two that both half-work.

import { getConfig } from './config.ts';
import type { Lang } from './types.ts';

export const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    filterAndSort: 'Filter & Sort',
    resetFilters: 'Reset Filters',
    search: 'Search',
    sortBy: 'Sort by',
    all: 'All',
    statsTitle: 'Ranking Statistics',
    averageScore: 'Average Score:',
    deviceCount: 'Device Count',
    closeStats: 'Close statistics',
    openStats: 'Open statistics',
    measurementsPage: 'Go to Measurements Page',
    toggleTheme: 'Toggle Light/Dark Theme',
    toggleLanguage: 'View in Korean',
    scrollTop: 'Scroll to top',
    noResults: 'No devices match the current filters.',
    loadError: 'Could not load the ranking data. Check the source URL in ranking-config.js.',
    ascending: 'A to Z',
    descending: 'Z to A',
  },
  ko: {
    filterAndSort: '필터 & 정렬',
    resetFilters: '필터 초기화',
    search: '검색',
    sortBy: '정렬 기준',
    all: '전체',
    statsTitle: '랭킹 통계',
    averageScore: '평균 점수:',
    deviceCount: '기기 수',
    closeStats: '통계 닫기',
    openStats: '통계 열기',
    measurementsPage: '측정 페이지로 이동',
    toggleTheme: '라이트/다크 테마 전환',
    toggleLanguage: 'View in English',
    scrollTop: '맨 위로',
    noResults: '현재 필터 조건에 맞는 기기가 없습니다.',
    loadError: '랭킹 데이터를 불러오지 못했습니다. ranking-config.js의 소스 URL을 확인하세요.',
    ascending: '오름차순',
    descending: '내림차순',
  },
};

/** Languages offered by the toggle, in cycle order. */
export function languages(): Lang[] {
  const declared = getConfig().languages;
  const tags = Array.isArray(declared) ? declared : Object.keys(declared ?? {});
  if (tags.length) return tags;
  const overrides = Object.keys(getConfig().i18n ?? {});
  const builtin = Object.keys(STRINGS);
  return [...new Set([...builtin, ...overrides])];
}

/** The operator's name for a language, when `languages` names them. */
function languageName(lang: Lang): string {
  const declared = getConfig().languages;
  if (!declared || Array.isArray(declared)) return '';
  return declared[lang] ?? '';
}

/**
 * The language button's tooltip, built from the names in `languages`.
 *
 * The string names the language the button moves to, so the two shipped values
 * are only correct while the cycle is English and then Korean. Naming the
 * languages lets core write it for any cycle; an unnamed one falls through to
 * the built-in string below.
 */
function toggleLanguageLabel(lang: Lang): string {
  if (languages().length < 2) return '';
  const name = languageName(nextLanguage(lang));
  return name ? `View in ${name}` : '';
}

/** Look up a chrome string, preferring config overrides, then English. */
export function t(key: string, lang: Lang): string {
  const override = getConfig().i18n?.[lang]?.[key];
  if (override != null) return override;
  if (key === 'toggleLanguage') {
    const derived = toggleLanguageLabel(lang);
    if (derived) return derived;
  }
  const builtin = STRINGS[lang]?.[key];
  if (builtin != null) return builtin;
  return STRINGS['en']?.[key] ?? key;
}

/** The language the page opens in: stored choice, else browser preference. */
export function detectLanguage(storageKey = 'preferred-lang'): Lang {
  const available = languages();
  const fallback = available[0] ?? 'en';
  let stored: string | null = null;
  try { stored = localStorage.getItem(storageKey); } catch { /* storage blocked */ }
  if (stored && available.includes(stored)) return stored;
  const navLangs = (navigator.languages?.length ? navigator.languages : [navigator.language || 'en'])
    .map(l => String(l).toLowerCase());
  for (const nav of navLangs) {
    const hit = available.find(l => nav === l.toLowerCase() || nav.startsWith(l.toLowerCase() + '-'));
    if (hit) return hit;
  }
  return fallback;
}

/** Next language in the cycle. */
export function nextLanguage(current: Lang): Lang {
  const available = languages();
  const i = available.indexOf(current);
  return available[(i + 1) % available.length] ?? current;
}

/**
 * Apply chrome strings to the page. Elements opt in with `data-i18n="key"`
 * for text content and `data-i18n-title="key"` / `data-i18n-label="key"`
 * for the `title` and `aria-label` attributes.
 */
export function applyStrings(root: ParentNode, lang: Lang): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const key = el.dataset['i18n'];
    if (key) el.textContent = t(key, lang);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => {
    const key = el.dataset['i18nTitle'];
    if (key) el.title = t(key, lang);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach(el => {
    const key = el.dataset['i18nLabel'];
    if (key) el.setAttribute('aria-label', t(key, lang));
  });
}
