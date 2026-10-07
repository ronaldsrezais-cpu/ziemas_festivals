import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { leaders } from "@/db/schema";
import { activeJudge } from "@/lib/active-judge";
import { sportParticipation } from "@/lib/sport-schools";

export const dynamic = "force-dynamic";
export async function GET() {
  const judge = await activeJudge();
  if (!judge) return Response.json({ error: "Pieslēdzieties tiesneša sadaļai." }, { status: 401 });
  const db = getDb();
  const scope = await sportParticipation(db, judge.sportId);
  const leaderRows = scope.schools.length ? await db.select().from(leaders).where(inArray(leaders.schoolId, scope.schools.map(school => school.id))) : [];
  return Response.json({
    categories: scope.categories.map(({ id, name, discipline }) => ({ id, name, discipline })),
    schools: scope.schools.map(school => ({ id: school.id, name: school.name, municipality: school.municipality,
      categoryIds: [...new Set(scope.entries.filter(entry => entry.schoolId === school.id).map(entry => entry.categoryId))],
      leaders: leaderRows.filter(leader => leader.schoolId === school.id).map(({ id, fullName, role, email }) => ({ id, fullName, role, email })),
    })).sort((a, b) => a.name.localeCompare(b.name, "lv")),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
