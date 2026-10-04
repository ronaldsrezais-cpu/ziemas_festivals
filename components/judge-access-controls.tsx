"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function JudgePasswordField({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  function generate() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    onChange(Array.from(bytes, byte => alphabet[byte % alphabet.length]).join(""));
    setVisible(true);
  }
  return <div className="grid gap-2">
    <label htmlFor={id} className="form-label">Parole</label>
    <div className="flex gap-2">
      <input id={id} className="form-control min-w-0" name="password" type={visible ? "text" : "password"}
        value={value} onChange={event => onChange(event.target.value)} required minLength={6} maxLength={128}
        disabled={disabled} autoComplete="new-password" autoCapitalize="none" spellCheck={false} />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => setVisible(!visible)}
        aria-label={visible ? "Paslēpt paroli" : "Parādīt paroli"} aria-pressed={visible}>
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
    <div><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={generate}><RefreshCw /> Ģenerēt paroli</Button></div>
  </div>;
}

export function SavedJudgePassword({ fullName, password }: { fullName: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    setError("");
    try { await navigator.clipboard.writeText(password); setCopied(true); }
    catch { setCopied(false); setError("Neizdevās nokopēt automātiski. Iezīmējiet un nokopējiet paroli no lauka."); }
  }
  return <div className="grid gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
    <p className="font-bold" role="status">Parole saglabāta: {fullName}</p>
    <label className="form-label">Saglabātā parole
      <input className="form-control select-all font-mono" type="text" value={password} readOnly autoComplete="off"
        onFocus={event => event.currentTarget.select()} />
    </label>
    <div><Button type="button" variant="outline" onClick={copy}>{copied ? <Check /> : <Copy />} {copied ? "Nokopēts" : "Kopēt paroli"}</Button></div>
    <p className="text-sm">Nokopējiet paroli, lai nodotu to tiesnesim. Pēc šī skata aizvēršanas to vairs nevarēs apskatīt; vajadzības gadījumā varēs iestatīt jaunu.</p>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
  </div>;
}

type Judge = { id: number; fullName: string; sportName: string; active: boolean };

export function JudgeAccessControls({ judge, savePassword, remove }: {
  judge: Judge;
  savePassword: (judgeId: number, password: string) => Promise<unknown>;
  remove: (judgeId: number, confirmation: string) => Promise<unknown>;
}) {
  return <div className="flex flex-wrap gap-2">
    <JudgePasswordDialog judge={judge} save={password => savePassword(judge.id, password)} />
    <DeleteJudgeDialog judge={judge} remove={confirmation => remove(judge.id, confirmation)} />
  </div>;
}

function JudgePasswordDialog({ judge, save }: { judge: Judge; save: (password: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  function changeOpen(next: boolean) {
    if (busy) return;
    setPassword(""); setError(""); setSaved(false); setOpen(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await save(password); setSaved(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Neizdevās saglabāt paroli."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline" disabled={!judge.active} aria-label={`Jauna parole: ${judge.fullName}`}><KeyRound /> Jauna parole</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Jauna tiesneša parole</DialogTitle>
        <DialogDescription>{judge.fullName} · {judge.sportName}. Esošo paroli nevar apskatīt. Saglabājot jaunu paroli, iepriekšējā vairs nedarbosies un tiesnesim būs jāpieslēdzas no jauna.</DialogDescription>
      </DialogHeader>
      {saved ? <>
        <SavedJudgePassword fullName={judge.fullName} password={password} />
        <Button type="button" onClick={() => changeOpen(false)}>Aizvērt</Button>
      </> : <form onSubmit={submit} className="grid gap-4">
        <JudgePasswordField value={password} onChange={setPassword} disabled={busy} />
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={busy}>Atcelt</Button>
          <Button type="submit" disabled={busy || password.trim().length < 6}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Saglabāt jauno paroli</Button>
        </div>
      </form>}
    </DialogContent>
  </Dialog>;
}

function DeleteJudgeDialog({ judge, remove }: { judge: Judge; remove: (confirmation: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function changeOpen(next: boolean) {
    if (busy) return;
    setConfirmation(""); setError(""); setOpen(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await remove(confirmation); setOpen(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Neizdevās izdzēst tiesnesi."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline" className="text-red-700" aria-label={`Dzēst tiesnesi: ${judge.fullName}`}><Trash2 /> Dzēst</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Dzēst tiesneša piekļuvi?</DialogTitle>
        <DialogDescription>{judge.fullName} · {judge.sportName}. Tiesnesis tiks izņemts no saraksta un viņa piekļuve tiks slēgta. Ievadītie rezultāti un pievienotie faili saglabāsies.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4">
        <label className="form-label">Apstiprināšanai ievadiet: {judge.fullName}
          <input className="form-control" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} required autoComplete="off" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={busy}>Atcelt</Button>
          <Button type="submit" variant="destructive" disabled={busy || confirmation.trim() !== judge.fullName}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Dzēst tiesnesi</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
