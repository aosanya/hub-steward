import { callTool } from "../wakala/mcp";
import { changeAccountLimits } from "./modelLimits";
import { isRecord, textOf } from "./pages/groups";
import type { RunLine } from "./scenario";

export const budgetReachedReason = "Budget reached";

export const budgetStopped = (run: RunLine): boolean => run.result === "stopped" && run.stopReason === budgetReachedReason;

export const budgetLimitKey = "tokens_per_test";

const notAccountWords = "the answer was not a model";
const notWholeWords = "that was not understood";

export const suggestedBudget = (now: number): number => Math.max(1000, Math.ceil((now * 1.5) / 1000) * 1000);

const defaultAccount = async (hubId: string): Promise<Record<string, unknown>> => {
  const account = await callTool<unknown>(hubId, "ai_get_default_account");
  if (!isRecord(account) || textOf(account, "id") === "") throw new Error(notAccountWords);
  return account;
};

export const currentBudget = async (hubId: string): Promise<number | null> => {
  const value = (await defaultAccount(hubId))[budgetLimitKey];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const raiseBudget = async (hubId: string, value: number): Promise<void> => {
  if (!Number.isInteger(value) || value < 0) throw new Error(notWholeWords);
  const account = await defaultAccount(hubId);
  await changeAccountLimits(hubId, textOf(account, "id"), { [budgetLimitKey]: value });
};
