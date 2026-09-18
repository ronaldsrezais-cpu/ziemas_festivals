"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filterParticipants, genderLabel, schoolStatusLabel, type ListedParticipant } from "@/lib/participant-list";

export function ParticipantList() {
  const [people, setPeople] = useState<ListedParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [school, setSchool] = useState("");
  const [sport, setSport] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/participants", { signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Neizdevās ielādēt dalībniekus.");
      setPeople(body.participants);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const schools = [...new Map(people.map((person) => [person.schoolId, person.schoolName])).entries()];
  const registrations = people.flatMap((person) => person.registrations);
  const sports = [...new Map(registrations.map((entry) => [entry.sportId, entry.sportName])).entries()];
  const categories = [...new Map(registrations.filter((entry) => !sport || String(entry.sportId) === sport)
    .map((entry) => [entry.categoryId, `${entry.sportName}: ${entry.categoryName}`])).entries()];
  const filtered = filterParticipants(people, { school, sport, category, search });
  async function exportExcel() {
    setExporting(true); setError("");
    try {
      const query = new URLSearchParams({ format: "xlsx", school, sport, category, search });
      const response = await fetch(`/api/participants?${query}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Neizdevās eksportēt Excel failu.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `dalibnieki-${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Eksports neizdevās."); }
    finally { setExporting(false); }
  }
  if (loading) return <p role="status" className="flex items-center gap-2 p-6"><Loader2 className="animate-spin" /> Ielādē dalībniekus…</p>;
  return <section className="glass-panel rounded-3xl p-5">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-black">Dalībnieku saraksts</h2>
        <p className="mt-1 text-sm text-muted-foreground">{filtered.length} dalībnieki · {filtered.reduce((sum, person) => sum + person.registrations.length, 0)} pieteikumi</p>
        <p className="mt-1 text-sm text-muted-foreground">Excel failā ir lapas “Dalībnieki” un “Pieteikumi”. Eksportā tiek izmantoti izvēlētie filtri.</p></div>
      <Button onClick={exportExcel} disabled={exporting || !filtered.length}>{exporting ? <Loader2 className="animate-spin" /> : <Download />} Eksportēt Excel</Button>
    </div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="form-label">Meklēt<input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Vārds, uzvārds, skola, novads" /></label>
      <label className="form-label">Skola<select className="form-control" value={school} onChange={(event) => setSchool(event.target.value)}><option value="">Visas skolas</option>{schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="form-label">Sporta veids<select className="form-control" value={sport} onChange={(event) => { setSport(event.target.value); setCategory(""); }}><option value="">Visi pieejamie sporta veidi</option>{sports.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="form-label">Kategorija<select className="form-control" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Visas kategorijas</option>{categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Dalībnieks</th><th>Dzimšanas gads</th><th>Dzimums</th><th>Skola / novads</th><th>Sporta veidi un kategorijas</th></tr></thead>
      <tbody>{filtered.map((person) => <tr key={person.id}>
        <td className="font-bold">{person.firstName} {person.lastName}</td><td>{person.birthYear}</td><td>{genderLabel(person.gender)}</td>
        <td>{person.schoolName}<div className="text-xs text-muted-foreground">{person.municipality} · {schoolStatusLabel(person.schoolStatus)}</div></td>
        <td>{person.registrations.length ? person.registrations.map((entry) => <div key={entry.id} className="mb-1">{entry.sportName} — {entry.discipline}, {entry.categoryName}{entry.teamName ? ` (${entry.teamName})` : ""}</div>) : "Nav pieteikumu"}</td>
      </tr>)}</tbody></table></div>
    {!filtered.length && <p className="p-6 text-center text-muted-foreground">Nav dalībnieku, ko parādīt ar izvēlētajiem filtriem.</p>}
  </section>;
}
