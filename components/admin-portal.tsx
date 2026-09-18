"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Printer,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { PageHeading } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Category = {
  id: number;
  sportId: number;
  code: string;
  name: string;
  discipline: string;
  gender: "F" | "M" | "X";
  minBirthYear: number;
  maxBirthYear: number;
  teamMin: number;
  teamMax: number;
  schoolLimit: number | null;
  active: boolean;
};
type Sport = {
  id: number;
  name: string;
  location: string;
  mode: "individual" | "team";
  categories: Category[];
};
type AdminData = {
  schools: Array<{
    id: number;
    name: string;
    municipality: string;
    teacherName: string;
    teacherRole: string;
    email: string;
    phone: string;
    status: string;
    accessCode: string | null;
    participantCount: number;
    leaderCount: number;
    createdAt: string;
  }>;
  sports: Sport[];
  judges: Array<{
    id: number;
    fullName: string;
    sportName: string;
    sportId: number;
    active: boolean;
  }>;
  outbox: Array<{
    id: number;
    recipient: string;
    status: string;
    createdAt: string;
    error: string | null;
  }>;
  settings: Record<string, string>;
};

export function AdminPortal() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/actions?view=admin");
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
    await load();
    return body;
  }
  if (loading)
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <Loader2 className="size-10 animate-spin" />
      </main>
    );
  if (!data) return <AdminLogin onSuccess={load} initialError={error} />;
  async function logout() {
    await action({ action: "logout" });
    setData(null);
  }
  async function approve(schoolId: number) {
    try {
      const body = await action({ action: "approve-school", schoolId });
      setNotice(
        `Skola apstiprināta. Piekļuves kods: ${body.code}. ${body.emailSent ? "E-pasts nosūtīts." : "E-pasts ievietots nosūtīšanas rindā — kodu saglabājiet."}`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Neizdevās apstiprināt.",
      );
    }
  }
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading
          eyebrow="Administratora sadaļa"
          title="Festivāla pārvaldība"
          description="Apstipriniet skolas, konfigurējiet kategorijas, izveidojiet tiesnešu piekļuves un kontrolējiet publicēšanu."
        />
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/akreditacijas">
              <Printer /> Visas akreditācijas
            </Link>
          </Button>
          <Button variant="outline" onClick={logout}>
            <LogOut /> Iziet
          </Button>
        </div>
      </div>
      {error && (
        <p className="mb-5 rounded-2xl bg-red-50 p-4 font-bold text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 font-bold text-emerald-900">
          {notice}
        </p>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Summary
          label="Gaida apstiprinājumu"
          value={
            data.schools.filter((school) => school.status === "pending").length
          }
        />
        <Summary
          label="Apstiprinātas skolas"
          value={
            data.schools.filter((school) => school.status === "approved").length
          }
        />
        <Summary label="Reģistrēti tiesneši" value={data.judges.length} />
      </div>
      <Tabs defaultValue="schools">
        <TabsList className="mb-6 h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl bg-[#0c0942] p-1.5 text-white">
          <TabsTrigger
            value="schools"
            className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]"
          >
            Skolas
          </TabsTrigger>
          <TabsTrigger
            value="sports"
            className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]"
          >
            Sporta veidi un kategorijas
          </TabsTrigger>
          <TabsTrigger
            value="judges"
            className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]"
          >
            Tiesneši
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="min-h-11 px-5 data-[state=active]:bg-[#d2d61d] data-[state=active]:text-[#0c0942]"
          >
            Iestatījumi
          </TabsTrigger>
        </TabsList>
        <TabsContent value="schools">
          <SchoolsTable
            data={data}
            approve={approve}
            reject={async (schoolId) =>
              action({ action: "reject-school", schoolId })
            }
          />
        </TabsContent>
        <TabsContent value="sports">
          <SportsSection
            sports={data.sports}
            save={async (payload) => action(payload)}
          />
        </TabsContent>
        <TabsContent value="judges">
          <JudgesSection
            data={data}
            add={async (payload) => action({ action: "add-judge", ...payload })}
          />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsSection
            data={data}
            save={async (key, value) =>
              action({ action: "save-setting", key, value })
            }
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function AdminLogin({
  onSuccess,
  initialError,
}: {
  onSuccess: () => void;
  initialError: string;
}) {
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login-admin", password }),
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
        eyebrow="Administratora sadaļa"
        title="Droša piekļuve"
        description="Ievadiet administratora paroli."
      />
      <form onSubmit={submit} className="glass-panel rounded-3xl p-7">
        <label className="form-label">
          Parole
          <input
            className="form-control"
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 font-bold text-red-800">
            {error}
          </p>
        )}
        <Button className="mt-5 bg-[#0c0942]" size="lg" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Atvērt
          administratora sadaļu
        </Button>
      </form>
    </main>
  );
}

