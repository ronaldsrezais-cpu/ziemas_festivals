import test from 'node:test';
import assert from 'node:assert/strict';
import { contactCsv } from '../lib/contact-csv.ts';
test('contact export preserves Latvian names, escapes fields and neutralizes spreadsheet formulas', () => {
  const csv = contactCsv([['Skola; "Rīga"', 'Rīga', '=1+1', 'Vadītājs', 'name@example.test']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Skola; ""Rīga"""'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"name@example.test"'));
});
