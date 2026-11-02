import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../wakala/mcp";
import { budgetStopped, currentBudget, raiseBudget, suggestedBudget } from "./testBudget";

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const line = (result: string, stopReason: string) => ({
  id: "r1",
  result,
  tokens: 0,
  startedAt: "",
  finishedAt: "",
  stopReason,
  draftVersion: "",
  rules: [],
});

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("which stopped runs offer more tokens", () => {
  it("only a run Stopped with Budget reached", () => {
    expect(budgetStopped(line("stopped", "Budget reached"))).toBe(true);
    expect(budgetStopped(line("stopped", "Stopped by the designer"))).toBe(false);
    expect(budgetStopped(line("failed", "Budget reached"))).toBe(false);
  });
});

describe("the suggested budget", () => {
  it("is half as much again, rounded up to a thousand, and never below a thousand", () => {
    expect(suggestedBudget(30000)).toBe(45000);
    expect(suggestedBudget(30001)).toBe(46000);
    expect(suggestedBudget(0)).toBe(1000);
  });
});

describe("raising the budget", () => {
  it("reads the default account for its id, reads that account again and sends all nine limits back with only Tokens per test changed", async () => {
    vi.mocked(callTool).mockResolvedValue({ id: "a1", tokens_per_call: 5, tokens_per_test: 100, scenarios_at_once: null });
    await raiseBudget("h1", 200);
    expect(callTool).toHaveBeenCalledWith("h1", "ai_get_default_account");
    expect(callTool).toHaveBeenCalledWith("h1", "ai_get_account", { accountID: "a1" });
    expect(callTool).toHaveBeenLastCalledWith("h1", "ai_set_limits", {
      accountID: "a1",
      tokens_per_call: 5,
      tokens_per_day: null,
      tokens_per_week: null,
      tokens_per_month: null,
      requests_per_minute: null,
      requests_per_day: null,
      requests_per_week: null,
      tokens_per_test: 200,
      scenarios_at_once: null,
    });
  });

  it("refuses a negative or fractional number before asking anything", async () => {
    await expect(raiseBudget("h1", -1)).rejects.toThrow();
    await expect(raiseBudget("h1", 1.5)).rejects.toThrow();
    expect(callTool).not.toHaveBeenCalled();
  });

  it("reads the current budget, null when it does not apply", async () => {
    vi.mocked(callTool).mockResolvedValue({ id: "a1", tokens_per_test: null });
    expect(await currentBudget("h1")).toBeNull();
    vi.mocked(callTool).mockResolvedValue({ id: "a1", tokens_per_test: 30000 });
    expect(await currentBudget("h1")).toBe(30000);
  });
});
