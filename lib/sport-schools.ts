import { and, eq, inArray } from "drizzle-orm";
import type { Transaction } from "@/db/transaction";
import { categories, entries, participants, schools } from "@/db/schema";

// Scope always comes from the authenticated judge's sport, not a client filter.
export async function sportParticipation(db: Pick<Transaction, "select">, sportId: number) {
  const categoryRows = await db.select().from(categories).where(and(eq(categories.sportId, sportId), eq(categories.active, true)));
  const entryRows = categoryRows.length ? await db.select().from(entries).where(inArray(entries.categoryId, categoryRows.map(row => row.id))) : [];
  const people = entryRows.length ? await db.select().from(participants).where(and(eq(participants.active, true), inArray(participants.id, entryRows.map(row => row.participantId)))) : [];
  const activePeople = new Map(people.map(person => [person.id, person.schoolId]));
  const validEntries = entryRows.filter(entry => activePeople.get(entry.participantId) === entry.schoolId);
  const schoolRows = validEntries.length ? await db.select().from(schools).where(and(eq(schools.status, "approved"), inArray(schools.id, [...new Set(validEntries.map(entry => entry.schoolId))]))) : [];
  const approvedIds = new Set(schoolRows.map(school => school.id));
  return { categories: categoryRows, schools: schoolRows, entries: validEntries.filter(entry => approvedIds.has(entry.schoolId)) };
}
