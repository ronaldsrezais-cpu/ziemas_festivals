import test from 'node:test';
import assert from 'node:assert/strict';
import { uniqueTeamResults } from '../lib/team-results.ts';

const a = { categoryId: 1, schoolId: 1, schoolName: 'Testa skola', teamName: '1. komanda', placement: '1', status: 'ranked' };

test('a team has one public result and ambiguous old results count for no medal', () => {
  const first = { ...a, placement: 1 };
  const secondTeam = { ...first, teamName: '2. komanda' };
  assert.deepEqual(uniqueTeamResults([first, { ...first }, secondTeam]), [first, secondTeam]);
  assert.deepEqual(uniqueTeamResults([first, { ...first, placement: 2 }, secondTeam]), [secondTeam]);
});
