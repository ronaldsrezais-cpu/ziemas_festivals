"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { findSchoolAnswers, schoolFaq } from "@/lib/school-help";

export function SchoolHelp() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ question: string; answers: string[] }>>([]);
  function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    const matches = findSchoolAnswers(question);
    setMessages(previous => [...previous.slice(-9), { question: question.trim(), answers: matches.length ? matches.map(item => item.answer) : ["Šim jautājumam palīdzības sadaļā nav precīzas atbildes. Rakstiet ziemasfestivals@lsfp.lv, norādot skolas nosaukumu un problēmas aprakstu. Piekļuves kodu nesūtiet."] }]);
    setQuestion("");
  }
  return <section aria-labelledby="skolu-palidziba" className="mx-auto mb-12 w-full max-w-7xl px-5 sm:px-8">
    <details className="glass-panel rounded-2xl p-5 sm:p-7">
      <summary id="skolu-palidziba" className="cursor-pointer text-xl font-black">Palīdzība skolām · FAQ un čats</summary>
      <div className="mt-5 rounded-xl bg-[#e9ecff] p-4"><h2 className="font-bold">Vajadzīga palīdzība?</h2><p className="mt-2">Rakstiet <a className="font-bold text-primary underline" href="mailto:ziemasfestivals@lsfp.lv">ziemasfestivals@lsfp.lv</a>, norādot skolas nosaukumu un jautājumu.</p></div>
      <h2 className="mb-3 mt-6 text-lg font-black">Biežāk uzdotie jautājumi</h2>
      <div className="grid gap-2">{schoolFaq.map(item => <details key={item.id} className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-bold">{item.question}</summary><p className="mt-3 text-sm leading-6">{item.answer}</p></details>)}</div>
      <h2 className="mt-7 text-lg font-black">Čata palīgs skolām</h2><p className="mt-2 text-sm text-muted-foreground">Palīgs piemeklē atbildes no biežāk uzdotajiem jautājumiem. Tas nepārbauda konkrētas skolas pieteikumu. Nesūtiet bērnu personas datus vai piekļuves kodu.</p>
      <div role="log" aria-label="Palīdzības saruna" aria-live="polite" className="my-4 grid max-h-96 gap-3 overflow-y-auto">{messages.map((message, index) => <div key={index} className="grid gap-2"><p className="justify-self-end rounded-xl bg-[#e9ecff] p-3 text-sm"><strong>Jūs:</strong> {message.question}</p><div className="rounded-xl border bg-white p-3 text-sm leading-6"><strong>Palīgs:</strong>{message.answers.map((answer, i) => <p className="mt-2" key={i}>{answer}</p>)}</div></div>)}</div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={ask}><label className="form-label min-w-0 flex-1">Jūsu jautājums<input className="form-control" maxLength={500} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Piemēram: vai SIAC numurs ir obligāts?" required /></label><Button type="submit" disabled={!question.trim()}>Jautāt</Button>{messages.length > 0 && <Button type="button" variant="outline" onClick={() => setMessages([])}>Notīrīt sarunu</Button>}</form>
    </details>
  </section>;
}
