// Loading placeholders. Shown between first paint and the first CSV response
// so the page has structure instead of a blank column.

import { el } from '../dom.ts';

function line(width: string, height = '0.85rem'): HTMLElement {
  const node = el('span', { class: 'skeleton-line skeleton-pulse' });
  node.style.width = width;
  node.style.height = height;
  return node;
}

export function renderSkeletons(container: HTMLElement, count = 10): void {
  container.replaceChildren();
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const card = el('div', { class: 'device-card skeleton-card' });
    card.appendChild(el('div', { class: 'device-card-rank skeleton-block skeleton-pulse' }));

    const header = el('div', { class: 'device-card-header-div' });
    header.appendChild(line('70%', '1.1em'));
    const meta = el('div', { class: 'device-card-meta' });
    for (const width of ['4.5rem', '3.25rem']) {
      const chip = el('span', { class: 'skeleton-chip skeleton-pulse' });
      chip.style.width = width;
      meta.appendChild(chip);
    }
    header.appendChild(meta);
    card.appendChild(header);

    const body = el('div', { class: 'device-card-body' });
    for (const width of ['95%', '88%', '70%']) body.appendChild(line(width));
    card.appendChild(body);

    fragment.appendChild(card);
  }
  container.appendChild(fragment);
}
