export const SAFETY_MAX_BYTES = 12 * 1024 * 1024;
export const safetyContentTypes = ["application/pdf", "application/octet-stream", "application/zip", "application/vnd.etsi.asic-e+zip", "application/vnd.etsi.asic-s+zip"];

export function safetyExtension(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension !== "pdf" && extension !== "edoc") throw new Error("Atļauti tikai PDF un EDOC faili.");
  return extension;
}

export function validSafetyPath(path: string, schoolId: number, revision: number) {
  return new RegExp(`^safety/${schoolId}/${revision}/[a-f0-9-]{36}\\.(pdf|edoc)$`).test(path);
}

export function safetyStatus(document: { rosterRevision: number } | null | undefined, revision: number) {
  return !document ? "missing" : document.rosterRevision === revision ? "submitted" : "outdated";
}
