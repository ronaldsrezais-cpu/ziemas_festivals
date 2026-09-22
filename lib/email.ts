import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { withTransaction, type Transaction } from "@/db/transaction";
import { emailOutbox, schools } from "@/db/schema";
import { runtimeEnv } from "@/lib/runtime";
import { accessCodeHash, createAccessCode, sha256 } from "@/lib/security";
import { recoverSchoolAccessCode } from "@/lib/school-access-code";

const approvalSubject = "Apstiprināta dalība Latvijas skolu Ziemas festivālā";
function approvalBody(schoolName: string, accessCode: string) {
  return ["Labdien!", "", `${schoolName} dalība Latvijas skolu Ziemas festivālā ir apstiprināta.`,
    `Skolas piekļuves kods: ${accessCode}`, "",
    "Ar šo kodu skolas sadaļā varēsiet pievienot un labot komandas vadītājus un dalībniekus."].join("\n");
}

async function queueApproval(tx: Transaction, school: typeof schools.$inferSelect, code: string) {
  const [mail] = await tx.insert(emailOutbox).values({ schoolId: school.id, recipient: school.email,
    subject: approvalSubject, body: approvalBody(school.name, code) }).returning();
  return mail;
}

export async function approveSchool(schoolId: number) {
  const queued = await withTransaction(async tx => {
    const [school] = await tx.select().from(schools).where(eq(schools.id, schoolId)).for("update");
    if (!school) throw new Error("Skola nav atrasta.");
    if (school.status === "approved") throw new Error("Skola jau ir apstiprināta. Lai nosūtītu esošo kodu, izmantojiet sadaļu “E-pasti”.");
    const code = createAccessCode();
    await tx.update(schools).set({ status: "approved", approvedAt: new Date().toISOString(),
      accessCodeHash: await accessCodeHash(code) }).where(eq(schools.id, schoolId));
    const mail = await queueApproval(tx, school, code);
    return { code, mailId: mail.id };
  });
  const email = await attemptApprovalEmail(queued.mailId);
  return { ok: true, code: queued.code, emailSent: email.sent, emailStatus: email.status, emailError: email.error };
}

export async function resendApprovalEmail(schoolId: number) {
  const mailId = await withTransaction(async tx => {
    const [school] = await tx.select().from(schools).where(eq(schools.id, schoolId)).for("update");
    if (!school || school.status !== "approved") throw new Error("E-pastu var nosūtīt tikai apstiprinātai skolai.");
    const [latest] = await tx.select().from(emailOutbox).where(eq(emailOutbox.schoolId, schoolId))
      .orderBy(desc(emailOutbox.id)).limit(1);
    const code = await recoverSchoolAccessCode(latest?.body, school.accessCodeHash, accessCodeHash);
    if (!code) throw new Error("Esošais piekļuves kods nav pieejams. E-pasts netika nosūtīts; kods nav mainīts.");
    if (latest?.status === "sending" && latest.lastAttemptAt && Date.now() - Date.parse(latest.lastAttemptAt) < 300_000)
      throw new Error("E-pasts jau tiek nosūtīts. Uzgaidiet un atjaunojiet sarakstu.");
    if (latest?.status === "sent" && latest.sentAt && Date.now() - Date.parse(latest.sentAt) < 60_000)
      throw new Error("E-pasts tikko nosūtīts. Atkārtoti varēsiet nosūtīt pēc minūtes.");
    // Retry an unfinished attempt using its stable request ID and identical body.
    // An intentional re-send of an accepted email is a new outbox item.
    if (latest && latest.status !== "sent" && latest.recipient === school.email) return latest.id;
    return (await queueApproval(tx, school, code)).id;
  });
  const email = await attemptApprovalEmail(mailId);
  return { ok: true, emailSent: email.sent, emailStatus: email.status, emailError: email.error };
}

export async function attemptApprovalEmail(mailId: number) {
  const db = getDb();
  const runtime = runtimeEnv();
  const [mail] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, mailId)).limit(1);
  if (!mail) throw new Error("E-pasts nav atrasts.");
  const [school] = mail.schoolId ? await db.select().from(schools).where(eq(schools.id, mail.schoolId)).limit(1) : [];
  if (!school || school.status !== "approved" || !await recoverSchoolAccessCode(mail.body, school.accessCodeHash, accessCodeHash))
    throw new Error("Šī vēstule vairs neatbilst apstiprinātās skolas piekļuves kodam.");
  if (!runtime.RESEND_API_KEY || !runtime.EMAIL_FROM) {
    const error = "E-pastu sūtīšana nav konfigurēta. Pēc pieslēgšanas nospiediet “Nosūtīt atkārtoti”.";
    await db.update(emailOutbox).set({ status: "queued", error }).where(and(eq(emailOutbox.id, mailId), inArray(emailOutbox.status, ["queued", "failed"])));
    return { sent: false, status: "queued" as const, error };
  }
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 300_000).toISOString();
  const [claimed] = await db.update(emailOutbox).set({ status: "sending", error: null, lastAttemptAt: now,
    attemptCount: sql`${emailOutbox.attemptCount} + 1` }).where(and(eq(emailOutbox.id, mailId), or(
      inArray(emailOutbox.status, ["queued", "failed"]),
      and(eq(emailOutbox.status, "sending"), lt(emailOutbox.lastAttemptAt, stale)),
    ))).returning();
  if (!claimed) return { sent: mail.status === "sent", status: mail.status, error: "E-pasts jau tiek nosūtīts vai ir nosūtīts. Atjaunojiet sarakstu." };
  let failure = "Neizdevās sazināties ar e-pasta pakalpojumu. Mēģiniet atkārtoti.";
  try {
    const payload = { from: runtime.EMAIL_FROM, to: [claimed.recipient], subject: claimed.subject, text: claimed.body };
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${runtime.RESEND_API_KEY}`, "Content-Type": "application/json",
        "Idempotency-Key": `approval-${claimed.id}-${await sha256(JSON.stringify(payload))}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      failure = response.status === 429 ? "Sasniegts Resend sūtīšanas limits. Mēģiniet vēlāk."
        : [401, 403].includes(response.status) ? "Resend neatļauj nosūtīšanu. Pārbaudiet API atslēgu un sūtītāja domēna apstiprinājumu."
        : `Resend noraidīja vēstuli (HTTP ${response.status}). Pārbaudiet sūtītāja un saņēmēja adresi.`;
      throw new Error(failure);
    }
    await db.update(emailOutbox).set({ status: "sent", sentAt: new Date().toISOString(), error: null }).where(eq(emailOutbox.id, mailId));
    return { sent: true, status: "sent" as const, error: null };
  } catch {
    await db.update(emailOutbox).set({ status: "failed", error: failure }).where(eq(emailOutbox.id, mailId));
    return { sent: false, status: "failed" as const, error: failure };
  }
}
