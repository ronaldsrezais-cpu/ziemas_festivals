import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { getDb } from "@/db";
import { safetyDocuments } from "@/db/schema";
import { getSession } from "@/lib/security";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["school", "admin"].includes(session.role)) return new Response("Nav atļauts.", { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response("Fails nav atrasts.", { status: 404 });
  const [file] = await getDb().select().from(safetyDocuments).where(eq(safetyDocuments.id, id)).limit(1);
  if (!file || (session.role === "school" && file.schoolId !== session.subjectId)) return new Response("Fails nav atrasts.", { status: 404 });
  try {
    const object = await get(file.objectKey, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN?.trim() });
    if (!object || object.statusCode !== 200) return new Response("Fails nav atrasts.", { status: 404 });
    return new Response(object.stream, { headers: { "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Neizdevās atvērt failu. Mēģiniet vēlreiz.", { status: 502 }); }
}
