"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Edit3, FileSignature, KeyRound, Loader2, LogOut, Plus, Save, Trash2, UserRoundPlus, Users } from "lucide-react";
import { PageHeading } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Category = { id: number; name: string; discipline: string; gender: "F" | "M" | "X"; minBirthYear: number; maxBirthYear: number; teamMin: number; teamMax: number };
type Sport = { id: number; name: string; mode: "individual" | "team"; categories: Category[] };
type PortalData = {
  school: { id: number; name: string; municipality: string; teacherName: string; teacherRole: string; email: string; phone: string };
  leaders: Array<{ id: number; fullName: string; role: string; email: string | null; phone: string | null }>;
  participants: Array<{ id: number; firstName: string; lastName: string; birthYear: number; gender: "F" | "M" }>;
  entries: Array<{ id: number; participantId: number; categoryId: number; teamName: string | null }>;
  sports: Sport[];
  requiredLeaders: number;
};

type RegistrationDraft = { categoryId: string; teamName: string };

export function SchoolPortal() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [participantOpen, setParticipantOpen] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); const response = await fetch("/api/actions?view=school");
    if (response.status === 401) { setData(null); setLoading(false); return; }
    const body = await response.json(); if (!response.ok) setError(body.error); else setData(body); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <main className="mx-auto grid min-h-[60vh] max-w-5xl place-items-center px-4"><Loader2 className="size-10 animate-spin text-[#2910bf]"/></main>;
  if (!data) return <SchoolLogin onSuccess={load} error={error} />;

  async function action(payload: Record<string, unknown>) {
    setError(""); const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Neizdevās saglabāt."); await load(); return body;
  }
  async function logout() { await action({ action: "logout" }); setData(null); }

  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeading eyebrow={data.school.municipality} title={data.school.name} description="Pārvaldiet komandas vadītājus, dalībniekus un pieteikumus sporta veidos."/><Button variant="outline" onClick={logout}><LogOut/> Iziet</Button></div>
    {error && <p className="mb-5 rounded-2xl bg-red-50 p-4 font-bold text-red-800">{error}</p>}
    <section className="mb-7 grid gap-4 md:grid-cols-3">
      <Info label="Dalībnieki" value={data.participants.length} icon={<Users/>}/>
      <Info label="Komandas vadītāji" value={`${data.leaders.length} / ${data.requiredLeaders}`} icon={<UserRoundPlus/>} warning={data.leaders.length < data.requiredLeaders}/>
      <div className="glass-panel flex flex-wrap content-center gap-2 rounded-3xl p-5 md:col-span-1"><Button asChild className="bg-[#0c0942]"><Link href="/skolai/drosibas-lapa"><FileSignature/> Drošības parakstu lapa</Link></Button><Button asChild variant="outline"><Link href="/skolai/akreditacijas"><Download/> Akreditācijas</Link></Button></div>
    </section>
    {data.leaders.length < data.requiredLeaders && <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 font-bold text-amber-900">Pie {data.participants.length} dalībniekiem nepieciešami vismaz {data.requiredLeaders} komandas vadītāji. Pievienojiet vēl {data.requiredLeaders - data.leaders.length}.</div>}
    <Tabs defaultValue="participants">
      <TabsList className="mb-6 h-auto rounded-2xl bg-[#0c0942] p-1.5 text-white"><TabsTrigger value="participants" className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]">Dalībnieki</TabsTrigger><TabsTrigger value="leaders" className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]">Komandas vadītāji</TabsTrigger></TabsList>
      <TabsContent value="participants">
        <div className="mb-4 flex justify-end"><Dialog open={participantOpen} onOpenChange={setParticipantOpen}><DialogTrigger asChild><Button className="bg-[#0c0942]"><Plus/> Pievienot dalībnieku</Button></DialogTrigger><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Pievienot dalībnieku</DialogTitle><DialogDescription>Sistēma piedāvās tikai dzimšanas gadam un dzimumam atbilstošās kategorijas.</DialogDescription></DialogHeader><ParticipantForm sports={data.sports} onSave={async (payload) => { await action({ action: "save-participant", ...payload }); setParticipantOpen(false); }} /></DialogContent></Dialog></div>
        <ParticipantTable data={data} onDelete={async (id) => { if (confirm("Vai noņemt dalībnieku un visus viņa pieteikumus?")) await action({ action: "delete-participant", participantId: id }); }} onEdit={async (payload) => action({ action: "save-participant", ...payload })}/>
      </TabsContent>
      <TabsContent value="leaders"><LeaderSection data={data} onAdd={async (payload) => action({ action: "add-leader", ...payload })} onDelete={async (id) => action({ action: "delete-leader", leaderId: id })}/></TabsContent>
    </Tabs>
  </main>;
}

