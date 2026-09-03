import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { setConfig } from '../src/config.ts';
import { filterAndSort, initialFilterState, sortRows } from '../src/query.ts';
import type { RankingConfig, Row } from '../src/types.ts';

const CONFIG: RankingConfig = {
  types: { earphone: { label: 'Earphones', source: { kind: 'csv', url: 'x' } } },
  columns: [
    {
      id: 'rank',
      source: 'Rank',
      role: 'rank',
      label: 'Rank',
      filter: { kind: 'select', values: ['S', 'A', 'B', 'C'] },
      render: { kind: 'rank-badge' },
    },
    { id: 'brand', source: 'Brand', role: 'brand', label: 'Brand', filter: { kind: 'text' } },
    { id: 'model', source: 'Model', role: 'model', label: 'Model', filter: { kind: 'text' } },
    { id: 'score', source: 'Score', role: 'score', label: 'Score', render: { kind: 'numeric' } },
    { id: 'pros', source: 'Pros', i18nSource: { en: 'Pros', ko: 'Pros_KR' }, label: 'Pros' },
  ],
  search: { enabled: true, fields: ['Brand', 'Model', 'Pros'] },
  sort: { default: 'rank-asc', options: ['rank-asc', 'rank-desc', 'score-desc'] },
};

const rows: Row[] = [
  { Rank: 'A', Brand: 'Beta', Model: 'Two', Score: '4', Pros: 'wide stage' },
  { Rank: 'S', Brand: 'Alpha', Model: 'One', Score: '5', Pros: 'tight bass' },
  { Rank: 'A', Brand: 'Alpha', Model: 'Three', Score: '4.5', Pros: '' },
  { Rank: '', Brand: 'Gamma', Model: 'Four', Score: '', Pros: 'unranked' },
];

const names = (list: Row[]): string[] => list.map(row => String(row['Model']));

beforeEach(() => setConfig(CONFIG));

test('rank sort follows the configured value order, not the alphabet', () => {
  assert.deepEqual(names(sortRows(rows, 'rank-asc', 'en')).slice(0, 1), ['One']);
});

test('unranked rows sink to the bottom in both directions', () => {
  assert.equal(names(sortRows(rows, 'rank-asc', 'en')).at(-1), 'Four');
  assert.equal(names(sortRows(rows, 'rank-desc', 'en')).at(-1), 'Four');
});

test('equal ranks break the tie on brand, then model', () => {
  assert.deepEqual(names(sortRows(rows, 'rank-asc', 'en')), ['One', 'Three', 'Two', 'Four']);
});

test('numeric columns sort by value, not by string', () => {
  const sorted = names(sortRows(rows, 'score-desc', 'en'));
  assert.deepEqual(sorted.slice(0, 3), ['One', 'Three', 'Two']);
});

test('the tie-breaker uses role columns, not hardcoded header names', () => {
  setConfig({
    ...CONFIG,
    columns: CONFIG.columns.map(column =>
      column.id === 'brand' ? { ...column, source: 'Maker' } : column),
  });
  const renamed: Row[] = [
    { Rank: 'A', Maker: 'Zeta', Model: 'Two' },
    { Rank: 'A', Maker: 'Alpha', Model: 'One' },
  ];
  assert.deepEqual(names(sortRows(renamed, 'rank-asc', 'en')), ['One', 'Two']);
});

test('select filters match exactly and ignore case and spacing', () => {
  const state = initialFilterState('earphone', 'rank-asc');
  state.columns['rank'] = ' a ';
  assert.deepEqual(names(filterAndSort(rows, 'earphone', state, 'en')), ['Three', 'Two']);
});

test('text filters match substrings', () => {
  const state = initialFilterState('earphone', 'rank-asc');
  state.columns['brand'] = 'alph';
  assert.deepEqual(names(filterAndSort(rows, 'earphone', state, 'en')), ['One', 'Three']);
});

test('search covers the configured fields', () => {
  const state = initialFilterState('earphone', 'rank-asc');
  state.search = 'stage';
  assert.deepEqual(names(filterAndSort(rows, 'earphone', state, 'en')), ['Two']);
});

test('filters combine as AND', () => {
  const state = initialFilterState('earphone', 'rank-asc');
  state.columns['rank'] = 'A';
  state.search = 'alpha';
  assert.deepEqual(names(filterAndSort(rows, 'earphone', state, 'en')), ['Three']);
});

test('a localized column falls back to the neutral source when blank', () => {
  setConfig(CONFIG);
  const localized: Row[] = [{ Rank: 'A', Brand: 'A', Model: 'One', Pros: 'fallback' }];
  const state = initialFilterState('earphone', 'rank-asc');
  state.search = 'fallback';
  assert.equal(filterAndSort(localized, 'earphone', state, 'ko').length, 1);
});
