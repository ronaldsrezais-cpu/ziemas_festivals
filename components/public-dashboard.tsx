"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Filter, Medal, School, Trophy, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

type PublicData = {
  sports: Array<{
    id: number;
    name: string;
    location: string;
    mode: "individual" | "team";
    categories: Array<{ id: number; name: string }>;
  }>;
  schools: Array<{ id: number; name: string; municipality: string }>;
  participants: Array<{
    id: number;
    firstName: string;
    lastName: string;
    birthYear: number;
    gender: "F" | "M";
    schoolId: number;
    schoolName: string;
    municipality: string;
  }>;
  participantsPublic: boolean;
  participantCount: number;
  results: Array<{
    id: number;
    placement: number | null;
    status: string;
    score: string | null;
    categoryId: number;
    categoryName: string;
    discipline: string;
    gender: string;
    sportId: number;
    sportName: string;
    participantId: number;
    participantName: string;
    participantLastName: string;
    schoolId: number;
    schoolName: string;
    municipality: string;
    teamName: string | null;
    sourceUploadId: number | null;
  }>;
  uploads: Array<{ id: number; fileName: string }>;
  judges: Array<{
    id: number;
    fullName: string;
    sportId: number;
    sportName: string;
  }>;
};

export function PublicDashboard() {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState("");
  const [school, setSchool] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [sport, setSport] = useState("");
  useEffect(() => {
    fetch("/api/actions?view=public")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        return body;
      })
      .then(setData)
      .catch((reason) => setError(reason.message));
  }, []);

  const municipalities = useMemo(
    () =>
      Array.from(
        new Set(data?.schools.map((item) => item.municipality) ?? []),
      ).sort(),
    [data],
  );
  const filteredSchools = useMemo(
    () =>
      (data?.schools ?? []).filter(
        (item) =>
          (!school || item.id === Number(school)) &&
          (!municipality || item.municipality === municipality),
      ),
    [data, school, municipality],
  );
  const filteredParticipants = useMemo(
    () =>
      (data?.participants ?? []).filter(
        (person) =>
          (!school || person.schoolId === Number(school)) &&
          (!municipality || person.municipality === municipality),
      ),
    [data, school, municipality],
  );
  const filteredResults = useMemo(
    () =>
      (data?.results ?? []).filter(
        (row) =>
          (!school || row.schoolId === Number(school)) &&
          (!municipality || row.municipality === municipality) &&
          (!sport || row.sportId === Number(sport)),
      ),
    [data, school, municipality, sport],
  );
  const medalTable = useMemo(() => {
    const counted = new Set<string>();
    const rows = new Map<
      number,
      {
        school: string;
        municipality: string;
        gold: number;
        silver: number;
        bronze: number;
      }
    >();
    for (const result of filteredResults) {
      if (!result.placement || result.placement > 3) continue;
      const key = `${result.schoolId}:${result.categoryId}:${result.placement}:${result.teamName ?? result.participantId}`;
      if (counted.has(key)) continue;
      counted.add(key);
      const current = rows.get(result.schoolId) ?? {
        school: result.schoolName,
        municipality: result.municipality,
        gold: 0,
        silver: 0,
        bronze: 0,
      };
      if (result.placement === 1) current.gold += 1;
      if (result.placement === 2) current.silver += 1;
      if (result.placement === 3) current.bronze += 1;
      rows.set(result.schoolId, current);
    }
    return Array.from(rows.values()).sort(
      (a, b) =>
        b.gold - a.gold ||
        b.silver - a.silver ||
        b.bronze - a.bronze ||
        a.school.localeCompare(b.school, "lv"),
    );
  }, [filteredResults]);

  return (
    <main>
      <section className="snow-band px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[.2em] text-[#f7d21f]">
            Latvijas skolu Ziemas festivāls
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
            Dalībnieki un sacensību rezultāti
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-cyan-50/80">
            Pirms sacensībām šeit redzamas apstiprinātās skolas un dalībnieki.
            Pēc tiesnešu apstiprinājuma tiek publicēti rezultāti un skolu medaļu
            kopvērtējums.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">
            {error}
          </div>
        )}
        {!data ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-32 rounded-3xl" />
            ))}
          </div>
        ) : (
          <>
            <section className="mb-8 grid gap-4 sm:grid-cols-3">
              <Stat
                icon={<School />}
                label="Apstiprinātas skolas"
                value={data.schools.length}
              />
              <Stat
                icon={<Users />}
                label="Reģistrēti dalībnieki"
                value={data.participantCount}
              />
              <Stat
                icon={<Trophy />}
                label="Publicēti rezultāti"
                value={data.results.length}
              />
            </section>
            <section className="glass-panel mb-8 rounded-3xl p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2 font-black">
                <Filter className="size-5 text-[#008baa]" /> Filtri
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="form-label">
                  Skola
                  <select
                    className="form-control"
                    value={school}
                    onChange={(event) => setSchool(event.target.value)}
                  >
                    <option value="">Visas skolas</option>
                    {data.schools.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Novads / pilsēta
                  <select
                    className="form-control"
                    value={municipality}
                    onChange={(event) => setMunicipality(event.target.value)}
                  >
                    <option value="">Visi novadi</option>
                    {municipalities.map((item) => (
                      <option value={item} key={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Sporta veids
                  <select
                    className="form-control"
                    value={sport}
                    onChange={(event) => setSport(event.target.value)}
                  >
                    <option value="">Visi sporta veidi</option>
                    {data.sports.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
            <Tabs defaultValue="participants">
              <TabsList className="mb-6 h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl bg-[#07152f] p-1.5 text-white">
                <TabsTrigger
                  value="participants"
                  className="min-h-11 px-5 data-[state=active]:bg-[#f7d21f] data-[state=active]:text-[#07152f]"
                >
                  Skolas un dalībnieki
                </TabsTrigger>
                <TabsTrigger
                  value="results"
                  className="min-h-11 px-5 data-[state=active]:bg-[#f7d21f] data-[state=active]:text-[#07152f]"
                >
                  Rezultāti
                </TabsTrigger>
                <TabsTrigger
                  value="medals"
                  className="min-h-11 px-5 data-[state=active]:bg-[#f7d21f] data-[state=active]:text-[#07152f]"
                >
                  Skolu kopvērtējums
                </TabsTrigger>
              </TabsList>
              <TabsContent value="participants">
                <Participants
                  schools={filteredSchools}
                  participants={filteredParticipants}
                  participantsPublic={data.participantsPublic}
                />
              </TabsContent>
              <TabsContent value="results">
                <Results data={data} rows={filteredResults} />
              </TabsContent>
              <TabsContent value="medals">
                <Medals rows={medalTable} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="glass-panel flex items-center gap-4 rounded-3xl p-5">
      <span className="grid size-12 place-items-center rounded-2xl bg-[#f7d21f] text-[#07152f]">
        {icon}
      </span>
      <div>
        <strong className="block text-3xl font-black">{value}</strong>
        <span className="text-sm font-bold text-[#53657d]">{label}</span>
      </div>
    </div>
  );
}

function Participants({
  schools,
  participants,
  participantsPublic,
}: {
  schools: PublicData["schools"];
  participants: PublicData["participants"];
  participantsPublic: boolean;
}) {
  return (
    <div className="grid gap-5">
      {schools.length === 0 && <Empty text="Atbilstošu skolu nav." />}
      {schools.map((item) => {
        const schoolParticipants = participants.filter(
          (person) => person.schoolId === item.id,
        );
        return (
          <article
            key={item.id}
            className="glass-panel overflow-hidden rounded-3xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white/80 px-5 py-4">
              <div>
                <h2 className="text-xl font-black">{item.name}</h2>
                <p className="text-sm text-[#53657d]">{item.municipality}</p>
              </div>
              {participantsPublic && (
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-black text-cyan-900">
                  {schoolParticipants.length} dalībnieki
                </span>
              )}
            </div>
            {participantsPublic ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dalībnieks</th>
                      <th>Dzimšanas gads</th>
                      <th>Grupa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolParticipants.map((person) => (
                      <tr key={person.id}>
                        <td className="font-bold">
                          {person.firstName} {person.lastName}
                        </td>
                        <td>{person.birthYear}</td>
                        <td>
                          {person.gender === "F"
                            ? "Meitenes / jaunietes"
                            : "Zēni / jaunieši"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {schoolParticipants.length === 0 && (
                  <p className="p-5 text-sm font-bold text-[#53657d]">
                    Dalībnieki vēl nav pievienoti.
                  </p>
                )}
              </div>
            ) : (
              <p className="p-5 text-sm font-bold text-[#53657d]">
                Dalībnieku vārdu saraksts pašlaik nav publisks.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Results({
  data,
  rows,
}: {
  data: PublicData;
  rows: PublicData["results"];
}) {
  const sports = data.sports.filter((item) =>
    rows.some((row) => row.sportId === item.id),
  );
  return (
    <div className="grid gap-6">
      {sports.length === 0 && <Empty text="Rezultāti vēl nav publicēti." />}
      {sports.map((item) => {
        const sportJudges = data.judges.filter(
          (judge) => judge.sportId === item.id,
        );
        return (
          <article
            key={item.id}
            className="glass-panel overflow-hidden rounded-3xl"
          >
            <div className="snow-band flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <h2 className="text-xl font-black">{item.name}</h2>
                <p className="text-sm text-cyan-100/75">{item.location}</p>
                {sportJudges.length > 0 && (
                  <p className="mt-1 text-xs font-bold text-cyan-50/90">
                    Tiesneši:{" "}
                    {sportJudges.map((judge) => judge.fullName).join(", ")}
                  </p>
                )}
              </div>
              {Array.from(
                new Set(
                  rows
                    .filter((row) => row.sportId === item.id)
                    .map((row) => row.sourceUploadId)
                    .filter(Boolean),
                ),
              ).map((uploadId) => {
                const file = data.uploads.find(
                  (upload) => upload.id === uploadId,
                );
                return file ? (
                  <a
                    key={uploadId}
                    href={`/api/files/${uploadId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20"
                  >
                    <Download className="size-4" /> {file.fileName}
                  </a>
                ) : null;
              })}
            </div>
            {item.categories
              .filter((category) =>
                rows.some((row) => row.categoryId === category.id),
              )
              .map((category) => (
                <ResultTable
                  key={category.id}
                  title={category.name}
                  rows={rows.filter((row) => row.categoryId === category.id)}
                  team={item.mode === "team"}
                />
              ))}
          </article>
        );
      })}
    </div>
  );
}

function ResultTable({
  title,
  rows,
  team,
}: {
  title: string;
  rows: PublicData["results"];
  team: boolean;
}) {
  const seen = new Set<string>();
  const display = rows.filter((row) => {
    const key = team
      ? `${row.schoolId}:${row.teamName}:${row.placement}`
      : String(row.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <div className="border-b last:border-0">
      <h3 className="bg-cyan-50 px-5 py-3 font-black text-[#075b79]">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Vieta</th>
              <th>{team ? "Komanda" : "Dalībnieks"}</th>
              <th>Skola</th>
              <th>Rezultāts</th>
            </tr>
          </thead>
          <tbody>
            {display.map((row) => (
              <tr key={row.id}>
                <td className="text-lg font-black">
                  {row.status === "ranked"
                    ? row.placement
                    : row.status.toUpperCase()}
                </td>
                <td className="font-bold">
                  {team
                    ? row.teamName
                    : `${row.participantName} ${row.participantLastName}`}
                </td>
                <td>{row.schoolName}</td>
                <td>{row.score ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Medals({
  rows,
}: {
  rows: Array<{
    school: string;
    municipality: string;
    gold: number;
    silver: number;
    bronze: number;
  }>;
}) {
  return (
    <article className="glass-panel overflow-hidden rounded-3xl">
      {rows.length === 0 ? (
        <Empty text="Kopvērtējums būs redzams pēc rezultātu publicēšanas." />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vieta</th>
                <th>Skola</th>
                <th>Novads</th>
                <th>🥇 Zelts</th>
                <th>🥈 Sudrabs</th>
                <th>🥉 Bronza</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.school}>
                  <td className="font-black">{index + 1}.</td>
                  <td className="font-black">{row.school}</td>
                  <td>{row.municipality}</td>
                  <td>{row.gold}</td>
                  <td>{row.silver}</td>
                  <td>{row.bronze}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="glass-panel grid min-h-48 place-items-center rounded-3xl p-8 text-center">
      <div>
        <Medal className="mx-auto mb-3 size-10 text-[#00a6c7]" />
        <p className="font-bold text-[#53657d]">{text}</p>
      </div>
    </div>
  );
}
