// Card assembly. Each column declares a renderer; the renderer's output lands
// in a slot. Adding a render kind means adding a case here and a default slot
// in `slotFor`.

import { columnValue, getRoleColumn, interpolate, normalize, rankEntry, resolveI18n } from '../config.ts';
import { rampColor, readableTextColor } from '../color.ts';
import { el, svgIcon } from '../dom.ts';
import { ICON_EXTERNAL_LINK, ICON_STAR } from '../icons.ts';
import { buildCardId } from '../deeplink.ts';
import { t } from '../i18n.ts';
import { renderBlock, renderTags } from './blocks.ts';
import type { ColumnConfig, Lang, Row, Slot } from '../types.ts';

/** Worst-to-best ramp used by `score-badge` when the config names no colors. */
const DEFAULT_SCORE_RAMP = ['#b71c1c', '#ffc107', '#4caf50', '#6c63ff'];

/** Where a column lands when it declares no explicit `placement`. */
export function slotFor(column: ColumnConfig): Slot | null {
  if (column.placement) return column.placement;
  switch (column.render?.kind) {
    case 'rank-badge':
    case 'stars':
    case 'score-badge': return 'rank';
    case 'title': return 'title';
    case 'block':
    case 'tags': return 'body';
    case 'link':
    case 'measurement-link': return 'actions';
    case 'meta-chip':
    case 'text':
    case 'numeric': return 'meta';
    default: return null;
  }
}

function renderColumn(row: Row, column: ColumnConfig, lang: Lang): HTMLElement | null {
  const render = column.render;
  if (!render) return null;
  const value = columnValue(row, column, lang);

  switch (render.kind) {
    case 'rank-badge': {
      const key = value.replace(/\s+/g, '');
      const entry = rankEntry(key);
      // classMap is the pre-scale mechanism and keeps precedence, so configs
      // written against the old CSS classes render byte-identically.
      const mapped = render.classMap?.[key];
      const cls = mapped ?? entry?.class ?? render.classMap?.['default'] ?? '';
      const text = entry?.label ? resolveI18n(entry.label, lang) : key;
      const badge = el('div', { class: `device-card-rank ${cls}`.trim(), text });
      if (!mapped && entry?.color) {
        badge.style.background = entry.color;
        badge.style.color = entry.textColor ?? readableTextColor(entry.color);
      }
      return badge;
    }
    case 'stars': {
      const max = Math.max(1, Math.round(render.max ?? 5));
      const filled = Number.parseFloat(value);
      if (Number.isNaN(filled)) return null;
      const ratio = Math.min(1, Math.max(0, filled / max));
      const wrap = el('div', {
        class: 'device-card-rank device-card-stars',
        role: 'img',
        'aria-label': `${value} / ${max}`,
      });
      // Two identical star rows, the filled one clipped to a percentage. Any
      // fraction works, so a scale of halves needs no half-star artwork.
      const track = el('span', { class: 'stars-track', 'aria-hidden': 'true' });
      const fill = el('span', { class: 'stars-fill', 'aria-hidden': 'true' });
      fill.style.width = `${ratio * 100}%`;
      for (let i = 0; i < max; i++) {
        track.appendChild(svgIcon([ICON_STAR], 16));
        fill.appendChild(svgIcon([ICON_STAR], 16));
      }
      wrap.appendChild(track);
      wrap.appendChild(fill);
      return wrap;
    }
    case 'score-badge': {
      const parsed = Number.parseFloat(value);
      if (Number.isNaN(parsed)) return null;
      const min = render.min ?? 0;
      const max = render.max ?? 5;
      const decimals = render.decimals;
      const text = decimals === undefined ? String(parsed) : parsed.toFixed(decimals);
      const badge = el('div', { class: 'device-card-rank device-card-score-badge', text });
      const colors = render.colors ?? DEFAULT_SCORE_RAMP;
      const span = max - min;
      const color = rampColor(colors, span === 0 ? 1 : (parsed - min) / span);
      if (color) {
        badge.style.background = color;
        badge.style.color = readableTextColor(color);
      }
      return badge;
    }
    case 'title': {
      const text = render.template ? interpolate(render.template, row) : value;
      return el('span', { class: 'device-card-header', text });
    }
    case 'meta-chip':
      if (!value) return null;
      return el('span', { class: `device-card-chip device-card-${column.id}`, text: value });
    case 'text':
    case 'numeric':
      if (!value) return null;
      return el('span', { class: `device-card-${column.id}`, text: value });
    case 'block':
      return renderBlock(value, render.style ?? 'plain', column.blockLabel, lang);
    case 'tags':
      return renderTags(value, render.separator ?? ',');
    case 'link': {
      const href = render.hrefTemplate ? interpolate(render.hrefTemplate, row) : (render.href ?? '');
      if (!href) return null;
      const anchor = el('a', {
        class: `device-card-link device-card-${column.id}`,
        href,
        text: resolveI18n(render.text ?? column.label, lang),
      });
      if (render.newTab !== false) {
        anchor.target = '_blank';
        anchor.rel = 'noopener';
      }
      return anchor;
    }
    case 'measurement-link': {
      // The href is filled in later by the phonebook resolver. The link stays
      // hidden until then, so an unmatched device never shows a dead link.
      const label = resolveI18n(column.label, lang);
      const anchor = el('a', {
        class: 'device-card-measurement',
        title: label,
        hidden: true,
        target: '_blank',
        rel: 'noopener',
      });
      anchor.appendChild(svgIcon([ICON_EXTERNAL_LINK], 16));
      anchor.appendChild(el('span', { class: 'device-card-measurement-label', text: label }));
      return anchor;
    }
    default:
      return null;
  }
}

