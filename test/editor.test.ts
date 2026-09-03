// The docs site's config editor generates `ranking-config.js` text. This asserts
// that what it generates is something core can actually read, and that a config
// survives a round trip through the editor's importer unchanged.
//
// The editor lives in a separate package, so nothing but a test connects the two.
// Without this, the editor could drift into emitting a shape core stopped
// understanding and nobody would find out until an operator pasted the result.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import {
  getRankValues, rankEntry, rowScore, setConfig, visibleColumns,
} from '../src/config.ts';
import { rampColor, readableTextColor } from '../src/color.ts';
import { csvToRows } from '../src/csv.ts';
import { CONFIG_VERSION } from '../src/types.ts';
import type { RankingConfig } from '../src/types.ts';
import {
  presetState, rampColor as editorRamp, readableTextColor as editorTextColor, validate,
} from '../docs/src/components/config-editor/form.ts';
import {
  generateConfig, generateTemplateHeaders,
} from '../docs/src/components/config-editor/generate.ts';
import { parseConfig } from '../docs/src/components/config-editor/parse.ts';

/** Run generated config text the way a browser would. */
function evaluate(source: string): RankingConfig {
  const holder: { RANKING_CONFIG?: RankingConfig } = {};
  new Function('window', source)(holder);
  assert.ok(holder.RANKING_CONFIG, 'the generated file assigned nothing');
  return holder.RANKING_CONFIG!;
}

const PRESETS = ['letter', 'stars', 'score'];

beforeEach(() => setConfig(undefined));

for (const preset of PRESETS) {
  test(`the editor's ${preset} output is a config core can read`, () => {
    const config = evaluate(generateConfig(presetState(preset)));
    setConfig(config);

    assert.equal(config.configVersion, CONFIG_VERSION);
    assert.ok(getRankValues().length >= 2, 'the generated scale has no steps');
    assert.ok(visibleColumns('earphone').some(c => c.role === 'brand'), 'no brand column');
    assert.ok(visibleColumns('earphone').some(c => c.role === 'model'), 'no model column');
    assert.equal(rankEntry(getRankValues()[0]!)?.value, getRankValues()[0]);
  });

  test(`the editor's ${preset} output matches the shipped preset's scale`, () => {
    const generated = evaluate(generateConfig(presetState(preset)));
    const shipped = evaluate(readFileSync(`presets/${preset}/ranking-config.js`, 'utf8'));

    const scaleOf = (config: RankingConfig) =>
      config.columns.find(c => c.role === 'rank')!.scale!.map(s => [s.value, s.score, s.color]);
    assert.deepEqual(scaleOf(generated), scaleOf(shipped));

    const renderOf = (config: RankingConfig) => config.columns.find(c => c.role === 'rank')!.render;
    assert.deepEqual(renderOf(generated), renderOf(shipped));
  });

  test(`the editor's ${preset} headers cover its own template`, () => {
    const form = presetState(preset);
    const headers = generateTemplateHeaders(form);
    const shipped = Object.keys(csvToRows(readFileSync(`presets/${preset}/TEMPLATE.csv`, 'utf8'))[0]!);
    for (const header of shipped) {
      assert.ok(headers.includes(header), `${header} is missing from the generated header row`);
    }
  });

  test(`a ${preset} config survives a round trip through the importer`, () => {
    const first = generateConfig(presetState(preset));
    const result = parseConfig(first);
    assert.equal(result.error, undefined);
    assert.deepEqual(result.warnings, []);
    assert.equal(generateConfig(result.form!), first);
  });
}

test('the generated scale carries the scores rows are averaged with', () => {
  setConfig(evaluate(generateConfig(presetState('stars'))));
  // The stars preset has no Score column, so this can only come from the scale.
  assert.equal(rowScore({ Rank: '4.5' }, 'en'), 4.5);
});

test('importing a pre-scale config reports what it had to change', () => {
  const legacy = `window.RANKING_CONFIG = {
    configVersion: 1,
    types: { earphone: { label: 'Earphones', source: { kind: 'csv', url: 'https://x/pub?output=csv' } } },
    columns: [
      {
        id: 'rank', source: 'Rank', role: 'rank', label: 'Rank',
        filter: { kind: 'select', values: ['S', 'A', 'B'] },
        render: { kind: 'rank-badge', classMap: { S: 'rank-S' } },
      },
      { id: 'brand', source: 'Brand', role: 'brand', label: 'Brand' },
      { id: 'model', source: 'Model', role: 'model', label: 'Model' },
    ],
  };`;
  const result = parseConfig(legacy);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.form!.scale.map(s => s.value), ['S', 'A', 'B']);
  assert.equal(result.warnings.length, 2, 'expected notes about the scale and the classMap');
  assert.ok(result.warnings.some(w => w.includes('classMap')));
});

test('the importer refuses a file that is not a ranking config', () => {
  assert.match(parseConfig('const x = 1;').error!, /No window.RANKING_CONFIG/);
  assert.match(parseConfig('window.RANKING_CONFIG = { types: {} };').error!, /columns/);
  assert.match(parseConfig('this is not javascript').error!, /did not run/);
});

test('the importer reports a custom column rather than dropping it quietly', () => {
  const withExtra = generateConfig(presetState('letter')).replace(
    '\tcolumns: [',
    "\tcolumns: [\n\t\t{ id: 'price', source: 'Price', label: 'Price', render: { kind: 'meta-chip' } },",
  );
  const result = parseConfig(withExtra);
  assert.ok(result.warnings.some(w => w.includes('price')), 'the custom column went unmentioned');
});

test('validation catches the mistakes the form makes easy', () => {
  const form = presetState('letter');
  assert.deepEqual(validate(form), []);

  form.scale[1]!.value = 'S';
  assert.ok(validate(form).some(p => p.includes('more than once')));

  const reordered = presetState('letter');
  reordered.scale.reverse();
  assert.ok(validate(reordered).some(p => p.includes('decrease')));

  const noUrl = presetState('letter');
  noUrl.types[0]!.url = 'https://example.com/sheet';
  assert.ok(validate(noUrl).some(p => p.includes('published CSV')));
});

test('the editor and the runtime agree on color math', () => {
  // The editor duplicates src/color.ts so the docs site can build alone. The
  // badge preview would lie if the two ever diverged.
  for (const t of [0, 0.13, 0.5, 0.87, 1]) {
    const stops = ['#b71c1c', '#ffc107', '#4caf50', '#6c63ff'];
    assert.equal(editorRamp(stops, t), rampColor(stops, t), `ramp differs at ${t}`);
  }
  for (const color of ['#ffffff', '#b71c1c', '#8bc34a', '#6c63ff']) {
    assert.equal(editorTextColor(color), readableTextColor(color), `text color differs on ${color}`);
  }
});
