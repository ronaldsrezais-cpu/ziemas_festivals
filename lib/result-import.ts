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
  // PDF and XLSX extraction use tabs. A comma inside a school name must not
  // shift the columns in tab-separated, semicolon-separated or quoted CSV rows.
  const outsideQuotes = line.replace(/"(?:""|[^"])*"/g, "");
  const delimiter = outsideQuotes.includes("\t") ? "\t" : outsideQuotes.includes(";") ? ";" : ",";
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"' && (quoted || !value.trim())) {
      if (quoted && line[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      values.push(value.trim()); value = "";
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

function parseResultRows(text: string) {
  let placeColumn = -1;
  let personColumns: number[] = [];
  return text.split(/\r?\n/).map((line) => {
    const values = cells(line);
    const normalizedCells = values.map(normalizeResultText);
    const header = normalizedCells.findIndex(value => /^(vieta|place|pl|rank|position)$/.test(value));
    if (header >= 0) {
      placeColumn = header;
      personColumns = normalizedCells.flatMap((value, index) =>
        /^(vards|uzvards|vards uzvards|uzvards vards|dalibnieks|dalibnieki|dalibnieka vards|name|first name|last name|full name|participant)$/.test(value) ? [index] : []);
    }
    const value = placeColumn >= 0 ? values[placeColumn] ?? "" : "";
    // Never interpret a nearby start number, birth year or time as a place.
    const placement = /^\d{1,4}\.?$/.test(value) && Number(value.replace(/\.$/, "")) > 0
      ? String(Number(value.replace(/\.$/, ""))) : "";
    const status = normalizedCells.find(value => /^(dns|dnf|dsq)$/.test(value)) as "dns" | "dnf" | "dsq" | undefined;
    return { line: line.trim(), normalizedCells, placement, status: status ?? "ranked" as const, header: header >= 0, personValues: personColumns.map(index => normalizedCells[index]).filter(Boolean) };
  }).filter((row) => row.line);
}

export function previewResultMatches(text: string, entries: ImportEntry[]) {
  const rows = parseResultRows(text);
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

type ImportTeam = {
  teamName: string;
  schoolName: string;
  categoryName: string;
  discipline: string;
  members: ImportEntry[];
};

export function previewTeamResultMatches(
  text: string,
  teams: ImportTeam[],
  categories: { name: string; discipline: string }[] = teams.map(team => ({ name: team.categoryName, discipline: team.discipline })),
) {
  const rules = teams.map(team => ({
    school: normalizeResultText(team.schoolName.replace(/^\[TESTS \d{4}\]\s*/i, "")),
    teamName: normalizeResultText(team.teamName),
    labels: [team.categoryName, team.discipline].map(normalizeResultText),
    names: team.members.flatMap(member => [
      normalizeResultText(`${member.firstName} ${member.lastName}`),
      normalizeResultText(`${member.lastName} ${member.firstName}`),
    ]),
  }));
  const knownLabels = new Set(categories.flatMap(category => [category.name, category.discipline]).map(normalizeResultText).filter(Boolean));
  const knownTeamNames = new Set(rules.map(rule => rule.teamName).filter(Boolean));
  const matched: ReturnType<typeof parseResultRows>[] = teams.map(() => []);
  const ambiguous: ReturnType<typeof parseResultRows>[] = teams.map(() => []);
  let heading = "";
  for (const row of parseResultRows(text)) {
    if (row.header) continue;
    const fields = new Set(row.normalizedCells.filter(Boolean));
    const line = ` ${normalizeResultText(row.line)} `;
    if (fields.size === 1 && knownLabels.has(line.trim())) {
      heading = line.trim();
      continue;
    }
    const candidatesByName = rules.flatMap((rule, index) =>
      rule.names.some(name => line.includes(` ${name} `)) ? [index] : []);
    const candidatesBySchool = rules.flatMap((rule, index) => fields.has(rule.school) ? [index] : []);
    // Team protocols can identify a team using the school alone only if the
    // scope and any explicit labels narrow that school to exactly one team.
    let candidates = candidatesByName.length ? candidatesByName : candidatesBySchool.filter(index =>
      row.personValues.every(value => value === rules[index].school || value === rules[index].teamName));
    if (candidatesByName.length && candidatesBySchool.length)
      candidates = candidates.filter(index => candidatesBySchool.includes(index));
    const namedTeams = new Set([...fields].filter(value => knownTeamNames.has(value) || /^\d+ komanda$/.test(value)));
    if (namedTeams.size) candidates = candidates.filter(index => namedTeams.has(rules[index].teamName));
    const groupLabels = [...fields].filter(value => knownLabels.has(value));
    if (!groupLabels.length && heading) groupLabels.push(heading);
    if (groupLabels.length) candidates = candidates.filter(index => groupLabels.every(label => rules[index].labels.includes(label)));
    if (candidates.length === 1) matched[candidates[0]].push(row);
    else for (const index of candidates) ambiguous[index].push(row);
  }

  return teams.map((_, index) => {
    const rows = matched[index];
    const uncertain = ambiguous[index];
    const hasResult = (row: (typeof rows)[number]) => Boolean(row.placement) || row.status !== "ranked";
    const results = rows.filter(hasResult);
    const first = results[0];
    const conflict = results.some(row => row.status !== first.status || (row.status === "ranked" && row.placement !== first.placement));
    const determined = Boolean(first) && !conflict && !uncertain.some(hasResult);
    return {
      placement: determined ? first.placement : "",
      status: determined ? first.status : "ranked" as const,
      sourceLine: [...new Set([...rows, ...uncertain].map(row => row.line))].join("\n"),
      matchNote: conflict ? "Failā komandai atrastas atšķirīgas vietas vai statusi. Precizējiet pēc oriģināla."
        : uncertain.length ? "Faila rinda var attiekties uz vairākām komandām. Precizējiet pēc oriģināla."
        : determined ? "Atrasts komandas rezultāts. Pārbaudiet pirms iekļaušanas."
        : "Komandas vieta nav droši noteikta. Precizējiet pēc oriģināla.",
    };
  });
}
