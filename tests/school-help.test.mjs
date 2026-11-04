import test from 'node:test';
import assert from 'node:assert/strict';
import { findSchoolAnswers } from '../lib/school-help.ts';
test('school help matches Latvian FAQ topics and leaves unsupported questions unanswered', () => {
  assert.equal(findSchoolAnswers('Vai SIAC ir obligāts?')[0].id, 'siac');
  assert.equal(findSchoolAnswers('Kā iesniegt drošības lapu?')[0].id, 'safety');
  assert.equal(findSchoolAnswers('Cik vadītāju vajag?')[0].id, 'leaders');
  assert.equal(findSchoolAnswers('Kāpēc nav saņemts kods?')[0].id, 'missing-code');
  assert.deepEqual(findSchoolAnswers('Kāda būs temperatūra?'), []);
});
