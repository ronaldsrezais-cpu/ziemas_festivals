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

export function rosterReadiness(participantCount: number, leaderCount: number, submittedAt: string | null, missingRegistrations = 0) {
  const required = requiredLeaders(participantCount);
  const missingLeaders = Math.max(0, required - leaderCount);
  const issues: string[] = [];
  if (!participantCount) issues.push("Pievienojiet vismaz vienu dalībnieku.");
  if (missingLeaders) issues.push(`Pievienojiet vēl ${missingLeaders} komandas ${isSingularCount(missingLeaders) ? "vadītāju" : "vadītājus"}.`);
  if (missingRegistrations) issues.push(`${missingRegistrations} dalībniekam(-iem) nav pieteikuma sporta veidā.`);
  return { canSubmit: !issues.length, submitted: Boolean(submittedAt) && !issues.length, requiredLeaders: required, missingLeaders, issues };
}

export type RosterReadiness = ReturnType<typeof rosterReadiness>;
