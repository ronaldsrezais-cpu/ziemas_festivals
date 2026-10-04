import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { state, resetEmailState } from './email-test-db.mjs';
import { cookieState } from './judge-test-cookies.mjs';

const adapter = new URL('./email-test-db.mjs', import.meta.url).href;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (['drizzle-orm', '@/db', '@/db/transaction', '@/db/schema', '@/lib/runtime'].includes(specifier))
    return { url: adapter, shortCircuit: true };
  if (specifier === 'next/headers')
    return { url: new URL('./judge-test-cookies.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('@/lib/'))
    return { url: new URL(`../lib/${specifier.slice(6)}.ts`, import.meta.url).href, shortCircuit: true };
  return next(specifier === './roster-readiness' ? './roster-readiness.ts' : specifier, context);
} });
const { manageJudgeAccess } = await import('../lib/judge-access.ts');
const { hashSecret, verifySecret, createJudgeSession, createSession, getSession } = await import('../lib/security.ts');
const { POST } = await import('../app/api/judges/route.ts');
hooks.deregister();

const admin = { role: 'admin', subjectId: 0 };
const oldPassword = 'Old_test_password';
const nextPassword = 'New_test_password';
const oldHash = await hashSecret(oldPassword);
const session = (id, role, subjectId) => ({ id, role, subjectId, expiresAt: '2999-01-01T00:00:00.000Z' });
const deleteInput = { action: 'delete', judgeId: 1, confirmation: 'Jānis Bērziņš' };
const passwordInput = { action: 'reset-password', judgeId: 1, password: nextPassword };
const request = (payload, origin = 'https://example.test') => new Request('https://example.test/api/judges', {
  method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(payload),
});

beforeEach(async () => {
  await resetEmailState();
  state.judges = [
    { id: 1, fullName: 'Jānis Bērziņš', sportId: 1, active: true, passwordHash: oldHash },
    { id: 2, fullName: 'Anna Kalniņa', sportId: 2, active: true, passwordHash: oldHash },
  ];
  state.sessions = [session('admin-1', 'admin', 0), session('school-1', 'school', 1),
    session('judge-1a', 'judge', 1), session('judge-1b', 'judge', 1), session('judge-2', 'judge', 2)];
  state.results = [{ id: 1, judgeId: 1, categoryId: 1, placement: 1 }];
  state.uploads = [{ id: 1, createdByJudgeId: 1, sportId: 1, objectKey: 'test-results.pdf' }];
  cookieState.value = 'admin-1'; cookieState.options = null;
});

test('judge management requires an administrator before any mutation', async () => {
  const before = structuredClone(state);
  for (const actor of [null, { role: 'judge' }, { role: 'school' }]) {
    for (const input of [deleteInput, passwordInput])
      await assert.rejects(manageJudgeAccess(actor, input), { status: actor ? 403 : 401 });
  }
  assert.deepEqual(state, before);
});

test('deleting a judge requires the matching name and preserves other records', async () => {
  const before = structuredClone(state);
  await assert.rejects(manageJudgeAccess(admin, { ...deleteInput, confirmation: 'Cits tiesnesis' }), /precīzi/);
  assert.deepEqual(state, before);
  assert.deepEqual(await manageJudgeAccess(admin, deleteInput), { ok: true });
  assert.deepEqual(state.judges, [before.judges[1]]);
  assert.deepEqual(state.sessions, before.sessions.filter(row => !(row.role === 'judge' && row.subjectId === 1)));
  assert.deepEqual(state.results, before.results);
  assert.deepEqual(state.uploads, before.uploads);
  assert.equal(await createJudgeSession(1, oldPassword), false);
  cookieState.value = 'judge-1a';
  assert.equal(await getSession(), null);
});

