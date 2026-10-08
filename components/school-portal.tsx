"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Edit3, FileSignature, KeyRound, Loader2, LogOut, Plus, Save, Trash2, UserRoundPlus, Users } from "lucide-react";
import { numberedTeam, teamOptions } from "@/lib/team-registration";
import { resolveParticipantCategory } from "@/lib/participant-category";
import { SafetyUpload, type SafetyDocument } from "@/components/safety-upload";
import { SchoolNameEditor } from "@/components/school-name-editor";
import { leaderRequirementMessage, type RosterReadiness } from "@/lib/roster-readiness";
import { PageHeading } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Category = { id: number; name: string; discipline: string; gender: "F" | "M" | "X"; minBirthYear: number; maxBirthYear: number; teamMin: number; teamMax: number; schoolLimit: number | null };
type Sport = { id: number; code: string; name: string; mode: "individual" | "team"; categories: Category[] };
type PortalData = {
  school: { id: number; name: string; municipality: string; teacherName: string; teacherRole: string; email: string; phone: string; rosterRevision: number };
  leaders: Array<{ id: number; fullName: string; role: string; email: string | null; phone: string | null }>;
  participants: Array<{ id: number; firstName: string; lastName: string; birthYear: number; gender: "F" | "M" }>;
  entries: Array<{ id: number; participantId: number; categoryId: number; teamName: string | null; siacNumber: string | null }>;
  sports: Sport[];
  safetyDocument: SafetyDocument | null;
  requiredLeaders: number;
  rosterEditable: boolean;
  readiness: RosterReadiness;
};

type RegistrationDraft = { sportId?: string; categoryId: string; teamName: string; teamNumber?: string; siacNumber?: string };

