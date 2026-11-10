"use client";

import { JudgeContacts } from "@/components/judge-contacts";
import { JudgeStartProtocols } from "@/components/start-protocols";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { put } from "@vercel/blob/client";
import {
  CheckCircle2,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  LogOut,
  Save,
  Upload,
  Trash2,
} from "lucide-react";
import { resultTeamKey, resultTeamName } from "@/lib/team-results";
import { previewResultMatches, previewTeamResultMatches } from "@/lib/result-import";
import { ParticipantList } from "@/components/participant-list";
import { PageHeading } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Category = {
  id: number;
  name: string;
  discipline: string;
  gender: "F" | "M" | "X";
  minBirthYear: number;
  maxBirthYear: number;
};
type Entry = {
  entryId: number;
  categoryId: number;
  teamName: string | null;
  participantId: number;
  firstName: string;
  lastName: string;
  birthYear: number;
  gender: "F" | "M";
  schoolId: number;
  schoolName: string;
  municipality: string;
};
type Result = {
  id: number;
  entryId: number;
  categoryId: number;
  placement: number | null;
  status: "ranked" | "dns" | "dnf" | "dsq";
  score: string | null;
  sourceUploadId: number | null;
  published: boolean;
  updatedAt: string;
};
type JudgeData = {
  judge: { id: number; fullName: string; sportId: number; sportName: string; sportMode: "individual" | "team" };
  categories: Category[];
  entries: Entry[];
  results: Result[];
  uploads: Array<{
    id: number;
    fileName: string;
    status: string;
    createdAt: string;
  }>;
};
type PreviewRow = Entry & {
  members?: Entry[];
  sourceLine: string;
  matchNote: string;
  placement: string;
  status: Result["status"];
  score: string;
};

