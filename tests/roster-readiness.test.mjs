import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredLeaders, rosterReadiness } from '../lib/roster-readiness.ts';
test('leader requirement increases at 11 and 21 participants', () => {
  for(const [count,expected] of [[0,1],[1,1],[10,1],[11,2],[20,2],[21,3]]) assert.equal(requiredLeaders(count),expected);
});
test('completion requires participants, their entries and enough leaders', () => {
  assert.equal(rosterReadiness(0,1,null).canSubmit,false);
  assert.equal(rosterReadiness(11,1,null).canSubmit,false);
  assert.equal(rosterReadiness(11,2,null,1).canSubmit,false);
  assert.equal(rosterReadiness(11,2,null).canSubmit,true);
  assert.equal(rosterReadiness(11,2,null).submitted,false);
  assert.equal(rosterReadiness(11,2,'2026-09-21T00:00:00Z').submitted,true);
  assert.equal(rosterReadiness(11,1,'2026-09-21T00:00:00Z').submitted,false);
});
