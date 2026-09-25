import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { state, resetEmailState } from './email-test-db.mjs';
import { blobState, resetBlobs } from './safety-test-blob.mjs';

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (['drizzle-orm', '@/db/transaction', '@/db/schema'].includes(specifier))
    return { url: new URL('./email-test-db.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier === '@vercel/blob') return { url: new URL('./safety-test-blob.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const { deleteJudgeRecord, deleteSchoolApplication } = await import('../lib/delete-records.ts');
hooks.deregister();

beforeEach(async () => {
  await resetEmailState(); resetBlobs();
  state.schools.push({ id: 2, name: 'Otra skola' });
  state.judges = [{ id: 1, sportId: 1, active: true }, { id: 2, sportId: 2, active: true }];
  state.categories = [{ id: 1, sportId: 1 }, { id: 2, sportId: 2 }];
  state.results = [{ id: 1, categoryId: 1, entryId: 1 }, { id: 2, categoryId: 2, entryId: 2 }];
  state.uploads = [{ id: 1, sportId: 1, objectKey: 'test-file-1' }, { id: 2, sportId: 2, objectKey: 'test-file-2' }];
  state.sessions = [{ role: 'school', subjectId: 1 }, { role: 'school', subjectId: 2 }, { role: 'judge', subjectId: 1 }];
  state.documents = [{ id: 1, schoolId: 1, objectKey: 'test-safety-1' }];
});

test('inactive judges and judges from another sport cannot delete records', async () => {
  state.judges[0].active = false;
  for (const kind of ['result', 'upload']) {
    await assert.rejects(deleteJudgeRecord(1, kind, 1), /nav aktīva/);
    await assert.rejects(deleteJudgeRecord(2, kind, 1), /nav pieejams/);
  }
  assert.equal(state.results.length, 2);
  assert.equal(state.uploads.length, 2);
  assert.equal(blobState.deleted.length, 0);
});

test('judge result deletion affects only the chosen result in their sport', async () => {
  await deleteJudgeRecord(1, 'result', 1);
  assert.deepEqual(state.results.map(row => row.id), [2]);
  assert.equal(state.uploads.length, 2);
});

test('failed storage deletion retains the result file record', async () => {
  blobState.failDelete = true;
  await assert.rejects(deleteJudgeRecord(1, 'upload', 1), /glabātuves/);
  assert.equal(state.uploads.length, 2);
  assert.equal(state.results.length, 2);
});

test('deleting an owned file leaves the entered result records in place', async () => {
  await deleteJudgeRecord(1, 'upload', 1);
  assert.deepEqual(blobState.deleted, ['test-file-1']);
  assert.deepEqual(state.uploads.map(row => row.id), [2]);
  assert.deepEqual(state.results.map(row => row.id), [1, 2]);
});

test('school deletion requires exact confirmation before any storage or database write', async () => {
  await assert.rejects(deleteSchoolApplication(1, 'Nepareizs nosaukums'), /precīzi/);
  assert.equal(state.schools.length, 2);
  assert.equal(state.sessions.length, 3);
  assert.equal(blobState.deleted.length, 0);
});

test('failed safety-document deletion retains the school and its sessions', async () => {
  blobState.failDelete = true;
  await assert.rejects(deleteSchoolApplication(1, 'Testa skola'), /drošības dokumentu/);
  assert.equal(state.schools.length, 2);
  assert.equal(state.sessions.length, 3);
});

test('school deletion revokes only that school sessions and deletes only its private document', async () => {
  await deleteSchoolApplication(1, 'Testa skola');
  assert.deepEqual(state.schools.map(row => row.id), [2]);
  assert.deepEqual(state.sessions, [{ role: 'school', subjectId: 2 }, { role: 'judge', subjectId: 1 }]);
  assert.deepEqual(blobState.deleted, ['test-safety-1']);
});
