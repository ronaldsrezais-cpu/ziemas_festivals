import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { emailOutbox } from "@/db/schema";
import { runtimeEnv } from "@/lib/runtime";

export async function sendApprovalEmail(input: { schoolId: number; recipient: string; schoolName: string; accessCode: string }) {
  const subject = "Apstiprināta dalība Latvijas skolu Ziemas festivālā";
  const body = [
    "Labdien!",
    "",
    `${input.schoolName} dalība Latvijas skolu Ziemas festivālā ir apstiprināta.`,
    `Skolas piekļuves kods: ${input.accessCode}`,
    "",
    "Ar šo kodu skolas sadaļā varēsiet pievienot un labot komandas vadītājus un dalībniekus.",
  ].join("\n");
  const db = getDb();
  const [queued] = await db.insert(emailOutbox).values({ schoolId: input.schoolId, recipient: input.recipient, subject, body }).returning();
  const runtime = runtimeEnv();
  if (!runtime.RESEND_API_KEY || !runtime.EMAIL_FROM) return { sent: false, queuedId: queued.id };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${runtime.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: runtime.EMAIL_FROM, to: [input.recipient], subject, text: body }),
    });
    if (!response.ok) throw new Error(`E-pasta pakalpojums atbildēja ar ${response.status}`);
    await db.update(emailOutbox).set({ status: "sent", sentAt: new Date().toISOString() }).where(eq(emailOutbox.id, queued.id));
    return { sent: true, queuedId: queued.id };
  } catch (error) {
    await db.update(emailOutbox).set({ status: "failed", error: error instanceof Error ? error.message : "Nezināma kļūda" }).where(eq(emailOutbox.id, queued.id));
    return { sent: false, queuedId: queued.id };
  }
}
