import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { withTransaction, type Transaction } from "@/db/transaction";
import { emailOutbox, schools, settings } from "@/db/schema";
import { runtimeEnv } from "@/lib/runtime";
import { accessCodeHash, createAccessCode, sha256 } from "@/lib/security";
import { recoverSchoolAccessCode } from "@/lib/school-access-code";
import { deliveryLabels } from "@/lib/email-status";
import { configurationProblem, emailConfiguration, type EmailCheck } from "@/lib/email-configuration";
import { EMAIL_TEMPLATE_KEY, readEmailTemplate, renderApprovalEmail, sampleEmailContext, type EmailTemplate } from "@/lib/email-template";

function snapshot(template: EmailTemplate, context: Parameters<typeof renderApprovalEmail>[1]) {
  const rendered = renderApprovalEmail(template, context);
  const config = emailConfiguration();
  const displayName = template.senderName.replace(/[\\"]/g, character => `\\${character}`);
  return { subject: rendered.subject, body: rendered.text, html: rendered.html,
    sender: config.senderValid ? `"${displayName}" <${config.senderAddress}>` : null,
    replyTo: template.replyTo };
}

async function approvalSnapshot(tx: Transaction, school: typeof schools.$inferSelect, code: string) {
  const [row] = await tx.select().from(settings).where(eq(settings.key, EMAIL_TEMPLATE_KEY)).limit(1);
  return snapshot(readEmailTemplate(row?.value), { schoolName: school.name, teacherName: school.teacherName, code });
}

async function queueApproval(tx: Transaction, school: typeof schools.$inferSelect, code: string) {
  const [mail] = await tx.insert(emailOutbox).values({ schoolId: school.id, recipient: school.email,
    ...await approvalSnapshot(tx, school, code) }).returning();
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
    if (latest && latest.status !== "sent" && latest.recipient === school.email) {
      // Never change a payload after a provider attempt: its retry must stay
      // identical even if the administrator has since edited the template.
      if (latest.status === "queued" && latest.attemptCount === 0) {
        await tx.update(emailOutbox).set(await approvalSnapshot(tx, school, code)).where(and(
          eq(emailOutbox.id, latest.id), eq(emailOutbox.status, "queued"), eq(emailOutbox.attemptCount, 0)));
      }
      return latest.id;
    }
    return (await queueApproval(tx, school, code)).id;
  });
  const email = await attemptApprovalEmail(mailId);
  return { ok: true, emailSent: email.sent, emailStatus: email.status, emailError: email.error };
}

export async function attemptApprovalEmail(mailId: number) {
  return attemptEmail(mailId, false);
}

