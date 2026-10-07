"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { put } from "@vercel/blob/client";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROTOCOL_MAX_BYTES, protocolExtension, protocolMimeTypes } from "@/lib/start-protocol-file";

type Protocol = { id: number; fileName: string; published: boolean; createdAt: string; publishedAt: string | null;
  notifications: Array<{ id: number; schoolName: string; recipient: string; status: string; error: string | null }> };
type ProtocolData = { recipientCount: number; protocols: Protocol[] };
async function jsonResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Neizdevās apstrādāt pieprasījumu.");
  return body;
}

export function JudgeStartProtocols({ sportId, judgeId }: { sportId: number; judgeId: number }) {
  const [data, setData] = useState<ProtocolData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const load = useCallback(async () => {
    const body = await jsonResponse(await fetch("/api/start-protocols"));
    if (mounted.current) setData(body);
  }, []);
  useEffect(() => {
    mounted.current = true;
    load().catch(reason => { if (mounted.current) setError(reason.message); });
    return () => { mounted.current = false; };
  }, [load]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const extension = protocolExtension(file.name);
      if (!file.size || file.size > PROTOCOL_MAX_BYTES) throw new Error("Atļauti faili līdz 12 MB.");
      const pathname = `start-protocols/${sportId}/${judgeId}/${crypto.randomUUID()}.${extension}`;
      const token = await jsonResponse(await fetch("/api/start-protocols/upload", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname, clientPayload: null, multipart: false } }) }));
      if (!token.clientToken) throw new Error("Neizdevās saņemt augšupielādes atļauju.");
      const blob = await put(pathname, file, { access: "private", token: token.clientToken, contentType: protocolMimeTypes[extension] });
      await jsonResponse(await fetch("/api/start-protocols/upload", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: blob.url, fileName: file.name }) }));
      if (fileRef.current) fileRef.current.value = "";
      setNotice("Fails saglabāts kā melnraksts. Atveriet un pārbaudiet to, tad publicējiet un paziņojiet skolām.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Augšupielāde neizdevās."); }
    finally { setBusy(false); }
  }
  async function publish(protocol: Protocol) {
    if (!protocol.published && !window.confirm(`Publicēt “${protocol.fileName}” publiskajā lapā un nosūtīt paziņojumu ${data?.recipientCount ?? 0} skolām?`)) return;
    setBusy(true); setError(""); setNotice("Publicē un nosūta paziņojumus… Lūdzu, uzgaidiet.");
    try {
      let action = protocol.published ? "send-pending" : "publish";
      do {
        const result = await jsonResponse(await fetch("/api/start-protocols", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id: protocol.id }) }));
        setNotice(`Starta protokols ir publicēts. E-pasta pakalpojumam nodoti ${result.sent} no ${result.total} paziņojumiem.${result.remaining ? ` Atlikuši ${result.remaining}.` : ""}`);
        await load();
        if (result.error) { setError(result.error); break; }
        if (!result.continueSending || !mounted.current) break;
        action = "send-pending";
      } while (mounted.current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Publicēšana neizdevās.");
      await load().catch(() => undefined);
    } finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <div className="glass-panel rounded-3xl p-5"><h2 className="text-xl font-black">Starta protokoli</h2>
      <p className="mt-2 text-sm text-muted-foreground">Augšupielādējiet un pārbaudiet failu. Poga “Publicēt un paziņot skolām” padara to publiski pieejamu un nosūta e-pastu šajā sporta veidā pārstāvēto skolu reģistrācijas kontaktpersonām.</p>
      <p className="mt-2 text-sm font-bold">Pašlaik paziņojumu saņems {data?.recipientCount ?? "…"} skolas. PDF, XLSX, XLS vai CSV, līdz 12 MB.</p>
      <form onSubmit={upload} className="mt-5 flex flex-wrap items-end gap-3"><label className="form-label min-w-0 flex-1">Starta protokola fails<input ref={fileRef} disabled={busy} type="file" accept=".pdf,.xlsx,.xls,.csv" required className="form-control" /></label><Button disabled={busy} type="submit">{busy ? <Loader2 className="animate-spin" /> : <Upload />} Augšupielādēt melnrakstu</Button></form>
    </div>
    {notice && <p role="status" className="rounded-2xl bg-[#e9ecff] p-4">{notice}</p>}
    {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-800">{error}</p>}
    {!data && !error && <p role="status">Ielādē starta protokolus…</p>}
    {data?.protocols.map(protocol => {
      const sent = protocol.notifications.filter(mail => mail.status === "sent").length;
      const pending = protocol.notifications.length - sent;
      return <article key={protocol.id} className="glass-panel rounded-3xl p-5"><div className="flex flex-wrap items-start justify-between gap-4">
        <div><h3 className="break-all font-black">{protocol.fileName}</h3><p className="mt-1 text-sm text-muted-foreground">{protocol.published ? "Publicēts" : "Melnraksts — nav publiski redzams"} · {new Date(protocol.publishedAt ?? protocol.createdAt).toLocaleString("lv-LV")}</p></div>
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href={`/api/start-protocols/${protocol.id}`} target="_blank" rel="noreferrer"><Download /> Atvērt failu</a></Button>
          {(!protocol.published || pending > 0) && <Button disabled={busy} onClick={() => publish(protocol)}>{protocol.published ? "Nosūtīt atlikušos paziņojumus" : "Publicēt un paziņot skolām"}</Button>}</div>
      </div>{protocol.published && <details className="mt-4"><summary className="cursor-pointer font-bold">Paziņojumi skolām: nosūtīti {sent} no {protocol.notifications.length}{pending > 0 ? ` · atlikuši ${pending}` : ""}</summary>
        <p className="my-3 text-sm text-muted-foreground">“Nosūtīts” nozīmē, ka e-pasta pakalpojums pieņēmis vēstuli nosūtīšanai. Ja sūtīšana pārtraukta, izmantojiet atlikušajiem paziņojumiem paredzēto pogu. Jau nosūtītās vēstules atkārtoti netiks sūtītas.</p>
        <ul className="space-y-2">{protocol.notifications.map(mail => <li key={mail.id} className="rounded-xl bg-white p-3 text-sm"><strong>{mail.schoolName}</strong> · {mail.recipient}<br />{({ sent: "Nosūtīts", sending: "Tiek nosūtīts", queued: "Gaida nosūtīšanu", failed: "Nosūtīšana neizdevās" })[mail.status] ?? mail.status}{mail.error && <span className="block text-red-800">{mail.error}</span>}</li>)}</ul>
      </details>}</article>;
    })}
    {data && !data.protocols.length && <p className="p-5 text-center text-muted-foreground">Šim sporta veidam vēl nav starta protokolu.</p>}
  </section>;
}

