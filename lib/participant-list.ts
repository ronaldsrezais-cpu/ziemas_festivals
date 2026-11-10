export type Registration = {
  id: number; sportId: number; sportName: string; categoryId: number;
  categoryName: string; discipline: string; teamName: string | null; sportMode?: "individual" | "team"; siacNumber?: string | null;
};
export type ListedParticipant = {
  id: number; firstName: string; lastName: string; birthYear: number;
  gender: string; schoolId: number; schoolName: string; municipality: string;
  schoolStatus: string; registrations: Registration[]; otherSports?: string[];
};
export type ParticipantFilters = { school?: string; sport?: string; category?: string; search?: string };
export function filterParticipants(rows: ListedParticipant[], filters: ParticipantFilters) {
  const search = filters.search?.trim().toLocaleLowerCase("lv") ?? "";
  return rows.flatMap((person) => {
    if (filters.school && String(person.schoolId) !== filters.school) return [];
    if (search && !`${person.firstName} ${person.lastName} ${person.schoolName} ${person.municipality}`.toLocaleLowerCase("lv").includes(search)) return [];
    const registrations = person.registrations.filter((entry) =>
      (!filters.sport || String(entry.sportId) === filters.sport) &&
      (!filters.category || String(entry.categoryId) === filters.category));
    if ((filters.sport || filters.category) && !registrations.length) return [];
    return [{ ...person, registrations }];
  });
}
export const genderLabel = (value: string) => value === "F" ? "Meitene" : value === "M" ? "Zēns" : value;
export const schoolStatusLabel = (value: string) => ({ approved: "Apstiprināta", pending: "Gaida apstiprinājumu", rejected: "Noraidīta" })[value] ?? value;

export function groupTeamParticipants(people: ListedParticipant[]) {
  const teams = new Map<string, {
    key: string; schoolName: string; municipality: string; teamName: string;
    registration: Registration; members: ListedParticipant[];
  }>();
  const individuals: ListedParticipant[] = [];
  for (const person of people) {
    const registrations = [];
    for (const entry of person.registrations) {
      if (entry.sportMode !== "team") { registrations.push(entry); continue; }
      const teamName = entry.teamName?.trim() || "1. komanda";
      const key = JSON.stringify([entry.sportId, entry.categoryId, person.schoolId, teamName]);
      const team = teams.get(key) ?? { key, schoolName: person.schoolName, municipality: person.municipality, teamName, registration: entry, members: [] };
      team.members.push(person);
      teams.set(key, team);
    }
    if (registrations.length || !person.registrations.length) individuals.push({ ...person, registrations });
  }
  const sortedTeams = [...teams.values()].sort((a, b) =>
    a.registration.sportName.localeCompare(b.registration.sportName, "lv") ||
    a.registration.categoryName.localeCompare(b.registration.categoryName, "lv", { numeric: true }) ||
    a.schoolName.localeCompare(b.schoolName, "lv") ||
    a.teamName.localeCompare(b.teamName, "lv", { numeric: true }));
  return { teams: sortedTeams, individuals };
}
