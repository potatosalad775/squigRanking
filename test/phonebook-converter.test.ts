// The docs site's phone book converter turns a `phone_book.json` into sheet
// rows. Two things have to hold for those rows to be worth anything, and neither
// is visible from inside the docs package:
//
//   1. The header row has to be the header row of the workbook an operator
//      downloaded, or pasting into it silently shifts every column.
//   2. The Brand and Model it writes have to match back to the same phonebook
//      entry, or every card loses its measurement link.
//
// Both are asserted here against the real presets and the real matcher.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { csvToRows, parseCsv } from '../src/csv.ts';
import { resolveMeasurementUrl, type Phonebook } from '../src/phonebook.ts';
import { presetState } from '../docs/src/components/config-editor/form.ts';
import {
  convert, duplicateNames, stripHtml, variationsOf,
  type ConvertOptions,
} from '../docs/src/components/phonebook-converter/convert.ts';
import {
  offScaleRanks, sheetGrid, sheetHeaders, toCsv, toTsv,
  type SheetOptions,
} from '../docs/src/components/phonebook-converter/sheet.ts';
import { TEMPLATE_HEADERS } from '../docs/src/components/phonebook-converter/templates.ts';

const PRESETS = ['letter', 'stars', 'score'];

const READING: ConvertOptions = {
  splitVariations: false,
  rankFromReviewScore: true,
  zeroIsUnrated: true,
};

function sheetOptions(overrides: Partial<SheetOptions> = {}): SheetOptions {
  return {
    template: TEMPLATE_HEADERS['letter']!,
    korean: true,
    descriptionInto: '',
    price: false,
    reviewLink: false,
    shopLink: false,
    ...overrides,
  };
}

/** A CrinGraph book: object phones, `file`/`suffix` arrays, and the terse form. */
const CRINGRAPH: unknown = [
  {
    name: '64 Audio',
    phones: [
      {
        name: 'Aspire 1',
        reviewScore: '4',
        price: '$350',
        shopLink: 'https://example.com/shop',
        reviewLink: 'https://example.com/review',
        file: ['64 Audio Aspire 1', '64 Audio Aspire 1 deep'],
        suffix: ['', '(insert: deep)'],
      },
      { name: 'Unscored', reviewScore: '0', file: '64 Audio Unscored' },
    ],
  },
  { name: 'QBK', phones: ['FQQ', 'Q53'] },
];

/** A modernGraphTool book: name arrays, `prefix`, `hptfs[]` and `variants[]`. */
const MODERN: unknown = [
  {
    name: 'Demo',
    suffix: '(Audio)',
    phones: [
      {
        name: ['Variations'],
        file: ['Combo Variant 1', 'Combo Variant 2'],
        suffix: ['var1', 'var2'],
        reviewScore: '4',
        description: 'Neutral, with <b>good</b> extension &amp; a <a href="https://x/">link</a>.',
      },
      {
        name: ['Variations 2'],
        file: ['Combo Variant', 'Combo Variant (A)'],
        prefix: 'Combo Variant',
        reviewScore: 'A+',
      },
      {
        name: ['HpTF Multi Pad'],
        hptfs: [{ suffix: 'Leather Pad', files: ['HpTF Demo Center', 'HpTF Demo Front'] }],
      },
      {
        name: ['Dual Hosted'],
        file: ['Combo Variant 1', 'Multi Sample'],
        suffix: ['Foam Tip', 'Repeat Runs'],
        variants: [
          { suffix: 'Repeat Runs', file: 'Multi Sample', samples: 3 },
          { suffix: 'Pad Positions', samples: { files: ['HpTF Demo Center'] } },
        ],
      },
    ],
  },
];

test('the converter and the shipped workbooks agree on the header row', () => {
  // The docs site builds as its own package, so the headers are repeated there.
  // This is what stops a column added to a preset from going unnoticed.
  for (const preset of PRESETS) {
    const csv = readFileSync(`presets/${preset}/TEMPLATE.csv`, 'utf8');
    const header = parseCsv(csv)[0]!.map(cell => cell.trim());
    assert.deepEqual(TEMPLATE_HEADERS[preset], header, `${preset} drifted from its TEMPLATE.csv`);
  }
});

