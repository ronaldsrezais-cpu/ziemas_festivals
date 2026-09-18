"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dalībnieki un rezultāti" },
  { href: "/skolai", label: "Skolas sadaļa" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <div className="flex min-h-screen flex-col">
    <a href="#saturs" className="sr-only fixed left-4 top-4 z-50 rounded bg-white p-3 font-bold focus:not-sr-only">Pāriet uz saturu</a>
    <header className="no-print sticky top-0 z-40 border-b bg-white">
      <div className="relative mx-auto flex min-h-24 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
        <Link href="/" aria-label="Ziemas festivāls — sākumlapa" className="shrink-0" onClick={() => setOpen(false)}>
          <Image src="/brand/logo-color.svg" alt="Latvijas skolu Ziemas festivāls" width={224} height={64} priority className="h-auto w-48 lg:w-56" />
        </Link>
        <button className="grid size-11 place-items-center rounded-md border lg:hidden" aria-label={open ? "Aizvērt izvēlni" : "Atvērt izvēlni"} aria-expanded={open} aria-controls="galvena-izvelne" onClick={() => setOpen(value => !value)}>{open ? <X /> : <Menu />}</button>
        <nav id="galvena-izvelne" aria-label="Galvenā izvēlne" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }} className={cn("absolute inset-x-0 top-full grid gap-1 border-b bg-white p-5 shadow-lg lg:static lg:flex lg:items-center lg:gap-1 lg:border-0 lg:p-0 lg:shadow-none xl:gap-3", !open && "hidden lg:flex")}>
          {nav.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={() => setOpen(false)} className={cn("rounded-md px-3 py-3 text-sm font-medium hover:bg-accent hover:text-primary lg:text-base", pathname === item.href && "text-primary")}>{item.label}</Link>)}
          <Link href="/registracija" aria-current={pathname === "/registracija" ? "page" : undefined} onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-3 rounded-md bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-[#0c0942] lg:ml-2 lg:mt-0 lg:text-base">Reģistrēt skolu <ArrowRight className="size-4" /></Link>
        </nav>
      </div>
    </header>
    <div id="saturs" className="flex-1">{children}</div>
    <footer className="no-print mt-20 bg-[#0c0942] text-white">
      <div className="brand-stripe" />
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-center">
        <div><Image src="/brand/logo-white.svg" alt="Latvijas skolu Ziemas festivāls" width={224} height={64} className="h-auto w-56" /><p className="mt-4 text-sm text-[#c7cfff]">Reģistrācija. Dalībnieki. Rezultāti.</p></div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm">
          <a href="https://ziemasfestivals.lv/" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-[#d2d61d]">Festivāla mājaslapa <ArrowUpRight className="size-4" /></a>
        </div>
      </div>
    </footer>
  </div>;
}

export function PageHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <div className="mb-8">{eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}<h1 className="section-title text-4xl sm:text-5xl">{title}</h1>{description && <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>}</div>;
}
