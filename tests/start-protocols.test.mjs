import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { state, resetEmailState } from './email-test-db.mjs';
import { blobState, resetBlobs } from './safety-test-blob.mjs';

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (['drizzle-orm', '@/db', '@/db/transaction', '@/db/schema', '@/lib/security', '@/lib/runtime'].includes(specifier))
    return { url: new URL('./email-test-db.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('@vercel/blob')) return { url: new URL('./safety-test-blob.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('@/lib/')) return { url: new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const contactsApi = await import('../app/api/judge-contacts/route.ts');
const uploadApi = await import('../app/api/start-protocols/upload/route.ts');
const protocolsApi = await import('../app/api/start-protocols/route.ts');
const publicApi = await import('../app/api/start-protocols/public/route.ts');
const filesApi = await import('../app/api/start-protocols/[id]/route.ts');
const { publishStartProtocol, sendProtocolNotifications } = await import('../lib/start-protocols.ts');
const { attemptProtocolEmail, resendApprovalEmail } = await import('../lib/email.ts');
const { protocolEmail } = await import('../lib/start-protocol-email.ts');
const { defaultEmailTemplate } = await import('../lib/email-template.ts');
hooks.deregister();

const pathname = (sport = 1, judge = 1) => `start-protocols/${sport}/${judge}/00000000-0000-4000-8000-000000000001.pdf`;
const fileUrl = (sport = 1, judge = 1) => `https://fixture.private.blob.vercel-storage.com/${pathname(sport, judge)}`;
const request = (body, method = 'POST', origin = 'https://festival.test') => new Request('https://festival.test/api/start-protocols', {
  method, headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
});
const tokenRequest = (path = pathname()) => request({ type: 'blob.generate-client-token', payload: { pathname: path } });
const commit = (overrides = {}) => uploadApi.PUT(request({ url: fileUrl(), fileName: 'Starts.pdf', ...overrides }, 'PUT'));
const download = id => filesApi.GET(new Request('https://festival.test'), { params: Promise.resolve({ id: String(id) }) });
const originalFetch = globalThis.fetch;
let calls, providerStatus;
beforeEach(async () => {
  await resetEmailState(); resetBlobs(); calls = []; providerStatus = 200;
  state.session = { role: 'judge', subjectId: 1 };
  state.judges = [{ id: 1, sportId: 1, active: true }, { id: 2, sportId: 2, active: true }, { id: 3, sportId: 1, active: false }];
  state.sports = [{ id: 1, name: 'Slēpošana' }, { id: 2, name: 'Biatlons' }];
  state.categories = [
    { id: 11, sportId: 1, active: true, discipline: 'Sprints', name: 'A' },
    { id: 12, sportId: 1, active: true, discipline: 'Distance', name: 'B' },
    { id: 13, sportId: 1, active: false, discipline: 'Neaktīva', name: 'C' },
    { id: 21, sportId: 2, active: true, discipline: 'Sprints', name: 'D' },
  ];
  state.schools.push(...[2, 3, 4, 5, 6].map(id => ({ id, name: `Skola ${id}`, email: `school${id}@example.test`, status: id === 3 ? 'pending' : 'approved' })));
  state.participants = [1, 2, 3, 4, 5, 6].map(id => ({ id, schoolId: id, active: id !== 4 }));
  state.entries = [
    { id: 1, schoolId: 1, participantId: 1, categoryId: 11 },
    { id: 2, schoolId: 1, participantId: 1, categoryId: 12 },
    { id: 3, schoolId: 2, participantId: 2, categoryId: 21 },
    { id: 4, schoolId: 3, participantId: 3, categoryId: 11 },
    { id: 5, schoolId: 4, participantId: 4, categoryId: 11 },
    { id: 6, schoolId: 5, participantId: 5, categoryId: 12 },
    { id: 7, schoolId: 6, participantId: 6, categoryId: 13 },
  ];
  state.leaders = state.schools.map(school => ({ id: school.id, schoolId: school.id, fullName: `Vadītājs ${school.id}`, email: `leader${school.id}@example.test`, role: 'Vadītājs' }));
  state.protocols = [{ id: 1, sportId: 1, fileName: 'Starts.pdf', objectKey: fileUrl(), mimeType: 'application/pdf', published: false }];
  blobState.objects.set(fileUrl(), { url: fileUrl(), pathname: pathname(), size: 100, contentType: 'application/pdf' });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    calls.push({ key: options.headers['Idempotency-Key'], payload: JSON.parse(options.body) });
    return Response.json({ id: `fixture-${calls.length}` }, { status: providerStatus });
  };
});
afterEach(() => { globalThis.fetch = originalFetch; });

test('judge contacts include only approved schools with active participants in the judge sport', async () => {
  const response = await contactsApi.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const data = await response.json();
  assert.deepEqual(data.schools.map(school => school.id).sort(), [1, 5]);
  assert.deepEqual(data.schools.find(school => school.id === 1).categoryIds, [11, 12]);
  assert.deepEqual(data.schools.find(school => school.id === 5).categoryIds, [12]);
  assert.equal(data.schools[0].leaders.length, 1);
  assert.ok(!JSON.stringify(data).includes('accessCodeHash'));
  state.session.subjectId = 2;
  assert.deepEqual((await (await contactsApi.GET()).json()).schools.map(school => school.id), [2]);
});

test('anonymous, school and disabled judge sessions cannot read contacts or generate upload tokens', async () => {
  for (const session of [null, { role: 'school', subjectId: 1 }, { role: 'judge', subjectId: 3 }]) {
    state.session = session;
    assert.equal((await contactsApi.GET()).status, 401);
    assert.equal((await uploadApi.POST(tokenRequest())).status, 401);
    assert.equal((await protocolsApi.GET()).status, 401);
  }
});

test('upload tokens bind sport, judge, file type, size and immutable path', async () => {
  for (const path of [pathname(2), pathname(1, 2), pathname().replace('.pdf', '.html'), '../' + pathname()])
    assert.equal((await uploadApi.POST(tokenRequest(path))).status, 400);
  assert.equal((await uploadApi.POST(tokenRequest())).status, 200);
  assert.equal(blobState.policies[0].allowOverwrite, false);
  assert.equal(blobState.policies[0].maximumSizeInBytes, 12 * 1024 * 1024);
});

test('commit rejects foreign URLs, metadata mismatches, cross-site requests and invalid content', async () => {
  assert.equal((await uploadApi.PUT(request({}, 'PUT', 'https://attacker.test'))).status, 403);
  for (const url of [fileUrl(2), fileUrl(1, 2), fileUrl() + '?x=1', fileUrl().replace('https:', 'http:'), 'https://attacker.test/file.pdf'])
    assert.equal((await commit({ url })).status, 400);
  const valid = blobState.objects.get(fileUrl());
  for (const patch of [{ size: 0 }, { size: 12 * 1024 * 1024 + 1 }, { contentType: 'text/html' }, { url: fileUrl(2) }, { pathname: pathname(2) }]) {
    blobState.objects.set(fileUrl(), { ...valid, ...patch });
    assert.equal((await commit()).status, 400);
  }
});

test('committing an uploaded draft is idempotent and never publishes or sends mail', async () => {
  state.protocols = [];
  assert.equal((await commit()).status, 200);
  assert.equal((await commit()).status, 200);
  assert.equal(state.protocols.length, 1);
  assert.equal(state.protocols[0].published, false);
  assert.equal(state.emails.length, 1);
  assert.equal(calls.length, 0);
});

test('draft files are private; publication makes only the protocol downloadable publicly', async () => {
  state.session = null;
  assert.equal((await download(1)).status, 403);
  assert.equal(blobState.reads.length, 0);
  assert.deepEqual((await (await publicApi.GET()).json()).protocols, []);
  state.session = { role: 'judge', subjectId: 2 };
  assert.equal((await download(1)).status, 403);
  state.session.subjectId = 1;
  assert.equal((await download(1)).status, 200);
  await publishStartProtocol(1, 1);
  state.session = null;
  assert.equal((await download(1)).status, 200);
  const published = (await (await publicApi.GET()).json()).protocols;
  assert.equal(published.length, 1);
  assert.deepEqual(Object.keys(published[0]).sort(), ['fileName', 'id', 'publishedAt', 'sportId', 'sportName']);
  assert.equal(calls.length, 0);
});

test('concurrent publication snapshots recipients once, deduplicates schools, and does not queue unrelated schools', async () => {
  await assert.rejects(publishStartProtocol(2, 1), /nav atrasts/);
  await assert.rejects(publishStartProtocol(3, 1), /nav aktīva/);
  await Promise.all([publishStartProtocol(1, 1), publishStartProtocol(1, 1)]);
  const mails = state.emails.filter(mail => mail.kind === 'start_protocol');
  assert.equal(state.protocols[0].published, true);
  assert.deepEqual(mails.map(mail => mail.schoolId), [1, 5]);
  assert.deepEqual(mails.map(mail => mail.recipient), ['teacher@example.test', 'school5@example.test']);
  assert.ok(mails.every(mail => mail.body.includes('Slēpošana') && !mail.body.includes('ABCDEFGH')));
});

test('notification delivery is private per school, and repeated sends skip already sent mail', async () => {
  await publishStartProtocol(1, 1);
  const result = await sendProtocolNotifications(1);
  assert.equal(result.sent, 2);
  assert.equal(result.remaining, 0);
  await sendProtocolNotifications(1);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.payload.to.length === 1));
  assert.ok(calls.every(call => call.key.startsWith('start-protocol-')));
  assert.equal(state.emails[0].status, 'queued');
});

