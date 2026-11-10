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

export function teamRosterIssues(
  registrations: { participantId: number; categoryId: number; teamName: string | null }[],
  activeParticipants: { id: number; gender: string }[],
  sports: { mode: string; name: string; categories: { id: number; name: string; teamMin: number; active?: boolean; requireMixedTeam?: boolean }[] }[],
) {
  const rules = new Map(sports.filter(sport => sport.mode === "team").flatMap(sport =>
    sport.categories.filter(category => category.active !== false).map(category => [category.id, { ...category, sportName: sport.name }] as const)));
  const gendersById = new Map(activeParticipants.map(person => [person.id, person.gender]));
  const teams = new Map<string, { label: string; minimum: number; mixed: boolean; members: Map<number, string> }>();
  for (const entry of registrations) {
    const rule = rules.get(entry.categoryId);
    const gender = gendersById.get(entry.participantId);
    if (!rule || gender === undefined) continue;
    const team = entry.teamName || "1. komanda";
    const key = JSON.stringify([entry.categoryId, team]);
    const group = teams.get(key) ?? { label: `${rule.sportName} · ${rule.name} · ${team}`, minimum: rule.teamMin, mixed: Boolean(rule.requireMixedTeam), members: new Map<number, string>() };
    group.members.set(entry.participantId, gender);
    teams.set(key, group);
  }
  return [...teams.values()].flatMap(team => {
    const issues = [];
    if (team.members.size < team.minimum)
      issues.push(`${team.label}: pieteikti ${team.members.size}, nepieciešami vismaz ${team.minimum} dalībnieki.`);
    if (team.mixed) {
      const genders = new Set(team.members.values());
      if (!genders.has("F") || !genders.has("M"))
        issues.push(`${team.label}: komandā jābūt vismaz vienai meitenei un vienam zēnam.`);
    }
    return issues;
  });
}

export const categoryTeamLimitPrefix = "category_team_limit_";
export const categoryMixedTeamPrefix = "category_mixed_team_";
export const categoryTeamLimitKey = (categoryId: number) => `${categoryTeamLimitPrefix}${categoryId}`;
export const categoryMixedTeamKey = (categoryId: number) => `${categoryMixedTeamPrefix}${categoryId}`;

export function categoryTeamRules(categoryId: number, values: ReadonlyMap<string, string>) {
  return {
    totalTeamLimit: positiveTeamLimit(values.get(categoryTeamLimitKey(categoryId))),
    requireMixedTeam: values.get(categoryMixedTeamKey(categoryId)) === "true",
  };
}

export const sportTeamLimitKey = (sportId: number) => `sport_team_limit_${sportId}`;
export function sportTeamLimit(code: string, value?: string) {
  if (value === undefined) return code === "discgolf" ? 15 : null;
  return positiveTeamLimit(value);
}

function positiveTeamLimit(value?: string) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}
