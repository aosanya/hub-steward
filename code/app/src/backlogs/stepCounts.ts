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

export const pendingCountsOf = (reply: any, held: number): StepCount[] => {
  const open: StepCount[] = (Array.isArray(reply?.by_step) ? reply.by_step : [])
    .map((raw: any) => ({ name: typeof raw?.name === "string" ? raw.name : "", issues: whole(raw?.count) }))
    .filter((one: StepCount) => one.name !== "");
  const settled = held - whole(reply?.total);
  return reply?.by_step === undefined ? [] : settled > 0 ? [...open, { name: "Done", issues: settled }] : open;
};
