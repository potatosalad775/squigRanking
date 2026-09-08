// The statistics modal: its markup, and the focus handling that keeps a keyboard
// user inside it while it is open.
//
// Built once at startup and left alone. The button that opens it lives in the
// header, which is rebuilt on every language change, so opening goes through
// `openStatsModal()` rather than through a listener the header owns.

import { el } from '../dom.ts';
import { t } from '../i18n.ts';
import type { Lang } from '../types.ts';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

let modal: HTMLElement | null = null;
let closeButton: HTMLElement | null = null;
let lastFocused: HTMLElement | null = null;
let onOpen: (() => void) | null = null;

/** Keep Tab inside the dialog, and let Escape dismiss it. */
function handleKeydown(event: KeyboardEvent): void {
  if (!modal?.classList.contains('open')) return;
  if (event.key === 'Escape') {
    closeStatsModal();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = modal.querySelectorAll<HTMLElement>(FOCUSABLE);
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
}

/**
 * Build the modal and append it to `parent`.
 *
 * `handlers.onOpen` runs on every open, so the chart is drawn against whatever
 * rows are on screen at that moment rather than the ones present at startup.
 */
export function mountStatsModal(
  parent: HTMLElement,
  lang: Lang,
  handlers: { onOpen: () => void },
): void {
  onOpen = handlers.onOpen;

  const backdrop = el('div', { class: 'stats-modal-backdrop' });
  backdrop.addEventListener('click', closeStatsModal);

  closeButton = el('button', {
    type: 'button',
    id: 'close-stats-modal',
    class: 'stats-modal-close',
    'data-i18n-label': 'closeStats',
    'aria-label': t('closeStats', lang),
    text: '×',
  });
  closeButton.addEventListener('click', closeStatsModal);

  const average = el('div', { class: 'stats-average' }, [
    el('b', { id: 'avg-score-label', 'data-i18n': 'averageScore', text: t('averageScore', lang) }),
    el('span', { id: 'avg-score', text: '-' }),
    el('span', { id: 'avg-score-denominator' }),
  ]);

  const content = el('div', { class: 'stats-modal-content', role: 'document' }, [
    closeButton,
    el('h2', { id: 'stats-modal-title', 'data-i18n': 'statsTitle', text: t('statsTitle', lang) }),
    el('div', { class: 'chart-container' }, [el('canvas', { id: 'rank-bar-chart' })]),
    average,
  ]);

  modal = el('div', {
    id: 'stats-modal',
    class: 'stats-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'stats-modal-title',
    tabindex: '-1',
  }, [backdrop, content]);
  modal.addEventListener('keydown', handleKeydown);

  parent.appendChild(modal);
}

export function openStatsModal(): void {
  if (!modal) return;
  lastFocused = document.activeElement as HTMLElement | null;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  onOpen?.();
  closeButton?.focus();
}

export function closeStatsModal(): void {
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
  // The header may have been rebuilt since the modal opened, so look the open
  // button up again rather than holding a reference to a detached node.
  const opener = lastFocused?.isConnected
    ? lastFocused
    : document.getElementById('open-stats-modal');
  opener?.focus();
}
