"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Filter, Info, Medal, School, Trophy, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FestivalHero } from "@/components/festival-hero";

type PublicData = {
  sports: Array<{
    id: number;
    name: string;
    location: string;
    mode: "individual" | "team";
    categories: Array<{ id: number; name: string }>;
  }>;
  schools: Array<{ id: number; name: string; municipality: string; participantCount: number }>;
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

const emptyData: PublicData = { sports: [], schools: [], participants: [], participantsPublic: false, participantCount: 0, results: [], uploads: [], judges: [] };

export function PublicDashboard({ configured = true }: { configured?: boolean }) {
  const [data, setData] = useState<PublicData | null>(configured ? null : emptyData);
  const [error, setError] = useState("");
  const [school, setSchool] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [sport, setSport] = useState("");
  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    fetch("/api/actions?view=public", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        return body;
      })
      .then(setData)
      .catch(() => {
        if (controller.signal.aborted) return;
        setError("Sarakstus pašlaik neizdevās ielādēt. Lūdzu, mēģini vēlreiz vēlāk.");
        setData(emptyData);
      });
    return () => controller.abort();
  }, [configured]);

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
      <FestivalHero />
      <div id="dalibnieki" className="mx-auto max-w-7xl px-5 pt-12 sm:px-8 sm:pt-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow mb-3">Seko līdzi festivālam</p><h2 className="section-title text-3xl sm:text-4xl">Dalībnieki un rezultāti</h2></div>
          <p className="max-w-sm text-base leading-6 text-muted-foreground">Atrodi savu skolu un seko sacensību rezultātiem un medaļu kopvērtējumam.</p>
        </div>
        {!configured && <p role="status" className="mb-6 flex items-start gap-3 rounded-lg border border-[#c7cfff] bg-[#e9ecff] px-5 py-4 text-base text-[#0c0942]"><Info className="mt-0.5 size-5 shrink-0 text-primary" />Dalībnieku saraksti un rezultāti vēl nav pieejami. Lūdzu, ieskaties šeit vēlāk.</p>}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">
            {error}
          </div>
        )}
        {!data ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <section className="mb-8 grid gap-4 sm:grid-cols-3">
              <Stat
                icon={<School />}
                label="Apstiprinātas skolas"
                value={!configured || error ? "—" : data.schools.length}
              />
              <Stat
                icon={<Users />}
                label="Reģistrēti dalībnieki"
                value={!configured || error ? "—" : data.participantCount}
              />
              <Stat
                icon={<Trophy />}
                label="Publicēti rezultāti"
                value={!configured || error ? "—" : data.results.length}
              />
            </section>
            <section className="glass-panel mb-8 rounded-xl p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2 font-black">
                <Filter className="size-5 text-[#2910bf]" /> Filtri
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="form-label">
                  Skola
                  <select
                    className="form-control"
                    disabled={data.schools.length === 0}
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
                    disabled={municipalities.length === 0}
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
                    disabled={data.sports.length === 0}
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
              <TabsList className="dashboard-tabs mb-6" aria-label="Festivāla saraksti">
                <TabsTrigger
                  value="participants"
                  className="shrink-0"
                >
                  Skolas un dalībnieki
                </TabsTrigger>
                <TabsTrigger
                  value="results"
                  className="shrink-0"
                >
                  Rezultāti
                </TabsTrigger>
                <TabsTrigger
                  value="medals"
                  className="shrink-0"
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
  value: number | string;
}) {
  return (
    <div className="glass-panel flex items-center gap-4 rounded-xl p-5 sm:p-6">
      <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#e9ecff] text-[#2910bf]">
        {icon}
      </span>
      <div>
        <strong className="block text-4xl font-bold">{value}</strong>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
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
      {schools.length === 0 && <Empty text="Pašlaik nav skolu, ko parādīt." />}
      {schools.map((item) => {
        const schoolParticipants = participants.filter(
          (person) => person.schoolId === item.id,
        );
        return (
          <article
            key={item.id}
            className="glass-panel overflow-hidden rounded-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white/80 px-5 py-4">
              <div>
                <h2 className="text-xl font-black">{item.name}</h2>
                <p className="text-sm text-[#65647b]">{item.municipality}</p>
              </div>
              <span className="rounded-full bg-[#e9ecff] px-3 py-1 text-sm font-black text-[#2910bf]">
                  Reģistrēti dalībnieki: {item.participantCount}
              </span>
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
                  <p className="p-5 text-sm font-medium text-muted-foreground">
                    Dalībnieki vēl nav pievienoti.
                  </p>
                )}
              </div>
            ) : (
              <p className="p-5 text-sm font-medium text-muted-foreground">
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
            className="glass-panel overflow-hidden rounded-xl"
          >
            <div className="snow-band flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <h2 className="text-xl font-black">{item.name}</h2>
                <p className="text-sm text-[#c7cfff]/75">{item.location}</p>
                {sportJudges.length > 0 && (
                  <p className="mt-1 text-xs font-bold text-white/90">
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
      <h3 className="bg-[#f0f1ff] px-5 py-3 font-black text-[#2910bf]">
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
    <article className="glass-panel overflow-hidden rounded-xl">
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
    <div className="glass-panel grid min-h-56 place-items-center rounded-xl p-8 text-center">
      <div>
        <Medal className="mx-auto mb-4 size-9 text-[#2910bf]/45" />
        <p className="font-bold text-[#65647b]">{text}</p>
      </div>
    </div>
  );
}
