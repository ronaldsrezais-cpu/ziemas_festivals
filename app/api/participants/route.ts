import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, entries, judges, participants, schools, sports } from "@/db/schema";
import { getSession } from "@/lib/security";
import { filterParticipants, type ListedParticipant } from "@/lib/participant-list";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "judge")) {
    return Response.json({ error: "Nepieciešama administratora vai tiesneša piekļuve." }, { status: 401 });
  }
  const db = getDb();
  let judgeSportId: number | undefined;
  if (session.role === "judge") {
    const [judge] = await db.select({ sportId: judges.sportId }).from(judges)
      .where(and(eq(judges.id, session.subjectId), eq(judges.active, true))).limit(1);
    if (!judge) return Response.json({ error: "Tiesneša piekļuve nav aktīva." }, { status: 403 });
    judgeSportId = judge.sportId;
  }
  // Scope is derived exclusively from the authenticated judge, never from URL parameters.
  const registrations = await db.select({
    id: entries.id, participantId: entries.participantId,
    sportId: sports.id, sportName: sports.name, categoryId: categories.id,
    categoryName: categories.name, discipline: categories.discipline, teamName: entries.teamName,
  }).from(entries).innerJoin(categories, eq(entries.categoryId, categories.id))
    .innerJoin(sports, eq(categories.sportId, sports.id))
    .where(judgeSportId === undefined ? undefined : and(eq(sports.id, judgeSportId), eq(categories.active, true)))
    .orderBy(asc(sports.sortOrder), asc(categories.sortOrder), asc(entries.id));
  const participantIds = [...new Set(registrations.map((entry) => entry.participantId))];
  const people = judgeSportId !== undefined && participantIds.length === 0 ? [] : await db.select({
    id: participants.id, firstName: participants.firstName, lastName: participants.lastName,
    birthYear: participants.birthYear, gender: participants.gender, schoolId: schools.id,
    schoolName: schools.name, municipality: schools.municipality, schoolStatus: schools.status,
  }).from(participants).innerJoin(schools, eq(participants.schoolId, schools.id))
    .where(and(eq(participants.active, true), judgeSportId === undefined ? undefined : and(
      eq(schools.status, "approved"), inArray(participants.id, participantIds))))
    .orderBy(asc(schools.name), asc(participants.lastName), asc(participants.firstName), asc(participants.id));
  const byParticipant = new Map<number, ListedParticipant["registrations"]>();
  for (const { participantId, ...entry } of registrations) {
    const list = byParticipant.get(participantId) ?? [];
    list.push(entry); byParticipant.set(participantId, list);
  }
  const rows = people.map((person) => ({ ...person, registrations: byParticipant.get(person.id) ?? [] }));
  const query = new URL(request.url).searchParams;
  const filtered = filterParticipants(rows, {
    school: query.get("school") ?? "", sport: query.get("sport") ?? "",
    category: query.get("category") ?? "", search: query.get("search") ?? "",
  });
  const headers = { "Cache-Control": "private, no-store" };
  if (query.get("format") === "xlsx") {
    const { participantWorkbook } = await import("@/lib/participant-workbook");
    const workbook = participantWorkbook(filtered);
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), { headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dalibnieki-${session.role}-${new Date().toISOString().slice(0,10)}.xlsx"`,
    } });
  }
  return Response.json({ participants: filtered }, { headers });
}
