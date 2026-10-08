import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedMedalPlaces } from '../lib/medal-ranking.ts';
test('equal medal breakdowns share a competition rank, not merely total medals', () => {
  assert.deepEqual(sharedMedalPlaces([{gold:2,silver:0,bronze:0},{gold:1,silver:1,bronze:0},{gold:1,silver:1,bronze:0},{gold:1,silver:0,bronze:1}]),[1,2,2,4]);
  assert.deepEqual(sharedMedalPlaces([]),[]);
});
