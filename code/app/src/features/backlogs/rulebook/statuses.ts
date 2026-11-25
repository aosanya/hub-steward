import type { RuleKind } from "./types";

export const ruleKinds: RuleKind[] = ["rule", "decision", "question"];

export const kindStatuses: Record<RuleKind, string[]> = {
  rule: ["proposed", "in_force", "superseded", "retired"],
  decision: ["proposed", "decided", "superseded"],
  question: ["open", "answered", "dropped"],
};

export const firstOn: Record<RuleKind, string[]> = {
  rule: ["in_force", "proposed"],
  decision: ["decided", "proposed"],
  question: ["open"],
};

export const chipOrder = (kind: RuleKind): string[] => [...firstOn[kind], ...kindStatuses[kind].filter((status) => !firstOn[kind].includes(status))];
