import assert from 'node:assert/strict';
import { test } from 'node:test';
import { phoneFile, resolveMeasurementUrl, type Phonebook } from '../src/phonebook.ts';

const PHONEBOOK: Phonebook = [
  {
    name: 'Moondrop',
    phones: [
      { name: 'Blessing 3', file: 'Blessing 3' },
      { name: 'Variations', file: ['Variations', 'Variations alt'] },
      { name: 'Kato', prefix: 'KXXS ', file: 'Kato' },
    ],
  },
  { name: '7Hz / Salnotes', phones: [{ name: 'Zero', file: 'Zero' }] },
  { name: 'Empty', phones: [{ name: 'NoFile' }] },
];

const TEMPLATE = '../?share={file}';

test('matches an exact brand and model', () => {
  assert.equal(resolveMeasurementUrl(PHONEBOOK, 'Moondrop', 'Blessing 3', TEMPLATE), '../?share=Blessing_3');
});

test('matching ignores case and extra whitespace', () => {
  assert.equal(resolveMeasurementUrl(PHONEBOOK, '  moondrop ', 'blessing 3', TEMPLATE), '../?share=Blessing_3');
});

test('matches a brand whose phonebook name carries extra words', () => {
  assert.equal(resolveMeasurementUrl(PHONEBOOK, '7Hz', 'Zero', TEMPLATE), '../?share=Zero');
});

test('falls back to alphanumeric-only matching', () => {
  assert.equal(resolveMeasurementUrl(PHONEBOOK, 'Moon-drop', 'Blessing3', TEMPLATE), '../?share=Blessing_3');
});

test('takes the first file when a phone has several', () => {
  assert.equal(resolveMeasurementUrl(PHONEBOOK, 'Moondrop', 'Variations', TEMPLATE), '../?share=Variations');
});

test('matches on the prefix field when the name does not match', () => {
  assert.equal(resolveMeasurementUrl(PHONEBOOK, 'Moondrop', 'KXXS', TEMPLATE), '../?share=Kato');
});

test('returns null for an unknown brand', () => {
  assert.equal(resolveMeasurementUrl(PHONEBOOK, 'Nonexistent', 'Blessing 3', TEMPLATE), null);
});

test('returns null for an unknown model', () => {
  assert.equal(resolveMeasurementUrl(PHONEBOOK, 'Moondrop', 'Nonexistent', TEMPLATE), null);
});

test('returns null when the phonebook entry has no file', () => {
  assert.equal(resolveMeasurementUrl(PHONEBOOK, 'Empty', 'NoFile', TEMPLATE), null);
});

test('returns null without a phonebook', () => {
  assert.equal(resolveMeasurementUrl(null, 'Moondrop', 'Blessing 3', TEMPLATE), null);
});

test('returns null when brand or model is blank', () => {
  assert.equal(resolveMeasurementUrl(PHONEBOOK, '', 'Blessing 3', TEMPLATE), null);
  assert.equal(resolveMeasurementUrl(PHONEBOOK, 'Moondrop', '', TEMPLATE), null);
});

test('encodes characters that are unsafe in a URL', () => {
  const book: Phonebook = [{ name: 'B', phones: [{ name: 'M', file: 'a&b c' }] }];
  assert.equal(resolveMeasurementUrl(book, 'B', 'M', TEMPLATE), '../?share=a%26b_c');
});

test('phoneFile normalizes the file field', () => {
  assert.equal(phoneFile({ file: '  Kato  ' }), 'Kato');
  assert.equal(phoneFile({ file: [] }), null);
  assert.equal(phoneFile({}), null);
});
