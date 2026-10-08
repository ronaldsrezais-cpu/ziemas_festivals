"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { contactCsv } from "@/lib/contact-csv";

type Contacts = {
  categories: Array<{ id: number; name: string; discipline: string }>;
  schools: Array<{ id: number; name: string; municipality: string; categoryIds: number[];
    leaders: Array<{ id: number; fullName: string; role: string; email: string | null }> }>;
};
export function JudgeContacts() {
  const [data, setData] = useState<Contacts | null>(null);
  const [error, setError] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/judge-contacts", { signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Neizdevās ielādēt kontaktus.");
      setData(body);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, []);
  const categories = data?.categories.filter(item => !discipline || item.discipline === discipline) ?? [];
  const ids = new Set(categories.filter(item => !category || String(item.id) === category).map(item => item.id));
  const schools = data?.schools.filter(school => school.categoryIds.some(id => ids.has(id))) ?? [];
  function exportEmails() {
    const rows = schools.flatMap(school => school.leaders.filter(leader => leader.email).map(leader => [school.name, school.municipality, leader.fullName, leader.role, leader.email!]));
    const url = URL.createObjectURL(new Blob([contactCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "komandu-vaditaju-epasti.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="glass-panel rounded-3xl p-5"><h2 className="text-xl font-black">Komandu vadītāju e-pasti</h2>
    <p className="mt-2 text-sm text-muted-foreground">Redzami tikai to skolu vadītāji, kurām izvēlētajā disciplīnā vai kategorijā ir reģistrēti dalībnieki. Skolas vadītāji nav atsevišķi piesaistīti sporta veidiem, tādēļ redzami visi attiecīgās skolas vadītāji.</p>
    {error && <p role="alert" className="mt-4 text-red-800">{error}</p>}
    {!data && !error && <p role="status" className="mt-4">Ielādē kontaktus…</p>}
    {data && <><div className="my-5 grid gap-3 sm:grid-cols-2">
      <label className="form-label">Disciplīna<select className="form-control" value={discipline} onChange={event => { setDiscipline(event.target.value); setCategory(""); }}><option value="">Visas šī sporta veida disciplīnas</option>{[...new Set(data.categories.map(item => item.discipline))].map(name => <option key={name}>{name}</option>)}</select></label>
      <label className="form-label">Kategorija<select className="form-control" value={category} onChange={event => setCategory(event.target.value)}><option value="">Visas kategorijas</option>{categories.map(item => <option key={item.id} value={item.id}>{item.discipline} — {item.name}</option>)}</select></label>
    </div><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Atlasītas {schools.length} skolas</p><Button variant="outline" onClick={exportEmails} disabled={!schools.some(school => school.leaders.some(leader => leader.email))}>Eksportēt e-pastus (CSV)</Button></div>
    <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Skola</th><th>Komandas vadītājs</th><th>E-pasts</th></tr></thead><tbody>{schools.flatMap(school => school.leaders.length ? school.leaders.map(leader => <tr key={`${school.id}-${leader.id}`}><td><strong>{school.name}</strong><div className="text-xs text-muted-foreground">{school.municipality}</div></td><td>{leader.fullName}<div className="text-xs text-muted-foreground">{leader.role}</div></td><td>{leader.email ? <a className="break-all font-bold text-primary underline" href={`mailto:${leader.email}`}>{leader.email}</a> : <span className="text-amber-900">Skola nav norādījusi e-pastu</span>}</td></tr>) : <tr key={school.id}><td>{school.name}</td><td colSpan={2}>Skola vēl nav pievienojusi komandas vadītāju.</td></tr>)}</tbody></table></div>
    {!schools.length && <p className="p-5 text-center text-muted-foreground">Izvēlētajā disciplīnā vai kategorijā nav reģistrētu dalībnieku.</p>}</>}
  </section>;
}
