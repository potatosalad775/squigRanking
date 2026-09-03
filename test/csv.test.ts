import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvToRows, parseCsv } from '../src/csv.ts';

test('parses plain rows', () => {
  assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
});

test('keeps commas inside quoted fields', () => {
  assert.deepEqual(parseCsv('a,b\n"x,y",2'), [['a', 'b'], ['x,y', '2']]);
});

test('unescapes doubled quotes', () => {
  assert.deepEqual(parseCsv('a\n"say ""hi"""'), [['a'], ['say "hi"']]);
});

test('keeps newlines inside quoted fields', () => {
  const rows = parseCsv('a,b\n"line1\nline2",2');
  assert.deepEqual(rows, [['a', 'b'], ['line1\nline2', '2']]);
});

test('handles CRLF line endings', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
});

test('does not emit a trailing empty row', () => {
  assert.equal(parseCsv('a,b\n1,2\n').length, 2);
});

test('a quote inside an unquoted field stays literal', () => {
  assert.deepEqual(parseCsv('a\n5" driver'), [['a'], ['5" driver']]);
});

test('maps rows onto trimmed headers', () => {
  const rows = csvToRows('Brand , Model\nAcme, Widget');
  assert.deepEqual(rows, [{ Brand: 'Acme', Model: 'Widget' }]);
});

test('skips blank rows', () => {
  const rows = csvToRows('Brand,Model\nAcme,Widget\n,\n\nOther,Thing');
  assert.equal(rows.length, 2);
});

test('fills missing trailing cells with empty strings', () => {
  const rows = csvToRows('A,B,C\n1,2');
  assert.deepEqual(rows[0], { A: '1', B: '2', C: '' });
});

test('a multi-line comment cell survives intact', () => {
  const csv = 'Model,Comment\nWidget,"Great sound\nWeak bass"';
  assert.equal(csvToRows(csv)[0]?.['Comment'], 'Great sound\nWeak bass');
});
