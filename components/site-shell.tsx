"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Snowflake, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dalībnieki un rezultāti" },
  { href: "/registracija", label: "Reģistrēt skolu" },
  { href: "/skolai", label: "Skolas sadaļa" },
  { href: "/tiesnesiem", label: "Tiesnešiem" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <div className="min-h-screen">
    <header className="no-print sticky top-0 z-40 border-b border-white/30 bg-[#07152f]/95 text-white shadow-lg backdrop-blur">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-5 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="grid size-11 place-items-center rounded-full bg-[#f7d21f] text-[#07152f]"><Snowflake className="size-6" /></span>
          <span className="leading-none"><strong className="block text-lg font-black tracking-tight">ZIEMAS FESTIVĀLS</strong><small className="mt-1 block text-xs font-bold tracking-[.18em] text-cyan-200">SKOLU SISTĒMA</small></span>
        </Link>
        <button className="grid size-11 place-items-center rounded-xl border border-white/20 md:hidden" aria-label="Atvērt izvēlni" onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button>
        <nav className={cn("absolute inset-x-0 top-20 grid gap-1 bg-[#07152f] px-4 pb-5 md:static md:flex md:bg-transparent md:p-0", !open && "hidden md:flex")}>
          {nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("rounded-xl px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white", pathname === item.href && "bg-[#f7d21f] text-[#07152f] hover:bg-[#f7d21f] hover:text-[#07152f]")}>{item.label}</Link>)}
        </nav>
      </div>
    </header>
    {children}
    <footer className="no-print mt-16 border-t border-white/50 bg-white/55 py-8 text-center text-sm text-[#53657d] backdrop-blur">Latvijas skolu Ziemas festivāls · Reģistrācijas un rezultātu sistēma</footer>
  </div>;
}

export function PageHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <div className="mb-7"><p className="mb-2 text-sm font-black uppercase tracking-[.18em] text-[#007e9d]">{eyebrow}</p><h1 className="section-title text-3xl sm:text-5xl">{title}</h1>{description && <p className="mt-3 max-w-3xl text-base leading-7 text-[#53657d] sm:text-lg">{description}</p>}</div>;
}