function SchoolsTable({
  data,
  approve,
  reject,
}: {
  data: AdminData;
  approve: (id: number) => void;
  reject: (id: number) => Promise<unknown>;
}) {
  return (
    <div className="glass-panel overflow-hidden rounded-3xl">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Skola</th>
              <th>Kontaktpersona</th>
              <th>Dalībnieki / vadītāji</th>
              <th>Statuss</th>
              <th>Piekļuves kods</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.schools.map((school) => (
              <tr key={school.id}>
                <td>
                  <strong>{school.name}</strong>
                  <div className="text-xs text-[#65647b]">
                    {school.municipality}
                  </div>
                </td>
                <td>
                  {school.teacherName}
                  <div className="text-xs text-[#65647b]">
                    {school.teacherRole}
                    <br />
                    {school.email}
                    <br />
                    {school.phone}
                  </div>
                </td>
                <td>
                  {school.participantCount} / {school.leaderCount}
                </td>
                <td>
                  <Status value={school.status} />
                </td>
                <td>
                  {school.accessCode ? <code className="select-all whitespace-nowrap rounded bg-slate-100 px-2 py-1 text-base font-bold tracking-wider">{school.accessCode}</code> : <span className="text-xs text-muted-foreground">{school.status === "approved" ? "Kods nav pieejams" : "Pēc apstiprināšanas"}</span>}
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    {school.status !== "approved" && (
                      <Button
                        size="sm"
                        className="bg-emerald-700 hover:bg-emerald-800"
                        onClick={() => approve(school.id)}
                      >
                        <Check /> Apstiprināt
                      </Button>
                    )}
                    {school.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700"
                        onClick={() => reject(school.id)}
                      >
                        <X /> Noraidīt
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.schools.length === 0 && (
        <p className="p-8 text-center font-bold text-[#65647b]">
          Skolu pieteikumu vēl nav.
        </p>
      )}
    </div>
  );
}

function SportsSection({
  sports,
  save,
}: {
  sports: Sport[];
  save: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  return (
    <div className="grid gap-5">
      {sports.map((sport) => (
        <article
          key={sport.id}
          className="glass-panel overflow-hidden rounded-3xl"
        >
          <div className="snow-band flex items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-xl font-black">{sport.name}</h2>
              <p className="text-sm text-[#c7cfff]/75">
                {sport.location} ·{" "}
                {sport.mode === "team" ? "Komandu" : "Individuāls"}
              </p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-[#d2d61d] text-[#0c0942] hover:bg-[#e6e956]">
                  <Plus /> Kategorija
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Jauna kategorija</DialogTitle>
                  <DialogDescription>
                    Norādiet tikai dzimšanas gadu intervālu. Mēneša un 1.
                    septembra robeža netiek izmantota.
                  </DialogDescription>
                </DialogHeader>
                <CategoryForm sport={sport} save={save} />
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kategorija</th>
                  <th>Dzimums</th>
                  <th>Dzimšanas gadi</th>
                  <th>Dalībnieki</th>
                  <th>Limits skolai</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sport.categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <strong>{category.name}</strong>
                      <div className="text-xs text-[#65647b]">
                        {category.discipline}
                      </div>
                    </td>
                    <td>
                      {category.gender === "X"
                        ? "Jaukta"
                        : category.gender === "F"
                          ? "Meitenes / jaunietes"
                          : "Zēni / jaunieši"}
                    </td>
                    <td>
                      {category.minBirthYear}–{category.maxBirthYear}
                    </td>
                    <td>
                      {category.teamMin === category.teamMax
                        ? category.teamMin
                        : `${category.teamMin}–${category.teamMax}`}
                    </td>
                    <td>{category.schoolLimit ?? "—"}</td>
                    <td>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <Pencil />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Labot kategoriju</DialogTitle>
                          </DialogHeader>
                          <CategoryForm
                            sport={sport}
                            category={category}
                            save={save}
                          />
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sport.categories.length === 0 && (
              <p className="p-5 text-sm font-bold text-[#65647b]">
                Jaunā gada kategorijas vēl nav pievienotas.
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function CategoryForm({
  sport,
  category,
  save,
}: {
  sport: Sport;
  category?: Category;
  save: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await save({
        action: category ? "update-category" : "add-category",
        id: category?.id,
        sportId: sport.id,
        code: String(values.code),
        name: String(values.name),
        discipline: String(values.discipline),
        gender: String(values.gender),
        minBirthYear: Number(values.minBirthYear),
        maxBirthYear: Number(values.maxBirthYear),
        teamMin: Number(values.teamMin),
        teamMax: Number(values.teamMax),
        schoolLimit: values.schoolLimit ? Number(values.schoolLimit) : null,
        active: true,
      });
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Neizdevās saglabāt.",
      );
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="form-label">
        Kods
        <input
          className="form-control"
          name="code"
          defaultValue={category?.code}
          required
        />
      </label>
      <label className="form-label">
        Nosaukums
        <input
          className="form-control"
          name="name"
          defaultValue={category?.name}
          required
        />
      </label>
      <label className="form-label sm:col-span-2">
        Disciplīna
        <input
          className="form-control"
          name="discipline"
          defaultValue={category?.discipline ?? sport.name}
          required
        />
      </label>
      <label className="form-label">
        Dzimuma grupa
        <select
          className="form-control"
          name="gender"
          defaultValue={category?.gender ?? (sport.mode === "team" ? "X" : "F")}
        >
          <option value="F">Meitenes / jaunietes</option>
          <option value="M">Zēni / jaunieši</option>
          <option value="X">Jaukta</option>
        </select>
      </label>
      <span />
      <label className="form-label">
        No dzimšanas gada
        <input
          className="form-control"
          type="number"
          name="minBirthYear"
          defaultValue={category?.minBirthYear}
          required
        />
      </label>
      <label className="form-label">
        Līdz dzimšanas gadam
        <input
          className="form-control"
          type="number"
          name="maxBirthYear"
          defaultValue={category?.maxBirthYear}
          required
        />
      </label>
      <label className="form-label">
        Min. dalībnieki
        <input
          className="form-control"
          type="number"
          min="1"
          name="teamMin"
          defaultValue={category?.teamMin ?? 1}
          required
        />
      </label>
      <label className="form-label">
        Maks. dalībnieki
        <input
          className="form-control"
          type="number"
          min="1"
          name="teamMax"
          defaultValue={category?.teamMax ?? 1}
          required
        />
      </label>
      <label className="form-label">
        Komandu / dalībnieku limits skolai
        <input
          className="form-control"
          type="number"
          min="1"
          name="schoolLimit"
          defaultValue={category?.schoolLimit ?? ""}
        />
      </label>
      {error && (
        <p className="rounded-xl bg-red-50 p-3 font-bold text-red-800 sm:col-span-2">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-800 sm:col-span-2">
          Saglabāts.
        </p>
      )}
      <Button className="justify-self-start bg-[#0c0942] sm:col-span-2">
        <Check /> Saglabāt
      </Button>
    </form>
  );
}

function JudgesSection({
  data,
  add,
}: {
  data: AdminData;
  add: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await add({
        sportId: Number(values.sportId),
        fullName: String(values.fullName),
        password: String(values.password),
      });
      event.currentTarget.reset();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Neizdevās saglabāt.",
      );
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]">
      <form onSubmit={submit} className="glass-panel rounded-3xl p-5">
        <h2 className="mb-4 text-xl font-black">Jauna tiesneša piekļuve</h2>
        <div className="grid gap-4">
          <label className="form-label">
            Sporta veids
            <select className="form-control" name="sportId" required>
              <option value="">Izvēlieties</option>
              {data.sports.map((sport) => (
                <option value={sport.id} key={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Vārds, uzvārds
            <input className="form-control" name="fullName" required />
          </label>
          <label className="form-label">
            Parole
            <input
              className="form-control"
              name="password"
              type="password"
              minLength={6}
              required
            />
          </label>
        </div>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 font-bold text-red-800">
            {error}
          </p>
        )}
        <Button className="mt-5 bg-[#0c0942]">
          <Plus /> Izveidot piekļuvi
        </Button>
      </form>
      <div className="glass-panel overflow-hidden rounded-3xl">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tiesnesis</th>
              <th>Sporta veids</th>
              <th>Statuss</th>
            </tr>
          </thead>
          <tbody>
            {data.judges.map((judge) => (
              <tr key={judge.id}>
                <td className="font-black">{judge.fullName}</td>
                <td>{judge.sportName}</td>
                <td>{judge.active ? "Aktīvs" : "Neaktīvs"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsSection({
  data,
  save,
}: {
  data: AdminData;
  save: (key: string, value: string) => Promise<unknown>;
}) {
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/template", {
      method: "POST",
      body: form,
    });
    const body = await response.json();
    setUploading(false);
    setNotice(
      response.ok
        ? "Akreditācijas kartes dizaina paraugs saglabāts."
        : body.error,
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="glass-panel rounded-3xl p-6">
        <h2 className="text-xl font-black">Festivāla iestatījumi</h2>
        <label className="form-label mt-5">
          Festivāla gads
          <input
            className="form-control"
            type="number"
            defaultValue={
              data.settings.festival_year ?? new Date().getFullYear()
            }
            onBlur={(event) => save("festival_year", event.target.value)}
          />
        </label>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#f0f1ff] p-4">
          <div>
            <strong>Reģistrācija atvērta</strong>
            <p className="text-sm text-[#65647b]">
              Atļaut jaunu skolu pieteikumus
            </p>
          </div>
          <Switch
            defaultChecked={data.settings.registration_open !== "false"}
            onCheckedChange={(value) =>
              save("registration_open", String(value))
            }
          />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#f0f1ff] p-4">
          <div>
            <strong>Dalībnieku saraksts publisks</strong>
            <p className="text-sm text-[#65647b]">
              Nepilngadīgo vārdi būs redzami publiskajā lapā
            </p>
          </div>
          <Switch
            defaultChecked={data.settings.participants_public !== "false"}
            onCheckedChange={(value) =>
              save("participants_public", String(value))
            }
          />
        </div>
      </section>
      <form onSubmit={upload} className="glass-panel rounded-3xl p-6">
        <h2 className="text-xl font-black">Akreditācijas kartes dizains</h2>
        <p className="mt-2 text-sm leading-6 text-[#65647b]">
          Augšupielādējiet kartes fona attēlu. Sistēma virs tā izvietos personas
          vārdu, lomu un skolu.
        </p>
        <label className="form-label mt-5">
          Dizaina attēls
          <input
            className="form-control"
            type="file"
            name="file"
            accept="image/*"
            required
          />
        </label>
        <Button disabled={uploading} className="mt-5 bg-[#0c0942]">
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}{" "}
          Augšupielādēt
        </Button>
        {notice && (
          <p className="mt-4 rounded-xl bg-[#f0f1ff] p-3 font-bold text-[#2910bf]">
            {notice}
          </p>
        )}
      </form>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel rounded-3xl p-5">
      <strong className="block text-3xl font-black">{value}</strong>
      <span className="text-sm font-bold text-[#65647b]">{label}</span>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const map: Record<string, string> = {
    pending: "Gaida",
    approved: "Apstiprināta",
    rejected: "Noraidīta",
  };
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${value === "approved" ? "bg-emerald-100 text-emerald-800" : value === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}
    >
      {map[value] ?? value}
    </span>
  );
}
