import test from 'node:test';
import assert from 'node:assert/strict';
import { leaderRequirementMessage, rosterReadiness } from '../lib/roster-readiness.ts';
test('leader wording uses singular for endings 1 except 11', () => {
  for (const count of [1, 21, 31, 101, 121]) {
    assert.match(leaderRequirementMessage(0, count, 0), new RegExp(`nepieciešams vismaz ${count} komandas vadītājs\\.`));
    assert.equal(rosterReadiness(count * 10, 0, null).issues[0], `Pievienojiet vēl ${count} komandas vadītāju.`);
  }
  for (const count of [2, 10, 11, 12, 111]) {
    assert.match(leaderRequirementMessage(0, count, 0), new RegExp(`nepieciešami vismaz ${count} komandas vadītāji\\.`));
    assert.equal(rosterReadiness(count * 10, 0, null).issues[0], `Pievienojiet vēl ${count} komandas vadītājus.`);
  }
  assert.equal(leaderRequirementMessage(0, 1, 0), 'Pie 0 dalībniekiem nepieciešams vismaz 1 komandas vadītājs. Pievienojiet vēl 1.');
});
