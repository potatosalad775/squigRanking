// Resolving a ranking row to a CrinGraph measurement link.
//
// Spreadsheet names and phonebook names rarely match exactly, so matching runs
// as a cascade of progressively looser strategies. The matcher is pure and
// returns the resolved URL; the DOM update happens in main.

import { normalize, simplify } from './config.ts';

export interface PhonebookPhone {
  name?: string;
  file?: string | string[];
  prefix?: string;
  suffix?: string;
}

export interface PhonebookBrand {
  name?: string;
  phones?: PhonebookPhone[];
}

export type Phonebook = PhonebookBrand[];

/** Fetch a phone_book.json. Returns null when it is missing or malformed. */
export async function loadPhonebook(url: string): Promise<Phonebook | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as Phonebook) : null;
  } catch {
    return null;
  }
}

/** Ordered match strategies, strictest first. */
function findBy<T>(items: T[], needle: string, nameOf: (item: T) => string): T | undefined {
  if (!needle) return undefined;
  const normalized = items.map(item => ({ item, name: normalize(nameOf(item)) }));
  const exact = normalized.find(entry => entry.name === needle);
  if (exact) return exact.item;

  const contains = normalized.find(
    entry => entry.name !== '' && (entry.name.includes(needle) || needle.includes(entry.name)),
  );
  if (contains) return contains.item;

  const simpleNeedle = simplify(needle);
  if (!simpleNeedle) return undefined;
  const simplified = items.map(item => ({ item, name: simplify(nameOf(item)) }));
  const simpleExact = simplified.find(entry => entry.name === simpleNeedle);
  if (simpleExact) return simpleExact.item;

  return simplified.find(
    entry => entry.name !== '' && (entry.name.includes(simpleNeedle) || simpleNeedle.includes(entry.name)),
  )?.item;
}

function findPhone(phones: PhonebookPhone[], model: string): PhonebookPhone | undefined {
  const direct = findBy(phones, model, phone => phone.name ?? '');
  if (direct) return direct;
  // Some phonebooks split the display name across prefix and suffix fields.
  return phones.find(phone => {
    const prefix = normalize(phone.prefix);
    const suffix = normalize(phone.suffix);
    return (prefix !== '' && prefix.includes(model)) || (suffix !== '' && suffix.includes(model));
  });
}

/** The first measurement filename for a phonebook entry. */
export function phoneFile(phone: PhonebookPhone): string | null {
  const raw = Array.isArray(phone.file) ? phone.file[0] : phone.file;
  const trimmed = String(raw ?? '').trim();
  return trimmed || null;
}

/**
 * Resolve a brand and model to a measurement URL, or null when the phonebook
 * has no usable entry. `template` may contain a `{file}` placeholder.
 */
export function resolveMeasurementUrl(
  phonebook: Phonebook | null, brand: string, model: string, template: string,
): string | null {
  if (!phonebook || !template) return null;
  const brandKey = normalize(brand);
  const modelKey = normalize(model);
  if (!brandKey || !modelKey) return null;

  const matchedBrand = findBy(phonebook, brandKey, entry => entry.name ?? '');
  if (!matchedBrand) return null;

  const matchedPhone = findPhone(matchedBrand.phones ?? [], modelKey);
  if (!matchedPhone) return null;

  const file = phoneFile(matchedPhone);
  if (!file) return null;

  return template.replace('{file}', encodeURIComponent(file.replace(/\s+/g, '_')));
}