function SchoolLogin({ onSuccess, error: initialError }: { onSuccess: () => void; error: string }) {
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const code = String(new FormData(event.currentTarget).get("code") ?? ""); const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login-school", code }) }); const body = await response.json(); if (!response.ok) { setError(body.error); setBusy(false); return; } onSuccess(); }
  return <main className="mx-auto max-w-xl px-4 py-14 sm:px-6"><PageHeading eyebrow="Skolas sadaļa" title="Ievadiet piekļuves kodu" description="Kods tiek nosūtīts skolas kontaktpersonai pēc pieteikuma apstiprināšanas."/><form onSubmit={submit} className="glass-panel rounded-3xl p-6 sm:p-8"><label className="form-label">Skolas piekļuves kods<input className="form-control text-lg font-black uppercase tracking-[.25em]" name="code" required autoComplete="one-time-code" /></label>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 font-bold text-red-800">{error}</p>}<Button type="submit" size="lg" disabled={busy} className="mt-5 min-h-12 bg-[#0c0942]">{busy ? <Loader2 className="animate-spin"/> : <KeyRound/>} Atvērt skolas sadaļu</Button></form></main>;
}

function ParticipantForm({ sports, onSave, participant, registrations }: { sports: Sport[]; onSave: (payload: Record<string, unknown>) => Promise<unknown>; participant?: PortalData["participants"][number]; registrations?: RegistrationDraft[] }) {
  const [firstName, setFirstName] = useState(participant?.firstName ?? ""); const [lastName, setLastName] = useState(participant?.lastName ?? ""); const [birthYear, setBirthYear] = useState(participant?.birthYear ? String(participant.birthYear) : ""); const [gender, setGender] = useState<"F"|"M">(participant?.gender ?? "F");
  const [rows, setRows] = useState<RegistrationDraft[]>(registrations?.length ? registrations : [{ categoryId: "", teamName: "" }]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const categories = useMemo(() => sports.flatMap((sport) => sport.categories.map((category) => ({ ...category, sportName: sport.name, mode: sport.mode }))).filter((category) => !birthYear || (Number(birthYear) >= category.minBirthYear && Number(birthYear) <= category.maxBirthYear && (category.gender === "X" || category.gender === gender))), [sports, birthYear, gender]);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); setBusy(true); try { await onSave({ id: participant?.id, firstName, lastName, birthYear: Number(birthYear), gender, registrations: rows.map((row) => ({ categoryId: Number(row.categoryId), teamName: row.teamName })) }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Neizdevās saglabāt."); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><label className="form-label">Vārds<input className="form-control" value={firstName} onChange={(e) => setFirstName(e.target.value)} required/></label><label className="form-label">Uzvārds<input className="form-control" value={lastName} onChange={(e) => setLastName(e.target.value)} required/></label><label className="form-label">Dzimšanas gads<input className="form-control" type="number" min="2000" max="2030" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} required/></label><label className="form-label">Dzimuma grupa<select className="form-control" value={gender} onChange={(e) => setGender(e.target.value as "F"|"M")}><option value="F">Meitenes / jaunietes</option><option value="M">Zēni / jaunieši</option></select></label></div>
    <div><div className="mb-3 flex items-center justify-between"><h3 className="font-black">Sporta veidi un disciplīnas</h3><Button type="button" variant="outline" size="sm" onClick={() => setRows((value) => [...value, { categoryId: "", teamName: "" }])}><Plus/> Vēl viens</Button></div>{sports.every((sport) => sport.categories.length === 0) && <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Administrators vēl nav publicējis jaunā gada kategorijas.</p>}<div className="grid gap-3">{rows.map((row, index) => { const selected = categories.find((category) => category.id === Number(row.categoryId)); return <div key={index} className="grid gap-3 rounded-2xl bg-[#f0f1ff] p-4 sm:grid-cols-[1fr_1fr_auto]"><label className="form-label">Kategorija<select className="form-control" value={row.categoryId} required onChange={(event) => setRows((values) => values.map((item, itemIndex) => itemIndex === index ? { ...item, categoryId: event.target.value } : item))}><option value="">Izvēlieties</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.sportName} — {category.name} ({category.minBirthYear}–{category.maxBirthYear})</option>)}</select></label>{selected?.mode === "team" ? <label className="form-label">Komandas nosaukums<input className="form-control" value={row.teamName} required onChange={(event) => setRows((values) => values.map((item, itemIndex) => itemIndex === index ? { ...item, teamName: event.target.value } : item))}/></label> : <span/>}<Button type="button" variant="ghost" size="icon" className="self-end text-red-700" disabled={rows.length === 1} onClick={() => setRows((values) => values.filter((_, itemIndex) => itemIndex !== index))}><Trash2/></Button></div>; })}</div></div>
    {error && <p className="rounded-xl bg-red-50 p-3 font-bold text-red-800">{error}</p>}<Button type="submit" disabled={busy} className="justify-self-start bg-[#0c0942]">{busy ? <Loader2 className="animate-spin"/> : <Save/>} Saglabāt dalībnieku</Button>
  </form>;
}

