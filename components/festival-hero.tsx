import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, KeyRound } from "lucide-react";

export function FestivalHero() {
  return <section className="relative isolate overflow-hidden bg-[#0c0942] text-white" aria-labelledby="festival-title">
    <div className="hero-art" aria-hidden="true" />
    <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-18 lg:py-20">
      <div className="relative z-10 max-w-2xl">
        <p className="mb-8 text-xs font-bold uppercase tracking-[.2em] text-[#c7cfff]">Latvijas skolu • Reģistrācija un rezultāti</p>
        <h1 id="festival-title"><span className="hero-title-winter">Ziemas</span><span className="hero-title-festival text-[#c7cfff]">FESTIVĀLS</span></h1>
        <p className="mt-7 max-w-md text-lg leading-7 text-white/85 sm:text-xl">Piesaki savu skolu. Pulcē komandu.<br />Tiekamies Festivālā!</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/registracija" className="inline-flex min-h-13 items-center justify-center gap-6 rounded-md bg-[#d2d61d] px-6 font-bold text-[#0c0942] hover:bg-[#e6e956]">Reģistrēt skolu <ArrowRight className="size-5" /></Link>
          <Link href="/skolai" className="inline-flex min-h-13 items-center justify-center gap-3 rounded-md border border-[#c7cfff]/40 bg-[#0c0942]/50 px-5 font-medium text-white hover:bg-[#2910bf]"><KeyRound className="size-4" /> Man ir piekļuves kods</Link>
        </div>
      </div>
      <div className="absolute right-[9%] top-[18%] hidden rotate-[-8deg] rounded-[2rem] bg-white p-6 shadow-xl md:block lg:p-8" aria-hidden="true">
        <Image src="/brand/symbol.svg" alt="" width={176} height={164} className="w-36 lg:w-48" priority />
      </div>
      <p className="absolute bottom-24 right-12 hidden rotate-[-9deg] rounded-full bg-[#ff4a4a] px-9 py-4 font-bold uppercase tracking-wider text-[#0c0942] lg:block" aria-hidden="true">Vairāk kustības. Vairāk prieka.</p>
      <a href="#dalibnieki" className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-[#c7cfff] hover:text-white">Skatīt dalībniekus un rezultātus <ArrowDown className="size-4" /></a>
    </div>
    <div className="brand-stripe relative" />
  </section>;
}
