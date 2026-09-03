import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  getRankScale, getRankValues, rankColors, rankEntry, rowScore, setConfig,
} from '../src/config.ts';
import { parseHex, rampColor, readableTextColor } from '../src/color.ts';
import { averageScore, rankCounts } from '../src/stats.ts';
import { sortRows } from '../src/query.ts';
import type { RankingConfig, Row } from '../src/types.ts';

/** A scale-driven config: no filter values, no chartColors, no Score column. */
const SCALED: RankingConfig = {
  types: { earphone: { label: 'Earphones', source: { kind: 'csv', url: 'x' } } },
  columns: [
    {
      id: 'rank',
      source: 'Rank',
      role: 'rank',
      label: 'Rank',
      scale: [
        { value: 'S', score: 5, color: '#6c63ff' },
        { value: 'A', score: 4, color: '#00bfff' },
        { value: 'B', score: 3, color: '#8bc34a' },
      ],
      filter: { kind: 'select' },
      render: { kind: 'rank-badge' },
    },
    { id: 'brand', source: 'Brand', role: 'brand', label: 'Brand' },
    { id: 'model', source: 'Model', role: 'model', label: 'Model' },
    { id: 'score', source: 'Score', role: 'score', label: 'Score', render: { kind: 'numeric' } },
  ],
};

/** The pre-scale shape, kept working by the synthesized scale. */
const LEGACY: RankingConfig = {
  types: { earphone: { label: 'Earphones', source: { kind: 'csv', url: 'x' } } },
  columns: [
    {
      id: 'rank',
      source: 'Rank',
      role: 'rank',
      label: 'Rank',
      filter: { kind: 'select', values: ['S', 'A', 'B'] },
      render: { kind: 'rank-badge', classMap: { S: 'rank-S', default: 'rank-F' } },
    },
  ],
};

beforeEach(() => setConfig(SCALED));

test('a declared scale supplies the rank order', () => {
  assert.deepEqual(getRankValues(), ['S', 'A', 'B']);
});

test('a config without a scale synthesizes one from the filter values', () => {
  setConfig(LEGACY);
  assert.deepEqual(getRankValues(), ['S', 'A', 'B']);
  assert.deepEqual(getRankScale().map(e => e.value), ['S', 'A', 'B']);
  assert.equal(rankColors().length, 0);
});

test('rank lookup ignores case and spacing', () => {
  assert.equal(rankEntry(' a ')?.score, 4);
  assert.equal(rankEntry('nope'), undefined);
  assert.equal(rankEntry(''), undefined);
});

test('chart colors come from the scale', () => {
  assert.deepEqual(rankColors(), ['#6c63ff', '#00bfff', '#8bc34a']);
});

test('a blank Score cell falls back to the score its rank carries', () => {
  assert.equal(rowScore({ Rank: 'A', Score: '' }, 'en'), 4);
  assert.equal(rowScore({ Rank: 'A', Score: '4.7' }, 'en'), 4.7);
  assert.equal(rowScore({ Rank: '', Score: '' }, 'en'), null);
});

test('score sort works on a sheet that only has a Rank column', () => {
  const rows: Row[] = [
    { Rank: 'B', Brand: 'C', Model: 'Three' },
    { Rank: 'S', Brand: 'A', Model: 'One' },
    { Rank: 'A', Brand: 'B', Model: 'Two' },
  ];
  const sorted = sortRows(rows, 'score-desc', 'en').map(r => r['Model']);
  assert.deepEqual(sorted, ['One', 'Two', 'Three']);
});

test('the average readout uses scale scores when Score is empty', () => {
  const rows: Row[] = [{ Rank: 'S' }, { Rank: 'B' }];
  assert.equal(averageScore(rows, 'Score', 'en'), 4);
});

test('rank counts tally against the scale', () => {
  const rows: Row[] = [{ Rank: 'S' }, { Rank: 'a' }, { Rank: 'A' }, { Rank: 'Z' }];
  assert.deepEqual(rankCounts(rows, 'en'), { labels: ['S', 'A', 'B'], counts: [1, 2, 0] });
});

test('a numeric scale needs no per-value colors', () => {
  setConfig({
    ...SCALED,
    columns: [{
      id: 'rank', source: 'Rank', role: 'rank', label: 'Rank',
      scale: [{ value: '10', score: 10 }, { value: '5', score: 5 }, { value: '0', score: 0 }],
      render: { kind: 'score-badge', min: 0, max: 10 },
    }],
  });
  assert.deepEqual(getRankValues(), ['10', '5', '0']);
  assert.equal(rowScore({ Rank: '5' }, 'en'), 5);
});

test('an off-step value snaps to the nearest step on a numeric scale', () => {
  setConfig({
    ...SCALED,
    columns: [
      {
        id: 'rank', source: 'Rank', role: 'rank', label: 'Rank',
        scale: [{ value: '10' }, { value: '9' }, { value: '8' }, { value: '7' }],
        render: { kind: 'score-badge', min: 0, max: 10 },
      },
      { id: 'brand', source: 'Brand', role: 'brand', label: 'Brand' },
      { id: 'model', source: 'Model', role: 'model', label: 'Model' },
    ],
  });
  const rows: Row[] = [{ Rank: '8.6', Model: 'One' }, { Rank: '9', Model: 'Two' }];
  assert.deepEqual(rankCounts(rows, 'en').counts, [0, 2, 0, 0]);
  // The average reads the cell, not the step it snapped to.
  assert.equal(averageScore(rows, 'Score', 'en'), 8.8);
});

test('snapping never applies to a letter scale', () => {
  assert.equal(rankEntry('A-'), undefined);
});

test('hex parsing accepts both shorthand and full form', () => {
  assert.deepEqual(parseHex('#fff'), [255, 255, 255]);
  assert.deepEqual(parseHex('6c63ff'), [108, 99, 255]);
  assert.equal(parseHex('rebeccapurple'), null);
});

test('the color ramp interpolates between stops and clamps outside them', () => {
  assert.equal(rampColor(['#000000', '#ffffff'], 0.5), '#808080');
  assert.equal(rampColor(['#000000', '#ffffff'], -1), '#000000');
  assert.equal(rampColor(['#000000', '#ffffff'], 2), '#ffffff');
  assert.equal(rampColor(['#123456'], 0.4), '#123456');
  assert.equal(rampColor([], 0.4), '');
});

test('badge text color flips on a light background', () => {
  assert.equal(readableTextColor('#ffffff'), '#111');
  assert.equal(readableTextColor('#b71c1c'), '#fff');
});
