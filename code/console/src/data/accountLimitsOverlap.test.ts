import { callTool } from "../wakala/mcp";
import { heldLimitKeys, saveModelLimits } from "./modelLimits";
import { raiseBudget } from "./testBudget";

vi.mock("../wakala/mcp");

type Account = Record<string, unknown>;

const opening = (id: string): Account => ({
  id,
  tokens_per_call: 8000,
  tokens_per_day: 200000,
  tokens_per_week: null,
  tokens_per_month: 4000000,
  requests_per_minute: 30,
  requests_per_day: 1500,
  requests_per_week: null,
  tokens_per_test: 30000,
  scenarios_at_once: 2,
});

const nextTurn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const opened = () => {
  let release: () => void = () => {};
  return { gate: new Promise<void>((resolve) => (release = resolve)), release: () => release() };
};

const backendHolding = (accounts: Record<string, Account>, gates: Record<string, Promise<void>> = {}) => {
  const calls: string[] = [];
  vi.mocked(callTool).mockImplementation(async (_hubId, tool, args = {}) => {
    const id = tool === "ai_get_default_account" ? "c1" : String(args.accountID);
    calls.push(`${tool} ${id}`);
    await gates[`${tool} ${id}`];
    await nextTurn();
    if (tool === "ai_get_account" || tool === "ai_get_default_account") return { ...accounts[id] } as never;
    if (tool !== "ai_set_limits") throw new Error("unexpected " + tool);
    const replaced = Object.fromEntries(heldLimitKeys.map((key) => [key, args[key] ?? null]));
    accounts[id] = { ...accounts[id], ...replaced };
    return { ...accounts[id] } as never;
  });
  return calls;
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("changes to one model's limits that overlap", () => {
  it("keep both when a budget raise and a save of one limit start together", async () => {
    const accounts = { c1: opening("c1") };
    backendHolding(accounts);
    await Promise.all([raiseBudget("h", 45000), saveModelLimits("h", "c1", { tokens_per_day: 150000 })]);
    expect(accounts.c1).toEqual({ ...opening("c1"), tokens_per_test: 45000, tokens_per_day: 150000 });
  });

  it("keep both when the save of one limit starts before the budget raise", async () => {
    const accounts = { c1: opening("c1") };
    backendHolding(accounts);
    await Promise.all([saveModelLimits("h", "c1", { tokens_per_day: 150000 }), raiseBudget("h", 45000)]);
    expect(accounts.c1).toEqual({ ...opening("c1"), tokens_per_test: 45000, tokens_per_day: 150000 });
  });

  it("keep both when two saves of different limits start together", async () => {
    const accounts = { c1: opening("c1") };
    backendHolding(accounts);
    await Promise.all([
      saveModelLimits("h", "c1", { requests_per_day: 2500 }),
      saveModelLimits("h", "c1", { scenarios_at_once: 4 }),
    ]);
    expect(accounts.c1).toEqual({ ...opening("c1"), requests_per_day: 2500, scenarios_at_once: 4 });
  });

  it("read the model again only after the change before them has been written", async () => {
    const accounts = { c1: opening("c1") };
    const calls = backendHolding(accounts);
    await Promise.all([
      saveModelLimits("h", "c1", { requests_per_day: 2500 }),
      saveModelLimits("h", "c1", { scenarios_at_once: 4 }),
    ]);
    expect(calls).toEqual(["ai_get_account c1", "ai_set_limits c1", "ai_get_account c1", "ai_set_limits c1"]);
  });

  it("go on with the next change when the one before them failed", async () => {
    const accounts = { c1: opening("c1") };
    backendHolding(accounts);
    const real = vi.mocked(callTool).getMockImplementation()!;
    let refused = false;
    vi.mocked(callTool).mockImplementation(async (hubId, tool, args) => {
      if (tool === "ai_set_limits" && !refused) {
        refused = true;
        throw new Error("ai_set_limits: refused");
      }
      return real(hubId, tool, args);
    });
    const failing = saveModelLimits("h", "c1", { requests_per_day: 2500 });
    const following = saveModelLimits("h", "c1", { scenarios_at_once: 4 });
    await expect(failing).rejects.toThrow("refused");
    await following;
    expect(accounts.c1).toEqual({ ...opening("c1"), scenarios_at_once: 4 });
  });

  it("do not make a change to another model wait", async () => {
    const accounts = { c1: opening("c1"), c2: opening("c2") };
    const held = opened();
    backendHolding(accounts, { "ai_get_account c1": held.gate });
    const slow = saveModelLimits("h", "c1", { requests_per_day: 2500 });
    await saveModelLimits("h", "c2", { scenarios_at_once: 4 });
    expect(accounts.c2).toEqual({ ...opening("c2"), scenarios_at_once: 4 });
    expect(accounts.c1).toEqual(opening("c1"));
    held.release();
    await slow;
    expect(accounts.c1).toEqual({ ...opening("c1"), requests_per_day: 2500 });
  });
});
