"use client";

import { useState } from "react";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type OutboxItem = {
  id: number; schoolId: number | null; schoolName: string; recipient: string;
  status: string; error: string | null; createdAt: string; sentAt: string | null;
  lastAttemptAt: string | null; attemptCount: number; canRetry: boolean;
};

const statusLabels: Record<string, string> = {
  queued: "Gaida nosūtīšanu", sending: "Tiek nosūtīts", sent: "Nodots nosūtīšanai", failed: "Nosūtīšana neizdevās",
};

export function EmailOutbox({ items, configured, resend, refresh }: {
  items: OutboxItem[]; configured: boolean;
  resend: (schoolId: number) => Promise<{ emailSent: boolean; emailError?: string | null }>;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function retry(item: OutboxItem) {
    if (!item.schoolId) return;
    setBusy(item.id); setError(""); setNotice("");
    try {
      const result = await resend(item.schoolId);
      if (result.emailSent) setNotice(`Apstiprinājums nosūtīts uz ${item.recipient}. Skolas piekļuves kods nav mainīts.`);
      else setError(result.emailError ?? "E-pasts nav nosūtīts. Pārbaudiet sūtīšanas iestatījumus.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Neizdevās nosūtīt."); }
    finally { setBusy(null); }
  }
  return <section className="glass-panel rounded-3xl p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-black">Skolu apstiprinājuma e-pasti</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Katras skolas pēdējās vēstules statuss. “Nodots nosūtīšanai” nozīmē, ka Resend pieņēmis vēstuli; tas vēl neapstiprina piegādi saņēmēja pastkastē.</p>
        <p className="mt-1 text-sm text-muted-foreground">Gaidošās un neizdevušās vēstules nosūtiet ar pogu “Nosūtīt atkārtoti”. Piekļuves kods saglabājas.</p></div>
      <Button variant="outline" onClick={() => refresh().catch(() => setError("Neizdevās atjaunot sarakstu."))}><RefreshCw /> Atjaunot sarakstu</Button>
    </div>
    {!configured && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-amber-900">E-pastu sūtīšana vēl nav konfigurēta. Vēstules ir saglabātas; nosūtiet tās pēc e-pasta pieslēgšanas.</p>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="overflow-x-auto"><table className="data-table">
      <thead><tr><th>Skola / saņēmējs</th><th>Nosūtīšanas statuss</th><th>Pēdējais mēģinājums</th><th>Darbība</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}>
        <td><strong>{item.schoolName}</strong><div className="break-all text-sm">{item.recipient}</div></td>
        <td><span className={item.status === "failed" ? "font-bold text-red-800" : "font-bold"}>{statusLabels[item.status] ?? item.status}</span>
          {item.error && <p className="mt-1 max-w-sm text-sm text-red-800">{item.error}</p>}</td>
        <td className="text-sm">{item.lastAttemptAt || item.sentAt ? new Date(item.lastAttemptAt ?? item.sentAt!).toLocaleString("lv-LV", { timeZone: "Europe/Riga" }) : "Nav mēģināts"}</td>
        <td>{item.canRetry ? <Button variant="outline" size="sm" disabled={busy !== null || !configured}
          onClick={() => retry(item)}>{busy === item.id ? <Loader2 className="animate-spin" /> : <Mail />} Nosūtīt atkārtoti</Button>
          : <span className="text-sm text-muted-foreground">Nav aktīva piekļuves koda</span>}</td>
      </tr>)}</tbody>
    </table></div>
    {!items.length && <p className="p-6 text-center text-muted-foreground">Apstiprinājuma e-pastu vēl nav.</p>}
  </section>;
}
