/** Classify read failures without returning the provider's potentially private message. */
export async function resendReadError(response: Response, resource: "domains" | "delivery"): Promise<{
  level: "warning" | "error"; message: string;
}> {
  const body: unknown = await response.json().catch(() => null);
  const name = body && typeof body === "object" && "name" in body ? body.name : undefined;

  // Resend uses the same name for two different conditions:
  // 401 restricted_api_key = send-only; 403 restricted_api_key = inactive key.
  // https://resend.com/docs/api-reference/errors
  const sendOnly = response.status === 401 && name === "restricted_api_key";
  const missingReadPermission = response.status === 403 && name === "invalid_permission";
  if (sendOnly || missingReadPermission) return { level: "warning", message: resource === "delivery"
    ? "Atslēgai nav tiesību nolasīt piegādes datus. Vēstules statusu skatiet Resend sadaļā Emails; saņēmējs var pārbaudīt arī nevēlamā pasta mapi."
    : sendOnly
      ? "Atslēga ir paredzēta tikai sūtīšanai, tāpēc domēna statusu ar to nevar nolasīt. Sūtīšanu pārbaudiet ar izmēģinājuma vēstuli; domēna statusu skatiet Resend sadaļā Domains."
      : "Atslēgai nav tiesību nolasīt Resend domēnus. Domēna statusu skatiet Resend sadaļā Domains, bet sūtīšanu pārbaudiet ar izmēģinājuma vēstuli." };
  if (response.status === 403 && name === "restricted_api_key") return { level: "error",
    message: "Resend atslēga nav aktīva. Pārbaudiet to Resend sadaļā API Keys. Ja izveidojat jaunu atslēgu, ievadiet to Vercel mainīgajā RESEND_API_KEY un veiciet Redeploy." };
  if (response.status === 403 && name === "suspended_api_key") return { level: "error",
    message: "Resend atslēgas darbība ir apturēta. Pārbaudiet Resend kontu un sazinieties ar Resend atbalstu." };
  if (response.status === 401) return { level: "error",
    message: "Resend neizdevās autentificēt pārbaudi. Pārbaudiet RESEND_API_KEY vērtību Vercel iestatījumos un pēc tās labošanas veiciet Redeploy." };
  if (response.status === 403) return { level: "error",
    message: "Resend neatļauj pārbaudi (HTTP 403). Pārbaudiet atslēgas tiesības Resend kontā." };
  return { level: "error", message: `${resource === "domains" ? "Resend pārbaude" : "Piegādes pārbaude"} neizdevās (HTTP ${response.status}). Mēģiniet vēlāk vai skatiet Resend.` };
}
