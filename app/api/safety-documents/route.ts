import { eq } from "drizzle-orm";
import { del, head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { getDb } from "@/db";
import { withTransaction } from "@/db/transaction";
import { safetyDocuments, schools } from "@/db/schema";
import { getSession } from "@/lib/security";
import { sameOrigin } from "@/lib/request-origin";
import { SAFETY_MAX_BYTES, safetyContentTypes, safetyExtension, validSafetyPath } from "@/lib/safety-document";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Nav atļauts." }, { status: 403 });
  const session = await getSession("school");
  if (!session) return Response.json({ error: "Pieslēdzieties skolas sadaļai." }, { status: 401 });
  try {
    const [school] = await getDb().select().from(schools).where(eq(schools.id, session.subjectId)).limit(1);
    if (!school || school.status !== "approved") return Response.json({ error: "Skolas pieteikums nav apstiprināts." }, { status: 403 });
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({ body, request, token: process.env.BLOB_READ_WRITE_TOKEN?.trim(),
      onBeforeGenerateToken: async pathname => {
        if (!validSafetyPath(pathname, school.id, school.rosterRevision)) throw new Error("Invalid path");
        return { allowedContentTypes: safetyContentTypes, maximumSizeInBytes: SAFETY_MAX_BYTES,
          addRandomSuffix: false, allowOverwrite: false, validUntil: Date.now() + 10 * 60_000 };
      },
    });
    return Response.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Neizdevās sagatavot augšupielādi. Atjaunojiet lapu un mēģiniet vēlreiz." }, { status: 400 }); }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Nav atļauts." }, { status: 403 });
  const session = await getSession("school");
  if (!session) return Response.json({ error: "Pieslēdzieties skolas sadaļai." }, { status: 401 });
  try {
    const input = z.object({ url: z.string().url(), fileName: z.string().trim().min(1).max(255), revision: z.number().int().nonnegative() }).parse(await request.json());
    const extension = safetyExtension(input.fileName);
    const url = new URL(input.url);
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname) || url.search || url.hash || url.username || url.password ||
      !validSafetyPath(url.pathname.slice(1), session.subjectId, input.revision) || !url.pathname.endsWith(`.${extension}`))
      return Response.json({ error: "Fails nepieder šai skolai." }, { status: 400 });
    const object = await head(input.url, { token: process.env.BLOB_READ_WRITE_TOKEN?.trim() });
    if (object.size <= 0 || object.size > SAFETY_MAX_BYTES || !safetyContentTypes.includes(object.contentType))
      return Response.json({ error: "Atļauti PDF un EDOC faili līdz 12 MB." }, { status: 400 });
    const previousKey = await withTransaction(async tx => {
      const [school] = await tx.select().from(schools).where(eq(schools.id, session.subjectId)).for("update");
      if (!school || school.status !== "approved" || school.rosterRevision !== input.revision) throw new Error("Roster changed");
      const [previous] = await tx.select().from(safetyDocuments).where(eq(safetyDocuments.schoolId, school.id));
      const document = { schoolId: school.id, fileName: input.fileName, objectKey: input.url,
        mimeType: extension === "pdf" ? "application/pdf" : "application/vnd.etsi.asic-e+zip",
        size: object.size, rosterRevision: school.rosterRevision, createdAt: new Date().toISOString() };
      await tx.insert(safetyDocuments).values(document).onConflictDoUpdate({ target: safetyDocuments.schoolId, set: document });
      return previous?.objectKey;
    });
    // A failed cleanup must not turn a successful submission into an error.
    if (previousKey && previousKey !== input.url) await del(previousKey, { token: process.env.BLOB_READ_WRITE_TOKEN?.trim() }).catch(() => undefined);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Neizdevās iesniegt drošības lapu. Pārbaudiet failu un atjaunojiet lapu — iespējams, komandas sastāvs ir mainījies." }, { status: 400 }); }
}
