type TeamEntry = { schoolId: number; categoryId: number; teamName: string | null };
export function resultTeamName(name: string | null) {
  return name?.trim() || "1. komanda";
}
export function resultTeamKey(entry: TeamEntry) {
  return JSON.stringify([entry.schoolId, entry.categoryId, resultTeamName(entry.teamName)]);
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
