"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";

type PrintData = {
  school: { name: string; municipality: string };
  entries: Array<{ participantId: number; categoryId: number }>;
  sports: Array<{ name: string; categories: Array<{ id: number; discipline: string; name: string }> }>;
  leaders: Array<{ id: number; fullName: string; role: string }>;
  participants: Array<{ id: number; firstName: string; lastName: string }>;
};

function usePrintData() {
  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/actions?view=school")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        return body;
      })
      .then(setData)
      .catch((reason) => setError(reason.message));
  }, []);
  return { data, error };
}

function PrintActions({ backHref = "/skolai", disabled = false }: { backHref?: string; disabled?: boolean }) {
  return (
    <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 pt-6">
      <Button asChild variant="outline">
        <Link href={backHref}>
          <ArrowLeft /> Atpakaļ
        </Link>
      </Button>
      <Button onClick={() => window.print()} disabled={disabled} className="bg-[#0c0942]">
        <Printer /> Drukāt / saglabāt PDF
      </Button>
    </div>
  );
}

export function SafetySheet() {
  const { data, error } = usePrintData();
  if (error)
    return <p className="p-8 text-center font-bold text-red-800">{error}</p>;
  if (!data)
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-10 animate-spin" />
      </div>
    );
  return (
    <>
      <PrintActions />
      <main className="print-sheet mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white px-[16mm] py-[14mm] text-[#0c0942] shadow-2xl">
        <header className="mb-7 flex items-center gap-4 border-b-4 border-[#d2d61d] pb-5">
          <span className="grid size-14 place-items-center rounded-full bg-[#0c0942] text-white">
            <Snowflake />
          </span>
          <div>
            <p className="text-sm font-black uppercase tracking-[.15em] text-[#2910bf]">
              Latvijas skolu Ziemas festivāls
            </p>
            <h1 className="text-2xl font-black">
              Drošības un kārtības noteikumu parakstu lapa
            </h1>
          </div>
        </header>
        <section className="mb-6 grid gap-2">
          <p>
            <strong>Skola:</strong> {data.school.name}
          </p>
          <p>
            <strong>Novads / valstspilsēta:</strong> {data.school.municipality}
          </p>
        </section>
        <p className="mb-4 text-sm leading-6">
          Esam iepazinušies ar Latvijas skolu Ziemas festivāla drošības un
          kārtības noteikumiem, apsolām tos ievērot un uzņemties personīgu
          atbildību par to neizpildi. Dalībnieku pienākums ir ievērot
          sabiedriskās kārtības, drošības, ugunsdrošības un vides aizsardzības
          prasības, kā arī organizatoru norādījumus.
        </p>
        <p className="mb-6 text-sm leading-6">
          Piekrītam, ka Festivāla norises dokumentēšanas un sabiedrības
          informēšanas nolūkā pasākumā var tikt veikta fotografēšana, video un
          audio ierakstīšana saskaņā ar organizatora privātuma informāciju.
        </p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#0c0942] text-white">
              <th className="border p-2 text-left">Nr.</th>
              <th className="border p-2 text-left">Vārds, uzvārds</th>
              <th className="w-64 border p-2 text-left">Sporta veids / disciplīna</th>
            </tr>
          </thead>
          <tbody>
            {data.participants.map((person, index) => (
              <tr key={person.id}>
                <td className="border p-2">{index + 1}.</td>
                <td className="border p-2 font-bold">
                  {person.firstName} {person.lastName}
                </td>
                <td className="border p-2">{data.entries.filter(entry => entry.participantId === person.id).map(entry => { const sport = data.sports.find(item => item.categories.some(category => category.id === entry.categoryId)); const category = sport?.categories.find(item => item.id === entry.categoryId); return <div key={entry.categoryId}>{sport?.name} — {category?.discipline ?? category?.name ?? "Disciplīna"}</div>; })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2 className="mt-8 text-lg font-black">Komandas vadītāji</h2>
        <p className="mb-4 mt-2 text-sm leading-6">
          Komandas vadītājs ir atbildīgs par dalībnieku drošības un kārtības
          noteikumu ievērošanu festivāla sacensību vietās, kopīgajos pasākumos
          un naktsmītnēs.
        </p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#f0f1ff]">
              <th className="border p-2 text-left">Vārds, uzvārds</th>
              <th className="border p-2 text-left">Loma</th>
              <th className="w-48 border p-2 text-left">Paraksts</th>
            </tr>
          </thead>
          <tbody>
            {data.leaders.map((leader) => (
              <tr key={leader.id}>
                <td className="border p-2 font-bold">{leader.fullName}</td>
                <td className="border p-2">{leader.role}</td>
                <td className="border p-2">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="mt-10 break-inside-avoid text-sm">
          <p className="font-bold">Skolas atbildīgās personas apliecinājums</p>
          <p className="mt-7">Vārds, uzvārds: __________________________________________________</p>
          <p className="mt-8">Paraksts: _____________________________ Datums: __________________</p>
        </section>
      </main>
    </>
  );
}

type AdminPrintData = {
  participants: Array<{
    id: number;
    firstName: string;
    lastName: string;
    schoolName: string;
  }>;
  leaders: Array<{
    id: number;
    fullName: string;
    role: string;
    schoolName: string;
  }>;
  judges: Array<{
    id: number;
    fullName: string;
    sportName: string;
  }>;
};

type AccreditationGroup = "all" | "participants" | "leaders" | "judges";

export function AdminAccreditationSheets({ initialGroup = "all" }: { initialGroup?: AccreditationGroup }) {
  const [data, setData] = useState<AdminPrintData | null>(null);
  const [error, setError] = useState("");
  const [group, setGroup] = useState<AccreditationGroup>(initialGroup);
  useEffect(() => {
    fetch("/api/actions?view=admin-accreditations")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        return body;
      })
      .then(setData)
      .catch((reason) => setError(reason.message));
  }, []);
  if (error)
    return <p className="p-8 text-center font-bold text-red-800">{error}</p>;
  if (!data)
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-10 animate-spin" />
      </div>
    );
  const people = [
    ...data.participants.map((person) => ({
      id: `p${person.id}`,
      group: "participants",
      name: `${person.firstName} ${person.lastName}`,
      role: "DALĪBNIEKS",
      organization: person.schoolName,
    })),
    ...data.leaders.map((person) => ({
      id: `l${person.id}`,
      group: "leaders",
      name: person.fullName,
      role: person.role.toUpperCase(),
      organization: person.schoolName,
    })),
    ...data.judges.map((person) => ({
      id: `j${person.id}`,
      group: "judges",
      name: person.fullName,
      role: "TIESNESIS",
      organization: person.sportName,
    })),
  ].filter((person) => group === "all" || person.group === group);
  return (
    <>
      <PrintActions backHref="/admin" disabled={!people.length} />
      <section className="no-print mx-auto mb-6 max-w-[210mm] px-4">
        <h1 className="mb-4 text-3xl font-black">Akreditācijas kartes</h1>
        <label className="form-label">Drukājamās kartes
          <select className="form-control" value={group} onChange={(event) => setGroup(event.target.value as AccreditationGroup)}>
            <option value="all">Visas akreditācijas ({data.participants.length + data.leaders.length + data.judges.length})</option>
            <option value="participants">Dalībnieki ({data.participants.length})</option>
            <option value="leaders">Komandu vadītāji ({data.leaders.length})</option>
            <option value="judges">Tiesneši ({data.judges.length})</option>
          </select>
        </label>
        <p className="mt-3 text-sm" role="status">Drukai atlasītas kartes: <strong>{people.length}</strong>. Katrai kartei ir priekšpuse un aizmugure.</p>
        <p className="mt-1 text-sm text-muted-foreground">Pieejamas apstiprināto skolu dalībnieku un vadītāju, kā arī aktīvo tiesnešu kartes.</p>
      </section>
      <div className="no-print mx-auto mb-6 max-w-[210mm] rounded-xl bg-amber-50 p-4 text-amber-950">
        <strong>Testa akreditācijas karte</strong>
        <p>Parauga datums — 16. februāris — un programma vēl nav saskaņoti šim gadam.</p>
        <p>Katram cilvēkam sagatavota A6 priekšpuse un programmas aizmugure. Drukājiet A6 formātā, 100% mērogā, bez galvenēm un kājenēm. Divpusējai drukai izvēlieties apgriešanu gar garo malu.</p>
      </div>
      {people.length === 0 && <p className="no-print p-8 text-center">Izvēlētajā grupā vēl nav cilvēku, kuriem izveidot kartes.</p>}
      <main className="accreditation-pages">
        <style>{`@media print { @page { size: A6 portrait; margin: 0; } }`}</style>
        {people.map((person) => (
          <div key={person.id} className="accreditation-pair">
            <article className="accreditation-card" aria-label={`Akreditācija: ${person.name}`}>
              {/* Native images preserve exact print dimensions and authenticated template access. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="accreditation-background" src="/api/template" alt="Akreditācijas kartes priekšpuse" />
              <div className="accreditation-person">
                <p className="accreditation-role">{person.role}</p>
                <h2 className="accreditation-name" style={{ fontSize: person.name.length > 42 ? "17pt" : person.name.length > 28 ? "21pt" : "26pt" }}>{person.name}</h2>
                <p className="accreditation-organization" style={{ fontSize: person.organization.length > 70 ? "11pt" : "14pt" }}>{person.organization}</p>
              </div>
            </article>
            <article className="accreditation-card" aria-label={`Programma: ${person.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="accreditation-background" src="/api/template?side=back" alt="Parauga programma — jāsaskaņo šim gadam" />
            </article>
          </div>
        ))}
      </main>
    </>
  );
}
