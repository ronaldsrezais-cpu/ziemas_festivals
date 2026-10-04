import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { withTransaction } from "@/db/transaction";
import { judges, sessions } from "@/db/schema";
import { hashSecret } from "@/lib/security";

export const judgePasswordSchema = z.string()
  .min(6, "Parolē ievadiet vismaz 6 rakstzīmes.")
  .max(128, "Parole drīkst būt līdz 128 rakstzīmēm.")
  .refine(value => value.trim().length >= 6, "Parolē ievadiet vismaz 6 rakstzīmes, neskaitot atstarpes malās.");

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reset-password"), judgeId: z.number().int().positive(), password: judgePasswordSchema }),
  z.object({ action: z.literal("delete"), judgeId: z.number().int().positive(), confirmation: z.string().trim() }),
]);

export class JudgeAccessError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function manageJudgeAccess(actor: { role: string } | null, payload: unknown) {
  if (!actor) throw new JudgeAccessError("Nepieciešams pieslēgties administratora sadaļai.", 401);
  if (actor.role !== "admin") throw new JudgeAccessError("Nepieciešama administratora piekļuve.", 403);
  const input = requestSchema.parse(payload);
  const passwordHash = input.action === "reset-password" ? await hashSecret(input.password) : null;

  try {
    return await withTransaction(async tx => {
      const [judge] = await tx.select().from(judges).where(eq(judges.id, input.judgeId)).for("update");
      if (!judge) throw new JudgeAccessError("Tiesnesis nav atrasts. Atjaunojiet sarakstu.", 404);
      if (input.action === "delete" && input.confirmation !== judge.fullName)
        throw new JudgeAccessError("Dzēšanai precīzi ievadiet tiesneša vārdu un uzvārdu.");
      if (input.action === "reset-password") {
        if (!judge.active) throw new JudgeAccessError("Tiesneša piekļuve nav aktīva.", 403);
        await tx.update(judges).set({ passwordHash: passwordHash! }).where(eq(judges.id, judge.id));
      }
      await tx.delete(sessions).where(and(eq(sessions.role, "judge"), eq(sessions.subjectId, judge.id)));
      if (input.action === "delete") {
        // Existing foreign keys clear attribution, preserving results and uploaded files.
        await tx.delete(judges).where(eq(judges.id, judge.id));
      }
      return { ok: true };
    });
  } catch (error) {
    if (error instanceof JudgeAccessError) throw error;
    throw new JudgeAccessError("Neizdevās saglabāt tiesneša piekļuves izmaiņas. Mēģiniet vēlreiz.", 503);
  }
}
