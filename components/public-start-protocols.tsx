"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type PublicProtocol = { id: number; fileName: string; sportId: number; sportName: string; publishedAt: string };
export function PublicStartProtocols() {
  const [protocols, setProtocols] = useState<PublicProtocol[] | null>(null);
  const [sectionVisible, setSectionVisible] = useState(false);
  const [sport, setSport] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/start-protocols/public", { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error("Failed"); return response.json(); }).then(body => { setSectionVisible(body.visible !== false); setProtocols(body.protocols); })
      .catch(() => { if (!controller.signal.aborted) setError("Starta protokolus pašlaik neizdevās ielādēt. Atjaunojiet lapu un mēģiniet vēlreiz."); });
    return () => controller.abort();
  }, []);
  const sports = [...new Map(protocols?.map(protocol => [protocol.sportId, protocol.sportName]) ?? []).entries()].sort((a, b) => a[1].localeCompare(b[1], "lv"));
  const visible = protocols?.filter(protocol => !sport || String(protocol.sportId) === sport) ?? [];
  if (!sectionVisible) return null;
  return <section id="starta-protokoli" className="mx-auto max-w-7xl scroll-mt-8 px-5 pb-10 pt-12 sm:px-8">
    <div className="glass-panel rounded-3xl p-5 sm:p-7"><h2 className="section-title text-2xl sm:text-3xl">Starta protokoli</h2><p className="mt-2 text-muted-foreground">Tiesnešu publicētie starta saraksti un sacensību kārtība.</p>
      {error && <p role="alert" className="mt-4 text-red-800">{error}</p>}
      {!protocols && !error && <p role="status" className="mt-4">Ielādē starta protokolus…</p>}
      {protocols && <><label className="form-label my-5 max-w-sm">Sporta veids<select className="form-control" value={sport} onChange={event => setSport(event.target.value)}><option value="">Visi sporta veidi</option>{sports.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <ul className="grid gap-3 md:grid-cols-2">{visible.map(protocol => <li key={protocol.id} className="rounded-2xl border border-[#c7cfff] bg-white p-5"><strong>{protocol.sportName}</strong><a className="mt-2 flex items-start gap-2 break-all font-bold text-primary underline" href={`/api/start-protocols/${protocol.id}`} target="_blank" rel="noreferrer"><Download className="mt-0.5 size-5 shrink-0" />{protocol.fileName}</a><p className="mt-2 text-xs text-muted-foreground">Publicēts {new Date(protocol.publishedAt).toLocaleString("lv-LV")}</p></li>)}</ul>
        {!visible.length && <p className="text-muted-foreground">Starta protokoli vēl nav publicēti.</p>}</>}
    </div>
  </section>;
}
