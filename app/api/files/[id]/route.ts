import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { getDb } from "@/db";
import { uploads, judges } from "@/db/schema";
import { getSession } from "@/lib/security";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return new Response("Fails nav atrasts.", { status: 404 });
  const [file] = await getDb().select().from(uploads).where(eq(uploads.id, id)).limit(1);
  if (!file) return new Response("Fails nav atrasts.", { status: 404 });
  if (file.status !== "published") {
    const session = await getSession();
    const [judge] = session?.role === "judge" ? await getDb().select().from(judges).where(eq(judges.id, session.subjectId)).limit(1) : [];
    if (session?.role !== "admin" && (!judge?.active || judge.sportId !== file.sportId)) return new Response("Fails nav publicēts.", { status: 404 });
  }
  const object = await get(file.objectKey, { access: "private" });
  if (!object || object.statusCode !== 200) return new Response("Fails nav atrasts.", { status: 404 });
  return new Response(object.stream, {
    headers: {
      "Content-Type": object.blob.contentType || file.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
