"use client";

import { useState, type FormEvent } from "react";
import { Edit3, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function SchoolNameEditor({ name, onSave }: {
  name: string;
  onSave: (name: string, previousName: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [original, setOriginal] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function changeOpen(next: boolean) {
    if (busy) return;
    if (next) { setDraft(name); setOriginal(name); setError(""); }
    setOpen(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await onSave(draft.trim(), original); setOpen(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Neizdevās saglabāt nosaukumu."); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm" aria-label={`Labot skolas nosaukumu: ${name}`}><Edit3 /> Labot nosaukumu</Button></DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Labot skolas nosaukumu</DialogTitle>
        <DialogDescription>Norādiet precīzu skolas nosaukumu. Labojums būs redzams sarakstos un no jauna sagatavotajos dokumentos.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4">
        <label className="form-label">Skolas nosaukums
          <input className="form-control" value={draft} onChange={event => setDraft(event.target.value)} required minLength={2} maxLength={180} disabled={busy} autoComplete="organization" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Atcelt</Button>
          <Button type="submit" disabled={busy || draft.trim().length < 2 || draft.trim() === original}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />} Saglabāt nosaukumu
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