test('failed notification is saved and retried with the same payload and idempotency key', async () => {
  await publishStartProtocol(1, 1);
  providerStatus = 429;
  const failed = await sendProtocolNotifications(1);
  assert.equal(failed.remaining, 2);
  assert.equal(failed.continueSending, false);
  assert.match(failed.error, /limits/);
  providerStatus = 200;
  const mailId = state.emails.find(mail => mail.kind === 'start_protocol').id;
  const outcomes = await Promise.all([attemptProtocolEmail(mailId), attemptProtocolEmail(mailId)]);
  assert.ok(outcomes.some(outcome => outcome.sent));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
});

test('missing configuration leaves notifications queued and school approval recovery ignores protocol emails', async () => {
  await publishStartProtocol(1, 1);
  state.env.RESEND_API_KEY = '';
  const pending = await sendProtocolNotifications(1);
  assert.equal(pending.remaining, 2);
  assert.equal(pending.continueSending, false);
  assert.equal(calls.length, 0);
  state.env.RESEND_API_KEY = 're_unit_test_only';
  assert.equal((await resendApprovalEmail(1)).emailSent, true);
  assert.match(calls[0].payload.text, /Skolas piekļuves kods: ABCDEFGH/);
});

test('publication routes reject foreign sport, cross-site, and sending an unpublished file', async () => {
  assert.equal((await protocolsApi.POST(request({ action: 'publish', id: 1 }, 'POST', 'https://attacker.test'))).status, 403);
  state.session.subjectId = 2;
  assert.equal((await protocolsApi.POST(request({ action: 'publish', id: 1 }))).status, 404);
  state.session.subjectId = 1;
  assert.equal((await protocolsApi.POST(request({ action: 'send-pending', id: 1 }))).status, 400);
  assert.equal(calls.length, 0);
});

