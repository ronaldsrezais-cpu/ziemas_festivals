"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { schoolStatusLabel } from "@/lib/participant-list";
import { filterTeamLeaders, type ListedLeader } from "@/lib/team-leader-list";

export type { ListedLeader } from "@/lib/team-leader-list";

export function TeamLeaderList({ leaders }: { leaders: ListedLeader[] }) {
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const schools = [...new Map(leaders.map((leader) => [leader.schoolId, leader.schoolName])).entries()];
  const filtered = filterTeamLeaders(leaders, { school, search });

  async function exportExcel() {
    setExporting(true);
    setError("");
    try {
      const query = new URLSearchParams({ school, search });
      const response = await fetch(`/api/team-leaders?${query}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Neizdevās eksportēt Excel failu.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `komandu-vaditaji-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Eksports neizdevās.");
    } finally {
      setExporting(false);
    }
  }

  return <section className="glass-panel rounded-3xl p-5">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-black">Komandu vadītāju saraksts</h2>
        <p className="mt-1 text-sm text-muted-foreground" role="status">Atlasīti: {filtered.length} no {leaders.length} vadītājiem</p>
        <p className="mt-1 text-xs text-muted-foreground">Excel failā iekļauti vadītāji atbilstoši izvēlētajiem filtriem.</p>
      </div>
      <Button type="button" variant="outline" onClick={exportExcel} disabled={exporting || !filtered.length}>
        {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {exporting ? "Gatavo Excel…" : "Eksportēt Excel"}
      </Button>
    </div>
    {error && <p className="mb-4 text-sm text-red-700" role="alert">{error}</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      <label className="form-label">Meklēt vadītāju
        <input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Vārds, uzvārds, skola, novads" />
      </label>
      <label className="form-label">Skola
        <select className="form-control" value={school} onChange={(event) => setSchool(event.target.value)}>
          <option value="">Visas skolas</option>
          {schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
    </div>
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead><tr><th>Vārds, uzvārds</th><th>Amats / loma</th><th>Skola / novads</th><th>E-pasts</th><th>Tālrunis</th></tr></thead>
        <tbody>{filtered.map((leader) => <tr key={leader.id}>
          <td className="font-bold">{leader.fullName}</td>
          <td>{leader.role}</td>
          <td>{leader.schoolName}<div className="text-xs text-muted-foreground">{leader.municipality} · {schoolStatusLabel(leader.schoolStatus)}</div></td>
          <td className="break-all">{leader.email || "—"}</td>
          <td className="whitespace-nowrap">{leader.phone || "—"}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {!filtered.length && <p className="p-6 text-center text-muted-foreground">Nav vadītāju, ko parādīt ar izvēlētajiem filtriem.</p>}
  </section>;
}
