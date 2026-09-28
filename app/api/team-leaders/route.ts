import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leaders, schools } from "@/db/schema";
import { getSession } from "@/lib/security";
import { filterTeamLeaders } from "@/lib/team-leader-list";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getSession("admin");
  if (!session) {
    return Response.json({ error: "Nepieciešama administratora piekļuve." }, { status: 401, headers });
  }
  const rows = await getDb().select({
    id: leaders.id, fullName: leaders.fullName, role: leaders.role,
    email: leaders.email, phone: leaders.phone, schoolId: schools.id,
    schoolName: schools.name, municipality: schools.municipality, schoolStatus: schools.status,
  }).from(leaders).innerJoin(schools, eq(leaders.schoolId, schools.id))
    .orderBy(asc(schools.name), asc(leaders.fullName), asc(leaders.id));
  const query = new URL(request.url).searchParams;
  const filtered = filterTeamLeaders(rows, {
    school: query.get("school") ?? "", search: query.get("search") ?? "",
  });
  const { teamLeaderWorkbook } = await import("@/lib/team-leader-workbook");
  const buffer = await teamLeaderWorkbook(filtered).xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), { headers: {
    ...headers,
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="komandu-vaditaji-${new Date().toISOString().slice(0, 10)}.xlsx"`,
  } });
}
