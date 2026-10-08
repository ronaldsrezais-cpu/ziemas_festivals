export type ImportEntry = {
  entryId: number;
  firstName: string;
  lastName: string;
  schoolName: string;
};

export function normalizeResultText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}

function containsName(line: string, entry: ImportEntry) {
  const text = ` ${normalizeResultText(line)} `;
  return [
    `${entry.firstName} ${entry.lastName}`,
    `${entry.lastName} ${entry.firstName}`,
  ].some((name) => text.includes(` ${normalizeResultText(name)} `));
}

function cells(line: string) {
  // PDF/XLSX extraction uses tabs. Text files may use semicolons or commas.
  return line.split(/\t|;|,/).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

export function previewResultMatches(text: string, entries: ImportEntry[]) {
  let placeColumn = -1;
  const rows = text.split(/\r?\n/).map((line) => {
    const values = cells(line);
    const header = values.findIndex((value) => /^(vieta|place|pl|rank|position)$/.test(normalizeResultText(value)));
    if (header >= 0) placeColumn = header;
    const value = placeColumn >= 0 ? values[placeColumn] ?? "" : "";
    // Never interpret a nearby start number, birth year or time as a place.
    const placement = /^\d{1,4}\.?$/.test(value) && Number(value.replace(/\.$/, "")) > 0
      ? String(Number(value.replace(/\.$/, ""))) : "";
    const status = values.map(normalizeResultText).find(value => /^(dns|dnf|dsq)$/.test(value)) as "dns" | "dnf" | "dsq" | undefined;
    return { line: line.trim(), placement, status: status ?? "ranked" as const };
  }).filter((row) => row.line);

  return entries.map((entry) => {
    const nameRows = rows.filter((row) => containsName(row.line, entry));
    const school = normalizeResultText(entry.schoolName);
    const schoolRows = nameRows.filter((row) => (` ${normalizeResultText(row.line)} `).includes(` ${school} `));
    const candidates = schoolRows.length ? schoolRows : nameRows;
    const candidate = candidates.length === 1 ? candidates[0] : null;
    const peers = candidate ? entries.filter((other) => containsName(candidate.line, other)) : [];
    const sameSchoolPeers = peers.filter((other) => normalizeResultText(other.schoolName) === school);
    const unique = Boolean(candidate) && (peers.length === 1 || (schoolRows.length === 1 && sameSchoolPeers.length === 1));
    return {
      entryId: entry.entryId,
      placement: unique ? candidate!.placement : "",
      status: unique ? candidate!.status : "ranked" as const,
      sourceLine: candidates.map((row) => row.line).join("\n"),
      matchNote: nameRows.length === 0 ? "Vārds un uzvārds failā nav atrasti."
        : !unique ? "Vairākas iespējamās atbilstības — jāprecizē manuāli."
        : candidate!.status !== "ranked" ? `Atrasta viena atbilstība un statuss ${candidate!.status.toUpperCase()}. Pārbaudiet pirms iekļaušanas.`
        : candidate!.placement ? "Atrasta viena atbilstība un kolonna “Vieta”. Pārbaudiet pirms iekļaušanas."
        : "Vārds atrasts; vieta nav droši noteikta. Ievadiet to no oriģināla.",
    };
  });
}
