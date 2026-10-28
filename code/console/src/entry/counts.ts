type Counts = { roles: number; goals: number; workflows?: number };

export const countsOf = (counts: Counts, t: (key: string) => string) => {
  const line = t(counts.workflows === undefined ? "templateCounts" : "agencyCounts");
  return line.replace("{roles}", String(counts.roles)).replace("{goals}", String(counts.goals)).replace("{workflows}", String(counts.workflows ?? 0));
};
