import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { columnValue, resolveI18n, searchFields, setConfig, visibleColumns } from '../src/config.ts';
import { buildCardId } from '../src/deeplink.ts';
import { STRINGS, languages, nextLanguage, t } from '../src/i18n.ts';
import type { RankingConfig } from '../src/types.ts';

const CONFIG: RankingConfig = {
  types: {
    earphone: { label: { default: 'Earphones', i18n: { ko: '이어폰' } }, source: { kind: 'csv', url: 'x' } },
    headphone: { label: 'Headphones', source: { kind: 'csv', url: 'y' } },
  },
  columns: [
    { id: 'brand', source: 'Brand', role: 'brand', label: 'Brand' },
    { id: 'model', source: 'Model', role: 'model', label: 'Model' },
    { id: 'ff', source: 'F/F', label: 'Formfactor', showForTypes: ['headphone'] },
    { id: 'pros', source: 'Pros', i18nSource: { en: 'Pros', ko: 'Pros_KR' }, label: 'Pros' },
  ],
  deepLink: { template: '{Brand}-{Model}', slugify: 'lowercase-hyphen' },
};

beforeEach(() => setConfig(CONFIG));

test('resolveI18n prefers the requested language then the default', () => {
  const label = { default: 'Rank', i18n: { ko: '등급' } };
  assert.equal(resolveI18n(label, 'ko'), '등급');
  assert.equal(resolveI18n(label, 'ja'), 'Rank');
  assert.equal(resolveI18n('Plain', 'ko'), 'Plain');
  assert.equal(resolveI18n(undefined, 'en'), '');
});

test('showForTypes hides a column on other types', () => {
  assert.equal(visibleColumns('earphone').some(c => c.id === 'ff'), false);
  assert.equal(visibleColumns('headphone').some(c => c.id === 'ff'), true);
});

test('a localized column reads its per-language header', () => {
  const column = CONFIG.columns[3]!;
  const row = { Pros: 'english', Pros_KR: '한국어' };
  assert.equal(columnValue(row, column, 'ko'), '한국어');
  assert.equal(columnValue(row, column, 'en'), 'english');
});

test('a blank localized cell falls back to the neutral source', () => {
  const column = CONFIG.columns[3]!;
  assert.equal(columnValue({ Pros: 'english', Pros_KR: '' }, column, 'ko'), 'english');
});

test('search defaults to every declared source header', () => {
  const fields = searchFields('en');
  assert.deepEqual(fields.sort(), ['Brand', 'F/F', 'Model', 'Pros', 'Pros_KR'].sort());
});

test('card ids slugify the deep-link template', () => {
  assert.equal(buildCardId({ Brand: 'Apple', Model: 'AirPods Max USB-C' }), 'apple-airpods-max-usb-c');
});

test('card ids tolerate missing fields', () => {
  assert.equal(buildCardId({ Brand: 'Apple' }), 'apple-');
});

test('chrome strings fall back to English for an unknown language', () => {
  assert.equal(t('resetFilters', 'ja'), STRINGS['en']!['resetFilters']);
});

test('config overrides win over built-in strings', () => {
  setConfig({ ...CONFIG, i18n: { en: { resetFilters: 'Clear' } } });
  assert.equal(t('resetFilters', 'en'), 'Clear');
});

test('the language toggle cycles through available languages', () => {
  assert.equal(nextLanguage('en'), 'ko');
  assert.equal(nextLanguage('ko'), 'en');
});

test('a configured language list drives the cycle', () => {
  setConfig({ ...CONFIG, languages: ['en', 'ko', 'ja'] });
  assert.deepEqual(languages(), ['en', 'ko', 'ja']);
  assert.equal(nextLanguage('ja'), 'en');
});
