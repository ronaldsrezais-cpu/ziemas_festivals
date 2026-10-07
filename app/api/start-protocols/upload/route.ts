import { and, eq } from "drizzle-orm";
import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { withTransaction } from "@/db/transaction";
import { judges, startProtocols } from "@/db/schema";
import { activeJudge } from "@/lib/active-judge";
import { sameOrigin } from "@/lib/request-origin";
import { PROTOCOL_MAX_BYTES, protocolContentTypes, protocolExtension, protocolMimeTypes, validProtocolPath } from "@/lib/start-protocol-file";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Nav atļauts." }, { status: 403, headers });
  const judge = await activeJudge();
  if (!judge) return Response.json({ error: "Pieslēdzieties tiesneša sadaļai." }, { status: 401, headers });
  try {
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({ request, body, token: process.env.BLOB_READ_WRITE_TOKEN?.trim(),
      onBeforeGenerateToken: async pathname => {
        if (!validProtocolPath(pathname, judge.sportId, judge.id)) throw new Error("Invalid path");
        return { allowedContentTypes: protocolContentTypes, maximumSizeInBytes: PROTOCOL_MAX_BYTES,
          addRandomSuffix: false, allowOverwrite: false, validUntil: Date.now() + 10 * 60_000 };
      },
    });
    return Response.json(result, { headers });
  } catch { return Response.json({ error: "Neizdevās sagatavot augšupielādi. Pārbaudiet failu glabātuves iestatījumus." }, { status: 400, headers }); }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Nav atļauts." }, { status: 403, headers });
  const judge = await activeJudge();
  if (!judge) return Response.json({ error: "Pieslēdzieties tiesneša sadaļai." }, { status: 401, headers });
  try {
    const input = z.object({ url: z.string().url(), fileName: z.string().trim().min(1).max(255) }).parse(await request.json());
    const extension = protocolExtension(input.fileName);
    const url = new URL(input.url);
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname) || url.search || url.hash || url.username || url.password ||
      !validProtocolPath(url.pathname.slice(1), judge.sportId, judge.id) || !url.pathname.endsWith(`.${extension}`))
      return Response.json({ error: "Fails nepieder šim tiesnesim un sporta veidam." }, { status: 400, headers });
    const object = await head(input.url, { token: process.env.BLOB_READ_WRITE_TOKEN?.trim() });
    if (object.url !== input.url || object.pathname !== url.pathname.slice(1) || object.size <= 0 || object.size > PROTOCOL_MAX_BYTES ||
      ![protocolMimeTypes[extension], "application/octet-stream"].includes(object.contentType))
      return Response.json({ error: "Atļauti PDF, XLSX, XLS un CSV faili līdz 12 MB." }, { status: 400, headers });
    const protocol = await withTransaction(async tx => {
      const [currentJudge] = await tx.select().from(judges).where(and(eq(judges.id, judge.id), eq(judges.active, true))).for("update");
      if (!currentJudge || currentJudge.sportId !== judge.sportId) throw new Error("Judge changed");
      const [existing] = await tx.select().from(startProtocols).where(eq(startProtocols.objectKey, input.url));
      if (existing) return existing;
      const [created] = await tx.insert(startProtocols).values({ sportId: judge.sportId, createdByJudgeId: judge.id,
        fileName: input.fileName, objectKey: input.url, mimeType: protocolMimeTypes[extension] }).returning();
      return created;
    });
    return Response.json({ id: protocol.id }, { headers });
  } catch { return Response.json({ error: "Neizdevās saglabāt starta protokolu. Pārbaudiet failu un atjaunojiet lapu." }, { status: 400, headers }); }
}