export function SchoolPortal() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [participantOpen, setParticipantOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true); const response = await fetch("/api/actions?view=school");
    if (response.status === 401) { setData(null); setLoading(false); return; }
    const body = await response.json(); if (!response.ok) setError(body.error); else setData(body); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <main className="mx-auto grid min-h-[60vh] max-w-5xl place-items-center px-4"><Loader2 className="size-10 animate-spin text-[#2910bf]"/></main>;
  if (!data) return <SchoolLogin onSuccess={load} error={error} />;

  async function action(payload: Record<string, unknown>) {
    setError(""); setNotice(""); const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Neizdevās saglabāt."); await load(true); return body;
  }
  function showError(reason: unknown) { setError(reason instanceof Error ? reason.message : "Neizdevās saglabāt."); }
  async function submitRoster() {
    setSubmitting(true); setNotice("");
    try { await action({ action: "submit-roster" }); setNotice("Komandas pieteikums ir pabeigts."); }
    catch (reason) { showError(reason); }
    finally { setSubmitting(false); }
  }
  async function logout() { await action({ action: "logout" }); setData(null); }

  return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeading eyebrow={data.school.municipality} title={data.school.name} description="Pārvaldiet komandas vadītājus, dalībniekus un pieteikumus sporta veidos."/><div className="flex flex-wrap items-center gap-2"><SchoolNameEditor name={data.school.name} onSave={async (name, previousName) => { await action({ action: "rename-school", name, previousName }); setNotice("Skolas nosaukums saglabāts."); }} /><Button variant="outline" onClick={logout}><LogOut/> Iziet</Button></div></div>
    {error && <p className="mb-5 rounded-2xl bg-red-50 p-4 font-bold text-red-800">{error}</p>}
    {notice && <p role="status" className="mb-5 rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-900">{notice}</p>}
    {!data.rosterEditable && <p className="mb-5 rounded-2xl bg-amber-50 p-4 font-bold text-amber-900">Komandas sastāva pievienošana un labošana ir slēgta. Saglabātie dalībnieki paliek reģistrēti; nepabeigts pieteikums netiek automātiski pabeigts. Ja pieteikums nav pabeigts vai vajadzīgas izmaiņas, sazinieties ar organizatoru.</p>}
    <section className={`mb-6 flex flex-wrap items-start justify-between gap-5 rounded-2xl border-2 p-6 ${data.readiness.submitted ? "border-emerald-300 bg-emerald-50" : "border-[#2910bf] bg-[#e9ecff]"}`}>
      <div>
        <h2 className="text-xl font-black">Komandas pieteikums: {data.readiness.submitted ? "pabeigts" : "nav pabeigts"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Katrs saglabātais dalībnieks jau ir reģistrēts. Ar pogu “Pabeigt pieteikumu” apstipriniet, ka sastāvs ir gatavs. Pēc izmaiņām tas jāapstiprina vēlreiz.</p>
        <p className="mt-2 text-sm text-muted-foreground">Drošības lapas augšupielāde nav obligāta pieteikuma pabeigšanai. Parakstīto lapu var iesniegt arī klātienē.</p>
        {data.readiness.issues.length > 0 && <ul className="mt-2 list-inside list-disc text-sm text-amber-900">{data.readiness.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        {data.readiness.canSubmit && !data.readiness.submitted && <p className="mt-2 text-sm">Pārbaudiet ievadīto sastāvu un nospiediet “Pabeigt pieteikumu”.</p>}
      </div>
      <Button size="lg" className="min-h-14 w-full bg-[#2910bf] px-8 text-base font-black shadow-md sm:w-auto" onClick={submitRoster} disabled={!data.rosterEditable || !data.readiness.canSubmit || data.readiness.submitted || submitting}>
        {submitting ? <Loader2 className="animate-spin" /> : <Save />} {data.readiness.submitted ? "Pieteikums pabeigts" : "Pabeigt pieteikumu"}
      </Button>
    </section>
    <section className="mb-7 grid gap-4 md:grid-cols-3">
      <Info label="Dalībnieki" value={data.participants.length} icon={<Users/>}/>
      <Info label="Komandas vadītāji" value={`${data.leaders.length} / ${data.requiredLeaders}`} icon={<UserRoundPlus/>} warning={data.leaders.length < data.requiredLeaders}/>
      <div className="glass-panel flex flex-wrap content-center gap-2 rounded-3xl p-5 md:col-span-1"><Button asChild className="bg-[#0c0942]"><Link href="/skolai/drosibas-lapa"><FileSignature/> Drošības parakstu lapa</Link></Button></div>
    </section>
    {data.leaders.length < data.requiredLeaders && <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 font-bold text-amber-900">{leaderRequirementMessage(data.participants.length, data.requiredLeaders, data.leaders.length)}</div>}
    <SafetyUpload schoolId={data.school.id} revision={data.school.rosterRevision} document={data.safetyDocument} onSaved={() => load(true)} />
    <Tabs defaultValue="participants">
      <TabsList className="mb-6 h-auto rounded-2xl bg-[#0c0942] p-1.5 text-white"><TabsTrigger value="participants" className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]">Dalībnieki</TabsTrigger><TabsTrigger value="leaders" className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]">Komandas vadītāji</TabsTrigger></TabsList>
      <TabsContent value="participants">
        <div className="mb-4 flex justify-end"><Dialog open={participantOpen} onOpenChange={setParticipantOpen}><DialogTrigger asChild><Button disabled={!data.rosterEditable} className="bg-[#0c0942]"><Plus/> Pievienot dalībnieku</Button></DialogTrigger><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Pievienot dalībnieku</DialogTitle><DialogDescription>Izvēlieties sporta veidu. Grupa tiks noteikta pēc dalībnieka dzimšanas gada un dzimuma.</DialogDescription></DialogHeader><ParticipantForm sports={data.sports} entries={data.entries} onSave={async (payload) => { await action({ action: "save-participant", ...payload }); setParticipantOpen(false); }} /></DialogContent></Dialog></div>
        <ParticipantTable data={data} onDelete={async (id) => { if (confirm("Vai noņemt dalībnieku un visus viņa pieteikumus?")) { try { await action({ action: "delete-participant", participantId: id }); } catch (reason) { showError(reason); } } }} onEdit={async (payload) => action({ action: "save-participant", ...payload })}/>
      </TabsContent>
      <TabsContent value="leaders"><LeaderSection data={data} onAdd={async (payload) => action({ action: "add-leader", ...payload })} onDelete={async (id) => { try { await action({ action: "delete-leader", leaderId: id }); } catch (reason) { showError(reason); } }}/></TabsContent>
    </Tabs>
  </main>;
}

function SchoolLogin({ onSuccess, error: initialError }: { onSuccess: () => void; error: string }) {
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const code = String(new FormData(event.currentTarget).get("code") ?? ""); const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login-school", code }) }); const body = await response.json(); if (!response.ok) { setError(body.error); setBusy(false); return; } onSuccess(); }
  return <main className="mx-auto max-w-xl px-4 py-14 sm:px-6"><PageHeading eyebrow="Skolas sadaļa" title="Ievadiet piekļuves kodu" description="Kods tiek nosūtīts skolas kontaktpersonai pēc pieteikuma apstiprināšanas."/><form onSubmit={submit} className="glass-panel rounded-3xl p-6 sm:p-8"><label className="form-label">Skolas piekļuves kods<input className="form-control text-lg font-black uppercase tracking-[.25em]" name="code" required autoComplete="one-time-code" /></label>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 font-bold text-red-800">{error}</p>}<Button type="submit" size="lg" disabled={busy} className="mt-5 min-h-12 bg-[#0c0942]">{busy ? <Loader2 className="animate-spin"/> : <KeyRound/>} Atvērt skolas sadaļu</Button></form></main>;
}

function ParticipantForm({ sports, entries, onSave, participant, registrations }: { sports: Sport[]; entries: PortalData["entries"]; onSave: (payload: Record<string, unknown>) => Promise<unknown>; participant?: PortalData["participants"][number]; registrations?: RegistrationDraft[] }) {
  const [firstName, setFirstName] = useState(participant?.firstName ?? "");
  const [lastName, setLastName] = useState(participant?.lastName ?? "");
  const [birthYear, setBirthYear] = useState(participant?.birthYear ? String(participant.birthYear) : "");
  const [gender, setGender] = useState<"F" | "M">(participant?.gender ?? "F");
  const [rows, setRows] = useState<RegistrationDraft[]>(() => registrations?.length ? registrations.map(row => ({
    ...row, sportId: String(sports.find(sport => sport.categories.some(category => String(category.id) === row.categoryId))?.id ?? ""),
  })) : [{ sportId: "", categoryId: "", teamName: "" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resolvedRows = rows.map(row => {
    const sport = sports.find(sport => String(sport.id) === row.sportId);
    return { row, sport, ...resolveParticipantCategory(sport?.categories ?? [], birthYear, gender, row.categoryId) };
  });
  function changeDemographics(year: string, group: "F" | "M") {
    setBirthYear(year); setGender(group);
    setRows(values => values.map(row => {
      const categories = sports.find(sport => String(sport.id) === row.sportId)?.categories ?? [];
      const previous = resolveParticipantCategory(categories, birthYear, gender, row.categoryId).selected;
      const next = resolveParticipantCategory(categories, year, group, row.categoryId).selected;
      return { ...row, categoryId: next ? String(next.id) : "", teamNumber: previous?.id === next?.id ? row.teamNumber : "1" };
    }));
  }
  function updateRow(index: number, patch: Partial<RegistrationDraft>) {
    setRows(values => values.map((row, i) => i === index ? { ...row, ...patch } : row));
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (resolvedRows.some(({ selected }) => !selected))
        throw new Error("Pārbaudiet dzimšanas gadu un sporta veidu. Ja piedāvātas vairākas disciplīnas vai ieskaites, izvēlieties nepieciešamo.");
      await onSave({ id: participant?.id, firstName, lastName, birthYear: Number(birthYear), gender,
        registrations: resolvedRows.map(({ row, selected, sport }) => ({ categoryId: selected!.id, teamNumber: Number(row.teamNumber || 1), siacNumber: sport?.code === "winter-orienteering" ? row.siacNumber ?? "" : "" })) });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Neizdevās saglabāt."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2">
    <label className="form-label">Vārds<input className="form-control" value={firstName} onChange={e => setFirstName(e.target.value)} required /></label>
    <label className="form-label">Uzvārds<input className="form-control" value={lastName} onChange={e => setLastName(e.target.value)} required /></label>
    <label className="form-label">Dzimšanas gads<input className="form-control" type="number" min="2000" max="2030" value={birthYear} onChange={e => changeDemographics(e.target.value, gender)} required /></label>
    <label className="form-label">Dzimums<select className="form-control" value={gender} onChange={e => changeDemographics(birthYear, e.target.value as "F" | "M")}><option value="F">Meitenes / jaunietes</option><option value="M">Zēni / jaunieši</option></select></label>
  </div><div>
    <div className="mb-3 flex items-center justify-between"><h3 className="font-black">Sporta veidi</h3><Button type="button" variant="outline" size="sm" onClick={() => setRows(values => [...values, { sportId: "", categoryId: "", teamName: "" }])}><Plus /> Vēl viens</Button></div>
    <p className="mb-3 text-sm text-muted-foreground">Izvēlieties sporta veidu — grupu sistēma noteiks pēc dzimšanas gada un dzimuma. Ja pieejamas vairākas disciplīnas vai ieskaites, izvēlieties nepieciešamo.</p>
    {sports.every(sport => !sport.categories.length) && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Administrators vēl nav publicējis jaunā gada kategorijas.</p>}
    <div className="grid gap-3">{resolvedRows.map(({ row, sport, options, selected, automatic }, index) => {
      const disciplines = new Set(options.map(category => category.discipline));
      const choiceLabel = disciplines.size === options.length ? "Disciplīna" : disciplines.size === 1 ? "Ieskaites veids" : "Disciplīna / ieskaites veids";
      const names = teamOptions(entries.filter(entry => entry.categoryId === selected?.id));
      return <div key={index} className="grid min-w-0 items-start gap-3 rounded-2xl bg-[#f0f1ff] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="form-label">Sporta veids<select className="form-control" value={row.sportId ?? ""} required onChange={e => updateRow(index, { sportId: e.target.value, categoryId: "", teamNumber: "1", siacNumber: "" })}><option value="">Izvēlieties sporta veidu</option>{sports.map(sport => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
        <div className="grid min-w-0 content-start gap-3">
          {options.length > 1 && <label className="form-label">{choiceLabel}<select className="form-control" value={selected ? String(selected.id) : ""} required onChange={e => updateRow(index, { categoryId: e.target.value, teamNumber: "1" })}><option value="">Izvēlieties</option>{options.map(category => <option key={category.id} value={category.id}>{disciplines.size === options.length ? category.discipline : disciplines.size === 1 ? category.name : `${category.discipline} — ${category.name}`}</option>)}</select>{sport?.code !== "hockey-3x3" && <span className="text-xs font-normal text-muted-foreground">Šo izvēli nevar noteikt tikai pēc dzimšanas gada un dzimuma.</span>}</label>}
          <div role="status" className={`rounded-xl border p-3 ${selected ? "border-emerald-200 bg-white" : "border-[#c7cfff] bg-white/70"}`}>
            <p className="text-xs font-bold text-muted-foreground">{automatic ? "Grupa · noteikta automātiski" : "Grupa / ieskaite"}</p>
            {selected ? <><strong className="mt-1 block">{selected.name}</strong><span className="mt-1 block text-xs text-muted-foreground">{selected.discipline} · {selected.minBirthYear}–{selected.maxBirthYear}. dzimšanas gads</span></> : <p className={`mt-1 text-sm ${sport && birthYear && !options.length ? "text-amber-900" : "text-muted-foreground"}`}>{!sport ? "Izvēlieties sporta veidu." : !birthYear ? "Norādiet dzimšanas gadu." : !options.length ? "Šajā sporta veidā nav dzimšanas gadam un dzimumam atbilstošas grupas." : "Izvēlieties disciplīnu vai ieskaites veidu."}</p>}
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label={`Noņemt ${index + 1}. sporta pieteikumu`} className="self-end text-red-700" disabled={rows.length === 1} onClick={() => setRows(values => values.filter((_, i) => i !== index))}><Trash2 /></Button>
        {sport?.code === "winter-orienteering" && <label className="form-label sm:col-span-2">SIAC numurs (neobligāts)<input className="form-control" inputMode="numeric" maxLength={40} value={row.siacNumber ?? ""} onChange={e => updateRow(index, { siacNumber: e.target.value })} placeholder="Dalībnieka SIAC numurs" /><span className="text-xs font-normal text-muted-foreground">Ja numurs nav zināms, lauku var atstāt tukšu.</span></label>}
        {sport?.mode === "team" && selected && selected.schoolLimit !== 1 && <label className="form-label sm:col-span-2">Komanda (skolas ietvaros)<select className="form-control" value={row.teamNumber || "1"} onChange={e => updateRow(index, { teamNumber: e.target.value })}>{Array.from({ length: Math.min(selected.schoolLimit ?? names.length + 1, names.length + 1) }, (_, i) => <option key={i + 1} value={i + 1}>{names[i] ?? numberedTeam(names.map(teamName => ({ teamName })), i + 1)}</option>)}</select><span className="text-xs font-normal">Komandas nosaukums nav jāievada.</span></label>}
      </div>;
    })}</div>
  </div>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 font-bold text-red-800">{error}</p>}<Button type="submit" disabled={busy} className="justify-self-start bg-[#0c0942]">{busy ? <Loader2 className="animate-spin" /> : <Save />} Saglabāt dalībnieku</Button></form>;
}

function ParticipantTable({ data, onDelete, onEdit }: { data: PortalData; onDelete: (id: number) => void; onEdit: (payload: Record<string, unknown>) => Promise<unknown> }) {
  const [sportId, setSportId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const selectedSport = data.sports.find(sport => String(sport.id) === sportId);
  const visible = data.participants.filter(person => {
    const query = search.trim().toLocaleLowerCase("lv");
    return (!query || `${person.firstName} ${person.lastName}`.toLocaleLowerCase("lv").includes(query)) &&
      ((!sportId && !categoryId) || data.entries.some(entry => entry.participantId === person.id &&
        (!categoryId || String(entry.categoryId) === categoryId) && (!selectedSport || selectedSport.categories.some(category => category.id === entry.categoryId))));
  });
  return <section><div className="mb-4 grid gap-3 sm:grid-cols-3">
    <label className="form-label">Meklēt dalībnieku<input className="form-control" value={search} onChange={event => setSearch(event.target.value)} placeholder="Vārds, uzvārds" /></label>
    <label className="form-label">Sporta veids<select className="form-control" value={sportId} onChange={event => { setSportId(event.target.value); setCategoryId(""); }}><option value="">Visi sporta veidi</option>{data.sports.map(sport => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
    <label className="form-label">Disciplīna / kategorija<select className="form-control" value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">Visas kategorijas</option>{(selectedSport ? [selectedSport] : data.sports).flatMap(sport => sport.categories.map(category => <option key={category.id} value={category.id}>{sport.name} — {category.name}</option>))}</select></label>
  </div><p role="status" className="mb-3 text-sm text-muted-foreground">Atlasīti {visible.length} no {data.participants.length} dalībniekiem</p><div className="glass-panel overflow-hidden rounded-3xl">{visible.length === 0 ? <p className="p-8 text-center font-bold text-[#65647b]">Ar izvēlētajiem filtriem dalībnieku nav.</p> : <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Dalībnieks</th><th>Dzimšanas gads</th><th>Pieteiktie sporta veidi</th><th></th></tr></thead><tbody>{visible.map((person) => { const personEntries = data.entries.filter((entry) => entry.participantId === person.id); const regs = personEntries.map((entry) => ({ categoryId: String(entry.categoryId), siacNumber: entry.siacNumber ?? "", teamName: entry.teamName ?? "", teamNumber: String(Math.max(0, teamOptions(data.entries.filter(item => item.categoryId === entry.categoryId)).indexOf(entry.teamName ?? "")) + 1) })); return <tr key={person.id}><td className="font-black">{person.firstName} {person.lastName}<div className="mt-1 text-xs font-normal text-[#65647b]">{person.gender === "F" ? "Meitenes / jaunietes" : "Zēni / jaunieši"}</div></td><td>{person.birthYear}</td><td>{personEntries.map((entry) => { const sport = data.sports.find((item) => item.categories.some((category) => category.id === entry.categoryId)); const category = sport?.categories.find((item) => item.id === entry.categoryId); return <span key={entry.id} className="mr-2 inline-flex rounded-full bg-[#e9ecff] px-2.5 py-1 text-xs font-bold text-[#2910bf]">{sport?.name}: {category?.name}{entry.teamName ? ` — ${entry.teamName}` : ""}{entry.siacNumber ? ` · SIAC: ${entry.siacNumber}` : ""}</span>; })}</td><td><div className="flex justify-end gap-1"><ParticipantEditor sports={data.sports} entries={data.entries} person={person} registrations={regs} editable={data.rosterEditable} onSave={onEdit}/><Button size="icon-sm" variant="ghost" className="text-red-700" disabled={!data.rosterEditable} aria-label={`Noņemt ${person.firstName} ${person.lastName}`} onClick={() => onDelete(person.id)}><Trash2/></Button></div></td></tr>; })}</tbody></table></div>}</div></section>; }

function ParticipantEditor({ sports, entries, person, registrations, editable, onSave }: {
  sports: Sport[]; entries: PortalData["entries"]; person: PortalData["participants"][number]; registrations: RegistrationDraft[];
  editable: boolean; onSave: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="icon-sm" variant="ghost" disabled={!editable}
      aria-label={`Labot ${person.firstName} ${person.lastName}`}><Edit3 /></Button></DialogTrigger>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>Labot dalībnieku</DialogTitle>
        <DialogDescription>Izmaiņas saglabās jau ievadītos rezultātus. Disciplīnu ar rezultātu nevar noņemt.</DialogDescription></DialogHeader>
      <ParticipantForm sports={sports} entries={entries} participant={person} registrations={registrations}
        onSave={async payload => { await onSave(payload); setOpen(false); }} />
    </DialogContent>
  </Dialog>;
}

function LeaderSection({ data, onAdd, onDelete }: { data: PortalData; onAdd: (payload: Record<string, unknown>) => Promise<unknown>; onDelete: (id: number) => Promise<unknown> }) { const [error, setError] = useState(""); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form)); try { await onAdd(values); form.reset(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Neizdevās saglabāt."); } } return <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={submit} className="glass-panel rounded-3xl p-5"><fieldset disabled={!data.rosterEditable}><h2 className="mb-4 text-xl font-black">Pievienot vadītāju</h2><div className="grid gap-4"><label className="form-label">Vārds, uzvārds<input className="form-control" name="fullName" required/></label><label className="form-label">Amats / loma<input className="form-control" name="role" defaultValue="Komandas vadītājs" required/></label><label className="form-label">E-pasts<input className="form-control" name="email" type="email"/></label><label className="form-label">Tālrunis<input className="form-control" name="phone"/></label></div>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}<Button className="mt-5 bg-[#0c0942]"><Plus/> Pievienot</Button></fieldset></form><div className="glass-panel overflow-hidden rounded-3xl"><table className="data-table"><thead><tr><th>Vadītājs</th><th>Kontakti</th><th></th></tr></thead><tbody>{data.leaders.map((leader) => <tr key={leader.id}><td><strong>{leader.fullName}</strong><div className="text-xs text-[#65647b]">{leader.role}</div></td><td>{leader.email}<br/>{leader.phone}</td><td><Button variant="ghost" size="icon-sm" className="text-red-700" disabled={!data.rosterEditable} aria-label={`Noņemt vadītāju ${leader.fullName}`} onClick={() => onDelete(leader.id)}><Trash2/></Button></td></tr>)}</tbody></table>{data.leaders.length === 0 && <p className="p-8 text-center font-bold text-[#65647b]">Vadītāji vēl nav pievienoti.</p>}</div></div>; }

function Info({ label, value, icon, warning }: { label: string; value: React.ReactNode; icon: React.ReactNode; warning?: boolean }) { return <div className="glass-panel flex items-center gap-4 rounded-3xl p-5"><span className={`grid size-12 place-items-center rounded-2xl ${warning ? "bg-amber-200" : "bg-[#d2d61d]"}`}>{icon}</span><div><strong className="block text-3xl font-black">{value}</strong><span className="text-sm font-bold text-[#65647b]">{label}</span></div></div>; }
