import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resetEmailState, state, accessCodeHash } from './email-test-db.mjs';

const adapter = new URL('./email-test-db.mjs', import.meta.url).href;
const dependencies = new Set(['drizzle-orm', '@/db', '@/db/transaction', '@/db/schema', '@/lib/runtime', '@/lib/security']);
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (dependencies.has(specifier)) return { url: adapter, shortCircuit: true };
  if (specifier.startsWith('@/lib/')) return {
    url: new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, shortCircuit: true,
  };
  return next(specifier, context);
} });
const { resendApprovalEmail, approveSchool, sendTestEmail, checkEmailDelivery, attemptApprovalEmail } = await import('../lib/email.ts');
const { defaultEmailTemplate } = await import('../lib/email-template.ts');
const { checkEmailConfiguration, emailConfiguration } = await import('../lib/email-configuration.ts');
const emailApi = await import('../app/api/email-settings/route.ts');
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


test('edited template uses HTML and personalized text while keeping the real access code recoverable', async () => {
  state.settings = [{ key: 'approval_email_template', value: JSON.stringify({ ...defaultEmailTemplate, heading: 'Sveiki, {{skola}}!', subject: 'Dalība: {{skola}}' }) }];
  await resendApprovalEmail(1);
  assert.match(requests[0].payload.html, /Sveiki, Testa skola!/);
  assert.match(requests[0].payload.text, /Testa skolotāja/);
  assert.equal(requests[0].payload.subject, 'Dalība: Testa skola');
  assert.equal(requests[0].payload.reply_to, 'ziemasfestivals@lsfp.lv');
  assert.equal(state.emails[0].providerId, 'mock-email');
  assert.equal(state.emails[0].deliveryStatus, undefined);
});

test('changing saved design and sender never changes a failed request snapshot', async () => {
  status = 500;
  await resendApprovalEmail(1);
  state.settings = [{ key: 'approval_email_template', value: JSON.stringify({ ...defaultEmailTemplate, subject: 'Jauns temats', accentColor: '#ff4a4a' }) }];
  state.env.EMAIL_FROM = 'Another <other@example.test>';
  status = 200;
  await resendApprovalEmail(1);
  assert.deepEqual(requests[0], requests[1]);
});

test('legacy attempted plaintext email retries without adding HTML or reply-to', async () => {
  state.emails[0].status = 'failed'; state.emails[0].attemptCount = 1;
  await resendApprovalEmail(1);
  assert.equal(requests[0].payload.html, undefined);
  assert.equal(requests[0].payload.reply_to, undefined);
  assert.equal(requests[0].payload.text, 'Labdien!\nSkolas piekļuves kods: ABCDEFGH\n');
});

test('test email uses only sample data, and concurrent requests send once', async () => {
  const schoolsBefore = structuredClone(state.schools);
  const outcomes = await Promise.allSettled([sendTestEmail(defaultEmailTemplate, 'admin@example.test'), sendTestEmail(defaultEmailTemplate, 'admin@example.test')]);
  assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(requests.length, 1);
  assert.match(requests[0].payload.subject, /^\[IZMĒĢINĀJUMS\]/);
  assert.match(requests[0].payload.text, /Skolas piekļuves kods: PARAUGS/);
  assert.doesNotMatch(requests[0].payload.text, /ABCDEFGH|Testa skola/);
  assert.deepEqual(state.schools, schoolsBefore);
  assert.equal(state.emails[1].schoolId, null);
  await assert.rejects(attemptApprovalEmail(state.emails[1].id), /neatbilst/);
});

test('configuration hides credentials and treats send-only domain access as unknown', async () => {
  const config = emailConfiguration();
  assert.equal(config.readyToTest, true);
  assert.doesNotMatch(JSON.stringify(config), /re_unit_test_only/);
  globalThis.fetch = async () => Response.json({ name: 'restricted_api_key' }, { status: 401 });
  assert.equal((await checkEmailConfiguration()).level, 'warning');
  globalThis.fetch = async () => Response.json({ data: [{ name: 'example.test', status: 'verified', capabilities: { sending: 'enabled' } }] });
  assert.equal((await checkEmailConfiguration()).level, 'success');
  state.env.EMAIL_FROM = 'Invalid\r\nBcc: another@example.test';
  assert.equal(emailConfiguration().readyToTest, false);
  assert.equal((await checkEmailConfiguration()).level, 'error');
});

