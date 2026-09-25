import { and, eq, inArray } from "drizzle-orm";
import { del } from "@vercel/blob";
import { withTransaction } from "@/db/transaction";
import { categories, judges, results, safetyDocuments, schools, sessions, uploads } from "@/db/schema";

export async function deleteJudgeRecord(judgeId: number, kind: "result" | "upload", id: number) {
  return withTransaction(async tx => {
    const [judge] = await tx.select().from(judges).where(and(eq(judges.id, judgeId), eq(judges.active, true))).for("share");
    if (!judge) throw new Error("Tiesneša piekļuve nav aktīva.");
    if (kind === "result") {
      const rows = await tx.select({ id: categories.id }).from(categories).where(eq(categories.sportId, judge.sportId));
      if (!rows.length) throw new Error("Rezultāts nav atrasts.");
      const removed = await tx.delete(results).where(and(eq(results.id, id), inArray(results.categoryId, rows.map(row => row.id)))).returning({ id: results.id });
      if (!removed.length) throw new Error("Rezultāts nav pieejams šim tiesnesim.");
    } else {
      const [file] = await tx.select().from(uploads).where(and(eq(uploads.id, id), eq(uploads.sportId, judge.sportId))).for("update");
      if (!file) throw new Error("Fails nav pieejams šim tiesnesim.");
      try { await del(file.objectKey, { token: process.env.BLOB_READ_WRITE_TOKEN?.trim() }); }
      catch { throw new Error("Neizdevās izdzēst failu no glabātuves. Mēģiniet vēlreiz."); }
      // The foreign key clears source_upload_id; entered results stay intact.
      await tx.delete(uploads).where(eq(uploads.id, file.id));
    }
    return { ok: true };
  });
}

export async function deleteSchoolApplication(schoolId: number, confirmation: string) {
  return withTransaction(async tx => {
    const [school] = await tx.select().from(schools).where(eq(schools.id, schoolId)).for("update");
    if (!school || confirmation !== school.name) throw new Error("Dzēšanai precīzi ievadiet skolas nosaukumu.");
    const documents = await tx.select().from(safetyDocuments).where(eq(safetyDocuments.schoolId, schoolId));
    if (documents.length) {
      try { await del(documents.map(document => document.objectKey), { token: process.env.BLOB_READ_WRITE_TOKEN?.trim() }); }
      catch { throw new Error("Neizdevās izdzēst skolas drošības dokumentu. Mēģiniet vēlreiz."); }
    }
    await tx.delete(sessions).where(and(eq(sessions.role, "school"), eq(sessions.subjectId, schoolId)));
    // Foreign keys remove the school's participants, entries, results and emails.
    await tx.delete(schools).where(eq(schools.id, schoolId));
    return { ok: true };
  });
}
