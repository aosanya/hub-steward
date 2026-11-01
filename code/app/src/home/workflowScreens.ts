import type { StartStep } from "../coordinator/start/api";
import { routes } from "../routes";
import { chatTab } from "../tabs";

export const joinGroupWorkflow = "Join a group";
export const applySupplierWorkflow = "Apply as a supplier";
export const joinGroupPath = () => routes.join.path();
export const applySupplierPath = "/supply/apply";

export const workflowScreens: ReadonlyMap<string, () => string> = new Map([
  [joinGroupWorkflow, joinGroupPath],
  [applySupplierWorkflow, () => applySupplierPath],
]);

export const hasScreen = (step: Pick<StartStep, "formName">): boolean => workflowScreens.has(step.formName);

export const screenOf = (step: Pick<StartStep, "formName">): string | undefined => workflowScreens.get(step.formName)?.();

export const buyInputsChatWorkflow = "Buy inputs";
export const sellHarvestChatWorkflow = "Sell harvest";
export const buyInputsChatPath = "/apps/buy";
export const sellHarvestChatPath = "/apps/sell";

const chatScreens: ReadonlyMap<string, string> = new Map([
  [buyInputsChatWorkflow, buyInputsChatPath],
  [sellHarvestChatWorkflow, sellHarvestChatPath],
]);

export const chatScreenOf = (step: Pick<StartStep, "workflowName">): string => chatScreens.get(step.workflowName) ?? chatTab.path;