test('a CrinGraph book converts to one row per device', () => {
  const result = convert(CRINGRAPH, READING);
  assert.equal(result.error, undefined);
  assert.equal(result.dialect, 'cringraph');
  assert.equal(result.brands, 2);
  assert.deepEqual(
    result.devices.map(device => [device.brand, device.model, device.rank, device.file]),
    [
      ['64 Audio', 'Aspire 1', '4', '64 Audio Aspire 1'],
      ['64 Audio', 'Unscored', '', '64 Audio Unscored'],
      ['QBK', 'FQQ', '', 'FQQ'],
      ['QBK', 'Q53', '', 'Q53'],
    ],
  );
});

test('a review score of zero is unrated unless the operator says otherwise', () => {
  const kept = convert(CRINGRAPH, { ...READING, zeroIsUnrated: false });
  assert.equal(kept.devices.find(device => device.model === 'Unscored')!.rank, '0');

  const off = convert(CRINGRAPH, { ...READING, rankFromReviewScore: false });
  assert.deepEqual(off.devices.map(device => device.rank), ['', '', '', '']);
});

test('modernGraphTool keys are read, and reported as what they are', () => {
  const result = convert(MODERN, READING);
  assert.equal(result.dialect, 'moderngraphtool');
  assert.deepEqual(
    result.devices.map(device => device.model),
    ['Variations', 'Variations 2', 'HpTF Multi Pad', 'Dual Hosted'],
  );
  assert.ok(result.notes.some(note => note.includes('hptfs')), 'the deprecated key went unmentioned');
  assert.ok(result.notes.some(note => note.includes('display suffix')), 'the brand suffix went unmentioned');
  // The brand suffix is a graph-tool decoration; an exact name matches better.
  assert.equal(result.devices[0]!.brand, 'Demo');
});

test('a phone with no file of its own is measured under its own name', () => {
  const result = convert(MODERN, READING);
  assert.equal(result.devices.find(d => d.model === 'HpTF Multi Pad')!.file, 'HpTF Demo Center');
});

test('variants[] refines a declared measurement rather than adding a second one', () => {
  // "Repeat Runs" names a file the phone already declared, so it upgrades that
  // variant in place. "Pad Positions" is new, so it is appended. Getting this
  // wrong would show four measurements where the graph tool shows three.
  const variations = variationsOf(
    {
      file: ['Combo Variant 1', 'Multi Sample'],
      suffix: ['Foam Tip', 'Repeat Runs'],
      variants: [
        { suffix: 'Repeat Runs', file: 'Multi Sample', samples: 3 },
        { suffix: 'Pad Positions', samples: { files: ['HpTF Demo Center'] } },
      ],
    },
    'Dual Hosted',
  );
  assert.deepEqual(variations, [
    { label: 'Foam Tip', file: 'Combo Variant 1' },
    { label: 'Repeat Runs', file: 'Multi Sample' },
    { label: 'Pad Positions', file: 'HpTF Demo Center' },
  ]);
});

test('a prefix names the variation the way the graph tools do', () => {
  const result = convert(MODERN, { ...READING, splitVariations: true });
  const named = result.devices.filter(device => device.model.startsWith('Variations 2'));
  assert.deepEqual(named.map(device => device.model), ['Variations 2', 'Variations 2 (A)']);
});

test('splitting variations gives every measurement its own row', () => {
  const single = convert(CRINGRAPH, READING);
  const split = convert(CRINGRAPH, { ...READING, splitVariations: true });
  assert.equal(single.devices.length, 4);
  assert.equal(split.devices.length, 5);
  assert.deepEqual(
    split.devices.slice(0, 2).map(device => device.model),
    ['Aspire 1', 'Aspire 1 (insert: deep)'],
  );
});

test('a description reaches the sheet as text, never as markup', () => {
  // Spreadsheet content is never HTML on the page, so tags left in a description
  // would render as literal angle brackets on the card.
  assert.equal(stripHtml('a <b>bold</b> &amp; <a href="https://x/">link</a>'), 'a bold & link');

  const result = convert(MODERN, READING);
  assert.equal(result.devices[0]!.description, 'Neutral, with good extension & a link.');
  assert.ok(result.notes.some(note => note.includes('HTML')), 'the flattening went unmentioned');
});

test('the converter refuses something that is not a phone book', () => {
  assert.match(convert({ brands: [] }, READING).error!, /not an array/);
  assert.match(convert(null, READING).error!, /not an array/);
});