test('protocol mail escapes user content and uses a fixed public origin', () => {
  const mail = protocolEmail(defaultEmailTemplate, { schoolName: '<script>bad</script>', sportName: 'Slēpošana', fileName: '<img>.pdf', protocolId: 12 });
  assert.ok(!mail.html.includes('<script>'));
  assert.ok(!mail.html.includes('<img>.pdf'));
  assert.match(mail.body, /https:\/\/ziemas-festivals.vercel.app\/api\/start-protocols\/12/);
});

test('hidden public protocol section denies anonymous downloads but keeps staff access', async () => {
  state.protocols[0].published = true;
  state.settings.push({ key: 'start_protocols_public', value: 'false' });
  state.session = null;
  const response = await publicApi.GET();
  assert.deepEqual(await response.json(), { visible: false, protocols: [] });
  assert.equal((await download(1)).status, 403);
  state.session = { role: 'judge', subjectId: 1 };
  assert.equal((await download(1)).status, 200);
  state.session = { role: 'admin' };
  assert.equal((await download(1)).status, 200);
  state.settings = state.settings.filter(setting => setting.key !== 'start_protocols_public');
  state.session = null;
  const visible = await (await publicApi.GET()).json();
  assert.equal(visible.visible, true);
  assert.equal(visible.protocols.length, 1);
  assert.equal((await download(1)).status, 200);
});
