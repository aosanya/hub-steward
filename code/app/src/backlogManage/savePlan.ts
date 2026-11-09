import type { DraftStep } from "./stepsDraft";
import type { BacklogDetail } from "./types";

export type Rename = { id: string; from: string; to: string };

export type SavePlan = { problem: string; draft: DraftStep[]; removed: DraftStep[]; renames: Rename[]; replacesAll: boolean };

const swapWords = "Two steps would swap names. Rename one of them to another name first, save, then rename the other.";

const empty = (problem: string): SavePlan => ({ problem, draft: [], removed: [], renames: [], replacesAll: false });

const reusingRemovedNames = (original: BacklogDetail, draft: DraftStep[]): DraftStep[] => {
  const claimed = new Set<string>();
  return draft.map((step) => {
    if (step.id !== "") return step;
    const gone = original.steps.find((old) => !draft.some((kept) => kept.id === old.id) && !claimed.has(old.id) && old.name === step.name.trim());
    if (!gone) return step;
    claimed.add(gone.id);
    return { ...step, id: gone.id };
  });
};

const inSafeOrder = (kept: DraftStep[], original: BacklogDetail): Rename[] | null => {
  const names = new Map(kept.map((step) => [step.id, original.steps.find((old) => old.id === step.id)?.name ?? ""]));
  const pending: Rename[] = kept.filter((step) => step.name.trim() !== names.get(step.id)).map((step) => ({ id: step.id, from: names.get(step.id) ?? "", to: step.name.trim() }));
  const ordered: Rename[] = [];
  while (pending.length > 0) {
    const index = pending.findIndex((one) => ![...names].some(([id, name]) => id !== one.id && name === one.to));
    if (index < 0) return null;
    const [next] = pending.splice(index, 1);
    names.set(next.id, next.to);
    ordered.push(next);
  }
  return ordered;
};

export const savePlan = (original: BacklogDetail, draft: DraftStep[]): SavePlan => {
  const reused = reusingRemovedNames(original, draft);
  const kept = reused.filter((step) => step.id !== "");
  const stale = kept.find((step) => !original.steps.some((old) => old.id === step.id));
  if (stale) return empty(`${stale.name} was changed by someone else. Open the backlog again.`);
  const renames = inSafeOrder(kept, original);
  if (renames === null) return empty(swapWords);
  const removed = original.steps.filter((old) => !reused.some((step) => step.id === old.id));
  return { problem: "", draft: reused, removed, renames, replacesAll: kept.length === 0 };
};
