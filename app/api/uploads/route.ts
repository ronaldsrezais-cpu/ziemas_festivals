import { desc, eq } from "drizzle-orm";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getDb } from "@/db";
import { judges, uploads } from "@/db/schema";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";

const resultContentTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/tab-separated-values",
  "text/plain",
  "application/octet-stream",
];

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await getSession("judge");
        if (!session) throw new Error("Nav atļauts.");
        const [judge] = await getDb().select().from(judges).where(eq(judges.id, session.subjectId)).limit(1);
        if (!judge) throw new Error("Tiesnesis nav atrasts.");
        if (!pathname.startsWith(`results/${judge.sportId}/`)) throw new Error("Nederīgs faila ceļš.");
        return {
          allowedContentTypes: resultContentTypes,
          maximumSizeInBytes: 12 * 1024 * 1024,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ judgeId: judge.id, sportId: judge.sportId }),
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Augšupielāde neizdevās." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession("judge");
  if (!session) return Response.json({ error: "Nav atļauts." }, { status: 401 });
  const db = getDb();
  const [judge] = await db.select().from(judges).where(eq(judges.id, session.subjectId)).limit(1);
  if (!judge) return Response.json({ error: "Tiesnesis nav atrasts." }, { status: 404 });
  const body = await request.json() as { url?: string; fileName?: string; mimeType?: string };
  if (!body.url || !body.fileName) return Response.json({ error: "Trūkst faila datu." }, { status: 400 });
  let url: URL;
  try { url = new URL(body.url); } catch { return Response.json({ error: "Nederīga faila adrese." }, { status: 400 }); }
  if (!url.hostname.endsWith(".private.blob.vercel-storage.com") || !url.pathname.includes(`/results/${judge.sportId}/`)) {
    return Response.json({ error: "Fails nepieder šim sporta veidam." }, { status: 400 });
  }
  const mimeType = body.mimeType || "application/octet-stream";
  if (!resultContentTypes.includes(mimeType)) return Response.json({ error: "Faila tips nav atļauts." }, { status: 400 });
  const [upload] = await db.insert(uploads).values({
    sportId: judge.sportId,
    fileName: body.fileName.slice(0, 255),
    objectKey: body.url,
    mimeType,
    createdByJudgeId: judge.id,
  }).returning();
  return Response.json({ upload }, { status: 201 });
}

export async function GET() {
  const session = await getSession("judge");
  if (!session) return Response.json({ error: "Nav atļauts." }, { status: 401 });
  const [judge] = await getDb().select().from(judges).where(eq(judges.id, session.subjectId)).limit(1);
  if (!judge) return Response.json({ error: "Tiesnesis nav atrasts." }, { status: 404 });
  return Response.json({ uploads: await getDb().select().from(uploads).where(eq(uploads.sportId, judge.sportId)).orderBy(desc(uploads.createdAt)) });
}