/** Build one card. */
export function renderCard(row: Row, columns: ColumnConfig[], lang: Lang): HTMLElement {
  const card = el('div', { class: 'device-card', id: buildCardId(row) });
  const brandColumn = getRoleColumn('brand');
  const modelColumn = getRoleColumn('model');
  if (brandColumn) card.dataset['brand'] = normalize(columnValue(row, brandColumn, lang));
  if (modelColumn) card.dataset['model'] = normalize(columnValue(row, modelColumn, lang));

  const header = el('div', { class: 'device-card-header-div' });
  const meta = el('div', { class: 'device-card-meta' });
  const actions: HTMLElement[] = [];
  const body: HTMLElement[] = [];
  let metaChips = 0;

  for (const column of columns) {
    const node = renderColumn(row, column, lang);
    if (!node) continue;
    switch (slotFor(column)) {
      case 'rank':
        card.appendChild(node);
        break;
      case 'title':
        header.appendChild(node);
        break;
      case 'meta':
        if (column.render?.kind === 'meta-chip' && metaChips > 0) {
          meta.appendChild(el('span', { class: 'device-card-chip-sep', 'aria-hidden': 'true', text: '|' }));
        }
        meta.appendChild(node);
        if (column.render?.kind === 'meta-chip') metaChips++;
        break;
      case 'actions':
        actions.push(node);
        break;
      case 'body':
        body.push(node);
        break;
      default:
        break;
    }
  }

  if (meta.childNodes.length) header.appendChild(meta);
  if (actions.length) {
    const actionRow = el('div', { class: 'device-card-actions' });
    for (const node of actions) actionRow.appendChild(node);
    header.appendChild(actionRow);
  }
  card.appendChild(header);

  if (body.length) {
    const bodyWrap = el('div', { class: 'device-card-body' });
    for (const node of body) bodyWrap.appendChild(node);
    card.appendChild(bodyWrap);
  }
  return card;
}

/** Replace the card list with the given rows, or a message when empty. */
export function renderCards(
  container: HTMLElement, rows: Row[], columns: ColumnConfig[], lang: Lang,
): void {
  container.replaceChildren();
  if (!rows.length) {
    container.appendChild(el('p', { class: 'list-empty', text: t('noResults', lang) }));
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const row of rows) fragment.appendChild(renderCard(row, columns, lang));
  container.appendChild(fragment);
}
