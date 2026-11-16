import type { StartStep } from "../market/start/api";

export type CouncilView = "lateMatters" | "councilRisks";

const viewByStepTitle: Record<string, CouncilView> = {
  "Let us approve the list and present it at the meeting": "lateMatters",
  "At the meeting we go through the risks": "councilRisks",
};

export const councilViewOf = (step: Pick<StartStep, "title">): CouncilView | null => viewByStepTitle[step.title] ?? null;
