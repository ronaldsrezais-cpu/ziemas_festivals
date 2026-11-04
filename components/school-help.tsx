import { schoolFaq } from "@/lib/school-help";

export function SchoolHelp() {
  return <section aria-labelledby="skolu-palidziba" className="mx-auto mb-12 w-full max-w-7xl px-5 sm:px-8">
    <details className="glass-panel rounded-2xl p-5 sm:p-7">
      <summary id="skolu-palidziba" className="cursor-pointer text-xl font-black">Palīdzība skolām · FAQ</summary>
      <div className="mt-5 rounded-xl bg-[#e9ecff] p-4"><h2 className="font-bold">Vajadzīga palīdzība?</h2><p className="mt-2">Rakstiet <a className="font-bold text-primary underline" href="mailto:ziemasfestivals@lsfp.lv">ziemasfestivals@lsfp.lv</a>, norādot skolas nosaukumu un jautājumu.</p></div>
      <h2 className="mb-3 mt-6 text-lg font-black">Biežāk uzdotie jautājumi</h2>
      <div className="grid gap-2">{schoolFaq.map(item => <details key={item.id} className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-bold">{item.question}</summary><p className="mt-3 text-sm leading-6">{item.answer}</p></details>)}</div>
    </details>
  </section>;
}
