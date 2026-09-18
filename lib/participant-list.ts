export type Registration = {
  id: number; sportId: number; sportName: string; categoryId: number;
  categoryName: string; discipline: string; teamName: string | null;
};
export type ListedParticipant = {
  id: number; firstName: string; lastName: string; birthYear: number;
  gender: string; schoolId: number; schoolName: string; municipality: string;
  schoolStatus: string; registrations: Registration[];
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