async function attemptEmail(mailId: number, allowTest: boolean) {
  const db = getDb();
  const runtime = runtimeEnv();
  const [mail] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, mailId)).limit(1);
  if (!mail) throw new Error("E-pasts nav atrasts.");
  if (mail.schoolId !== null || !allowTest) {
    const [school] = mail.schoolId ? await db.select().from(schools).where(eq(schools.id, mail.schoolId)).limit(1) : [];
    if (!school || school.status !== "approved" || !await recoverSchoolAccessCode(mail.body, school.accessCodeHash, accessCodeHash))
      throw new Error("Šī vēstule vairs neatbilst apstiprinātās skolas piekļuves kodam.");
  }
  const problem = configurationProblem();
  if (problem) {
    await db.update(emailOutbox).set({ status: "queued", error: problem }).where(and(eq(emailOutbox.id, mailId), inArray(emailOutbox.status, ["queued", "failed"])));
    return { sent: false, status: "queued" as const, error: problem };
  }
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 300_000).toISOString();
  const [claimed] = await db.update(emailOutbox).set({ status: "sending", error: null, lastAttemptAt: now,
    sender: mail.sender ?? runtime.EMAIL_FROM!.trim(),
    attemptCount: sql`${emailOutbox.attemptCount} + 1` }).where(and(eq(emailOutbox.id, mailId), or(
      inArray(emailOutbox.status, ["queued", "failed"]),
      and(eq(emailOutbox.status, "sending"), lt(emailOutbox.lastAttemptAt, stale)),
    ))).returning();
  if (!claimed) return { sent: mail.status === "sent", status: mail.status, error: "E-pasts jau tiek nosūtīts vai ir nosūtīts. Atjaunojiet sarakstu." };
  let failure = "Neizdevās sazināties ar e-pasta pakalpojumu. Mēģiniet atkārtoti.";
  try {
    const payload = { from: claimed.sender, to: [claimed.recipient], subject: claimed.subject, text: claimed.body,
      ...(claimed.html ? { html: claimed.html } : {}), ...(claimed.replyTo ? { reply_to: claimed.replyTo } : {}) };
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${runtime.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json",
        "Idempotency-Key": `approval-${claimed.id}-${await sha256(JSON.stringify(payload))}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      failure = response.status === 429 ? "Sasniegts Resend sūtīšanas limits. Mēģiniet vēlāk."
        : [401, 403].includes(response.status) ? "Resend neatļauj nosūtīšanu. Pārbaudiet API atslēgu un sūtītāja domēna apstiprinājumu."
        : `Resend noraidīja vēstuli (HTTP ${response.status}). Pārbaudiet sūtītāja un saņēmēja adresi.`;
      throw new Error(failure);
    }
    const receipt = await response.json() as { id?: string };
    if (!receipt.id || !/^[a-zA-Z0-9_-]{1,100}$/.test(receipt.id)) throw new Error("Invalid receipt");
    await db.update(emailOutbox).set({ status: "sent", sentAt: new Date().toISOString(), error: null,
      providerId: receipt.id }).where(eq(emailOutbox.id, mailId));
    return { sent: true, status: "sent" as const, error: null };
  } catch {
    await db.update(emailOutbox).set({ status: "failed", error: failure }).where(eq(emailOutbox.id, mailId));
    return { sent: false, status: "failed" as const, error: failure };
  }
}

export async function sendTestEmail(template: EmailTemplate, recipient: string) {
  const problem = configurationProblem();
  if (problem) throw new Error(problem);
  const mailId = await withTransaction(async tx => {
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const [permit] = await tx.insert(settings).values({ key: "email_test_last_sent", value: now, updatedAt: now })
      .onConflictDoUpdate({ target: settings.key, set: { value: now, updatedAt: now }, setWhere: lt(settings.updatedAt, cutoff) }).returning();
    if (!permit) throw new Error("Izmēģinājumu var nosūtīt reizi minūtē. Uzgaidiet un mēģiniet vēlreiz.");
    const content = snapshot(template, sampleEmailContext);
    const [mail] = await tx.insert(emailOutbox).values({ schoolId: null, recipient, ...content,
      subject: `[IZMĒĢINĀJUMS] ${content.subject}` }).returning();
    return mail.id;
  });
  return { ...await attemptEmail(mailId, true), mailId };
}


export async function checkEmailDelivery(mailId: number): Promise<EmailCheck> {
  const db = getDb();
  const [mail] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, mailId)).limit(1);
  if (!mail?.providerId) throw new Error("Šai vēstulei nav piegādes pārbaudes identifikatora. Tas tiek saglabāts jaunām nosūtītām vēstulēm.");
  if (!emailConfiguration().keyFormatValid) throw new Error("Pārbaudiet RESEND_API_KEY Vercel iestatījumos.");
  try {
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(mail.providerId)}`, {
      headers: { Authorization: `Bearer ${runtimeEnv().RESEND_API_KEY!.trim()}` }, signal: AbortSignal.timeout(10_000), cache: "no-store",
    });
    if (response.status === 403) return { level: "warning", message: "Atslēgai nav tiesību nolasīt piegādes datus. Vēstules statusu skatiet Resend sadaļā Emails; saņēmējs var pārbaudīt arī nevēlamā pasta mapi." };
    if (!response.ok) return { level: "error", message: `Piegādes pārbaude neizdevās (HTTP ${response.status}). Mēģiniet vēlāk vai skatiet Resend.` };
    const data = await response.json() as { last_event?: string };
    const status = data.last_event;
    if (!status || !Object.hasOwn(deliveryLabels, status)) return { level: "warning", message: "Resend vēl nav zināms piegādes statuss. Atkārtojiet pārbaudi vēlāk." };
    await db.update(emailOutbox).set({ deliveryStatus: status }).where(eq(emailOutbox.id, mailId));
    return { level: ["delivered", "opened", "clicked"].includes(status) ? "success" : "warning", message: deliveryLabels[status] + "." };
  } catch { return { level: "error", message: "Neizdevās pārbaudīt piegādi. Mēģiniet vēlreiz." }; }
}
