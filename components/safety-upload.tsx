"use client";

import { useState, type FormEvent } from "react";
import { put } from "@vercel/blob/client";
import { FileCheck2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SAFETY_MAX_BYTES, safetyExtension } from "@/lib/safety-document";

export type SafetyDocument = { id: number; fileName: string; createdAt: string; status: "submitted" | "outdated" };

export function SafetyUpload({ schoolId, revision, document, onSaved }: {
  schoolId: number; revision: number; document: SafetyDocument | null; onSaved: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!file) return;
    const form = event.currentTarget;
    setBusy(true); setError("");
    try {
      const extension = safetyExtension(file.name);
      if (!file.size || file.size > SAFETY_MAX_BYTES) throw new Error("Failam jābūt līdz 12 MB un tas nedrīkst būt tukšs.");
      const pathname = `safety/${schoolId}/${revision}/${crypto.randomUUID()}.${extension}`;
      const permission = await fetch("/api/safety-documents", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname, clientPayload: null, multipart: false } }) });
      const token = await permission.json();
      if (!permission.ok || !token.clientToken) throw new Error(token.error || "Neizdevās sagatavot augšupielādi.");
      const blob = await put(pathname, file, { access: "private", token: token.clientToken,
        contentType: extension === "pdf" ? "application/pdf" : "application/vnd.etsi.asic-e+zip" });
      const response = await fetch("/api/safety-documents", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url, fileName: file.name, revision }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Neizdevās iesniegt dokumentu.");
      await onSaved(); setFile(null); form.reset();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Augšupielāde neizdevās."); }
    finally { setBusy(false); }
  }
  return <section className="mb-7 rounded-3xl border bg-white p-5">
    <h2 className="flex items-center gap-2 text-xl font-black"><FileCheck2 /> Parakstītā drošības lapa</h2>
    <p className="mt-2 text-sm text-muted-foreground">Lejupielādējiet drošības lapu, parakstiet un iesniedziet PDF vai EDOC formātā (līdz 12 MB). Dokumentu redzēs jūsu skola un administrators. Iesniegšana ir pieejama arī pēc sastāva labošanas slēgšanas.</p>
    <p role="status" className={`mt-3 font-bold ${document?.status === "submitted" ? "text-emerald-800" : "text-amber-900"}`}>
      {document?.status === "submitted" ? "Iesniegts" : document ? "Sastāvs ir mainīts — iesniedziet atjaunotu drošības lapu." : "Vēl nav iesniegta"}
    </p>
    {document && <a className="mt-2 block break-all text-sm font-bold text-primary underline" href={`/api/safety-documents/${document.id}`}>{document.fileName} · {new Date(document.createdAt).toLocaleString("lv-LV")}</a>}
    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={submit}>
      <label className="form-label">{document ? "Aizstāt ar jaunu dokumentu" : "Izvēlēties parakstīto dokumentu"}
        <input className="form-control max-w-full" type="file" accept=".pdf,.edoc" required disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} />
      </label>
      <Button type="submit" disabled={busy || !file}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} Iesniegt drošības lapu</Button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm font-bold text-red-800">{error}</p>}
  </section>;
}
