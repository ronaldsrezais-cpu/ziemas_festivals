type TeamEntry = { schoolId: number; categoryId: number; teamName: string | null };
export function resultTeamName(name: string | null) {
  return name?.trim() || "1. komanda";
}
export function resultTeamKey(entry: TeamEntry) {
  return JSON.stringify([entry.schoolId, entry.categoryId, resultTeamName(entry.teamName)]);
}
export function combineTeamImportRows<T extends TeamEntry & { schoolName: string; placement: string; status: string }>(rows: T[]) {
  const teams = new Map<string, T>();
  for (const row of rows) {
    const key = resultTeamKey(row);
    const previous = teams.get(key);
    if (previous && (previous.status !== row.status || (row.status === "ranked" && Number(previous.placement) !== Number(row.placement)))) {
      throw new Error(`${row.schoolName} · ${resultTeamName(row.teamName)}: vienai komandai atlasītas atšķirīgas vietas vai statusi. Precizējiet tās priekšskatījumā.`);
    }
    if (!previous) teams.set(key, row);
  }
  return [...teams.values()];
}

// Legacy inconsistent teams need a judge's correction before displaying a place.
export function uniqueTeamResults<T extends TeamEntry & { placement: number | null; status: string }>(rows: T[]): T[] {
  const teams = new Map<string, { row: T; conflict: boolean }>();
  for (const row of rows) {
    const key = resultTeamKey(row);
    const previous = teams.get(key);
    if (!previous) teams.set(key, { row, conflict: false });
    else if (previous.row.placement !== row.placement || previous.row.status !== row.status) previous.conflict = true;
  }
  return [...teams.values()].flatMap(team => team.conflict ? [] : [team.row]);
}
