export const PROTOCOL_MAX_BYTES = 12 * 1024 * 1024;
export const protocolMimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
};
export const protocolContentTypes = [...Object.values(protocolMimeTypes), "application/octet-stream"];
export function protocolExtension(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (!Object.hasOwn(protocolMimeTypes, extension)) throw new Error("Atļauti PDF, XLSX, XLS un CSV faili līdz 12 MB.");
  return extension;
}
export function validProtocolPath(path: string, sportId: number, judgeId: number) {
  return new RegExp(`^start-protocols/${sportId}/${judgeId}/[a-f0-9-]{36}\\.(pdf|xlsx|xls|csv)$`).test(path);
}