function ParticipantTable({ data, onDelete, onEdit }: { data: PortalData; onDelete: (id: number) => void; onEdit: (payload: Record<string, unknown>) => Promise<unknown> }) { return <div className="glass-panel overflow-hidden rounded-3xl">{data.participants.length === 0 ? <p className="p-8 text-center font-bold text-[#65647b]">Dalībnieki vēl nav pievienoti.</p> : <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Dalībnieks</th><th>Dzimšanas gads</th><th>Pieteiktie sporta veidi</th><th></th></tr></thead><tbody>{data.participants.map((person) => { const personEntries = data.entries.filter((entry) => entry.participantId === person.id); const regs = personEntries.map((entry) => ({ categoryId: String(entry.categoryId), teamName: entry.teamName ?? "" })); return <tr key={person.id}><td className="font-black">{person.firstName} {person.lastName}<div className="mt-1 text-xs font-normal text-[#65647b]">{person.gender === "F" ? "Meitenes / jaunietes" : "Zēni / jaunieši"}</div></td><td>{person.birthYear}</td><td>{personEntries.map((entry) => { const sport = data.sports.find((item) => item.categories.some((category) => category.id === entry.categoryId)); const category = sport?.categories.find((item) => item.id === entry.categoryId); return <span key={entry.id} className="mr-2 inline-flex rounded-full bg-[#e9ecff] px-2.5 py-1 text-xs font-bold text-[#2910bf]">{sport?.name}: {category?.name}{entry.teamName ? ` — ${entry.teamName}` : ""}</span>; })}</td><td><div className="flex justify-end gap-1"><Dialog><DialogTrigger asChild><Button size="icon-sm" variant="ghost"><Edit3/></Button></DialogTrigger><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Labot dalībnieku</DialogTitle></DialogHeader><ParticipantForm sports={data.sports} participant={person} registrations={regs} onSave={onEdit}/></DialogContent></Dialog><Button size="icon-sm" variant="ghost" className="text-red-700" onClick={() => onDelete(person.id)}><Trash2/></Button></div></td></tr>; })}</tbody></table></div>}</div>; }

function LeaderSection({ data, onAdd, onDelete }: { data: PortalData; onAdd: (payload: Record<string, unknown>) => Promise<unknown>; onDelete: (id: number) => Promise<unknown> }) { const [error, setError] = useState(""); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await onAdd(values); event.currentTarget.reset(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Neizdevās saglabāt."); } } return <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={submit} className="glass-panel rounded-3xl p-5"><h2 className="mb-4 text-xl font-black">Pievienot vadītāju</h2><div className="grid gap-4"><label className="form-label">Vārds, uzvārds<input className="form-control" name="fullName" required/></label><label className="form-label">Amats / loma<input className="form-control" name="role" defaultValue="Komandas vadītājs" required/></label><label className="form-label">E-pasts<input className="form-control" name="email" type="email"/></label><label className="form-label">Tālrunis<input className="form-control" name="phone"/></label></div>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}<Button className="mt-5 bg-[#0c0942]"><Plus/> Pievienot</Button></form><div className="glass-panel overflow-hidden rounded-3xl"><table className="data-table"><thead><tr><th>Vadītājs</th><th>Kontakti</th><th></th></tr></thead><tbody>{data.leaders.map((leader) => <tr key={leader.id}><td><strong>{leader.fullName}</strong><div className="text-xs text-[#65647b]">{leader.role}</div></td><td>{leader.email}<br/>{leader.phone}</td><td><Button variant="ghost" size="icon-sm" className="text-red-700" onClick={() => onDelete(leader.id)}><Trash2/></Button></td></tr>)}</tbody></table>{data.leaders.length === 0 && <p className="p-8 text-center font-bold text-[#65647b]">Vadītāji vēl nav pievienoti.</p>}</div></div>; }

function Info({ label, value, icon, warning }: { label: string; value: React.ReactNode; icon: React.ReactNode; warning?: boolean }) { return <div className="glass-panel flex items-center gap-4 rounded-3xl p-5"><span className={`grid size-12 place-items-center rounded-2xl ${warning ? "bg-amber-200" : "bg-[#d2d61d]"}`}>{icon}</span><div><strong className="block text-3xl font-black">{value}</strong><span className="text-sm font-bold text-[#65647b]">{label}</span></div></div>; }
