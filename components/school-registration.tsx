"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Info, Loader2 } from "lucide-react";
import { PageHeading } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const steps = [
  { title: "Piesaki skolu", text: "Norādi skolu un tās kontaktpersonu." },
  { title: "Saņem apstiprinājumu", text: "Pēc pieteikuma pārbaudes e-pastā saņemsi skolas piekļuves kodu." },
  { title: "Pulcē komandu", text: "Pievieno vadītājus un dalībniekus, izvēlies sporta veidus un lejupielādē dokumentus." },
];

export function SchoolRegistration({ configured = true }: { configured?: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return;
    setError("");
    setState("loading");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register-school", ...values }) });
      const body = await response.json();
      if (!response.ok) throw new Error(response.status < 500 ? body.error ?? "Lūdzu, pārbaudi ievadītos datus." : "Pieteikumu pašlaik nevar iesniegt. Lūdzu, mēģini vēlreiz vēlāk.");
      setState("success");
    } catch (reason) {
      setError(reason instanceof Error && !(reason instanceof TypeError) ? reason.message : "Neizdevās savienoties. Pārbaudi interneta savienojumu un mēģini vēlreiz.");
      setState("idle");
    }
  }

  return <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
    <PageHeading eyebrow="Satiekamies festivālā" title="Reģistrēt skolu" description="Pirmais solis līdz startam — piesaki savu skolu. Pieteikumu aizpilda skolotājs vai cits pilnvarots skolas pārstāvis." />
    <div className="grid items-start gap-8 lg:grid-cols-[.75fr_1.25fr] lg:gap-12">
      <aside className="relative overflow-hidden rounded-xl bg-[#0c0942] p-7 text-white sm:p-9">
        <Image src="/brand/symbol.svg" alt="" width={64} height={60} className="mb-8" />
        <h2 className="section-title text-3xl text-[#c7cfff]">Tava skola. Tava komanda.</h2>
        <ol className="mt-8 grid gap-7">
          {steps.map((step, index) => <li key={step.title} className="flex gap-4"><span className="pt-0.5 text-sm font-bold text-[#d2d61d]">0{index + 1}</span><div><h3 className="text-lg font-bold">{step.title}</h3><p className="mt-1 text-base leading-6 text-[#c7cfff]">{step.text}</p></div></li>)}
        </ol>
        <div className="mt-9 border-t border-white/20 pt-6"><p className="text-sm text-[#c7cfff]">Skola jau ir apstiprināta?</p><Link href="/skolai" className="mt-2 inline-flex items-center gap-3 font-bold text-white hover:text-[#d2d61d]">Atvērt skolas sadaļu <ArrowRight className="size-4" /></Link></div>
      </aside>
      {state === "success" ? <div role="status" className="glass-panel rounded-xl p-8 text-center sm:p-12"><CheckCircle2 className="mx-auto size-14 text-primary" /><h2 className="section-title mt-6 text-3xl">Pieteikums saņemts!</h2><p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">Pēc administratora apstiprinājuma uz norādīto e-pasta adresi tiks nosūtīts piekļuves kods dalībnieku un komandas vadītāju reģistrēšanai.</p><Button asChild className="mt-7" variant="outline"><Link href="/">Atgriezties sākumlapā <ArrowRight /></Link></Button></div> :
        <form onSubmit={submit} className="glass-panel rounded-xl p-6 sm:p-9">
          {!configured && <p role="status" className="mb-7 flex items-start gap-3 rounded-md bg-[#e9ecff] p-4 text-sm leading-6"><Info className="mt-0.5 size-5 shrink-0 text-primary" />Skolu pieteikumu iesniegšana vēl nav pieejama. Lūdzu, ieskaties šeit vēlāk.</p>}
          <p className="mb-6 text-sm text-muted-foreground">Visi lauki ir obligāti.</p>
          <fieldset>
            <legend className="mb-5 text-xl font-bold">Skolas informācija</legend>
            <div className="grid gap-5">
              <label className="form-label">Skolas nosaukums<input className="form-control" name="name" required autoComplete="organization" placeholder="Pilns skolas nosaukums" /></label>
              <label className="form-label">Novads vai valstspilsēta<input className="form-control" name="municipality" required placeholder="Piemēram, Cēsu novads" /></label>
            </div>
          </fieldset>
          <fieldset className="mt-8 border-t pt-7">
            <legend className="float-left mb-5 w-full text-xl font-bold">Skolas kontaktpersona</legend>
            <div className="clear-both grid gap-5 sm:grid-cols-2">
              <label className="form-label">Vārds, uzvārds<input className="form-control" name="teacherName" required autoComplete="name" /></label>
              <label className="form-label">Amats skolā<input className="form-control" name="teacherRole" required autoComplete="organization-title" placeholder="Piemēram, sporta skolotājs" /></label>
              <label className="form-label">E-pasts<input className="form-control" name="email" type="email" required autoComplete="email" /><span className="text-xs font-normal text-muted-foreground">Uz šo adresi nosūtīsim piekļuves kodu.</span></label>
              <label className="form-label content-start">Tālrunis<input className="form-control" name="phone" type="tel" required autoComplete="tel" placeholder="+371" /></label>
            </div>
          </fieldset>
          <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-lg bg-[#f7f7fc] p-4 text-sm leading-6"><Checkbox checked={consent} onCheckedChange={value => setConsent(value === true)} className="mt-1" required /><span>Apstiprinu, ka esmu pilnvarots/-a iesniegt skolas pieteikumu un organizatoram ir tiesisks pamats apstrādāt pieteikumā norādīto kontaktinformāciju dalības nodrošināšanai.</span></label>
          {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-base text-red-800">{error}</p>}
          <Button type="submit" size="lg" disabled={!configured || !consent || state === "loading"} className="mt-7 w-full justify-between gap-3 text-base sm:w-auto">Iesniegt pieteikumu {state === "loading" ? <Loader2 className="animate-spin" /> : <ArrowRight />}</Button>
        </form>}
    </div>
  </main>;
}
