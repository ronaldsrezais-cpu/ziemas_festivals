import test from 'node:test';
import assert from 'node:assert/strict';
import { combineTeamImportRows, uniqueTeamResults } from '../lib/team-results.ts';

const a = { categoryId: 1, schoolId: 1, schoolName: 'Testa skola', teamName: '1. komanda', placement: '1', status: 'ranked' };

test('team import merges consistent rows and rejects conflicting places before uploading', () => {
  assert.equal(combineTeamImportRows([a, { ...a, teamName: null }, { ...a, schoolId: 2 }]).length, 2);
  assert.throws(() => combineTeamImportRows([a, { ...a, placement: '2' }]), /atšķirīgas vietas/);
});

test('a team has one public result and ambiguous old results count for no medal', () => {
  const first = { ...a, placement: 1 };
  const secondTeam = { ...first, teamName: '2. komanda' };
  assert.deepEqual(uniqueTeamResults([first, { ...first }, secondTeam]), [first, secondTeam]);
  assert.deepEqual(uniqueTeamResults([first, { ...first, placement: 2 }, secondTeam]), [secondTeam]);
});