for (const scenario of [
  { status: 401, name: 'restricted_api_key', level: 'warning', domainMessage: /tikai sūtīšanai/, deliveryMessage: /Emails/ },
  { status: 403, name: 'invalid_permission', level: 'warning', domainMessage: /tiesību/, deliveryMessage: /Emails/ },
  { status: 401, name: 'validation_error', level: 'error', domainMessage: /RESEND_API_KEY/, deliveryMessage: /RESEND_API_KEY/ },
  { status: 403, name: 'restricted_api_key', level: 'error', domainMessage: /nav aktīva/, deliveryMessage: /nav aktīva/ },
  { status: 403, name: 'suspended_api_key', level: 'error', domainMessage: /apturēta/, deliveryMessage: /apturēta/ },
  { status: 403, name: 'unknown_error', level: 'error', domainMessage: /HTTP 403/, deliveryMessage: /HTTP 403/ },
]) {
  test(`read checks classify ${scenario.status} ${scenario.name} without sending or exposing credentials`, async () => {
    state.emails[0].providerId = 'mock-email'; state.emails[0].status = 'sent';
    state.emails[0].deliveryStatus = 'delivered';
    const before = structuredClone(state.emails);
    let reads = 0;
    globalThis.fetch = async (url, options) => {
      assert.equal(options.method, undefined);
      assert.ok(['https://api.resend.com/domains?limit=100', 'https://api.resend.com/emails/mock-email'].includes(url));
      reads++;
      return Response.json({ name: scenario.name, message: `Private: ${state.env.RESEND_API_KEY}` }, { status: scenario.status });
    };
    const configuration = await checkEmailConfiguration();
    const delivery = await checkEmailDelivery(1);
    assert.equal(configuration.level, scenario.level);
    assert.equal(delivery.level, scenario.level);
    assert.match(configuration.message, scenario.domainMessage);
    assert.match(delivery.message, scenario.deliveryMessage);
    assert.doesNotMatch(JSON.stringify({ configuration, delivery }), /Private:|re_unit_test_only/);
    assert.deepEqual(state.emails, before);
    assert.equal(reads, 2);
    assert.equal(requests.length, 0);
  });
}

test('unreadable provider errors remain safe errors instead of claiming successful verification', async () => {
  state.emails[0].providerId = 'mock-email';
  for (const body of ['not JSON: re_unit_test_only', 'null']) {
    globalThis.fetch = async () => new Response(body, { status: 503 });
    for (const result of [await checkEmailConfiguration(), await checkEmailDelivery(1)]) {
      assert.equal(result.level, 'error');
      assert.match(result.message, /HTTP 503/);
      assert.doesNotMatch(result.message, /re_unit_test_only/);
    }
  }
});

test('delivery is recorded only after provider retrieval and sends no email', async () => {
  state.emails[0].providerId = 'mock-email'; state.emails[0].status = 'sent';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails/mock-email');
    assert.equal(options.method, undefined);
    return Response.json({ last_event: 'delivered', html: 'private message' });
  };
  const result = await checkEmailDelivery(1);
  assert.equal(result.level, 'success');
  assert.equal(state.emails[0].deliveryStatus, 'delivered');
  assert.doesNotMatch(JSON.stringify(result), /private message/);
  assert.equal(requests.length, 0);
});

test('email settings and sending endpoints require an administrator', async () => {
  for (const role of [undefined, 'school', 'judge']) {
    state.session = role ? { role } : null;
    assert.equal((await emailApi.GET()).status, 401);
    const response = await emailApi.POST(new Request('https://festival.test/api/email-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send-test', template: defaultEmailTemplate, recipient: 'admin@example.test' }) }));
    assert.equal(response.status, 401);
  }
  assert.equal(requests.length, 0);
});

test('admin editor persists valid template, rejects unsafe input and cross-origin posts', async () => {
  state.session = { role: 'admin' };
  const makeRequest = (template, origin = 'https://festival.test') => new Request('https://festival.test/api/email-settings', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ action: 'save-template', template }) });
  assert.equal((await emailApi.POST(makeRequest({ ...defaultEmailTemplate, subject: 'Jauns temats' }))).status, 200);
  assert.equal((await (await emailApi.GET()).json()).template.subject, 'Jauns temats');
  assert.equal((await emailApi.POST(makeRequest({ ...defaultEmailTemplate, message: '{{slepena_vertiba}}' }))).status, 400);
  assert.equal((await emailApi.POST(makeRequest(defaultEmailTemplate, 'https://unrelated.test'))).status, 403);
  assert.equal(requests.length, 0);
});

test('same-site admin requests work when Next.js has an internal proxy URL', async () => {
  state.session = { role: 'admin' };
  const response = await emailApi.POST(new Request('http://localhost:3000/api/email-settings', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://festival.test', Host: 'festival.test' },
    body: JSON.stringify({ action: 'save-template', template: defaultEmailTemplate }),
  }));
  assert.equal(response.status, 200);
});
