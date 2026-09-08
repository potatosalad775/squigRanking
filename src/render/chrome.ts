// The page chrome: header, footer, and the scaffold the list renders into.
//
// index.html ships three empty landmarks and nothing else, so the markup core
// queries and the code that queries it always ship together and cannot drift
// apart. Everything an operator would otherwise edit by hand — the title, the
// header links, which toggles appear, the footer and its links — comes from
// `RANKING_CONFIG.chrome`.
//
// The header is rebuilt on every language change, so nothing outside this
// module may hold a reference to a button inside it.

import { getConfig, resolveI18n } from '../config.ts';
import { appendTextWithBreaks, el, svgIcon } from '../dom.ts';
import {
  ICON_ARROW_UP, ICON_EXTERNAL_LINK, ICON_LANGUAGE, ICON_MEASUREMENTS, ICON_QUESTION,
  ICON_STATS, ICON_THEME,
} from '../icons.ts';
import { languages, t } from '../i18n.ts';
import type { ChromeConfig, ChromeIcon, ChromeLink, I18nString, Lang } from '../types.ts';
import { mountStatsModal, openStatsModal } from './modal.ts';

const LINK_ICONS: Record<ChromeIcon, string> = {
  measurements: ICON_MEASUREMENTS,
  external: ICON_EXTERNAL_LINK,
  info: ICON_QUESTION,
};

export interface ChromeHandlers {
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  /** Called on every open of the stats modal, to draw the chart. */
  onOpenStats: () => void;
}

function chrome(): ChromeConfig {
  return getConfig().chrome ?? {};
}

function statsEnabled(): boolean {
  return getConfig().stats?.enabled !== false;
}

/**
 * An icon button carrying a built-in string.
 *
 * The `data-i18n-*` attributes are what `applyStrings` looks for, so a button
 * that outlives a language change updates itself; the resolved values are set
 * here too, so one that is built fresh is correct before that ever runs.
 */
function iconButton(
  id: string,
  path: string,
  key: string,
  lang: Lang,
  onClick: () => void,
): HTMLButtonElement {
  const button = el('button', {
    type: 'button',
    id,
    'data-i18n-title': key,
    'data-i18n-label': key,
    title: t(key, lang),
    'aria-label': t(key, lang),
  });
  button.appendChild(svgIcon([path]));
  button.addEventListener('click', onClick);
  return button;
}

/** An operator-configured link. Falls back to the href when it has no label. */
function chromeLink(link: ChromeLink, lang: Lang, className: string): HTMLAnchorElement {
  const label = resolveI18n(link.label, lang);
  const title = resolveI18n(link.title, lang) || label;
  const anchor = el('a', { class: className, href: link.href });
  if (title) {
    anchor.title = title;
    anchor.setAttribute('aria-label', title);
  }
  if (link.newTab) {
    anchor.target = '_blank';
    anchor.rel = 'noopener';
  }
  if (link.icon && LINK_ICONS[link.icon]) anchor.appendChild(svgIcon([LINK_ICONS[link.icon]]));
  if (label || !link.icon) anchor.appendChild(el('span', { text: label || link.href }));
  return anchor;
}

// ---------------- Header ----------------

function headerTitle(lang: Lang): HTMLElement {
  const config = chrome();
  const box = el('div', { class: 'header-title' });

  const title = config.title === false ? '' : resolveI18n(config.title, lang);
  if (title) {
    box.appendChild(
      config.titleUrl
        ? el('a', { class: 'header-title-link', href: config.titleUrl, text: title })
        : el('span', { text: title }),
    );
  }
  const subtitle = resolveI18n(config.subtitle, lang);
  if (subtitle) box.appendChild(el('span', { class: 'header-subtitle', text: subtitle }));
  return box;
}

/**
 * Rebuild the header.
 *
 * Safe to call repeatedly: it replaces its own container's children and rebinds
 * every listener it needs.
 */
