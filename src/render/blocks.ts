// Body-column renderers: prose blocks and tag pills. These replace the v1
// backslash markup that packed every section into a single Comment cell.

import { resolveI18n } from '../config.ts';
import { appendTextWithBreaks, el, svgIcon } from '../dom.ts';
import { ICON_ASTERISK, ICON_MINUS, ICON_PLUS, ICON_QUESTION } from '../icons.ts';
import type { BlockStyle, I18nString, Lang } from '../types.ts';

const BLOCK_ICONS: Partial<Record<BlockStyle, string>> = {
  up: ICON_PLUS,
  down: ICON_MINUS,
  note: ICON_QUESTION,
  muted: ICON_ASTERISK,
};

/**
 * A prose block in the card body. Line breaks in the cell are preserved.
 * `plain` renders bare text; the other styles get an icon and color treatment.
 */
export function renderBlock(
  text: string, style: BlockStyle, label: I18nString | undefined, lang: Lang,
): HTMLElement | null {
  if (!text.trim()) return null;
  const block = el('div', { class: `card-block card-block-${style}` });

  const iconPath = BLOCK_ICONS[style];
  if (iconPath) {
    const icon = el('span', { class: 'card-block-icon' });
    icon.appendChild(svgIcon([iconPath]));
    block.appendChild(icon);
  }

  const body = el('span', { class: 'card-block-text' });
  const labelText = resolveI18n(label, lang);
  if (labelText) {
    body.appendChild(el('b', { class: 'card-block-label', text: `${labelText}: ` }));
  }
  appendTextWithBreaks(body, text.trim());
  block.appendChild(body);
  return block;
}

/** Split a cell on a separator and render each piece as a pill. */
export function renderTags(text: string, separator = ','): HTMLElement | null {
  const tags = text.split(separator).map(tag => tag.trim()).filter(Boolean);
  if (!tags.length) return null;
  const wrapper = el('div', { class: 'card-tags' });
  for (const tag of tags) wrapper.appendChild(el('span', { class: 'card-tag', text: tag }));
  return wrapper;
}
