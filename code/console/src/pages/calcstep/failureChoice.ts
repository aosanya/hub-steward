export type StepRef = { id: string; name: string };

export type FailureChoice = { kind: "goto"; stepId: string } | { kind: "stop" } | null;

export type FailureProblem = "empty" | "itself" | "unknown-step";

export const roundingRules = ["down", "up", "half-up", "half-down", "half-even"] as const;

export type RoundingRule = (typeof roundingRules)[number];

export const defaultRounding: RoundingRule = "half-up";

export const otherSteps = (steps: StepRef[], stepId: string): StepRef[] => steps.filter((step) => step.id !== stepId);

export function failureChoiceProblem(choice: FailureChoice, steps: StepRef[], stepId: string): FailureProblem | null {
  if (choice === null) return "empty";
  if (choice.kind === "stop") return null;
  if (choice.stepId === "") return "empty";
  if (choice.stepId === stepId) return "itself";
  return steps.some((step) => step.id === choice.stepId) ? null : "unknown-step";
}
