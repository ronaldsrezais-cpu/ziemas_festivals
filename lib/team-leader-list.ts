export type ListedLeader = {
  id: number;
  fullName: string;
  role: string;
  email: string | null;
  phone: string | null;
  schoolId: number;
  schoolName: string;
  municipality: string;
  schoolStatus: string;
};

export function filterTeamLeaders(
  leaders: ListedLeader[],
  filters: { school?: string; search?: string } = {},
) {
  const query = filters.search?.trim().toLocaleLowerCase("lv") ?? "";
  return leaders.filter((leader) =>
    (!filters.school || String(leader.schoolId) === filters.school) &&
    (!query || [leader.fullName, leader.role, leader.schoolName, leader.municipality, leader.email, leader.phone]
      .filter(Boolean).join(" ").toLocaleLowerCase("lv").includes(query)),
  );
}
