import { z } from "zod";
import { getSession } from "@/lib/security";
import { sameOrigin } from "@/lib/request-origin";
import { JudgeAccessError, manageJudgeAccess } from "@/lib/judge-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!sameOrigin(request)) return Response.json({ error: "Nav atļauts." }, { status: 403, headers });
  try {
    const actor = await getSession();
    if (!actor || actor.role !== "admin")
      return Response.json({ error: "Nepieciešama administratora piekļuve." }, { status: actor ? 403 : 401, headers });
    return Response.json(await manageJudgeAccess(actor, await request.json()), { headers });
  } catch (error) {
    const status = error instanceof JudgeAccessError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503;
    const message = error instanceof JudgeAccessError ? error.message : error instanceof z.ZodError
      ? error.issues[0]?.message : error instanceof SyntaxError ? "Nederīgs pieprasījums." : "Neizdevās saglabāt tiesneša piekļuves izmaiņas.";
    return Response.json({ error: message }, { status, headers });
  }
}