export function renderHeader(lang: Lang, handlers: ChromeHandlers): void {
  const host = document.getElementById('ranking-header');
  if (!host) return;
  const config = chrome();

  const links = el('div', { class: 'header-links' });
  for (const link of config.links ?? []) links.appendChild(chromeLink(link, lang, 'button-like'));

  if (config.measurementsLink !== false) {
    const measurements = el('a', {
      id: 'link-measurements-page',
      class: 'button-like',
      href: '#',
      'data-i18n-title': 'measurementsPage',
      'data-i18n-label': 'measurementsPage',
      title: t('measurementsPage', lang),
      'aria-label': t('measurementsPage', lang),
    });
    measurements.appendChild(svgIcon([ICON_MEASUREMENTS]));
    // Revealed by syncMeasurementsLink once a type declaring one is active.
    measurements.hidden = true;
    links.appendChild(measurements);
  }

  if (config.themeToggle !== false) {
    links.appendChild(iconButton('toggle-theme', ICON_THEME, 'toggleTheme', lang, handlers.onToggleTheme));
  }
  // A single-language deploy has nothing to toggle to, so the button is hidden
  // unless the operator asks for it.
  if (config.languageToggle ?? languages().length > 1) {
    links.appendChild(
      iconButton('toggle-language', ICON_LANGUAGE, 'toggleLanguage', lang, handlers.onToggleLanguage),
    );
  }

  const top = el('div', { class: 'header-top' }, [headerTitle(lang), links]);

  // The type toggles themselves are filled in by main.ts, which knows the
  // active type; this only lays out the row they sit in.
  const bar = el('div', { class: 'ranking-header' }, [el('div', { class: 'toggle-group' })]);
  if (statsEnabled()) {
    bar.appendChild(iconButton('open-stats-modal', ICON_STATS, 'openStats', lang, handlers.onOpenStats));
  }

  host.replaceChildren(top, bar);
}

// ---------------- Footer ----------------

function footerNotes(note: I18nString | I18nString[] | undefined, lang: Lang): string[] {
  if (!note) return [];
  const list = Array.isArray(note) ? note : [note];
  return list.map(entry => resolveI18n(entry, lang)).filter(Boolean);
}

/** Rebuild the footer. Hidden entirely when the config gives it nothing to say. */
export function renderFooter(lang: Lang): void {
  const host = document.getElementById('ranking-footer');
  if (!host) return;
  const footer = chrome().footer ?? {};
  const notes = footerNotes(footer.note, lang);
  const links = footer.links ?? [];

  host.replaceChildren();
  host.hidden = !notes.length && !links.length;
  if (host.hidden) return;

  if (notes.length) {
    const top = el('div', { class: 'footer-top' });
    for (const note of notes) {
      const line = el('span', { class: 'footer-note' });
      appendTextWithBreaks(line, note);
      top.appendChild(line);
    }
    host.appendChild(top);
  }
  if (notes.length && links.length) host.appendChild(el('hr', { class: 'footer-hr' }));
  if (links.length) {
    const bottom = el('div', { class: 'footer-bottom' });
    for (const link of links) bottom.appendChild(chromeLink(link, lang, 'footer-link'));
    host.appendChild(bottom);
  }
}

// ---------------- Content ----------------

/**
 * Build the containers the rest of core renders into, plus the two pieces of
 * furniture that never change: the stats modal and the scroll-to-top button.
 * Called once, before the first render.
 */
export function mountContent(lang: Lang, handlers: { onOpenStats: () => void }): void {
  const host = document.getElementById('ranking-content');
  if (!host) return;

  host.append(
    el('div', { id: 'filter-controls' }),
    el('div', { id: 'device-card-list' }),
  );
  if (statsEnabled()) mountStatsModal(host, lang, { onOpen: handlers.onOpenStats });
  host.appendChild(
    iconButton('scroll-to-top-btn', ICON_ARROW_UP, 'scrollTop', lang, () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }),
  );
}

export { openStatsModal };
