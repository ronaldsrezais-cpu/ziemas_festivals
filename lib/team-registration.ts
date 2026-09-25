// Keep existing team identities stable, including teams created before numbering.
export function teamOptions(entries: Array<{ teamName: string | null }>) {
  return [...new Set(entries.map(entry => entry.teamName).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, "lv", { numeric: true }));
}

export function numberedTeam(entries: Array<{ teamName: string | null }>, number?: number, previous?: string | null) {
  if (number === undefined && previous) return previous;
  const names = teamOptions(entries);
  const index = number ?? 1;
  if (index < 1 || index > names.length + 1) throw new Error("Izvēlieties komandas numuru no saraksta.");
  if (names[index - 1]) return names[index - 1];
  let next = 1;
  while (names.includes(`${next}. komanda`)) next++;
  return `${next}. komanda`;
}