test('password reset stores only a hash, rejects the old password and revokes only that judge sessions', async () => {
  const before = structuredClone(state);
  assert.deepEqual(await manageJudgeAccess(admin, passwordInput), { ok: true });
  const changed = state.judges[0];
  assert.notEqual(changed.passwordHash, nextPassword);
  assert.notEqual(changed.passwordHash, oldHash);
  assert.equal(await verifySecret(nextPassword, changed.passwordHash), true);
  assert.equal(await verifySecret(oldPassword, changed.passwordHash), false);
  assert.equal(JSON.stringify(state).includes(nextPassword), false);
  assert.deepEqual(state.judges[1], before.judges[1]);
  assert.deepEqual(state.sessions, before.sessions.filter(row => !(row.role === 'judge' && row.subjectId === 1)));
  assert.deepEqual(state.results, before.results);
  assert.deepEqual(state.uploads, before.uploads);
  cookieState.value = 'judge-1b';
  assert.equal(await getSession(), null);
  assert.equal(await createJudgeSession(1, oldPassword), false);
  assert.equal(await createJudgeSession(1, nextPassword), true);
  assert.equal((await getSession('judge')).subjectId, 1);
  assert.equal(cookieState.options.httpOnly, true);
  assert.equal(cookieState.options.sameSite, 'lax');
});

test('invalid or missing judge data is rejected without changing credentials or sessions', async () => {
  const before = structuredClone(state);
  for (const password of ['', 'short', '      ', 'x'.repeat(129)])
    await assert.rejects(manageJudgeAccess(admin, { ...passwordInput, password }));
  for (const input of [{ ...deleteInput, judgeId: 999 }, { ...passwordInput, judgeId: 999 }])
    await assert.rejects(manageJudgeAccess(admin, input), { status: 404 });
  assert.deepEqual(state, before);
});

test('inactive judge cannot log in or be reactivated by resetting a password', async () => {
  state.judges[0].active = false;
  const before = structuredClone(state);
  assert.equal(await createJudgeSession(1, oldPassword), false);
  await assert.rejects(manageJudgeAccess(admin, passwordInput), { status: 403 });
  assert.deepEqual(state, before);
  await manageJudgeAccess(admin, deleteInput);
  assert.deepEqual(state.judges.map(row => row.id), [2]);
});

test('concurrent login cannot leave a usable old-password session after reset or deletion', async () => {
  await Promise.all([createJudgeSession(1, oldPassword), manageJudgeAccess(admin, passwordInput)]);
  assert.equal(state.sessions.some(row => row.role === 'judge' && row.subjectId === 1), false);
  assert.equal(await createJudgeSession(1, oldPassword), false);
  await Promise.all([createJudgeSession(1, nextPassword), manageJudgeAccess(admin, deleteInput)]);
  assert.equal(state.sessions.some(row => row.role === 'judge' && row.subjectId === 1), false);
  assert.equal(await createJudgeSession(1, nextPassword), false);
});

test('existing school and administrator session creation still works', async () => {
  for (const [role, subjectId] of [['school', 1], ['admin', 0]]) {
    await createSession(role, subjectId);
    const current = await getSession(role);
    assert.equal(current.role, role);
    assert.equal(current.subjectId, subjectId);
    assert.ok(new Date(current.expiresAt).getTime() > Date.now());
    assert.equal(cookieState.options.httpOnly, true);
  }
});

test('management endpoint denies anonymous, school, judge and cross-origin requests', async () => {
  const before = structuredClone(state);
  for (const [cookie, expected] of [[null, 401], ['school-1', 403], ['judge-1a', 403]]) {
    cookieState.value = cookie;
    for (const input of [deleteInput, passwordInput]) {
      const response = await POST(request(input));
      assert.equal(response.status, expected);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    }
  }
  cookieState.value = 'admin-1';
  for (const input of [deleteInput, passwordInput])
    assert.equal((await POST(request(input, 'https://other.test'))).status, 403);
  assert.deepEqual(state, before);
});

test('admin endpoint saves passwords without returning credentials and validates deletion', async () => {
  const response = await POST(request(passwordInput));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal((await POST(request({ ...deleteInput, confirmation: '' }))).status, 400);
  assert.equal((await POST(request(deleteInput))).status, 200);
  assert.equal((await POST(request(deleteInput))).status, 404);
});
