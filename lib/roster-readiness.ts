export function requiredLeaders(participantCount: number) {
  return Math.max(1, Math.ceil(participantCount / 10));
}

export function rosterReadiness(participantCount: number, leaderCount: number, submittedAt: string | null, missingRegistrations = 0) {
  const required = requiredLeaders(participantCount);
  const missingLeaders = Math.max(0, required - leaderCount);
  const issues: string[] = [];
  if (!participantCount) issues.push("Pievienojiet vismaz vienu dalībnieku.");
  if (missingLeaders) issues.push(`Pievienojiet vēl ${missingLeaders} komandas vadītāju(-us).`);
  if (missingRegistrations) issues.push(`${missingRegistrations} dalībniekam(-iem) nav pieteikuma sporta veidā.`);
  return { canSubmit: !issues.length, submitted: Boolean(submittedAt) && !issues.length, requiredLeaders: required, missingLeaders, issues };
}

export type RosterReadiness = ReturnType<typeof rosterReadiness>;
