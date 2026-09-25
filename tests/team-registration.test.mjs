import test from 'node:test';
import assert from 'node:assert/strict';
import { numberedTeam } from '../lib/team-registration.ts';

test('team selection uses numbers while preserving legacy team identities', () => {
  assert.equal(numberedTeam([], 1), '1. komanda');
  const entries = [{ teamName: 'Vanagi' }];
  assert.equal(numberedTeam(entries, 1), 'Vanagi');
  assert.equal(numberedTeam(entries, undefined, 'Vanagi'), 'Vanagi');
  assert.equal(numberedTeam(entries, 2), '1. komanda');
  assert.throws(() => numberedTeam(entries, 3), /komandas numuru/);
});

test('new numbered teams avoid collisions and editing a sole team member keeps its identity', () => {
  const entries = [{ teamName: '1. komanda' }, { teamName: '3. komanda' }];
  assert.equal(numberedTeam(entries, 2), '3. komanda');
  assert.equal(numberedTeam(entries, 3), '2. komanda');
  assert.equal(numberedTeam([{ teamName: 'Vanagi' }], 1), 'Vanagi');
});
