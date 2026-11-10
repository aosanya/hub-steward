import type { Target } from "./types";

export const withoutCurrent = (targets: Target[], from: string[]) => (from.length === 0 ? targets : targets.filter((target) => !from.every((id) => id === target.backlogId)));
