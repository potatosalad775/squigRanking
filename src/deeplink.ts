// Card anchors. The slug format is a public contract: CrinGraph's listAugment.js
// and modernGraphTool's PhoneSelector build the same string to link into a card.

import { getConfig } from './config.ts';
import type { Row } from './types.ts';

/** The DOM id and URL hash for a row. */
export function buildCardId(row: Row): string {
  const deepLink = getConfig().deepLink ?? {};
  const template = deepLink.template ?? '{Brand}-{Model}';
  const mode = deepLink.slugify ?? 'lowercase-hyphen';
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = row[key] ?? '';
    return mode === 'lowercase-hyphen' ? value.toLowerCase().replace(/\s+/g, '-') : value;
  });
}
