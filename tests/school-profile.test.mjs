import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { state, resetEmailState } from './email-test-db.mjs';
import { safetyStatus } from '../lib/safety-document.ts';

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (['drizzle-orm', '@/db/transaction', '@/db/schema'].includes(specifier))
    return { url: new URL('./email-test-db.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const { renameSchool } = await import('../lib/school-profile.ts');
hooks.deregister();

const schoolActor = { role: 'school', subjectId: 1 };
const adminActor = { role: 'admin', subjectId: 0 };
const input = { name: 'Labotā skola', previousName: 'Testa skola' };

beforeEach(async () => {
  await resetEmailState();
  Object.assign(state.schools[0], { municipality: 'Rīga', rosterSubmittedAt: '2026-09-27T05:00:00Z' });
  state.schools.push({ id: 2, name: 'Otra skola', municipality: 'Rīga', status: 'pending', rosterRevision: 0 });
  state.documents = [{ id: 1, schoolId: 1, rosterRevision: 0 }];
  state.settings = [{ key: 'roster_editing_open', value: 'false' }];
});

test('school rename rejects anonymous users, judges and attempts to target another school', async () => {
  const before = structuredClone(state);
  await assert.rejects(renameSchool(null, input), { status: 401 });
  await assert.rejects(renameSchool({ role: 'judge', subjectId: 1 }, input), { status: 403 });
  await assert.rejects(renameSchool(schoolActor, { ...input, schoolId: 2 }), { status: 403 });
  assert.deepEqual(state, before);
});

test('school can correct its name after roster editing closes without changing access, approval or completion', async () => {
  const before = structuredClone(state);
  assert.deepEqual(await renameSchool(schoolActor, { ...input, name: '  Labotā skola  ', email: 'unwanted@example.test', status: 'rejected' }), { ok: true, name: 'Labotā skola' });
  assert.deepEqual(state.schools[0], { ...before.schools[0], name: 'Labotā skola', rosterRevision: 1 });
  assert.deepEqual(state.schools[1], before.schools[1]);
  assert.deepEqual(state.emails, before.emails);
  assert.equal(safetyStatus(state.documents[0], state.schools[0].rosterRevision), 'outdated');
});

test('administrator can correct a pending school name', async () => {
  const first = structuredClone(state.schools[0]);
  await renameSchool(adminActor, { schoolId: 2, name: 'Precizētā skola', previousName: 'Otra skola' });
  assert.equal(state.schools[1].name, 'Precizētā skola');
  assert.equal(state.schools[1].status, 'pending');
  assert.deepEqual(state.schools[0], first);
});

test('a revoked school session cannot rename the school', async () => {
  state.schools[0].status = 'rejected';
  await assert.rejects(renameSchool(schoolActor, input), { status: 403 });
  assert.equal(state.schools[0].name, 'Testa skola');
});

test('duplicate school name in the same municipality is rejected', async () => {
  await assert.rejects(renameSchool(schoolActor, { ...input, name: 'Otra skola' }), { status: 409 });
  assert.equal(state.schools[0].name, 'Testa skola');
  assert.equal(state.schools[0].rosterRevision, 0);
});

test('school names in different municipalities follow the existing registration uniqueness rule', async () => {
  state.schools[1].municipality = 'Liepāja';
  await renameSchool(schoolActor, { ...input, name: 'Otra skola' });
  assert.equal(state.schools[0].name, 'Otra skola');
});

test('unchanged name does not invalidate an existing safety sheet', async () => {
  const before = structuredClone(state);
  await renameSchool(schoolActor, { ...input, name: '  Testa skola  ' });
  assert.deepEqual(state, before);
  assert.equal(safetyStatus(state.documents[0], state.schools[0].rosterRevision), 'submitted');
});

test('empty and oversized names are rejected before any update', async () => {
  const before = structuredClone(state);
  for (const name of ['', ' ', 'A', 'A'.repeat(181)])
    await assert.rejects(renameSchool(schoolActor, { ...input, name }));
  assert.deepEqual(state, before);
});

test('stale edits cannot overwrite a correction saved by another user', async () => {
  const outcomes = await Promise.allSettled([
    renameSchool(schoolActor, input),
    renameSchool(adminActor, { ...input, schoolId: 1, name: 'Cits labojums' }),
  ]);
  assert.equal(outcomes[0].status, 'fulfilled');
  assert.equal(outcomes[1].status, 'rejected');
  assert.equal(outcomes[1].reason.status, 409);
  assert.equal(state.schools[0].name, 'Labotā skola');
  assert.equal(state.schools[0].rosterRevision, 1);
});
