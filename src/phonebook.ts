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
  /** modernGraphTool's sample sets. Read only for the filename they carry. */
  variants?: Array<{ file?: string; samples?: { files?: string[] } }>;
  /** The deprecated predecessor of `variants`. Same reason, same depth. */
  hptfs?: Array<{ files?: string[] }>;
}

/**
 * A phone book may list a device as a bare name. Both graph tools read that as
 * "the display name and the measurement filename are the same string".
 */
export type PhonebookEntry = string | PhonebookPhone;

export interface PhonebookBrand {
  name?: string;
  phones?: PhonebookEntry[];
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

/**
 * A phonebook, pre-keyed for matching.
 *
 * Matching is a cascade of four passes over every candidate name, and the page
 * resolves one link per row on every render. Normalizing those names on each
 * call made the cost of a keystroke the product of the row count and the
 * phonebook size. The names are derived from data that does not change once
 * fetched, so they are derived once and kept beside it.
 *
 * The index hangs off the phonebook in a WeakMap: it disappears with the
 * phonebook, and a caller that mutates a phonebook in place gets a stale index.
 * Nothing here does; `loadPhonebook` hands out a fresh parse.
 */
interface Indexed<T> {
  item: T;
  /** Lowercased, whitespace-collapsed. The first two passes compare on this. */
  normalized: string;
  /** Alphanumerics only. The last two passes compare on this. */
  simplified: string;
}

interface PhoneIndex extends Indexed<PhonebookPhone> {
  prefix: string;
  suffix: string;
}

interface BrandIndex extends Indexed<PhonebookBrand> {
  /** Built the first time this brand is matched, not for the whole book up front. */
  phones?: PhoneIndex[];
}

interface PhonebookIndex {
  brands: BrandIndex[];
  /** `${brandKey}\u0000${modelKey}` -> measurement filename, or null for a miss. */
  files: Map<string, string | null>;
}

const indexes = new WeakMap<Phonebook, PhonebookIndex>();

function indexOf(phonebook: Phonebook): PhonebookIndex {
  let index = indexes.get(phonebook);
  if (index) return index;
  index = {
    brands: phonebook.map(brand => ({
      item: brand,
      normalized: normalize(brand.name),
      simplified: simplify(brand.name),
    })),
    files: new Map(),
  };
  indexes.set(phonebook, index);
  return index;
}

/** The terse form expanded, so only one shape reaches the matcher. */
function asPhone(entry: PhonebookEntry): PhonebookPhone {
  return typeof entry === 'string' ? { name: entry, file: entry } : entry;
}

function phonesOf(brand: BrandIndex): PhoneIndex[] {
  if (brand.phones) return brand.phones;
  brand.phones = (brand.item.phones ?? []).map(entry => {
    const phone = asPhone(entry);
    return {
      item: phone,
      normalized: normalize(phone.name),
      simplified: simplify(phone.name),
      prefix: normalize(phone.prefix),
      suffix: normalize(phone.suffix),
    };
  });
  return brand.phones;
}

/** Ordered match strategies, strictest first. Returns the index entry, not the item. */
function findBy<E extends Indexed<unknown>>(entries: E[], needle: string): E | undefined {
  if (!needle) return undefined;
  for (const entry of entries) if (entry.normalized === needle) return entry;

  for (const entry of entries) {
    const name = entry.normalized;
    if (name !== '' && (name.includes(needle) || needle.includes(name))) return entry;
  }

  const simpleNeedle = simplify(needle);
  if (!simpleNeedle) return undefined;
  for (const entry of entries) if (entry.simplified === simpleNeedle) return entry;

  for (const entry of entries) {
    const name = entry.simplified;
    if (name !== '' && (name.includes(simpleNeedle) || simpleNeedle.includes(name))) return entry;
  }
  return undefined;
}

function findPhone(phones: PhoneIndex[], model: string): PhonebookPhone | undefined {
  const direct = findBy(phones, model);
  if (direct) return direct.item;
  // Some phonebooks split the display name across prefix and suffix fields.
  return phones.find(
    phone => (phone.prefix !== '' && phone.prefix.includes(model))
      || (phone.suffix !== '' && phone.suffix.includes(model)),
  )?.item;
}

/**
 * The first measurement filename for a phonebook entry.
 *
 * `file` wins whenever it is there, because that is the variant both graph tools
 * draw first. A modernGraphTool phone can declare its measurements only in
 * `variants[]` or the deprecated `hptfs[]`, and those are read next so such a
 * device still gets a measurement link instead of silently losing one.
 */
export function phoneFile(phone: PhonebookPhone): string | null {
  const candidates = [
    Array.isArray(phone.file) ? phone.file[0] : phone.file,
    phone.hptfs?.[0]?.files?.[0],
    phone.variants?.[0]?.file ?? phone.variants?.[0]?.samples?.files?.[0],
  ];
  for (const candidate of candidates) {
    const trimmed = String(candidate ?? '').trim();
    if (trimmed) return trimmed;
  }
  return null;
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

  // Cached on the filename rather than the finished URL, so two types pointing
  // at the same phonebook with different templates still share the matching.
  const index = indexOf(phonebook);
  const cacheKey = `${brandKey}\u0000${modelKey}`;
  let file = index.files.get(cacheKey);
  if (file === undefined) {
    file = matchFile(index, brandKey, modelKey);
    index.files.set(cacheKey, file);
  }
  if (!file) return null;

  return template.replace('{file}', encodeURIComponent(file.replace(/\s+/g, '_')));
}

function matchFile(index: PhonebookIndex, brandKey: string, modelKey: string): string | null {
  const brand = findBy(index.brands, brandKey);
  if (!brand) return null;
  const matchedPhone = findPhone(phonesOf(brand), modelKey);
  return matchedPhone ? phoneFile(matchedPhone) : null;
}
