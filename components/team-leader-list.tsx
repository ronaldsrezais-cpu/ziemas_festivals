"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { schoolStatusLabel } from "@/lib/participant-list";

export type ListedLeader = {
  id: number;
  fullName: string;
  role: string;
  email: string | null;
  phone: string | null;
  schoolId: number;
  schoolName: string;
  municipality: string;
  schoolStatus: string;
};

export function TeamLeaderList({ leaders }: { leaders: ListedLeader[] }) {
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("");
  const query = search.trim().toLocaleLowerCase("lv");
  const schools = [...new Map(leaders.map((leader) => [leader.schoolId, leader.schoolName])).entries()];
  const filtered = leaders.filter((leader) =>
    (!school || String(leader.schoolId) === school) &&
    (!query || [leader.fullName, leader.role, leader.schoolName, leader.municipality, leader.email, leader.phone]
      .filter(Boolean).join(" ").toLocaleLowerCase("lv").includes(query)),
  );

  return <section className="glass-panel rounded-3xl p-5">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-black">Komandu vadītāju saraksts</h2>
        <p className="mt-1 text-sm text-muted-foreground" role="status">Atlasīti: {filtered.length} no {leaders.length} vadītājiem</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/admin/akreditacijas?group=leaders"><Printer /> Vadītāju akreditācijas</Link>
      </Button>
    </div>
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
