import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { emailOutbox, schools, startProtocols } from "@/db/schema";
import { activeJudge } from "@/lib/active-judge";
import { publishStartProtocol, sendProtocolNotifications } from "@/lib/start-protocols";
import { sportParticipation } from "@/lib/sport-schools";
import { sameOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const judge = await activeJudge();
  if (!judge) return Response.json({ error: "Pieslēdzieties tiesneša sadaļai." }, { status: 401, headers });
  const db = getDb();
  const protocols = await db.select().from(startProtocols).where(eq(startProtocols.sportId, judge.sportId)).orderBy(desc(startProtocols.id));
  const mails = protocols.length ? await db.select().from(emailOutbox).where(inArray(emailOutbox.startProtocolId, protocols.map(protocol => protocol.id))) : [];
  const schoolRows = mails.length ? await db.select().from(schools).where(inArray(schools.id, mails.flatMap(mail => mail.schoolId ? [mail.schoolId] : []))) : [];
  const scope = await sportParticipation(db, judge.sportId);
  return Response.json({ recipientCount: scope.schools.length, protocols: protocols.map(({ id, fileName, published, createdAt, publishedAt }) => ({
    id, fileName, published, createdAt, publishedAt,
    notifications: mails.filter(mail => mail.startProtocolId === id).map(mail => ({
      id: mail.id, schoolName: schoolRows.find(school => school.id === mail.schoolId)?.name ?? "Skola",
      recipient: mail.recipient, status: mail.status, error: mail.error,
    })),
  })) }, { headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Nav atļauts." }, { status: 403, headers });
  const judge = await activeJudge();
  if (!judge) return Response.json({ error: "Pieslēdzieties tiesneša sadaļai." }, { status: 401, headers });
  const data = z.object({ action: z.enum(["publish", "send-pending"]), id: z.number().int().positive() }).safeParse(await request.json().catch(() => null));
  if (!data.success) return Response.json({ error: "Nepareizi dati." }, { status: 400, headers });
  const [protocol] = await getDb().select().from(startProtocols).where(eq(startProtocols.id, data.data.id)).limit(1);
  if (!protocol || protocol.sportId !== judge.sportId) return Response.json({ error: "Starta protokols nav atrasts." }, { status: 404, headers });
  try {
    if (data.data.action === "publish") await publishStartProtocol(judge.id, protocol.id);
    else if (!protocol.published) return Response.json({ error: "Vispirms publicējiet starta protokolu." }, { status: 400, headers });
    return Response.json({ ok: true, ...await sendProtocolNotifications(protocol.id) }, { headers });
  } catch { return Response.json({ error: "Neizdevās pabeigt darbību. Atjaunojiet sarakstu un pārbaudiet publicēšanas un paziņojumu statusu." }, { status: 400, headers }); }
}
