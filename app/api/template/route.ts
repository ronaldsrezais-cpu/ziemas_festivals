import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { get, put } from "@vercel/blob";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession("admin");
  if (!session) return Response.json({ error: "Nav atļauts." }, { status: 401 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Fails nav pievienots." }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "Akreditācijas fonam nepieciešams attēla fails." }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return Response.json({ error: "Fails pārsniedz 4 MB." }, { status: 400 });
  const key = `templates/accreditation-${Date.now()}-${crypto.randomUUID()}`;
  const blob = await put(key, file, { access: "private", contentType: file.type, addRandomSuffix: false });
  await getDb().insert(settings).values({ key: "accreditation_template_key", value: blob.url }).onConflictDoUpdate({ target: settings.key, set: { value: blob.url, updatedAt: new Date().toISOString() } });
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  const session = await getSession("admin");
  if (!session) return new Response("Nav atļauts.", { status: 401 });
  const side = new URL(request.url).searchParams.get("side") === "back" ? "back" : "front";
  const headers = new Headers({ "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  async function sampleTemplate() {
    const file = await readFile(path.join(process.cwd(), "assets", "accreditation", `${side}.jpg`));
    return new Response(new Uint8Array(file), { headers });
  }
  if (side === "back") return sampleTemplate();
  const [row] = await getDb().select().from(settings).where(eq(settings.key, "accreditation_template_key")).limit(1);
  if (!row) return sampleTemplate();
  const object = await get(row.value, { access: "private" });
  if (!object || object.statusCode !== 200) return sampleTemplate();
  headers.set("Content-Type", object.blob.contentType || "image/jpeg");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.stream, { headers });
}
