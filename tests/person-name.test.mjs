import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPersonName } from '../lib/person-name.ts';
test('names normalize Latvian letters, multiple words, hyphens and apostrophes', () => {
  for (const [input, expected] of [['JĀNIS','Jānis'], [' anna   MARĪJA ', 'Anna Marīja'], ['BĒRZIŅA-KALNIŅA','Bērziņa-Kalniņa'], ['O’CONNOR', 'O’Connor'], ['rŪDOLFS emīls', 'Rūdolfs Emīls']]) {
    assert.equal(formatPersonName(input), expected);
    assert.equal(formatPersonName(expected), expected);
  }
});
