"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";

type PrintData = {
  school: { name: string; municipality: string };
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

function PrintActions({ backHref = "/skolai" }: { backHref?: string }) {
  return (
    <div className="no-print mx-auto mb-6 flex max-w-[210mm] items-center justify-between gap-3 px-4 pt-6">
      <Button asChild variant="outline">
        <Link href={backHref}>
          <ArrowLeft /> Atpakaļ
        </Link>
      </Button>
      <Button onClick={() => window.print()} className="bg-[#0c0942]">
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
              <th className="w-48 border p-2 text-left">Paraksts</th>
            </tr>
          </thead>
          <tbody>
            {data.participants.map((person, index) => (
              <tr key={person.id}>
                <td className="border p-2">{index + 1}.</td>
                <td className="border p-2 font-bold">
                  {person.firstName} {person.lastName}
                </td>
                <td className="border p-2">&nbsp;</td>
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

export function AdminAccreditationSheets() {
  const [data, setData] = useState<AdminPrintData | null>(null);
  const [error, setError] = useState("");
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
      name: `${person.firstName} ${person.lastName}`,
      role: "DALĪBNIEKS",
      organization: person.schoolName,
    })),
    ...data.leaders.map((person) => ({
      id: `l${person.id}`,
      name: person.fullName,
      role: person.role.toUpperCase(),
      organization: person.schoolName,
    })),
    ...data.judges.map((person) => ({
      id: `j${person.id}`,
      name: person.fullName,
      role: "TIESNESIS",
      organization: person.sportName,
    })),
  ];
  return (
    <>
      <PrintActions backHref="/admin" />
      <main className="print-sheet mx-auto w-[210mm] max-w-full bg-white p-[10mm] shadow-2xl">
        <div className="grid grid-cols-2 gap-[6mm]">
          {people.map((person) => (
            <article
              key={person.id}
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.04),rgba(255,255,255,.04)), url('/api/template'), linear-gradient(145deg,#dff7ff,#ffffff)",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              className="relative flex aspect-[1.58/1] break-inside-avoid flex-col overflow-hidden rounded-[5mm] border-2 border-[#0c0942] p-[7mm]"
            >
              <div className="relative flex items-center gap-2">
                <Snowflake className="size-7 text-[#2910bf]" />
                <strong className="rounded bg-white/80 px-2 py-1 text-sm tracking-tight">
                  ZIEMAS FESTIVĀLS
                </strong>
              </div>
              <div className="relative mt-auto rounded-2xl bg-white/90 p-4 shadow-sm">
                <p className="text-[10px] font-black tracking-[.18em] text-[#2910bf]">
                  {person.role}
                </p>
                <h2 className="mt-1 text-2xl font-black leading-tight">
                  {person.name}
                </h2>
                <p className="mt-1 text-sm font-bold text-[#65647b]">
                  {person.organization}
                </p>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
