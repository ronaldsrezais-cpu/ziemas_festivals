import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resetEmailState, state, accessCodeHash } from './email-test-db.mjs';

const adapter = new URL('./email-test-db.mjs', import.meta.url).href;
const dependencies = new Set(['drizzle-orm', '@/db', '@/db/transaction', '@/db/schema', '@/lib/runtime', '@/lib/security']);
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (dependencies.has(specifier)) return { url: adapter, shortCircuit: true };
  if (specifier === '@/lib/school-access-code') return {
    url: new URL('../lib/school-access-code.ts', import.meta.url).href, shortCircuit: true,
  };
  return next(specifier, context);
} });
const { resendApprovalEmail, approveSchool } = await import('../lib/email.ts');
hooks.deregister();

const originalFetch = globalThis.fetch;
let requests;
let status;
beforeEach(async () => {
  await resetEmailState(); requests = []; status = 200;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    requests.push({ key: options.headers['Idempotency-Key'], payload: JSON.parse(options.body) });
    await new Promise(resolve => setTimeout(resolve, 5));
    return Response.json({ id: 'mock-email' }, { status });
  };
});
afterEach(() => { globalThis.fetch = originalFetch; });

test('missing configuration keeps the email queued without sending or rotating the code', async () => {
  state.env.RESEND_API_KEY = '';
  const result = await resendApprovalEmail(1);
  assert.equal(result.emailStatus, 'queued');
  assert.equal(requests.length, 0);
  assert.equal(state.emails[0].attemptCount, 0);
  assert.equal(state.schools[0].accessCodeHash, await accessCodeHash('ABCDEFGH'));
});

test('failed delivery retries the identical request and code; success clears the error', async () => {
  status = 403;
  assert.equal((await resendApprovalEmail(1)).emailStatus, 'failed');
  assert.ok(state.emails[0].error);
  status = 200;
  assert.equal((await resendApprovalEmail(1)).emailSent, true);
  assert.equal(state.emails[0].status, 'sent');
  assert.equal(state.emails[0].error, null);
  assert.equal(state.emails[0].attemptCount, 2);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  assert.match(requests[1].payload.text, /Skolas piekļuves kods: ABCDEFGH/);
  assert.equal(state.schools[0].accessCodeHash, await accessCodeHash('ABCDEFGH'));
});

test('concurrent retries make only one provider request', async () => {
  const outcomes = await Promise.allSettled([resendApprovalEmail(1), resendApprovalEmail(1)]);
  assert.ok(outcomes.some(outcome => outcome.status === 'fulfilled' && outcome.value.emailSent));
  assert.equal(requests.length, 1);
  assert.equal(state.emails[0].attemptCount, 1);
});

test('an intentional resend after the cooldown makes a new request with the same access code', async () => {
  state.emails[0].status = 'sent';
  state.emails[0].sentAt = new Date(Date.now() - 120_000).toISOString();
  assert.equal((await resendApprovalEmail(1)).emailSent, true);
  assert.equal(state.emails.length, 2);
  assert.match(requests[0].key, /^approval-2-/);
  assert.match(requests[0].payload.text, /Skolas piekļuves kods: ABCDEFGH/);
  assert.equal(state.schools[0].accessCodeHash, await accessCodeHash('ABCDEFGH'));
});

test('recently sent messages and duplicate approvals do not rotate codes or send again', async () => {
  state.emails[0].status = 'sent';
  state.emails[0].sentAt = new Date().toISOString();
  await assert.rejects(resendApprovalEmail(1), /pēc minūtes/);
  await assert.rejects(approveSchool(1), /jau ir apstiprināta/);
  assert.equal(state.emails.length, 1);
  assert.equal(requests.length, 0);
  assert.equal(state.schools[0].accessCodeHash, await accessCodeHash('ABCDEFGH'));
});

test('an obsolete code is never emailed or silently replaced', async () => {
  const currentHash = await accessCodeHash('HGFEDCBA');
  state.schools[0].accessCodeHash = currentHash;
  await assert.rejects(resendApprovalEmail(1), /kods nav pieejams/);
  assert.equal(state.schools[0].accessCodeHash, currentHash);
  assert.equal(requests.length, 0);
});
