// Only expose a code whose hash still matches the school's current login code.
export async function recoverSchoolAccessCode(
  body: string | undefined,
  expectedHash: string | null,
  hash: (code: string) => Promise<string>,
): Promise<string | null> {
  const code = body?.match(/^Skolas piekļuves kods:\s*([A-Z2-9]{8})\s*$/m)?.[1];
  if (!code || !expectedHash) return null;
  return await hash(code) === expectedHash ? code : null;
}
