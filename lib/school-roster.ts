import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { withTransaction, type Transaction } from "@/db/transaction";
import { categories, entries, leaders, participants, results, schools, settings, sports } from "@/db/schema";
import { rosterReadiness } from "./roster-readiness";
import { numberedTeam } from "./team-registration";

export const participantSchema = z.object({
  id: z.number().int().positive().optional(),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(100),
  birthYear: z.number().int().min(2000).max(2030),
  gender: z.enum(["F", "M"]),
  registrations: z.array(z.object({
    categoryId: z.number().int().positive(),
    teamNumber: z.number().int().positive().optional(),
    teamName: z.string().trim().max(80).optional(),
  })).min(1).refine(items => new Set(items.map(item => item.categoryId)).size === items.length,
    "Vienu kategoriju vienam dalībniekam drīkst izvēlēties tikai vienu reizi."),
});

export type ParticipantInput = z.infer<typeof participantSchema>;

async function validateRegistrations(tx: Transaction, input: ParticipantInput, schoolId: number) {
  const ids = input.registrations.map(registration => registration.categoryId);
  const rows = await tx.select({ category: categories, sportMode: sports.mode })
    .from(categories).innerJoin(sports, eq(categories.sportId, sports.id))
    .where(and(inArray(categories.id, ids), eq(categories.active, true)));
  if (rows.length !== ids.length) throw new Error("Kāda no izvēlētajām disciplīnām nav pieejama.");
  const existing = await tx.select().from(entries)
    .where(and(eq(entries.schoolId, schoolId), inArray(entries.categoryId, ids)));
  const otherEntries = existing.filter(entry => entry.participantId !== input.id);
  for (const { category, sportMode } of rows) {
    if (input.birthYear < category.minBirthYear || input.birthYear > category.maxBirthYear)
      throw new Error(`${category.name}: dzimšanas gads neatbilst kategorijai.`);
    if (category.gender !== "X" && category.gender !== input.gender)
      throw new Error(`${category.name}: dzimums neatbilst kategorijai.`);
    const registration = input.registrations.find(item => item.categoryId === category.id)!;
    const categoryEntries = otherEntries.filter(entry => entry.categoryId === category.id);
    if (sportMode === "team") {
      const previous = existing.find(entry => entry.participantId === input.id && entry.categoryId === category.id);
      registration.teamName = numberedTeam(existing.filter(entry => entry.categoryId === category.id), registration.teamNumber, previous?.teamName);
      if (categoryEntries.filter(entry => entry.teamName === registration.teamName).length >= category.teamMax)
        throw new Error(`${category.name}: komandā drīkst būt ne vairāk kā ${category.teamMax} dalībnieki.`);
      const teams = new Set(categoryEntries.map(entry => entry.teamName).filter(Boolean));
      teams.add(registration.teamName);
      if (category.schoolLimit && teams.size > category.schoolLimit)
        throw new Error(`${category.name}: skola drīkst pieteikt ne vairāk kā ${category.schoolLimit} komandas.`);
    } else {
      registration.teamName = "";
      if (category.schoolLimit && categoryEntries.length >= category.schoolLimit)
        throw new Error(`${category.name}: skola drīkst pieteikt ne vairāk kā ${category.schoolLimit} dalībniekus.`);
    }
  }
}

async function saveParticipant(tx: Transaction, schoolId: number, data: ParticipantInput) {
  let participantId = data.id;
  if (participantId) {
    const [person] = await tx.select().from(participants).where(and(
      eq(participants.id, participantId), eq(participants.schoolId, schoolId), eq(participants.active, true),
    ));
    if (!person) throw new Error("Dalībnieks nav atrasts.");
  }
  // Lock before checking results: a concurrent judge save must finish first or
  // wait until this edit commits. Retained entries keep their original IDs.
  const previous = participantId ? await tx.select().from(entries)
    .where(and(eq(entries.participantId, participantId), eq(entries.schoolId, schoolId))).for("update") : [];
  const scoredRows = previous.length ? await tx.select({ entryId: results.entryId }).from(results)
    .where(inArray(results.entryId, previous.map(entry => entry.id))) : [];
  const scoredIds = new Set(scoredRows.map(row => row.entryId));
  await validateRegistrations(tx, data, schoolId);
  for (const entry of previous) {
    const next = data.registrations.find(registration => registration.categoryId === entry.categoryId);
    if (scoredIds.has(entry.id) && (!next || (next.teamName || null) !== entry.teamName))
      throw new Error("Disciplīnu vai komandu ar ievadītu rezultātu nevar mainīt vai noņemt. Sazinieties ar organizatoru.");
  }
  const details = { firstName: data.firstName, lastName: data.lastName, birthYear: data.birthYear, gender: data.gender };
  if (participantId) {
    await tx.update(participants).set(details).where(eq(participants.id, participantId));
  } else {
    const [person] = await tx.insert(participants).values({ schoolId, ...details }).returning({ id: participants.id });
    participantId = person.id;
  }
  const wantedCategories = new Set(data.registrations.map(registration => registration.categoryId));
  const removedIds = previous.filter(entry => !wantedCategories.has(entry.categoryId)).map(entry => entry.id);
  if (removedIds.length) await tx.delete(entries).where(inArray(entries.id, removedIds));
  for (const registration of data.registrations) {
    const existing = previous.find(entry => entry.categoryId === registration.categoryId);
    const teamName = registration.teamName || null;
    if (existing) {
      if (existing.teamName !== teamName)
        await tx.update(entries).set({ teamName }).where(eq(entries.id, existing.id));
    } else {
      await tx.insert(entries).values({ schoolId, participantId, categoryId: registration.categoryId, teamName });
    }
  }
  return { ok: true, participantId };
}

