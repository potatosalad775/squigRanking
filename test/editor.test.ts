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
import { STRINGS, languages, t } from '../src/i18n.ts';
import { columnValue, resolveI18n } from '../src/config.ts';
import {
  INTERFACE_STRINGS, language, presetState, rampColor as editorRamp,
  readableTextColor as editorTextColor, validate,
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

  test(`the editor's ${preset} output carries the page chrome`, () => {
    // index.html has no title and no footer of its own, so a config the editor
    // produces has to supply both or the page ships blank ones.
    const config = evaluate(generateConfig(presetState(preset)));
    assert.equal(config.chrome?.title, 'SquigRanking');
    const note = config.chrome?.footer?.note;
    assert.ok(note && !Array.isArray(note) && typeof note !== 'string' && note.default);
    assert.ok(note.i18n?.['ko'], 'the Korean footer note is missing');
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

// --- Languages ---------------------------------------------------------------

/** The letter preset plus a language core ships no strings for. */
function withJapanese() {
  const form = presetState('letter');
  const ja = language('ja', 'Japanese', '_JA');
  ja.text['rank'] = 'ランク';
  ja.text['column:pros'] = '長所';
  ja.text['sort:rank-asc'] = '{rank}（高い順）';
  ja.text['footerNote'] = '本ランキングは運営者の個人的な試聴に基づきます。';
  ja.strings['filterAndSort'] = 'フィルターと並べ替え';
  form.languages.push(ja);
  return form;
}

test('the editor offers every interface string core actually writes', () => {
  // The editor duplicates this list so the docs site builds without the root
  // package. A string added to core has to show up in the form, or it silently
  // becomes untranslatable for everyone using the editor.
  assert.deepEqual(
    INTERFACE_STRINGS.map(s => s.key).sort(),
    Object.keys(STRINGS['en']!).sort(),
  );
  for (const { key, en } of INTERFACE_STRINGS) {
    assert.equal(en, STRINGS['en']![key], `the English text for ${key} has drifted`);
  }
});

test('a third language reaches core as a language core can serve', () => {
  const config = evaluate(generateConfig(withJapanese()));
  setConfig(config);

  assert.deepEqual(languages(), ['en', 'ko', 'ja']);
  assert.equal(t('filterAndSort', 'ja'), 'フィルターと並べ替え');
  // Untranslated strings fall back to English rather than going blank.
  assert.equal(t('resetFilters', 'ja'), STRINGS['en']!['resetFilters']);

  const rank = config.columns.find(c => c.role === 'rank')!;
  assert.equal(resolveI18n(rank.label, 'ja'), 'ランク');
  assert.equal(resolveI18n(rank.label, 'ko'), '등급');
  assert.equal(resolveI18n(rank.label, 'de'), 'Rank');

  // The sort label interpolates the rank name in the language it is written in.
  assert.equal(resolveI18n(config.sort!.labels!['rank-asc'], 'ja'), 'ランク（高い順）');
  assert.equal(resolveI18n(config.sort!.labels!['rank-asc'], 'ko'), '등급순 (높은 순)');
});

test('each language reads its own column, and falls back per cell', () => {
  setConfig(evaluate(generateConfig(withJapanese())));
  const pros = evaluate(generateConfig(withJapanese())).columns.find(c => c.id === 'pros')!;
  assert.deepEqual(pros.i18nSource, { en: 'Pros', ko: 'Pros_KR', ja: 'Pros_JA' });

  const row = { Pros: 'Even tonality', Pros_KR: '고른 음색', Pros_JA: '' };
  assert.equal(columnValue(row, pros, 'ja'), 'Even tonality', 'a blank cell should fall back');
  assert.equal(columnValue(row, pros, 'ko'), '고른 음색');
});

test('the template header row covers every language', () => {
  const headers = generateTemplateHeaders(withJapanese());
  for (const header of ['Pros', 'Pros_KR', 'Pros_JA', 'Comment_JA', 'Notes_JA']) {
    assert.ok(headers.includes(header), `${header} is missing from the generated header row`);
  }
});

test('the language button names the language it actually switches to', () => {
  // The editor names the languages rather than writing the tooltips, and core
  // builds each one from those names.
  const form = presetState('letter');
  form.languages = [language('ja', 'Japanese', '_JA')];
  setConfig(evaluate(generateConfig(form)));
  assert.equal(t('toggleLanguage', 'en'), 'View in Japanese');
  assert.equal(t('toggleLanguage', 'ja'), 'View in English');

  // Three languages: each button names the next one round, Korean included.
  const three = evaluate(generateConfig(withJapanese()));
  setConfig(three);
  assert.equal(t('toggleLanguage', 'en'), 'View in Korean');
  assert.equal(t('toggleLanguage', 'ko'), 'View in Japanese');
  assert.equal(t('toggleLanguage', 'ja'), 'View in English');

  // None of which is written into the file. This fixture overrides one string
  // by hand, so `i18n` exists — but it carries no tooltip for anything.
  assert.deepEqual(three.i18n, { ja: { filterAndSort: 'フィルターと並べ替え' } });
  assert.ok(!generateConfig(withJapanese()).includes('toggleLanguage'));
});

test('an operator can still word the language button themselves', () => {
  const form = withJapanese();
  form.languages[1]!.strings['toggleLanguage'] = '英語で表示';
  setConfig(evaluate(generateConfig(form)));
  assert.equal(t('toggleLanguage', 'ja'), '英語で表示');
  // The rest are still derived from the names.
  assert.equal(t('toggleLanguage', 'ko'), 'View in Japanese');

  const first = generateConfig(form);
  const result = parseConfig(first);
  assert.equal(result.form!.languages[1]!.strings['toggleLanguage'], '英語で表示');
  assert.equal(generateConfig(result.form!), first);
});

test('a tooltip an older editor wrote is dropped rather than kept as an override', () => {
  // Earlier output carried `View in X` per language. Core derives that now, so
  // importing one should leave nothing behind to regenerate.
  const config = generateConfig(withJapanese()).replace(
    '};',
    "\ti18n: { ko: { toggleLanguage: 'View in Japanese' } },\n};",
  );
  const result = parseConfig(config);
  assert.equal(result.error, undefined);
  assert.equal(result.form!.languages[0]!.strings['toggleLanguage'], undefined);
  assert.ok(!generateConfig(result.form!).includes('toggleLanguage'));
});

test('only the sort labels interpolate the rank name', () => {
  // The braces are the form's own notation, not something an operator's prose
  // should trip over.
  const form = presetState('letter');
  form.languages[0]!.text['footerNote'] = '{rank} 표기는 그대로 둡니다.';
  const config = evaluate(generateConfig(form));
  assert.equal(resolveI18n(config.chrome!.footer!.note as never, 'ko'), '{rank} 표기는 그대로 둡니다.');
  assert.equal(resolveI18n(config.sort!.labels!['rank-asc'], 'ko'), '등급순 (높은 순)');
});

test('an English-only config carries no language machinery at all', () => {
  const form = presetState('letter');
  form.languages = [];
  const output = generateConfig(form);
  assert.ok(!output.includes('languages:'), 'a one-language page has nothing to toggle');
  assert.ok(!output.includes('i18nSource'), 'a one-language page needs no parallel columns');

  const config = evaluate(output);
  setConfig(config);
  assert.equal(resolveI18n(config.columns.find(c => c.role === 'rank')!.label, 'en'), 'Rank');
});

test('a config with a third language survives a round trip', () => {
  const first = generateConfig(withJapanese());
  const result = parseConfig(first);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.form!.languages.map(l => l.tag), ['ko', 'ja']);
  assert.equal(result.form!.languages[1]!.suffix, '_JA');
  // Sort labels come back as patterns, so renaming the rank column still reaches them.
  assert.equal(result.form!.languages[1]!.text['sort:rank-asc'], '{rank}（高い順）');
  assert.equal(generateConfig(result.form!), first);
});

test('the importer finds a language the config only half declares', () => {
  // A hand-edited file may list a tag without translating a single column, or
  // add an `i18nSource` without listing the tag. Both are still that language.
  const config = generateConfig(presetState('letter'))
    .replace("languages: { en: 'English', ko: 'Korean' },", "languages: { en: 'English', ko: 'Korean', fr: 'French' },");
  const result = parseConfig(config);
  assert.deepEqual(result.form!.languages.map(l => l.tag), ['ko', 'fr']);
  assert.equal(result.form!.languages[1]!.suffix, '_FR', 'an unknown suffix should get a default');
});

test('the importer still reads a config that only lists its languages', () => {
  // The array form predates naming and stays valid, so it has to import as the
  // same form the editor would produce for it.
  const legacy = generateConfig(presetState('letter'))
    .replace("languages: { en: 'English', ko: 'Korean' },", "languages: ['en', 'ko'],");
  const result = parseConfig(legacy);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.form!.languages.map(l => l.tag), ['ko']);
  assert.equal(result.form!.languages[0]!.name, 'Korean', 'a known tag should get its name back');
  // Regenerating names them, which is the upgrade.
  assert.ok(generateConfig(result.form!).includes("languages: { en: 'English', ko: 'Korean' },"));
});

test('validation catches the mistakes a language list makes easy', () => {
  const duplicate = presetState('letter');
  duplicate.languages.push(language('ko', 'Korean again', '_KO'));
  assert.ok(validate(duplicate).some(p => p.includes('listed twice')));

  const noSuffix = presetState('letter');
  noSuffix.languages.push(language('ja', 'Japanese', ''));
  assert.ok(validate(noSuffix).some(p => p.includes('no column suffix')));

  const collision = presetState('letter');
  collision.languages.push(language('ja', 'Japanese', '_KR'));
  assert.ok(validate(collision).some(p => p.includes('both read')));

  const badTag = presetState('letter');
  badTag.languages.push(language('Japanese', 'Japanese', '_JA'));
  assert.ok(validate(badTag).some(p => p.includes('not a language tag')));

  // The name is what the button calls this language on every other language's
  // page, so an unnamed one would read "View in ja".
  const unnamed = presetState('letter');
  unnamed.languages.push(language('ja', '', '_JA'));
  assert.ok(validate(unnamed).some(p => p.includes('no name')));
  unnamed.languages[1]!.name = 'Japanese';
  assert.deepEqual(validate(unnamed), []);
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
