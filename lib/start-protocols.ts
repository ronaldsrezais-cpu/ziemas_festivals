import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { withTransaction } from "@/db/transaction";
import { emailOutbox, judges, settings, sports, startProtocols } from "@/db/schema";
import { sportParticipation } from "@/lib/sport-schools";
import { EMAIL_TEMPLATE_KEY, readEmailTemplate } from "@/lib/email-template";
import { protocolEmail } from "@/lib/start-protocol-email";
import { attemptProtocolEmail } from "@/lib/email";

export async function publishStartProtocol(judgeId: number, protocolId: number) {
  return withTransaction(async tx => {
    const [judge] = await tx.select().from(judges).where(and(eq(judges.id, judgeId), eq(judges.active, true))).for("share");
    if (!judge) throw new Error("Tiesneša piekļuve nav aktīva.");
    const [protocol] = await tx.select().from(startProtocols).where(and(eq(startProtocols.id, protocolId), eq(startProtocols.sportId, judge.sportId))).for("update");
    if (!protocol) throw new Error("Starta protokols nav atrasts.");
    // Publication and its recipient snapshot commit together. Repeated clicks
    // and retries never create new notifications for the same publication.
    if (protocol.published) return;
    const scope = await sportParticipation(tx, judge.sportId);
    const [sport] = await tx.select().from(sports).where(eq(sports.id, judge.sportId));
    const [setting] = await tx.select().from(settings).where(eq(settings.key, EMAIL_TEMPLATE_KEY));
    const template = readEmailTemplate(setting?.value);
    for (const school of scope.schools) {
      await tx.insert(emailOutbox).values({ kind: "start_protocol", startProtocolId: protocol.id, schoolId: school.id, recipient: school.email,
        ...protocolEmail(template, { schoolName: school.name, sportName: sport.name, fileName: protocol.fileName, protocolId: protocol.id }) });
    }
    await tx.update(startProtocols).set({ published: true, publishedAt: new Date().toISOString() }).where(eq(startProtocols.id, protocol.id));
  });
}

// A bounded, awaited pass fits the serverless request. The client continues
// passes while open; durable pending messages remain explicitly retryable.
export async function sendProtocolNotifications(protocolId: number) {
  const db = getDb();
  const rows = await db.select().from(emailOutbox).where(and(eq(emailOutbox.startProtocolId, protocolId), eq(emailOutbox.kind, "start_protocol"))).orderBy(asc(emailOutbox.id));
  const deadline = Date.now() + 35_000;
  let attempted = 0;
  let error: string | null = null;
  for (const mail of rows.filter(row => row.status !== "sent")) {
    if (attempted >= 20 || Date.now() >= deadline) break;
    const result = await attemptProtocolEmail(mail.id);
    attempted++;
    if (!result.sent) { error = result.error; break; }
    await new Promise(resolve => setTimeout(resolve, 550));
  }
  const current = await db.select().from(emailOutbox).where(eq(emailOutbox.startProtocolId, protocolId));
  const remaining = current.filter(mail => mail.status !== "sent").length;
  return { total: current.length, sent: current.length - remaining, remaining, error, continueSending: remaining > 0 && !error };
}
