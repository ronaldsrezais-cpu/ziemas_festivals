import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { getDb } from "@/db";
import { startProtocols } from "@/db/schema";
import { activeJudge } from "@/lib/active-judge";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response("Nav atrasts", { status: 404 });
  const [protocol] = await getDb().select().from(startProtocols).where(eq(startProtocols.id, id)).limit(1);
  if (!protocol) return new Response("Nav atrasts", { status: 404 });
  if (!protocol.published && !await getSession("admin")) {
    const judge = await activeJudge();
    if (!judge || judge.sportId !== protocol.sportId) return new Response("Nav atļauts", { status: 403 });
  }
  try {
    const object = await get(protocol.objectKey, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN?.trim() });
    if (!object || object.statusCode !== 200) return new Response("Fails nav pieejams", { status: 404 });
    const name = encodeURIComponent(protocol.fileName).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(object.stream, { headers: { "Content-Type": protocol.mimeType,
      "Content-Disposition": `${protocol.mimeType === "application/pdf" ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Fails pašlaik nav pieejams", { status: 503 }); }
}
