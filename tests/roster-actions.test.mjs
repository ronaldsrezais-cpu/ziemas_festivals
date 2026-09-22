import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { state, resetEmailState } from './email-test-db.mjs';

const adapter = new URL('./email-test-db.mjs', import.meta.url).href;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (['drizzle-orm', '@/db/transaction', '@/db/schema'].includes(specifier))
    return { url: adapter, shortCircuit: true };
  if (specifier === './roster-readiness')
    return { url: new URL('../lib/roster-readiness.ts', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const { mutateSchoolRoster } = await import('../lib/school-roster.ts');
hooks.deregister();

beforeEach(async () => {
  await resetEmailState();
  state.schools[0].rosterSubmittedAt = null;
  state.settings = [{ key: 'roster_editing_open', value: 'true' }];
  state.participants = Array.from({ length: 11 }, (_, index) => ({ id: index + 1, schoolId: 1, active: true }));
  state.entries = state.participants.map(person => ({ id: person.id, schoolId: 1, participantId: person.id, categoryId: 1 }));
  state.leaders = [{ id: 1, schoolId: 1 }];
});

test('closing roster editing blocks every mutation before it can change data', async () => {
  state.settings[0].value = 'false';
  const before = structuredClone(state);
  for (const action of ['save-participant', 'delete-participant', 'add-leader', 'delete-leader', 'submit-roster'])
    await assert.rejects(mutateSchoolRoster(1, action, {}), /labošana ir slēgta/);
  assert.deepEqual(state, before);
});

test('completion requires sufficient leaders and a roster change clears completion', async () => {
  await assert.rejects(mutateSchoolRoster(1, 'submit-roster', {}), /vadītāju/);
  assert.equal(state.schools[0].rosterSubmittedAt, null);
  state.leaders.push({ id: 2, schoolId: 1 });
  await mutateSchoolRoster(1, 'submit-roster', {});
  assert.ok(state.schools[0].rosterSubmittedAt);
  await mutateSchoolRoster(1, 'delete-leader', { leaderId: 2 });
  assert.equal(state.schools[0].rosterSubmittedAt, null);
  await assert.rejects(mutateSchoolRoster(1, 'submit-roster', {}), /vadītāju/);
});
