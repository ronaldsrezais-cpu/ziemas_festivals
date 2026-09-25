// Provider boundary for tests only; no real Blob credentials or network calls.
export const blobState = { objects: new Map(), deleted: [], reads: [], policies: [], failDelete: false };
export function resetBlobs() {
  blobState.objects.clear(); blobState.deleted = []; blobState.reads = []; blobState.policies = []; blobState.failDelete = false;
}
export async function head(url) {
  const object = blobState.objects.get(url);
  if (!object) throw new Error('Not found');
  return object;
}
export async function del(url) {
  if (blobState.failDelete) throw new Error('Provider unavailable');
  for (const key of Array.isArray(url) ? url : [url]) {
    blobState.deleted.push(key); blobState.objects.delete(key);
  }
}
export async function get(url) {
  blobState.reads.push(url);
  const object = blobState.objects.get(url);
  return object ? { statusCode: 200, blob: object, stream: new Response('test document').body } : null;
}
export async function handleUpload({ body, onBeforeGenerateToken }) {
  const policy = await onBeforeGenerateToken(body.payload.pathname);
  blobState.policies.push(policy);
  return { clientToken: 'unit-test-token' };
}
