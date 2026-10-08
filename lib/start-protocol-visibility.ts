import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";

export async function startProtocolsPublic() {
  const [setting] = await getDb().select().from(settings)
    .where(eq(settings.key, "start_protocols_public")).limit(1);
  return setting?.value !== "false";
}
