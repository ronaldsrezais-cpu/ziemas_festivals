export function isSingularCount(count: number) {
  return count % 10 === 1 && count % 100 !== 11;
}

export function leaderRequirementMessage(participantCount: number, required: number, leaderCount: number) {
  const singular = isSingularCount(required);
  return `Pie ${participantCount} dalībniekiem ${singular ? "nepieciešams" : "nepieciešami"} vismaz ${required} komandas ${singular ? "vadītājs" : "vadītāji"}. Pievienojiet vēl ${required - leaderCount}.`;
}

export function requiredLeaders(participantCount: number) {
  return Math.max(1, Math.ceil(participantCount / 10));
}

export function rosterReadiness(participantCount: number, leaderCount: number, submittedAt: string | null, missingRegistrations = 0, teamIssues: string[] = []) {
  const required = requiredLeaders(participantCount);
  const missingLeaders = Math.max(0, required - leaderCount);
  const issues: string[] = [];
  if (!participantCount) issues.push("Pievienojiet vismaz vienu dalībnieku.");
  if (missingLeaders) issues.push(`Pievienojiet vēl ${missingLeaders} komandas ${isSingularCount(missingLeaders) ? "vadītāju" : "vadītājus"}.`);
  if (missingRegistrations) issues.push(`${missingRegistrations} dalībniekam(-iem) nav pieteikuma sporta veidā.`);
  issues.push(...teamIssues);
  return { canSubmit: !issues.length, submitted: Boolean(submittedAt) && !issues.length, requiredLeaders: required, missingLeaders, issues };
}

export type RosterReadiness = ReturnType<typeof rosterReadiness>;

export function teamMinimumIssues(
  registrations: { participantId: number; categoryId: number; teamName: string | null }[],
  activeParticipantIds: Set<number>,
  sports: { mode: string; name: string; categories: { id: number; name: string; teamMin: number; active?: boolean }[] }[],
) {
  const rules = new Map(sports.filter(sport => sport.mode === "team").flatMap(sport =>
    sport.categories.filter(category => category.active !== false).map(category => [category.id, { ...category, sportName: sport.name }] as const)));
  const teams = new Map<string, { label: string; minimum: number; members: Set<number> }>();
  for (const entry of registrations) {
    const rule = rules.get(entry.categoryId);
    if (!rule || !activeParticipantIds.has(entry.participantId)) continue;
    const team = entry.teamName || "1. komanda";
    const key = JSON.stringify([entry.categoryId, team]);
    const group = teams.get(key) ?? { label: `${rule.sportName} · ${rule.name} · ${team}`, minimum: rule.teamMin, members: new Set<number>() };
    group.members.add(entry.participantId);
    teams.set(key, group);
  }
  return [...teams.values()].filter(team => team.members.size < team.minimum)
    .map(team => `${team.label}: pieteikti ${team.members.size}, nepieciešami vismaz ${team.minimum} dalībnieki.`);
}

export const sportTeamLimitKey = (sportId: number) => `sport_team_limit_${sportId}`;
export function sportTeamLimit(code: string, value?: string) {
  if (value === undefined) return code === "discgolf" ? 15 : null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}
