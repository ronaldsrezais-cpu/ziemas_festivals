import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { state, resetEmailState } from './email-test-db.mjs';
import { blobState, resetBlobs } from './safety-test-blob.mjs';
import { SAFETY_MAX_BYTES, safetyStatus } from '../lib/safety-document.ts';

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (['drizzle-orm', '@/db', '@/db/transaction', '@/db/schema', '@/lib/security'].includes(specifier))
    return { url: new URL('./email-test-db.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('@vercel/blob'))
    return { url: new URL('./safety-test-blob.mjs', import.meta.url).href, shortCircuit: true };
  if (['@/lib/request-origin', '@/lib/safety-document'].includes(specifier))
    return { url: new URL('../lib/' + specifier.split('/').pop() + '.ts', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const { POST, PUT } = await import('../app/api/safety-documents/route.ts');
const { GET } = await import('../app/api/safety-documents/[id]/route.ts');
hooks.deregister();

const path = (schoolId = 1, revision = 0, extension = 'pdf') => `safety/${schoolId}/${revision}/00000000-0000-4000-8000-000000000001.${extension}`;
const url = (schoolId = 1, revision = 0, extension = 'pdf') => `https://fixture.private.blob.vercel-storage.com/${path(schoolId, revision, extension)}`;
const request = (method, body, origin = 'https://festival.test') => new Request('https://festival.test/api/safety-documents', {
  method, headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
});
const uploadRequest = (pathname = path()) => request('POST', { type: 'blob.generate-client-token', payload: { pathname } });
const commit = (overrides = {}) => PUT(request('PUT', { url: url(), fileName: 'Parakstīta lapa.pdf', revision: 0, ...overrides }));
const download = id => GET(new Request('https://festival.test'), { params: Promise.resolve({ id: String(id) }) });

beforeEach(async () => {
  await resetEmailState(); resetBlobs();
  state.session = { role: 'school', subjectId: 1 };
  blobState.objects.set(url(), { size: 100, contentType: 'application/pdf' });
});

test('only an approved school can create upload tokens', async () => {
  for (const role of [null, 'admin', 'judge']) {
    state.session = role ? { role, subjectId: 1 } : null;
    assert.equal((await POST(uploadRequest())).status, 401);
  }
  state.session = { role: 'school', subjectId: 1 };
  state.schools[0].status = 'pending';
  assert.equal((await POST(uploadRequest())).status, 403);
  assert.equal(blobState.policies.length, 0);
});

test('token is restricted to current school, roster revision, formats and size', async () => {
  for (const invalid of [path(2), path(1, 1), path(1, 0, 'exe'), '../' + path()])
    assert.equal((await POST(uploadRequest(invalid))).status, 400);
  assert.equal((await POST(uploadRequest())).status, 200);
  const policy = blobState.policies[0];
  assert.equal(policy.maximumSizeInBytes, SAFETY_MAX_BYTES);
  assert.equal(policy.allowOverwrite, false);
  assert.ok(policy.allowedContentTypes.includes('application/pdf'));
  assert.ok(policy.allowedContentTypes.includes('application/vnd.etsi.asic-e+zip'));
});

test('cross-site mutations and another school file are rejected before storage reads', async () => {
  assert.equal((await POST(request('POST', {}, 'https://attacker.test'))).status, 403);
  assert.equal((await PUT(request('PUT', {}, 'https://attacker.test'))).status, 403);
  for (const badUrl of [url(2), 'https://attacker.test/file.pdf', url() + '?x=1', url().replace('https:', 'http:')])
    assert.equal((await commit({ url: badUrl })).status, 400);
  assert.equal(state.documents.length, 0);
});

test('file commit rejects excessive size, empty files and unapproved content types', async () => {
  for (const object of [{ size: 0, contentType: 'application/pdf' }, { size: SAFETY_MAX_BYTES + 1, contentType: 'application/pdf' }, { size: 100, contentType: 'text/html' }]) {
    blobState.objects.set(url(), object);
    assert.equal((await commit()).status, 400);
  }
  assert.equal(state.documents.length, 0);
});

test('PDF and EDOC submissions replace the previous private document', async () => {
  assert.equal((await commit()).status, 200);
  assert.equal(state.documents.length, 1);
  const edoc = url(1, 0, 'edoc');
  blobState.objects.set(edoc, { size: 200, contentType: 'application/vnd.etsi.asic-e+zip' });
  assert.equal((await commit({ url: edoc, fileName: 'Drošības lapa.EDOC' })).status, 200);
  assert.equal(state.documents.length, 1);
  assert.equal(state.documents[0].objectKey, edoc);
  assert.deepEqual(blobState.deleted, [url()]);
});

test('roster changes mark a document outdated and reject a stale in-flight submission', async () => {
  assert.equal((await commit()).status, 200);
  state.schools[0].rosterRevision = 1;
  assert.equal(safetyStatus(state.documents[0], 1), 'outdated');
  assert.equal((await commit()).status, 400);
  assert.equal(state.documents[0].rosterRevision, 0);
});

test('school may submit the safety sheet after roster editing closes', async () => {
  state.settings = [{ key: 'roster_editing_open', value: 'false' }];
  assert.equal((await commit()).status, 200);
  assert.equal(safetyStatus(state.documents[0], 0), 'submitted');
});

test('private safety document download is restricted to its school and admin', async () => {
  await commit();
  const id = state.documents[0].id;
  for (const session of [null, { role: 'judge', subjectId: 1 }, { role: 'school', subjectId: 2 }]) {
    state.session = session;
    assert.ok([401, 404].includes((await download(id)).status));
  }
  assert.equal(blobState.reads.length, 0);
  for (const role of ['admin', 'school']) {
    state.session = { role, subjectId: 1 };
    const response = await download(id);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(await response.text(), 'test document');
  }
});
