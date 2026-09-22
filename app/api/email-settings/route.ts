import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { getSession } from "@/lib/security";
import { EMAIL_TEMPLATE_KEY, emailTemplateSchema, readEmailTemplate } from "@/lib/email-template";
import { checkEmailConfiguration, emailConfiguration } from "@/lib/email-configuration";
import { checkEmailDelivery, sendTestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save-template"), template: emailTemplateSchema }),
  z.object({ action: z.literal("check-configuration") }),
  z.object({ action: z.literal("send-test"), template: emailTemplateSchema, recipient: z.string().trim().email().max(254) }),
  z.object({ action: z.literal("check-delivery"), mailId: z.number().int().positive() }),
]);

export async function GET() {
  if (!await getSession("admin")) return Response.json({ error: "Nav atļauts." }, { status: 401, headers });
  const [row] = await getDb().select().from(settings).where(eq(settings.key, EMAIL_TEMPLATE_KEY)).limit(1);
  return Response.json({ template: readEmailTemplate(row?.value), configuration: emailConfiguration() }, { headers });
}

export async function POST(request: Request) {
  if (!await getSession("admin")) return Response.json({ error: "Nav atļauts." }, { status: 401, headers });
  // JSON requests and a same-origin check also prevent cross-site form posts.
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "Nepareizs pieprasījuma formāts." }, { status: 415, headers });
  const origin = request.headers.get("origin");
  if (origin) {
    // Next.js can expose an internal URL behind a proxy. The incoming Host
    // identifies the actual site; browsers cannot override this header.
    const host = request.headers.get("host") ?? new URL(request.url).host;
    try {
      if (new URL(origin).host !== host) return Response.json({ error: "Nav atļauts." }, { status: 403, headers });
    } catch { return Response.json({ error: "Nav atļauts." }, { status: 403, headers }); }
  }
  let raw;
  try { raw = await request.json(); }
  catch { return Response.json({ error: "Neizdevās nolasīt datus." }, { status: 400, headers }); }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Pārbaudiet aizpildītos laukus, e-pasta adresi un teksta garumu. Atļautie mainīgie: {{skola}} un {{skolotajs}}." }, { status: 400, headers });
  const data = parsed.data;
  try {
    if (data.action === "save-template") {
      const value = JSON.stringify(data.template);
      await getDb().insert(settings).values({ key: EMAIL_TEMPLATE_KEY, value })
        .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date().toISOString() } });
      return Response.json({ ok: true, template: data.template }, { headers });
    }
    if (data.action === "check-configuration")
      return Response.json({ ...await checkEmailConfiguration(), configuration: emailConfiguration() }, { headers });
    if (data.action === "check-delivery") return Response.json(await checkEmailDelivery(data.mailId), { headers });
    return Response.json(await sendTestEmail(data.template, data.recipient), { headers });
  } catch (reason) {
    // Only deliberate user-facing messages are exposed, never SQL/provider details.
    const message = reason instanceof Error ? reason.message : "";
    const expected = /^(Izmēģinājumu var|Vercel |RESEND_API_KEY |Pārbaudiet RESEND_API_KEY|Šai vēstulei nav)/.test(message);
    return Response.json({ error: expected ? message : "Neizdevās saglabāt vai nosūtīt. Mēģiniet vēlreiz." }, { status: 400, headers });
  }
}
