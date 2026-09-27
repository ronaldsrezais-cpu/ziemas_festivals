import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withTransaction } from "@/db/transaction";
import { schools } from "@/db/schema";

export const schoolNameSchema = z.string().trim()
  .min(2, "Skolas nosaukumā ievadiet vismaz 2 rakstzīmes.")
  .max(180, "Skolas nosaukums drīkst būt līdz 180 rakstzīmēm.");

export class SchoolNameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const duplicateMessage = "Šāds skolas nosaukums šajā novadā vai valstspilsētā jau ir reģistrēts.";

function uniqueViolation(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

export async function renameSchool(actor: { role: string; subjectId: number } | null, payload: unknown) {
  if (!actor) throw new SchoolNameError("Nepieciešams pieslēgties.", 401);
  if (actor.role !== "admin" && actor.role !== "school") throw new SchoolNameError("Nav atļauts.", 403);
  const input = z.object({
    schoolId: z.number().int().positive().optional(),
    name: schoolNameSchema,
    previousName: z.string().min(2).max(180),
  }).parse(payload);
  if (actor.role === "school" && input.schoolId !== undefined && input.schoolId !== actor.subjectId)
    throw new SchoolNameError("Varat labot tikai savas skolas nosaukumu.", 403);
  const schoolId = actor.role === "school" ? actor.subjectId : input.schoolId;
  if (!schoolId) throw new SchoolNameError("Izvēlieties skolu.");

  try {
    return await withTransaction(async tx => {
      const [school] = await tx.select().from(schools).where(eq(schools.id, schoolId)).for("update");
      if (!school) throw new SchoolNameError("Skola nav atrasta.", 404);
      if (actor.role === "school" && school.status !== "approved")
        throw new SchoolNameError("Skolas pieteikums nav apstiprināts.", 403);
      if (input.previousName !== school.name)
        throw new SchoolNameError("Skolas nosaukums jau ir mainīts. Atjaunojiet lapu un pārbaudiet pašreizējo nosaukumu.", 409);
      if (input.name === school.name) return { ok: true, name: school.name };
      const [duplicate] = await tx.select({ id: schools.id }).from(schools)
        .where(and(eq(schools.name, input.name), eq(schools.municipality, school.municipality))).limit(1);
      if (duplicate) throw new SchoolNameError(duplicateMessage, 409);
      // Printed safety sheets include the school name. Use the same row lock and
      // revision as roster edits so an earlier upload cannot be marked current.
      await tx.update(schools).set({ name: input.name, rosterRevision: sql`${schools.rosterRevision} + 1` })
        .where(eq(schools.id, school.id));
      return { ok: true, name: input.name };
    });
  } catch (error) {
    if (error instanceof SchoolNameError) throw error;
    if (uniqueViolation(error)) throw new SchoolNameError(duplicateMessage, 409);
    throw new SchoolNameError("Neizdevās saglabāt skolas nosaukumu. Mēģiniet vēlreiz.", 503);
  }
}
