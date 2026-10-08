import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sports, startProtocols } from "@/db/schema";

import { startProtocolsPublic } from "@/lib/start-protocol-visibility";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!await startProtocolsPublic()) return Response.json({ visible: false, protocols: [] }, { headers: { "Cache-Control": "no-store" } });
  const db = getDb();
  const [rows, sportRows] = await Promise.all([
    db.select().from(startProtocols).where(eq(startProtocols.published, true)).orderBy(desc(startProtocols.publishedAt)),
    db.select().from(sports),
  ]);
  return Response.json({ visible: true, protocols: rows.map(({ id, sportId, fileName, publishedAt }) => ({
    id, sportId, fileName, publishedAt, sportName: sportRows.find(sport => sport.id === sportId)?.name ?? "Sporta veids",
  })) }, { headers: { "Cache-Control": "no-store" } });
}
