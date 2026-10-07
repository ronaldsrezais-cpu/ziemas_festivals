import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { judges } from "@/db/schema";
import { getSession } from "@/lib/security";

export async function activeJudge() {
  const session = await getSession("judge");
  if (!session) return null;
  const [judge] = await getDb().select().from(judges).where(and(eq(judges.id, session.subjectId), eq(judges.active, true))).limit(1);
  return judge ?? null;
}
