// Guards the presets against drift. Each preset ships a config and a matching
// TEMPLATE.csv; this asserts they still agree with each other and with core.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { csvToRows } from '../src/csv.ts';
import { getRankValues, rankIndexOf, rowScore, setConfig } from '../src/config.ts';
import { parseHex } from '../src/color.ts';
import type { RankingConfig } from '../src/types.ts';

const PRESETS = readdirSync('presets', { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);

/** Evaluate a preset's `window.RANKING_CONFIG` assignment in isolation. */
function loadPreset(name: string): RankingConfig {
  const source = readFileSync(`presets/${name}/ranking-config.js`, 'utf8');
  const scope: { RANKING_CONFIG?: RankingConfig } = {};
  new Function('window', source)(scope);
  assert.ok(scope.RANKING_CONFIG, `${name} did not assign window.RANKING_CONFIG`);
  return scope.RANKING_CONFIG!;
}

test('every preset directory ships a config and a template', () => {
  assert.ok(PRESETS.length >= 3, 'expected at least the three shipped presets');
  for (const name of PRESETS) {
    assert.doesNotThrow(() => readFileSync(`presets/${name}/TEMPLATE.csv`, 'utf8'), name);
  }
});

for (const name of PRESETS) {
  test(`preset ${name}: the rank column declares a usable scale`, () => {
    const config = loadPreset(name);
    setConfig(config);
    const rank = config.columns.find(c => c.role === 'rank');
    assert.ok(rank, 'no column carries the rank role');
    assert.ok(rank!.scale?.length, 'the rank column declares no scale');

    const values = getRankValues();
    assert.equal(new Set(values).size, values.length, 'duplicate scale values');

    for (const entry of rank!.scale!) {
      if (entry.color !== undefined) {
        assert.ok(parseHex(entry.color), `${entry.value} has an unparseable color`);
      }
    }
  });

  test(`preset ${name}: scores decrease down the scale`, () => {
    const config = loadPreset(name);
    setConfig(config);
    const scale = config.columns.find(c => c.role === 'rank')!.scale!;
    const scores = scale
      .map(entry => entry.score ?? Number.parseFloat(entry.value))
      .filter(score => !Number.isNaN(score));
    assert.equal(scores.length, scale.length, 'a step has neither a score nor a numeric value');
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i]! < scores[i - 1]!, `step ${i} is not worse than the one above it`);
    }
  });

  test(`preset ${name}: every template row lands on the scale`, () => {
    const config = loadPreset(name);
    setConfig(config);
    const rows = csvToRows(readFileSync(`presets/${name}/TEMPLATE.csv`, 'utf8'));
    assert.ok(rows.length, 'the template has no rows');
    const header = config.columns.find(c => c.role === 'rank')!.source!;
    for (const row of rows) {
      assert.notEqual(rankIndexOf(row[header]), -1, `${row['Model']} has an off-scale rank`);
      assert.notEqual(rowScore(row, 'en'), null, `${row['Model']} resolves to no score`);
    }
  });

  test(`preset ${name}: the average denominator matches the top of the scale`, () => {
    const config = loadPreset(name);
    setConfig(config);
    const denominator = config.stats?.average?.denominator;
    if (!denominator) return;
    const scale = config.columns.find(c => c.role === 'rank')!.scale!;
    const best = scale[0]!.score ?? Number.parseFloat(scale[0]!.value);
    assert.equal(Number.parseFloat(denominator), best, 'denominator does not match the best step');
  });
}
