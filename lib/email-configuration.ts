import { z } from "zod";
import { runtimeEnv } from "@/lib/runtime";

export function emailConfiguration() {
  const env = runtimeEnv();
  const key = env.RESEND_API_KEY?.trim() ?? "";
  const rawSender = env.EMAIL_FROM?.trim() ?? "";
  const match = rawSender.match(/^(?:[^<>\r\n]+\s*)?<([^<>\s]+)>$/);
  const address = match?.[1] ?? rawSender;
  const senderValid = !/[\r\n]/.test(rawSender) && z.string().email().safeParse(address).success;
  const keyPresent = Boolean(key);
  const keyFormatValid = /^re_[A-Za-z0-9_-]{8,}$/.test(key);
  return { keyPresent, keyFormatValid, senderValid, senderAddress: senderValid ? address : "",
    readyToTest: keyFormatValid && senderValid };
}

export type EmailConfiguration = ReturnType<typeof emailConfiguration>;
export type EmailCheck = { level: "success" | "warning" | "error"; message: string };

export function configurationProblem() {
  const config = emailConfiguration();
  if (!config.keyPresent) return "Vercel iestatījumos nav aizpildīts RESEND_API_KEY. Ievadiet Resend atslēgu Production videi un veiciet Redeploy.";
  if (!config.keyFormatValid) return "RESEND_API_KEY formāts nav derīgs. Ievadiet tikai atslēgas vērtību, kas sākas ar re_, bez nosaukuma un pēdiņām, un veiciet Redeploy.";
  if (!config.senderValid) return "Vercel mainīgajā EMAIL_FROM norādiet Ziemas festivāls <ziemasfestivals@lsfp.lv> un veiciet Redeploy.";
  return null;
}

export async function checkEmailConfiguration(): Promise<EmailCheck> {
  const problem = configurationProblem();
  if (problem) return { level: "error", message: problem };
  const domain = emailConfiguration().senderAddress.split("@")[1].toLowerCase();
  try {
    // Send-only keys may deliberately have no permission to list domains.
    // That is an unknown verification state, not evidence that sending fails.
    let after = "";
    for (let page = 0; page < 3; page++) {
      const response = await fetch(`https://api.resend.com/domains?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`, {
        headers: { Authorization: `Bearer ${runtimeEnv().RESEND_API_KEY?.trim()}` },
        signal: AbortSignal.timeout(10_000), cache: "no-store",
      });
      if (response.status === 403) return { level: "warning", message: "Ar šo atslēgu nevar nolasīt Resend domēnus. Tā var būt paredzēta tikai sūtīšanai. Pārbaudiet domēna statusu Resend vai nosūtiet izmēģinājuma vēstuli." };
      if (!response.ok) return { level: "error", message: response.status === 401 ? "Resend noraida API atslēgu. Pārbaudiet RESEND_API_KEY un veiciet Redeploy." : `Resend pārbaude neizdevās (HTTP ${response.status}). Mēģiniet vēlāk.` };
      const body = await response.json() as { data?: Array<{ id: string; name: string; status: string; capabilities?: { sending?: string } }>; has_more?: boolean };
      const found = body.data?.find(item => item.name.toLowerCase() === domain);
      if (found) return found.status === "verified" && found.capabilities?.sending !== "disabled"
        ? { level: "success", message: `${domain} ir apstiprināts Resend, un sūtīšana ir atļauta. Tagad nosūtiet izmēģinājumu, lai pārbaudītu arī piegādi.` }
        : { level: "warning", message: `${domain} vēl nav gatavs sūtīšanai (Resend statuss: ${found.status}). Atveriet Resend domēna iestatījumus un pabeidziet pārbaudi.` };
      if (!body.has_more || !body.data?.length) return { level: "warning", message: `Sūtītāja domēns ${domain} šajā Resend kontā nav atrasts. Pārbaudiet domēnu un API atslēgas kontu.` };
      after = body.data[body.data.length - 1].id;
    }
    return { level: "warning", message: "Domēnu saraksts ir pārāk liels automātiskai pārbaudei. Pārbaudiet sūtītāja domēnu Resend kontā." };
  } catch { return { level: "error", message: "Neizdevās sazināties ar Resend. Mēģiniet vēlreiz." }; }
}