async function deleteParticipant(tx: Transaction, schoolId: number, participantId: number) {
  const [person] = await tx.select({ id: participants.id }).from(participants)
    .where(and(eq(participants.id, participantId), eq(participants.schoolId, schoolId), eq(participants.active, true)));
  if (!person) throw new Error("Dalībnieks nav atrasts.");
  const registrations = await tx.select({ id: entries.id }).from(entries)
    .where(and(eq(entries.participantId, participantId), eq(entries.schoolId, schoolId))).for("update");
  if (registrations.length) {
    const [result] = await tx.select({ id: results.id }).from(results)
      .where(inArray(results.entryId, registrations.map(entry => entry.id))).limit(1);
    if (result) throw new Error("Dalībnieku ar ievadītu rezultātu nevar noņemt. Sazinieties ar organizatoru.");
    await tx.delete(entries).where(inArray(entries.id, registrations.map(entry => entry.id)));
  }
  await tx.update(participants).set({ active: false }).where(eq(participants.id, participantId));
  return { ok: true };
}

export async function mutateSchoolRoster(schoolId: number, action: string, payload: Record<string, unknown>) {
  return withTransaction(async tx => {
    // Share-lock the switch so closing registration cannot race a roster write.
    const [editing] = await tx.select().from(settings).where(eq(settings.key, "roster_editing_open")).for("share");
    if (editing?.value === "false") throw new Error("Komandas sastāva pievienošana un labošana ir slēgta. Sazinieties ar organizatoru.");
    const [school] = await tx.select().from(schools).where(eq(schools.id, schoolId)).for("update");
    if (!school || school.status !== "approved") throw new Error("Skolas pieteikums nav apstiprināts.");

    if (action === "submit-roster") {
      const people = await tx.select({ id: participants.id }).from(participants)
        .where(and(eq(participants.schoolId, schoolId), eq(participants.active, true)));
      const teamLeaders = await tx.select({ id: leaders.id }).from(leaders).where(eq(leaders.schoolId, schoolId));
      const registrations = await tx.select({ participantId: entries.participantId }).from(entries).where(eq(entries.schoolId, schoolId));
      const registered = new Set(registrations.map(entry => entry.participantId));
      const readiness = rosterReadiness(people.length, teamLeaders.length, school.rosterSubmittedAt,
        people.filter(person => !registered.has(person.id)).length);
      if (!readiness.canSubmit) throw new Error(readiness.issues.join(" "));
      const submittedAt = school.rosterSubmittedAt ?? new Date().toISOString();
      await tx.update(schools).set({ rosterSubmittedAt: submittedAt }).where(eq(schools.id, schoolId));
      return { ok: true, submittedAt };
    }

    let response: Record<string, unknown>;
    if (action === "save-participant") {
      response = await saveParticipant(tx, schoolId, participantSchema.parse(payload));
    } else if (action === "delete-participant") {
      response = await deleteParticipant(tx, schoolId, z.number().int().positive().parse(payload.participantId));
    } else if (action === "add-leader") {
      const data = z.object({
        fullName: z.string().trim().min(3).max(180), role: z.string().trim().min(2).max(120),
        email: z.string().trim().email().optional().or(z.literal("")), phone: z.string().trim().max(40).optional(),
      }).parse(payload);
      const [leader] = await tx.insert(leaders).values({ schoolId, ...data }).returning();
      response = { leader };
    } else if (action === "delete-leader") {
      const leaderId = z.number().int().positive().parse(payload.leaderId);
      const removed = await tx.delete(leaders).where(and(eq(leaders.id, leaderId), eq(leaders.schoolId, schoolId))).returning({ id: leaders.id });
      if (!removed.length) throw new Error("Vadītājs nav atrasts.");
      response = { ok: true };
    } else {
      throw new Error("Nezināma darbība.");
    }
    // Any successful roster change requires the school to confirm it again.
    await tx.update(schools).set({ rosterSubmittedAt: null, rosterRevision: sql`${schools.rosterRevision} + 1` }).where(eq(schools.id, schoolId));
    return response;
  });
}
