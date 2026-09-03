"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  CheckCircle2,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  LogOut,
  Save,
  Upload,
} from "lucide-react";
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
};
type JudgeData = {
  judge: { id: number; fullName: string; sportId: number; sportName: string };
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
  placement: string;
  status: Result["status"];
  score: string;
  matched: boolean;
};

export function JudgePortal() {
  const [data, setData] = useState<JudgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/actions?view=judge");
    if (response.status === 401) {
      setData(null);
      setLoading(false);
      return;
    }
    const body = await response.json();
    if (!response.ok) setError(body.error);
    else setData(body);
    setLoading(false);
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
    if (!confirm("Publicēt visus saglabātos šī sporta veida rezultātus?"))
      return;
    await action({ action: "publish-sport" });
    setNotice("Rezultāti publicēti publiskajā lapā.");
    await load();
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-[#07152f] p-5 text-white">
        <div>
          <strong className="text-xl">{data.entries.length} pieteikumi</strong>
          <p className="text-sm text-cyan-100/75">
            {data.categories.length} kategorijās
          </p>
        </div>
        <Button
          onClick={publish}
          className="bg-[#f7d21f] text-[#07152f] hover:bg-[#ffe76c]"
        >
          <CheckCircle2 /> Publicēt rezultātus
        </Button>
      </div>
      <Tabs defaultValue="manual">
        <TabsList className="mb-6 h-auto rounded-2xl bg-[#07152f] p-1.5 text-white">
          <TabsTrigger
            value="manual"
            className="min-h-11 px-5 data-[state=active]:bg-[#f7d21f] data-[state=active]:text-[#07152f]"
          >
            Manuāla ievade
          </TabsTrigger>
          <TabsTrigger
            value="import"
            className="min-h-11 px-5 data-[state=active]:bg-[#f7d21f] data-[state=active]:text-[#07152f]"
          >
            Importēt failu
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="min-h-11 px-5 data-[state=active]:bg-[#f7d21f] data-[state=active]:text-[#07152f]"
          >
            Faili
          </TabsTrigger>
        </TabsList>
        <TabsContent value="manual">
          <ManualResults
            data={data}
            save={async (payload) => {
              await action({ action: "save-result", ...payload });
              await load();
            }}
          />
        </TabsContent>
        <TabsContent value="import">
          <ImportResults
            data={data}
            save={async (payload) =>
              action({ action: "save-result", ...payload })
            }
            finished={async (message) => {
              setNotice(message);
              await load();
            }}
          />
        </TabsContent>
        <TabsContent value="files">
          <div className="glass-panel overflow-hidden rounded-3xl">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fails</th>
                  <th>Statuss</th>
                  <th>Augšupielādēts</th>
                </tr>
              </thead>
              <tbody>
                {data.uploads.map((file) => (
                  <tr key={file.id}>
                    <td className="font-black">{file.fileName}</td>
                    <td>{file.status}</td>
                    <td>{new Date(file.createdAt).toLocaleString("lv-LV")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.uploads.length === 0 && (
              <p className="p-8 text-center font-bold text-[#53657d]">
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
        <Button disabled={busy} className="mt-5 bg-[#07152f]" size="lg">
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
}: {
  data: JudgeData;
  save: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  return (
    <div className="grid gap-6">
      {data.categories.map((category) => (
        <article
          key={category.id}
          className="glass-panel overflow-hidden rounded-3xl"
        >
          <div className="border-b bg-cyan-50 px-5 py-4">
            <h2 className="text-xl font-black">{category.name}</h2>
            <p className="text-sm text-[#53657d]">
              {category.discipline} · {category.minBirthYear}–
              {category.maxBirthYear}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dalībnieks / komanda</th>
                  <th>Skola</th>
                  <th>Vieta</th>
                  <th>Statuss</th>
                  <th>Rezultāts</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.entries
                  .filter((entry) => entry.categoryId === category.id)
                  .map((entry) => (
                    <ManualRow
                      key={entry.entryId}
                      entry={entry}
                      result={data.results.find(
                        (result) => result.entryId === entry.entryId,
                      )}
                      save={save}
                    />
                  ))}
              </tbody>
            </table>
          </div>
          {!data.entries.some((entry) => entry.categoryId === category.id) && (
            <p className="p-5 text-sm font-bold text-[#53657d]">
              Šajā kategorijā pieteikumu nav.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function ManualRow({
  entry,
  result,
  save,
}: {
  entry: Entry;
  result?: Result;
  save: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const [placement, setPlacement] = useState(
    result?.placement ? String(result.placement) : "",
  );
  const [status, setStatus] = useState<Result["status"]>(
    result?.status ?? "ranked",
  );
  const [score, setScore] = useState(result?.score ?? "");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    await save({
      categoryId: entry.categoryId,
      entryId: entry.entryId,
      placement: placement ? Number(placement) : null,
      status,
      score,
    });
    setBusy(false);
  }
  return (
    <tr>
      <td>
        <strong>
          {entry.teamName ?? `${entry.firstName} ${entry.lastName}`}
        </strong>
        {entry.teamName && (
          <div className="text-xs text-[#53657d]">
            {entry.firstName} {entry.lastName}
          </div>
        )}
      </td>
      <td>{entry.schoolName}</td>
      <td>
        <input
          className="form-control w-20"
          type="number"
          min="1"
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
        <input
          className="form-control min-w-28"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="Laiks / punkti"
        />
      </td>
      <td>
        <Button
          size="sm"
          onClick={submit}
          disabled={busy}
          className="bg-[#07152f]"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Save />}
        </Button>
      </td>
    </tr>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}
function inferPlace(text: string, name: string) {
  const source = normalize(text);
  const target = normalize(name);
  const index = source.indexOf(target);
  if (index < 0) return "";
  const before = source.slice(Math.max(0, index - 100), index);
  const tokens = (before.match(/\b\d{1,4}\b/g) ?? []).map(Number);
  if (tokens.length === 0) return "";
  const candidates = tokens
    .slice(-5)
    .filter((number) => number > 0 && number <= 200);
  if (candidates.length >= 2)
    return String(candidates.find((number) => number <= 50) ?? "");
  return candidates[0] && candidates[0] <= 50 ? String(candidates[0]) : "";
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
      pages.push(
        content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      );
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
  save,
  finished,
}: {
  data: JudgeData;
  save: (payload: Record<string, unknown>) => Promise<unknown>;
  finished: (message: string) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function analyse() {
    if (!file || !categoryId) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 12 * 1024 * 1024) {
        throw new Error("Fails pārsniedz 12 MB.");
      }
      const text = await extractFileText(file);
      const rows = data.entries
        .filter((entry) => entry.categoryId === Number(categoryId))
        .map((entry) => {
          const matched =
            normalize(text).includes(
              normalize(`${entry.firstName} ${entry.lastName}`),
            ) || normalize(text).includes(normalize(entry.schoolName));
          return {
            ...entry,
            matched,
            placement: matched
              ? inferPlace(text, `${entry.firstName} ${entry.lastName}`)
              : "",
            status: "ranked" as const,
            score: "",
          };
        });
      setPreview(rows);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Failu neizdevās nolasīt.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function importRows() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const pathname = `results/${data.judge.sportId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/uploads",
        contentType: file.type || "application/octet-stream",
      });
      const uploadResponse = await fetch("/api/uploads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: blob.url,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
        }),
      });
      const uploadBody = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadBody.error);
      for (const row of preview.filter(
        (item) => item.matched && (item.placement || item.status !== "ranked"),
      )) {
        await save({
          categoryId: row.categoryId,
          entryId: row.entryId,
          placement: row.placement ? Number(row.placement) : null,
          status: row.status,
          score: row.score,
          sourceUploadId: uploadBody.upload.id,
        });
      }
      await finished(
        "Fails augšupielādēts un priekšskatījumā apstiprinātie rezultāti saglabāti. Pirms publicēšanas pārbaudiet vietu sadalījumu.",
      );
      setPreview([]);
      setFile(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Importēšana neizdevās.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-6">
      <section className="glass-panel rounded-3xl p-6">
        <h2 className="text-xl font-black">Rezultātu faila priekšskatījums</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#53657d]">
          Atbalstīti PDF, Excel, CSV un teksta faili līdz 12 MB. Sistēma
          salīdzina failā atrastos vārdus un skolas ar reģistrētajiem
          dalībniekiem. Automātiski noteiktās vietas pirms saglabāšanas vienmēr
          pārbaudiet.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="form-label">
            Kategorija
            <select
              className="form-control"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPreview([]);
              }}
            >
              <option value="">Izvēlieties</option>
              {data.categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Rezultātu fails
            <input
              className="form-control"
              type="file"
              accept=".pdf,.xlsx,.csv,.tsv,.txt"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview([]);
              }}
            />
          </label>
          <Button
            className="self-end bg-[#07152f]"
            disabled={!file || !categoryId || busy}
            onClick={analyse}
          >
            {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}{" "}
            Nolasīt failu
          </Button>
        </div>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 font-bold text-red-800">
            {error}
          </p>
        )}
      </section>
      {preview.length > 0 && (
        <section className="glass-panel overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between gap-3 border-b p-5">
            <div>
              <h3 className="text-lg font-black">Atbilstību priekšskatījums</h3>
              <p className="text-sm text-[#53657d]">
                Atzīmējiet tikai pareizi identificētās rindas.
              </p>
            </div>
            <Button
              onClick={importRows}
              disabled={busy}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              <Upload /> Saglabāt un pievienot failu
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Iekļaut</th>
                  <th>Dalībnieks</th>
                  <th>Skola</th>
                  <th>Vieta</th>
                  <th>Statuss</th>
                  <th>Rezultāts</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={row.entryId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.matched}
                        onChange={(e) =>
                          setPreview((values) =>
                            values.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, matched: e.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="font-black">
                      {row.firstName} {row.lastName}
                    </td>
                    <td>{row.schoolName}</td>
                    <td>
                      <input
                        className="form-control w-20"
                        type="number"
                        value={row.placement}
                        onChange={(e) =>
                          setPreview((values) =>
                            values.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, placement: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="form-control w-28"
                        value={row.status}
                        onChange={(e) =>
                          setPreview((values) =>
                            values.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    status: e.target.value as Result["status"],
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="ranked">Vieta</option>
                        <option value="dns">DNS</option>
                        <option value="dnf">DNF</option>
                        <option value="dsq">DSQ</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-control min-w-28"
                        value={row.score}
                        onChange={(e) =>
                          setPreview((values) =>
                            values.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, score: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