test('every converted row still resolves to its own measurement', () => {
  // The whole point of writing Brand and Model this way. If `src/phonebook.ts`
  // and the converter ever disagree, every card loses its measurement link.
  for (const book of [CRINGRAPH, MODERN]) {
    for (const device of convert(book, READING).devices) {
      const url = resolveMeasurementUrl(book as Phonebook, device.brand, device.model, '?share={file}');
      assert.equal(
        url,
        `?share=${encodeURIComponent(device.file.replace(/\s+/g, '_'))}`,
        `${device.brand} ${device.model} did not resolve to ${device.file}`,
      );
    }
  }
});

test('the sheet keeps the template columns, in the template order', () => {
  for (const preset of PRESETS) {
    const options = sheetOptions({ template: TEMPLATE_HEADERS[preset]! });
    assert.deepEqual(sheetHeaders(options), TEMPLATE_HEADERS[preset]);
    assert.deepEqual(
      sheetHeaders({ ...options, korean: false }),
      TEMPLATE_HEADERS[preset]!.filter(header => !header.endsWith('_KR')),
    );
  }
});

test('extra columns land after the template, and only when asked for', () => {
  const options = sheetOptions({ price: true, shopLink: true });
  assert.deepEqual(sheetHeaders(options).slice(-2), ['Price', 'Shop']);
  assert.equal(sheetHeaders(sheetOptions()).includes('Price'), false);

  const grid = sheetGrid(convert(CRINGRAPH, READING).devices, options);
  const priceAt = grid[0]!.indexOf('Price');
  assert.equal(grid[1]![priceAt], '$350');
  assert.equal(grid[1]![grid[0]!.indexOf('Shop')], 'https://example.com/shop');
});

test('a description goes only into a column the template actually has', () => {
  const devices = convert(MODERN, READING).devices;
  const into = sheetGrid(devices, sheetOptions({ descriptionInto: 'Notes' }));
  assert.equal(into[1]![into[0]!.indexOf('Notes')], 'Neutral, with good extension & a link.');

  // A column the chosen template does not carry is dropped, not appended.
  const missing = sheetGrid(devices, sheetOptions({ descriptionInto: 'Score', korean: false }));
  assert.deepEqual(missing[0], sheetHeaders(sheetOptions({ korean: false })));
});

test('the generated CSV is something core can read back', () => {
  // The docs package writes its own CSV, so this is the only thing holding it to
  // the parser the page uses.
  const devices = convert(CRINGRAPH, READING).devices;
  const csv = toCsv(sheetGrid(devices, sheetOptions()));
  const rows = csvToRows(csv);

  assert.equal(rows.length, devices.length);
  assert.deepEqual(
    rows.map(row => [row['Brand'], row['Model'], row['Rank']]),
    devices.map(device => [device.brand, device.model, device.rank]),
  );
});

test('CSV quotes what has to be quoted, and TSV flattens what cannot be', () => {
  const grid = [['Brand', 'Model'], ['A, Inc "the best"', 'One\nTwo']];
  assert.deepEqual(csvToRows(toCsv(grid)), [{ Brand: 'A, Inc "the best"', Model: 'One\nTwo' }]);
  // A spreadsheet's paste parser has no quoting, so a newline would split the row.
  assert.equal(toTsv(grid).split('\n').length, 2);
  assert.equal(toTsv(grid).split('\n')[1], 'A, Inc "the best"\tOne Two');
});

test('rank values off the chosen scale are reported', () => {
  const devices = convert(MODERN, READING).devices;
  const stars = presetState('stars').scale.map(entry => entry.value);
  const letters = presetState('letter').scale.map(entry => entry.value);

  assert.deepEqual(offScaleRanks(devices, stars), ['A+']);
  assert.deepEqual(offScaleRanks(devices, letters), ['4']);
});

test('names that would share a card anchor are reported', () => {
  assert.deepEqual(duplicateNames(convert(CRINGRAPH, READING).devices), []);
  assert.deepEqual(
    duplicateNames([
      { brand: 'Moondrop', model: 'Blessing 3' },
      { brand: 'moondrop', model: 'blessing  3' },
      { brand: 'Moondrop', model: 'Kato' },
    ]),
    ['Moondrop Blessing 3', 'moondrop blessing  3'],
  );
});
