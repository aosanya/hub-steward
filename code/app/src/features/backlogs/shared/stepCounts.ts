import type { Backlog } from "./api";

export type StepCount = { name: string; issues: number };

export const bubbleLimit = 5;

const whole = (value: unknown) => (typeof value === "number" && value > 0 ? value : 0);

export const topSteps = (counts: StepCount[], limit = bubbleLimit): StepCount[] =>
  counts
    .map((one, at) => ({ one, at }))
    .filter(({ one }) => one.issues > 0)
    .sort((a, b) => b.one.issues - a.one.issues || a.at - b.at)
    .slice(0, limit)
    .map(({ one }) => one);

export const stepTotals = (backlogs: Backlog[]): StepCount[] => {
  const totals = new Map<string, number>();
  backlogs
    .filter((one) => one.kind !== "smart")
    .forEach((one) => (one.counts ?? []).forEach((step) => totals.set(step.name, (totals.get(step.name) ?? 0) + step.issues)));
  return [...totals].map(([name, issues]) => ({ name, issues }));
};

export const pendingCountsOf = (reply: any): StepCount[] =>
  (Array.isArray(reply?.by_step) ? reply.by_step : [])
    .map((raw: any) => ({ name: typeof raw?.name === "string" ? raw.name : "", issues: whole(raw?.count) }))
    .filter((one: StepCount) => one.name !== "");
