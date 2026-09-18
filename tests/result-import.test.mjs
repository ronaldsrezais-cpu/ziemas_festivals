import test from 'node:test';
import assert from 'node:assert/strict';
import { previewResultMatches } from '../lib/result-import.ts';
import { recoverSchoolAccessCode } from '../lib/school-access-code.ts';
const entry = { entryId: 1, firstName: 'Jānis', lastName: 'Bērziņš', schoolName: 'Testa skola' };
test('school alone does not identify a participant', () => {
  const [r] = previewResultMatches('Vieta;Vārds;Skola\n1;Anna Kalniņa;Testa skola', [entry]);
  assert.equal(r.placement, ''); assert.equal(r.sourceLine, '');
});
test('uses the place column, not a bib number', () => {
  const [r] = previewResultMatches('Numurs;Vieta;Vārds;Skola\n35;2;Jānis Bērziņš;Testa skola', [entry]);
  assert.equal(r.placement, '2'); assert.match(r.sourceLine, /35;2/);
});
test('does not guess place from an unlabelled number or previous row', () => {
  const [r] = previewResultMatches('1 Anna Kalniņa\n25 Jānis Bērziņš 2010 01:23', [entry]);
  assert.equal(r.placement, ''); assert.match(r.sourceLine, /Jānis/);
});
test('handles reverse name order, accents and places above 50', () => {
  const [r] = previewResultMatches('Rank\tName\n87\tBerzins Janis', [entry]);
  assert.equal(r.placement, '87');
});
test('repeated participant across categories requires review', () => {
  const [r] = previewResultMatches('Vieta;Vārds\n1;Jānis Bērziņš\n3;Jānis Bērziņš', [entry]);
  assert.equal(r.placement, ''); assert.match(r.matchNote, /Vairākas/);
});
test('identical names require school identification', () => {
  const entries = [entry, {...entry, entryId: 2, schoolName: 'Cita skola'}];
  assert.equal(previewResultMatches('Vieta;Vārds\n1;Jānis Bērziņš', entries)[0].placement, '');
  const rows = previewResultMatches('Vieta;Vārds;Skola\n1;Jānis Bērziņš;Testa skola\n2;Jānis Bērziņš;Cita skola', entries);
  assert.deepEqual(rows.map(r=>r.placement), ['1','2']);
});
test('name substring is not an exact name match', () => {
  const [r] = previewResultMatches('Vieta;Vārds\n1;Jānis Bērziņškalns', [entry]);
  assert.equal(r.sourceLine, '');
});
test('only recovers a current access code', async () => {
  const hash = async value => `hash:${value}`;
  const body = 'Labdien!\nSkolas piekļuves kods: ABCD2345\n';
  assert.equal(await recoverSchoolAccessCode(body, 'hash:ABCD2345', hash), 'ABCD2345');
  assert.equal(await recoverSchoolAccessCode(body, 'hash:OTHER', hash), null);
  assert.equal(await recoverSchoolAccessCode(undefined, 'hash:ABCD2345', hash), null);
  assert.equal(await recoverSchoolAccessCode(body, null, hash), null);
});
