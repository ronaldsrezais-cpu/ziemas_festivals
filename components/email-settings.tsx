"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Mail, Monitor, RotateCcw, Save, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { defaultEmailTemplate, emailTemplateSchema, renderApprovalEmail, sampleEmailContext, type EmailTemplate } from "@/lib/email-template";
import type { EmailCheck, EmailConfiguration } from "@/lib/email-configuration";

const noticeStyle = { success: "bg-emerald-50 text-emerald-900", warning: "bg-amber-50 text-amber-900", error: "bg-red-50 text-red-800" };
async function post(data: unknown) {
  const response = await fetch("/api/email-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Darbība neizdevās.");
  return result;
}

export function EmailSettings({ onOutboxChanged }: { onOutboxChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState<EmailTemplate>(defaultEmailTemplate);
  const [saved, setSaved] = useState<EmailTemplate>(defaultEmailTemplate);
  const [config, setConfig] = useState<EmailConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<"save" | "check" | "test" | null>(null);
  const [check, setCheck] = useState<EmailCheck | null>(null);
  const [notice, setNotice] = useState<EmailCheck | null>(null);
  const [recipient, setRecipient] = useState("");
  const [mobile, setMobile] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const preview = renderApprovalEmail(draft, sampleEmailContext);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/email-settings", { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Neizdevās ielādēt e-pasta iestatījumus.");
      if (!controller.signal.aborted) { setDraft(data.template); setSaved(data.template); setConfig(data.configuration); }
    }).catch(reason => { if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : "Neizdevās ielādēt."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update<K extends keyof EmailTemplate>(key: K, value: EmailTemplate[K]) {
    setDraft(current => ({ ...current, [key]: value })); setNotice(null);
  }
  function validate() {
    const parsed = emailTemplateSchema.safeParse(draft);
    if (!parsed.success) {
      setNotice({ level: "error", message: "Pārbaudiet laukus: tiem jābūt aizpildītiem, atbildes adresei jābūt derīgai. Tekstā atļauti tikai {{skola}} un {{skolotajs}}." });
      return null;
    }
    return parsed.data;
  }
  async function save() {
    const template = validate(); if (!template) return;
    setBusy("save"); setNotice(null);
    try {
      const result = await post({ action: "save-template", template });
      setDraft(result.template); setSaved(result.template);
      setNotice({ level: "success", message: "Noformējums saglabāts. To izmantos skolu apstiprinājuma vēstulēs." });
    } catch (reason) { setNotice({ level: "error", message: reason instanceof Error ? reason.message : "Neizdevās saglabāt." }); }
    finally { setBusy(null); }
  }
  async function checkConnection() {
    setBusy("check"); setCheck(null);
    try { const result = await post({ action: "check-configuration" }); setConfig(result.configuration); setCheck(result); }
    catch (reason) { setCheck({ level: "error", message: reason instanceof Error ? reason.message : "Pārbaude neizdevās." }); }
    finally { setBusy(null); }
  }
  async function sendTest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const template = validate(); if (!template) return;
    setBusy("test"); setNotice(null);
    try {
      const result = await post({ action: "send-test", template, recipient });
      setNotice({ level: result.sent ? "success" : "error", message: result.sent
        ? `Izmēģinājums nodots nosūtīšanai uz ${recipient.trim()}. Pārbaudiet pastkasti un nevēlamo pastu. Piegādes statusu var pārbaudīt sarakstā zemāk.`
        : result.error ?? "Izmēģinājumu neizdevās nosūtīt." });
      await onOutboxChanged().catch(() => { /* The send outcome remains visible; the list has its own refresh button. */ });
    } catch (reason) { setNotice({ level: "error", message: reason instanceof Error ? reason.message : "Neizdevās nosūtīt." }); }
    finally { setBusy(null); }
  }

  if (loading) return <div className="glass-panel mb-6 flex items-center gap-3 rounded-3xl p-6" role="status"><Loader2 className="animate-spin" /> Ielādē e-pasta iestatījumus…</div>;
  if (loadError) return <div className="glass-panel mb-6 rounded-3xl p-6"><p role="alert" className="mb-3 text-red-800">{loadError}</p><Button variant="outline" onClick={() => { setLoading(true); setLoadError(""); setReload(value => value + 1); }}>Mēģināt vēlreiz</Button></div>;
  return <section className="mb-8 space-y-6">
    <div className="glass-panel rounded-3xl p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-xl font-black">E-pasta pieslēgums</h2>
          <p className="mt-2 text-sm">Sūtītāja adrese: <strong className="break-all">{config?.senderAddress || "Vēl nav norādīta"}</strong></p>
          <p className="mt-1 text-sm text-muted-foreground">Resend atslēga: {config?.keyFormatValid ? "pievienota" : config?.keyPresent ? "jāpārbauda tās formāts" : "nav pievienota"}.</p>
        </div>
        <Button variant="outline" disabled={busy !== null} onClick={checkConnection}>{busy === "check" ? <Loader2 className="animate-spin" /> : <Check />} Pārbaudīt pieslēgumu</Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Pārbaude noskaidro sūtītāja domēna statusu Resend. Piegādi savā pastkastē pārbaudiet ar izmēģinājuma vēstuli.</p>
      {check && <p role={check.level === "error" ? "alert" : "status"} className={`mt-4 rounded-xl p-3 text-sm ${noticeStyle[check.level]}`}>{check.message}</p>}
    </div>

    <div className="glass-panel overflow-hidden rounded-3xl">
      <div className="border-b border-[#c7cfff] p-5 md:p-6"><h2 className="text-xl font-black">Skolas apstiprinājuma vēstule</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Izveidojiet vēstuli, kuru skola saņems pēc apstiprināšanas. Skolas nosaukumu ievieto <code>{"{{skola}}"}</code>, skolotāja vārdu — <code>{"{{skolotajs}}"}</code>. Piekļuves kods un saite tiek pievienoti automātiski.</p></div>
      <div className="grid items-start xl:grid-cols-2">
        <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-4 p-5 md:p-6">
          <fieldset disabled={busy !== null} className="space-y-4 disabled:opacity-70">
            <label className="block text-sm font-bold">Sūtītāja nosaukums<input className="form-control mt-1" value={draft.senderName} maxLength={100} required onChange={event => update("senderName", event.target.value)} /></label>
            <label className="block text-sm font-bold">E-pasta temats<input className="form-control mt-1" value={draft.subject} maxLength={180} required onChange={event => update("subject", event.target.value)} /></label>
            <label className="block text-sm font-bold">Virsraksts vēstulē<input className="form-control mt-1" value={draft.heading} maxLength={160} required onChange={event => update("heading", event.target.value)} /></label>
            <label className="block text-sm font-bold">Vēstules teksts<textarea className="form-control mt-1 min-h-64 resize-y font-normal" rows={10} value={draft.message} maxLength={6000} required onChange={event => update("message", event.target.value)} /></label>
            <label className="block text-sm font-bold">Pogas teksts<input className="form-control mt-1" value={draft.buttonLabel} maxLength={60} required onChange={event => update("buttonLabel", event.target.value)} /></label>
            <label className="block text-sm font-bold">Paraksts un teksts vēstules apakšā<textarea className="form-control mt-1 resize-y font-normal" rows={3} value={draft.footer} maxLength={1500} onChange={event => update("footer", event.target.value)} /></label>
            <label className="block text-sm font-bold">Adrese atbildēm<input className="form-control mt-1" type="email" value={draft.replyTo} maxLength={254} required onChange={event => update("replyTo", event.target.value)} /><span className="mt-1 block font-normal text-muted-foreground">Uz šo adresi nonāks skolotāja atbilde. Sūtītāja adrese paliek pieslēguma iestatījumos.</span></label>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-3 text-sm font-bold"><input aria-label="Akcenta krāsa" className="h-11 w-14 cursor-pointer rounded border border-[#c7cfff] bg-white p-1" type="color" value={draft.accentColor} onChange={event => update("accentColor", event.target.value)} /> Akcenta krāsa</label>
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input className="size-4 accent-[#2910bf]" type="checkbox" checked={draft.showLogo} onChange={event => update("showLogo", event.target.checked)} /> Rādīt festivāla logo</label>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button type="submit" disabled={!dirty}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Saglabāt noformējumu</Button>
              <Button type="button" variant="outline" onClick={() => { setDraft({ ...defaultEmailTemplate }); setNotice(null); }}><RotateCcw /> Sākotnējais paraugs</Button>
            </div>
          </fieldset>
          <p className={`text-sm ${dirty ? "font-bold text-amber-800" : "text-muted-foreground"}`}>{dirty ? "Ir nesaglabātas izmaiņas." : "Noformējums saglabāts."}</p>
          <p className="text-xs text-muted-foreground">Jaunais noformējums attiecas arī uz vēl nemēģinātām gaidošām vēstulēm. Neizdevušās nosūtīšanas atkārtojumam saglabājas iepriekšējais saturs.</p>
        </form>
        <div className="min-w-0 border-t border-[#c7cfff] bg-[#f0f1ff] p-3 md:p-5 xl:sticky xl:top-4 xl:border-l xl:border-t-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Priekšskatījums</h3>
            <div className="flex gap-2"><Button type="button" size="sm" variant={mobile ? "outline" : "default"} aria-pressed={!mobile} onClick={() => setMobile(false)}><Monitor /> Dators</Button><Button type="button" size="sm" variant={mobile ? "default" : "outline"} aria-pressed={mobile} onClick={() => setMobile(true)}><Smartphone /> Tālrunis</Button></div>
          </div>
          <p className="mb-3 break-words text-xs text-muted-foreground">Temats: {preview.subject}</p>
          <iframe title="Apstiprinājuma e-pasta priekšskatījums" sandbox="" srcDoc={preview.html} className="mx-auto block h-[780px] w-full rounded-xl border border-[#c7cfff] bg-white" style={{ maxWidth: mobile ? 375 : 680 }} />
          <p className="mt-3 text-xs text-muted-foreground">Parauga dati. E-pasta programmās izskats var nedaudz atšķirties.</p>
        </div>
      </div>
      <form onSubmit={sendTest} className="border-t border-[#c7cfff] bg-white/50 p-5 md:p-6">
        <h3 className="font-black">Pārbaudīt savā pastkastē</h3><p className="mb-4 mt-2 text-sm text-muted-foreground">Nosūta pašlaik redzamo noformējumu ar parauga datiem. Tas nesaglabā izmaiņas un neizveido skolas pieteikumu.</p>
        <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-bold">Izmēģinājuma saņēmējs<input className="form-control mt-1" type="email" placeholder="Jūsu e-pasta adrese" value={recipient} required maxLength={254} onChange={event => setRecipient(event.target.value)} /></label>
          <Button type="submit" disabled={busy !== null || !config?.readyToTest}>{busy === "test" ? <Loader2 className="animate-spin" /> : <Mail />} Nosūtīt izmēģinājumu</Button></div>
        {!config?.readyToTest && <p className="mt-3 text-sm text-amber-800">Pirms nosūtīšanas sakārtojiet pieslēgumu. Poga “Pārbaudīt pieslēgumu” parādīs, kas jāpievieno.</p>}
      </form>
      {notice && <p role={notice.level === "error" ? "alert" : "status"} className={`m-5 mt-0 rounded-xl p-3 text-sm md:mx-6 ${noticeStyle[notice.level]}`}>{notice.message}</p>}
    </div>
  </section>;
}
