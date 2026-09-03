import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { getDb } from "@/db";
import { uploads } from "@/db/schema";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return new Response("Fails nav atrasts.", { status: 404 });
  const [file] = await getDb().select().from(uploads).where(eq(uploads.id, id)).limit(1);
  if (!file || file.status !== "published") return new Response("Fails nav publicēts.", { status: 404 });
  const object = await get(file.objectKey, { access: "private" });
  if (!object || object.statusCode !== 200) return new Response("Fails nav atrasts.", { status: 404 });
  return new Response(object.stream, {
    headers: {
      "Content-Type": object.blob.contentType || file.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
