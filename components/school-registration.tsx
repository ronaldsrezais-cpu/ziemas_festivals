"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { PageHeading } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function SchoolRegistration() {
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setState("loading");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register-school", ...values }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Neizdevās iesniegt pieteikumu."); setState("idle"); return; }
    setState("success");
  }
  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
    <PageHeading eyebrow="Skolas pieteikums" title="Reģistrēt skolu" description="Pieteikumu iesniedz skolas skolotājs vai cits pilnvarots pārstāvis. Administrators pārbaudīs informāciju un pēc apstiprināšanas nosūtīs skolas piekļuves kodu." />
    {state === "success" ? <div className="glass-panel rounded-3xl p-8 text-center sm:p-12"><CheckCircle2 className="mx-auto size-16 text-emerald-600"/><h2 className="mt-5 text-3xl font-black">Pieteikums saņemts</h2><p className="mx-auto mt-3 max-w-xl leading-7 text-[#53657d]">Pēc administratora apstiprinājuma uz norādīto e-pasta adresi tiks nosūtīts piekļuves kods dalībnieku un komandas vadītāju reģistrēšanai.</p></div> : <form onSubmit={submit} className="glass-panel rounded-3xl p-5 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="form-label sm:col-span-2">Skolas nosaukums<input className="form-control" name="name" required autoComplete="organization" /></label>
        <label className="form-label">Novads vai valstspilsēta<input className="form-control" name="municipality" required /></label>
        <label className="form-label">Skolotāja vārds, uzvārds<input className="form-control" name="teacherName" required autoComplete="name" /></label>
        <label className="form-label">Amats skolā<input className="form-control" name="teacherRole" required placeholder="Piem., sporta skolotājs" /></label>
        <label className="form-label">E-pasts<input className="form-control" name="email" type="email" required autoComplete="email" /></label>
        <label className="form-label">Tālrunis<input className="form-control" name="phone" type="tel" required autoComplete="tel" /></label>
      </div>
      <label className="mt-6 flex items-start gap-3 rounded-2xl bg-cyan-50 p-4 text-sm leading-6 text-[#193451]"><Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} className="mt-1"/><span>Apstiprinu, ka esmu pilnvarots/-a iesniegt skolas pieteikumu un organizatoram ir tiesisks pamats apstrādāt pieteikumā norādīto kontaktinformāciju dalības nodrošināšanai.</span></label>
      {error && <p className="mt-5 rounded-xl bg-red-50 p-3 font-bold text-red-800">{error}</p>}
      <Button type="submit" size="lg" disabled={!consent || state === "loading"} className="mt-6 min-h-12 bg-[#07152f] px-7 text-base hover:bg-[#102d55]">{state === "loading" ? <Loader2 className="animate-spin"/> : <Send/>} Iesniegt skolas pieteikumu</Button>
    </form>}
  </main>;
}