export function JudgePortal() {
  const [data, setData] = useState<JudgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resultNotice, setResultNotice] = useState("");
  const [resultMode, setResultMode] = useState("manual");
  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    try {
      const response = await fetch("/api/actions?view=judge", { cache: "no-store" });
      if (response.status === 401) {
        setData(null);
        return false;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Neizdevās ielādēt rezultātus.");
      setData(body);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Neizdevās ielādēt rezultātus.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  async function action(payload: Record<string, unknown>) {
    setError("");
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Neizdevās saglabāt.");
    return body;
  }
  if (loading)
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <Loader2 className="size-10 animate-spin" />
      </main>
    );
  if (!data) return <JudgeLogin onSuccess={load} initialError={error} />;
  async function logout() {
    await action({ action: "logout" });
    setData(null);
  }
  async function publish() {
    if (importBusy || publishing) return;
    if (!confirm("Publicēt visus saglabātos šī sporta veida rezultātus?")) return;
    setPublishing(true);
    setResultNotice("");
    try {
      await action({ action: "publish-sport" });
      if (await load(true)) setResultMode("manual");
      setResultNotice("Rezultāti publicēti publiskajā lapā.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Neizdevās publicēt.");
    } finally {
      setPublishing(false);
    }
  }
  async function remove(kind: "result" | "upload", id: number, label: string) {
    const explanation = kind === "upload" ? "Ievadītie rezultāti saglabāsies; saite uz failu tiks noņemta." : "Rezultāts tiks noņemts arī no publiskās lapas un kopvērtējuma. Dalībnieka pieteikums saglabāsies.";
    if (!confirm(`Dzēst ${label}? ${explanation}`)) return;
    try { await action({ action: kind === "upload" ? "delete-upload" : "delete-result", id }); setNotice(kind === "upload" ? "Fails izdzēsts. Rezultāti saglabāti." : "Rezultāts izdzēsts."); await load(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Neizdevās izdzēst."); }
  }
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading
          eyebrow={data.judge.sportName}
          title={data.judge.fullName}
          description="Pārbaudiet dalībnieku sarakstu, ievadiet rezultātus manuāli vai importējiet tiesnešu failu."
        />
        <Button variant="outline" onClick={logout}>
          <LogOut /> Iziet
        </Button>
      </div>
      {error && (
        <p className="mb-5 rounded-2xl bg-red-50 p-4 font-bold text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-5 rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-800">
          {notice}
        </p>
      )}
      <div className="mb-6 rounded-3xl bg-[#0c0942] p-5 text-white">
        <div>
          <strong className="text-xl">{data.entries.length} pieteikumi</strong>
          <p className="text-sm text-[#c7cfff]/75">
            {data.categories.length} kategorijās
          </p>
        </div>
      </div>
      <Tabs defaultValue="participants">
        <TabsList aria-label="Tiesnešu sadaļas" className="mb-6 h-auto w-full flex-wrap justify-start rounded-2xl bg-[#0c0942] p-1.5 text-white">
          <TabsTrigger value="participants" className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]">Reģistrētie dalībnieki</TabsTrigger>
          <TabsTrigger value="contacts" className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]">Komandu vadītāju e-pasti</TabsTrigger>
          <TabsTrigger value="start-protocols" className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]">Starta protokoli</TabsTrigger>
          <TabsTrigger
            value="results"
            className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]"
          >
            Rezultāti
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]"
          >
            Pievienotie faili
          </TabsTrigger>
        </TabsList>
        <TabsContent value="contacts"><JudgeContacts /></TabsContent>
        <TabsContent value="start-protocols"><JudgeStartProtocols sportId={data.judge.sportId} judgeId={data.judge.id} /></TabsContent>
        <TabsContent value="participants"><div className="mb-5 rounded-2xl bg-[#e9ecff] p-5"><h2 className="text-xl font-black">Reģistrētie dalībnieki</h2><p className="mt-2">Šeit skatiet un eksportējiet skolu pieteiktos dalībniekus. Sacensību rezultātus ievadiet vai importējiet sadaļā “Rezultāti”.</p></div><ParticipantList /></TabsContent>
        <TabsContent value="results">
          <Tabs value={resultMode} onValueChange={setResultMode}>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c7cfff] bg-[#e9ecff] p-3">
              <TabsList aria-label="Rezultātu ievades veids" className="h-auto max-w-full flex-wrap gap-1 bg-transparent p-0">
                <TabsTrigger value="manual" disabled={importBusy} className="min-h-10 px-4 data-[state=active]:bg-[#0c0942] data-[state=active]:text-white">
                  Ievadīt manuāli
                </TabsTrigger>
                <TabsTrigger value="import" disabled={publishing} className="min-h-10 px-4 data-[state=active]:bg-[#0c0942] data-[state=active]:text-white">
                  Importēt no faila
                </TabsTrigger>
              </TabsList>
              {resultMode === "manual" && (
                <Button
                  onClick={publish}
                  disabled={importBusy || publishing}
                  className="min-h-11 w-full bg-[#d2d61d] font-bold text-[#0c0942] hover:bg-[#e6e956] sm:w-auto"
                >
                  {publishing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  {publishing ? "Publicē…" : "Publicēt rezultātus"}
                </Button>
              )}
            </div>
            {resultNotice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{resultNotice}</p>}
            <TabsContent value="manual">
              <p className="mb-4 text-sm text-muted-foreground">
                {data.judge.sportMode === "team" ? "Ievadiet vietu vienreiz katrai komandai." : "Katram dalībniekam ievadiet vietu un saglabājiet."}
              </p>
              <ManualResults
                data={data}
                remove={(result, entry, team) => remove("result", result.id, team ? `${entry.schoolName} · ${resultTeamName(entry.teamName)} rezultātu` : `${entry.firstName} ${entry.lastName} rezultātu`)}
                save={async (payload) => {
                  await action({ action: "save-result", ...payload });
                  await load(true);
                }}
              />
            </TabsContent>
            <TabsContent value="import" forceMount className="data-[state=inactive]:hidden">
              <ImportResults
                data={data}
                publishing={publishing}
                onBusyChange={setImportBusy}
                save={async (payload) =>
                  action({ action: "save-result", ...payload })
                }
                finished={async (message) => {
                  if (await load(true)) setResultMode("manual");
                  setResultNotice(message);
                }}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="files">
          <div className="glass-panel overflow-hidden rounded-3xl">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fails</th>
                  <th>Statuss</th>
                  <th>Augšupielādēts</th><th>Darbības</th>
                </tr>
              </thead>
              <tbody>
                {data.uploads.map((file) => (
                  <tr key={file.id}>
                    <td className="font-black"><a href={`/api/files/${file.id}`} target="_blank" rel="noreferrer" className="underline">{file.fileName}</a></td>
                    <td>{file.status === "published" ? "Publicēts" : "Saglabāts"}</td>
                    <td>{new Date(file.createdAt).toLocaleString("lv-LV")}</td><td><Button size="sm" variant="outline" className="text-red-700" onClick={() => remove("upload", file.id, file.fileName)}><Trash2 /> Dzēst failu</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.uploads.length === 0 && (
              <p className="p-8 text-center font-bold text-[#65647b]">
                Faili vēl nav augšupielādēti.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function JudgeLogin({
  onSuccess,
  initialError,
}: {
  onSuccess: () => void;
  initialError: string;
}) {
  const [judges, setJudges] = useState<
    Array<{ id: number; fullName: string; sportName: string }>
  >([]);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/actions?view=judge-login")
      .then((response) => response.json())
      .then((body) => setJudges(body.judges ?? []));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "login-judge",
        judgeId: Number(values.judgeId),
        password: String(values.password),
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error);
      setBusy(false);
      return;
    }
    onSuccess();
  }
  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <PageHeading
        eyebrow="Tiesnešu sadaļa"
        title="Tiesneša piekļuve"
        description="Izvēlieties savu vārdu un ievadiet administratora piešķirto paroli."
      />
      <form onSubmit={submit} className="glass-panel rounded-3xl p-7">
        <div className="grid gap-4">
          <label className="form-label">
            Tiesnesis
            <select className="form-control" name="judgeId" required>
              <option value="">Izvēlieties</option>
              {judges.map((judge) => (
                <option value={judge.id} key={judge.id}>
                  {judge.sportName} — {judge.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Parole
            <input
              className="form-control"
              name="password"
              type="password"
              required
            />
          </label>
        </div>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 font-bold text-red-800">
            {error}
          </p>
        )}
        <Button disabled={busy} className="mt-5 bg-[#0c0942]" size="lg">
          {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Atvērt
          tiesneša sadaļu
        </Button>
      </form>
    </main>
  );
}

function ManualResults({
  data,
  save,
  remove,
}: {
  data: JudgeData;
  remove: (result: Result, entry: Entry, team?: Entry[]) => Promise<void>;
  save: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const [discipline, setDiscipline] = useState("");
  const disciplines = [...new Set(data.categories.map(category => category.discipline))];
  const resultsByEntry = new Map(data.results.map(result => [result.entryId, result]));
  const entriesByCategory = new Map<number, Entry[]>();
  for (const entry of data.entries) {
    const rows = entriesByCategory.get(entry.categoryId) ?? [];
    rows.push(entry);
    entriesByCategory.set(entry.categoryId, rows);
  }
  function renderRows(categoryId: number) {
    const rows = [...(entriesByCategory.get(categoryId) ?? [])].sort((a, b) =>
      (resultsByEntry.get(a.entryId)?.placement ?? Infinity) - (resultsByEntry.get(b.entryId)?.placement ?? Infinity) ||
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "lv"));
    const renderRow = (entry: Entry) => {
      const result = resultsByEntry.get(entry.entryId);
      return <ManualRow key={`${entry.entryId}:${result?.updatedAt ?? "new"}`} entry={entry} result={result}
        save={save} remove={remove} />;
    };
    if (data.judge.sportMode !== "team") return <tbody>{rows.map(renderRow)}</tbody>;
    const teams = new Map<string, { school: string; name: string; members: Entry[] }>();
    for (const entry of rows) {
      const name = resultTeamName(entry.teamName);
      const key = resultTeamKey(entry);
      const team = teams.get(key) ?? { school: entry.schoolName, name, members: [] };
      team.members.push(entry);
      teams.set(key, team);
    }
    return [...teams].map(([key, team]) => {
      const saved = team.members.flatMap(member => {
        const result = resultsByEntry.get(member.entryId);
        return result ? [result] : [];
      });
      const conflict = saved.some(result => result.placement !== saved[0].placement || result.status !== saved[0].status);
      return <tbody key={key}><ManualRow key={JSON.stringify(saved.map(result => [result.id, result.updatedAt]))}
        entry={team.members[0]} result={saved[0]} team={team.members} conflict={conflict} save={save} remove={remove} /></tbody>;
    });
  }
  return (
    <div className="grid gap-6">
      <label className="form-label max-w-md">Disciplīna<select className="form-control" value={discipline} onChange={event => setDiscipline(event.target.value)}><option value="">Visas disciplīnas</option>{disciplines.map(name => <option key={name}>{name}</option>)}</select></label>
      {disciplines.filter(name => !discipline || name === discipline).map(name => <section key={name} className="grid gap-4">
        <h2 className="text-2xl font-black">{name}</h2>
        {data.categories.filter(category => category.discipline === name).map((category) => (
        <article
          key={category.id}
          className="glass-panel overflow-hidden rounded-3xl"
        >
          <div className="border-b bg-[#f0f1ff] px-5 py-4">
            <h2 className="text-xl font-black">{category.name}</h2>
            <p className="text-sm text-[#65647b]">
              {category.discipline} · {category.minBirthYear}–
              {category.maxBirthYear}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{data.judge.sportMode === "team" ? "Komanda" : "Dalībnieks"}</th>
                  <th>Skola</th>
                  <th>Vieta</th>
                  <th>Statuss</th>
                  <th></th>
                </tr>
              </thead>
              {renderRows(category.id)}
            </table>
          </div>
          {!data.entries.some((entry) => entry.categoryId === category.id) && (
            <p className="p-5 text-sm font-bold text-[#65647b]">
              Šajā kategorijā pieteikumu nav.
            </p>
          )}
        </article>
      ))}</section>)}
    </div>
  );
}

function ManualRow({
  entry,
  result,
  team,
  conflict = false,
  save,
  remove,
}: {
  entry: Entry;
  result?: Result;
  team?: Entry[];
  conflict?: boolean;
  remove: (result: Result, entry: Entry, team?: Entry[]) => Promise<void>;
  save: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const [placement, setPlacement] = useState(
    !conflict && result?.placement ? String(result.placement) : "",
  );
  const [status, setStatus] = useState<Result["status"]>(
    conflict ? "ranked" : result?.status ?? "ranked",
  );
  const rowLabel = team ? `${entry.schoolName} · ${resultTeamName(entry.teamName)}` : `${entry.firstName} ${entry.lastName}`;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (status === "ranked" && (!Number.isSafeInteger(Number(placement)) || Number(placement) < 1)) {
      setError("Ievadiet iegūto vietu."); return;
    }
    setBusy(true); setError("");
    try { await save({
      categoryId: entry.categoryId,
      entryId: entry.entryId,
      placement: placement ? Number(placement) : null,
      status,
      score: result?.score ?? "",
    }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Neizdevās saglabāt."); }
    finally { setBusy(false); }
  }
  return (
    <tr>
      <td>{team ? <><strong>{resultTeamName(entry.teamName)}</strong>
        <ul className="mt-1 text-xs text-muted-foreground">{team.map(member => <li key={member.entryId}>{member.firstName} {member.lastName}</li>)}</ul>
        {conflict && <p className="mt-2 text-xs font-bold text-red-800">Iepriekš ievadītas atšķirīgas vietas vai statusi. Saglabājiet vienu rezultātu komandai.</p>}
      </> : <strong>{entry.firstName} {entry.lastName}</strong>}</td>
      <td>{entry.schoolName}<p className="mt-1 text-xs text-muted-foreground">{result ? result.published ? "Rezultāts publicēts" : "Rezultāts saglabāts" : "Rezultāts nav ievadīts"}</p></td>
      <td>
        <input
          className="form-control w-20"
          type="number"
          min="1"
          aria-label={`Vieta: ${rowLabel}`}
          value={placement}
          disabled={status !== "ranked"}
          onChange={(e) => setPlacement(e.target.value)}
        />
      </td>
      <td>
        <select
          className="form-control w-28"
          value={status}
          onChange={(e) => setStatus(e.target.value as Result["status"])}
        >
          <option value="ranked">Vieta</option>
          <option value="dns">DNS</option>
          <option value="dnf">DNF</option>
          <option value="dsq">DSQ</option>
        </select>
      </td>
      <td>
        <Button
          size="sm"
          aria-label={`Saglabāt rezultātu: ${entry.firstName} ${entry.lastName}`}
          onClick={submit}
          disabled={busy}
          className="bg-[#0c0942]"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Save />}
        </Button>
        {result && <Button size="icon-sm" variant="ghost" className="ml-1 text-red-700" disabled={busy} aria-label={`Dzēst rezultātu: ${entry.firstName} ${entry.lastName}`} onClick={() => remove(result, entry, team)}><Trash2 /></Button>}
        {error && <p role="alert" className="mt-2 max-w-48 text-sm text-red-800">{error}</p>}
      </td>
    </tr>
  );
}

async function extractFileText(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer() })
      .promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: Array<{ y: number; items: Array<{ x: number; text: string }> }> = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const y = item.transform[5];
        let line = lines.find((row) => Math.abs(row.y - y) < 3);
        if (!line) { line = { y, items: [] }; lines.push(line); }
        line.items.push({ x: item.transform[4], text: item.str });
      }
      pages.push(lines.sort((a, b) => b.y - a.y).map((line) =>
        line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join("\t"),
      ).join("\n"));
    }
    return pages.join("\n");
  }
  if (extension === "xlsx") {
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    const sheets = await readXlsxFile(file);
    return sheets
      .flatMap((sheet) => [
        sheet.sheet,
        ...sheet.data.map((row) => row.map((cell) => cell ?? "").join("\t")),
      ])
      .join("\n");
  }
  return file.text();
}

function ImportResults({
  data,
  publishing,
  onBusyChange,
  save,
  finished,
}: {
  data: JudgeData;
  publishing: boolean;
  onBusyChange: (busy: boolean) => void;
  save: (payload: Record<string, unknown>) => Promise<unknown>;
  finished: (message: string) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [extractedText, setExtractedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const disabled = busy || publishing;
  const isTeamSport = data.judge.sportMode === "team";
  const categories = new Map(data.categories.map(category => [category.id, category]));
  const hasResult = (row: Pick<PreviewRow, "placement" | "status">) =>
    row.status !== "ranked" || (/^[1-9]\d*$/.test(row.placement) && Number(row.placement) <= 2147483647);
  const rowsToSave = preview.filter(hasResult);
  const readyCount = rowsToSave.length;
  function updateRow(entryId: number, changes: Partial<Pick<PreviewRow, "placement" | "status">>) {
    setPreview(rows => rows.map(row => row.entryId === entryId ? { ...row, ...changes } : row));
  }
  async function analyse() {
    if (!file || disabled) return;
    setBusy(true); onBusyChange(true);
    setError("");
    setPreview([]);
    setExtractedText("");
    try {
      if (file.size > 12 * 1024 * 1024) {
        throw new Error("Fails pārsniedz 12 MB.");
      }
      const text = await extractFileText(file);
      setExtractedText(text);
      if (!text.trim()) throw new Error("Failā nav nolasāma teksta. Skenētam PDF nepieciešama teksta atpazīšana; izmantojiet Excel vai CSV failu.");
      const selectedEntries = data.entries.filter((entry) => !categoryId || entry.categoryId === Number(categoryId));
      if (!selectedEntries.length) throw new Error("Izvēlētajā atlasē nav pieteiktu dalībnieku.");
      if (isTeamSport) {
        const groups = new Map<string, Entry[]>();
        for (const entry of selectedEntries) {
          const key = resultTeamKey(entry);
          const members = groups.get(key) ?? [];
          members.push(entry);
          groups.set(key, members);
        }
        const teams = [...groups.values()].map(members => {
          const entry = members[0];
          const category = categories.get(entry.categoryId);
          return { entry, members, teamName: resultTeamName(entry.teamName), schoolName: entry.schoolName,
            categoryName: category?.name ?? "", discipline: category?.discipline ?? "" };
        });
        const matches = previewTeamResultMatches(text, teams, data.categories);
        setPreview(teams.map(({ entry, members }, index) => ({ ...entry, members, ...matches[index], score: "" })));
      } else {
        const matches = previewResultMatches(text, selectedEntries);
        setPreview(selectedEntries.map((entry, index) => ({ ...entry, ...matches[index], score: "" })));
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Failu neizdevās nolasīt.",
      );
    } finally {
      setBusy(false); onBusyChange(false);
    }
  }
  async function importRows() {
    if (!file || disabled || !readyCount) return;
    setBusy(true); onBusyChange(true);
    setError("");
    let stage = "Neizdevās saņemt atļauju augšupielādēt failu";
    let savedCount = 0;
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      const contentType = ({ pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        csv: "text/csv", tsv: "text/tab-separated-values", txt: "text/plain" } as Record<string, string>)[extension] ?? "application/octet-stream";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const pathname = `results/${data.judge.sportId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const tokenResponse = await fetch("/api/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "blob.generate-client-token",
          payload: { pathname, clientPayload: null, multipart: false },
        }),
      });
      const tokenBody = await tokenResponse.json().catch(() => null);
      if (!tokenResponse.ok || !tokenBody?.clientToken) {
        throw new Error(tokenBody?.error ?? `Neizdevās saņemt faila augšupielādes atļauju (HTTP ${tokenResponse.status}). Pārlādējiet lapu un pieslēdzieties tiesneša sadaļai vēlreiz.`);
      }
      // Only the short-lived, path-restricted client token reaches the browser.
      stage = "Neizdevās augšupielādēt rezultātu failu";
      const blob = await put(pathname, file, {
        access: "private",
        token: tokenBody.clientToken,
        contentType,
      });
      stage = "Fails augšupielādēts, bet to neizdevās pievienot rezultātiem";
      const uploadResponse = await fetch("/api/uploads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: blob.url,
          fileName: file.name,
          mimeType: contentType,
        }),
      });
      const uploadBody = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadBody.error);
      stage = "Fails pievienots, bet neizdevās saglabāt visus rezultātus";
      for (const row of rowsToSave) {
        await save({
          categoryId: row.categoryId,
          entryId: row.entryId,
          placement: row.status === "ranked" ? Number(row.placement) : null,
          status: row.status,
          score: row.score,
          sourceUploadId: uploadBody.upload.id,
        });
        savedCount++;
      }
      await finished(`Fails un rezultāti saglabāti. Saglabāto rindu skaits: ${savedCount}. Lai rezultāti būtu redzami publiskajā lapā, nospiediet “Publicēt rezultātus”.`);
      setPreview([]);
      setExtractedText("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "Nezināma kļūda.";
      setError(`${stage}. ${savedCount ? `Jau saglabātas rindas: ${savedCount}. ` : ""}${detail}`);
    } finally {
      setBusy(false); onBusyChange(false);
    }
  }
  function renderPreviewTable(rows: PreviewRow[], showCategory: boolean) {
    return <div className="overflow-x-auto">
      <table className="data-table">
        <thead><tr>
          <th>{isTeamSport ? "Komanda" : "Dalībnieks"}</th>
          {showCategory && <th>Disciplīna / kategorija</th>}
          <th>Skola</th><th>Vieta</th><th>Statuss</th>
        </tr></thead>
        <tbody>{rows.map(row => {
          const category = categories.get(row.categoryId);
          const label = row.members ? resultTeamName(row.teamName) : `${row.firstName} ${row.lastName}`;
          const accessibleLabel = row.members ? `${row.schoolName} · ${label} · ${category?.name ?? ""}` : label;
          const unresolved = !hasResult(row);
          return <tr key={row.entryId} className={unresolved ? "bg-red-50 [&>td]:border-red-200" : undefined}>
            <td className="font-black">
              {label}
              {row.members && <p className="mt-1 max-w-md text-xs font-normal text-muted-foreground">{row.members.map(member => `${member.firstName} ${member.lastName}`).join(", ")}</p>}
              <p className="mt-1 max-w-md text-xs font-normal text-muted-foreground">{row.matchNote}</p>
              {unresolved && <p className="mt-1 text-xs font-bold text-red-800">Norādiet vietu vai DNS/DNF/DSQ statusu, lai saglabātu rezultātu.</p>}
              {row.sourceLine && <details className="mt-2 max-w-md text-xs font-normal"><summary className="cursor-pointer">Parādīt atbilstības failā</summary><pre className="mt-1 whitespace-pre-wrap break-words">{row.sourceLine}</pre></details>}
            </td>
            {showCategory && <td>{category?.discipline}<div className="text-xs text-muted-foreground">{category?.name}</div></td>}
            <td>{row.schoolName}</td>
            <td><input className="form-control w-20" type="number" min={1} value={row.placement}
              disabled={disabled || row.status !== "ranked"} aria-label={`Vieta: ${accessibleLabel}`}
              onChange={event => updateRow(row.entryId, { placement: event.target.value })} /></td>
            <td><select className="form-control w-28" value={row.status} disabled={disabled} aria-label={`Statuss: ${accessibleLabel}`}
              onChange={event => updateRow(row.entryId, { status: event.target.value as Result["status"] })}>
              <option value="ranked">Vieta</option><option value="dns">DNS</option><option value="dnf">DNF</option><option value="dsq">DSQ</option>
            </select></td>
          </tr>;
        })}</tbody>
      </table>
    </div>;
  }
  const previewByCategory = new Map<number, PreviewRow[]>();
  if (isTeamSport) {
    for (const row of preview) {
      const rows = previewByCategory.get(row.categoryId) ?? [];
      rows.push(row);
      previewByCategory.set(row.categoryId, rows);
    }
  }
  return (
    <div className="grid gap-6">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 font-bold text-red-800">{error}</p>}
      <section className="glass-panel rounded-3xl p-6">
        <h2 className="text-xl font-black">1. Izvēlieties un nolasiet failu</h2>
        <p className="mt-3 rounded-xl bg-[#e9ecff] p-3 text-sm">
          Vispirms nospiediet <strong>“Saglabāt failu un rezultātus”</strong>. Pēc saglabāšanas atvērsies rezultātu tabula, kur varēsiet nospiest <strong>“Publicēt rezultātus”</strong>.
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#65647b]">
          Atbalstīti PDF, Excel, CSV un teksta faili līdz 12 MB.{" "}
          {isTeamSport
            ? "Priekšskatījumā katrai komandai ir viena rinda. Sistēma salīdzina skolas nosaukumu un dalībnieku vārdus ar reģistrētajām komandām."
            : "Sistēma salīdzina dalībnieku vārdus un uzvārdus ar sava sporta veida pieteikumiem."}{" "}
          Vietu automātiski piedāvā, ja atpazīta kolonna “Vieta”, “Place”, “Pl”, “Rank” vai “Position”.
          Pārbaudiet piedāvātos rezultātus un precizējiet neskaidrās atbilstības pēc oriģināla.
          Skenētus PDF bez teksta slāņa sistēma nenolasa.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="form-label">
            Kategorija
            <select
              className="form-control"
              value={categoryId}
              disabled={disabled}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPreview([]);
                setExtractedText("");
              }}
            >
              <option value="">Visas disciplīnas un kategorijas</option>
              {data.categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.discipline} — {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Rezultātu fails
            <input
              className="form-control"
              type="file"
              ref={fileInput}
              disabled={disabled}
              accept=".pdf,.xlsx,.csv,.tsv,.txt"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview([]);
                setExtractedText("");
              }}
            />
          </label>
          <Button
            className="self-end bg-[#0c0942]"
            disabled={!file || disabled}
            onClick={analyse}
          >
            {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}{" "}
            Nolasīt failu
          </Button>
        </div>

      </section>
      {extractedText && <details className="glass-panel rounded-2xl p-5"><summary className="cursor-pointer font-bold">Parādīt no faila nolasīto tekstu</summary><pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap text-xs">{extractedText}</pre></details>}
      {preview.length > 0 && (
        <section className="glass-panel overflow-hidden rounded-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div>
              <h3 className="text-lg font-black">2. Pārbaudiet un saglabājiet rezultātus</h3>
              <p className="text-sm text-[#65647b]">
                Saglabās visas rindas ar norādītu vietu vai DNS, DNF, DSQ statusu. Pārbaudiet nolasītās vietas un papildiniet trūkstošās. Rindas bez vietas vai statusa netiks saglabātas.
              </p>
              <p className="mt-2 text-sm font-bold" role="status">
                {readyCount ? `Saglabāšanai gatavas rindas: ${readyCount}.` : "Lai saglabātu, norādiet vietu vai statusu vismaz vienā rindā."}
              </p>
            </div>
            <Button
              onClick={importRows}
              disabled={disabled || !readyCount}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              <Upload /> Saglabāt failu un rezultātus
            </Button>
          </div>
          {isTeamSport ? data.categories.flatMap(category => {
            const rows = previewByCategory.get(category.id);
            if (!rows?.length) return [];
            return <section key={category.id}>
              <h4 className="border-y bg-[#f0f1ff] px-5 py-3 font-black">{category.discipline} · {category.name}</h4>
              {renderPreviewTable(rows, false)}
            </section>;
          }) : renderPreviewTable(preview, true)}
        </section>
      )}
    </div>
  );
}
