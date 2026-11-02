import { callTool } from "../wakala/mcp";
import type { ActionTool } from "./chatActions";
import {
  limitRaiseAction,
  limitRaiseAnswer,
  limitRaiseApproval,
  limitRaiseParamsOf,
  limitRaiseSpec,
  limitRaiseView,
  showLimitRaiseTool,
} from "./limitRaise";
import { roleLimitKeys } from "./roleLimits";

vi.mock("../wakala/mcp");

type Args = Record<string, unknown>;

let calls: { tool: string; args: Args }[] = [];

const answerWith = (replies: Record<string, unknown>) => {
  calls = [];
  vi.mocked(callTool).mockImplementation(async (_hubId, tool, args = {}) => {
    calls.push({ tool, args });
    if (!(tool in replies)) throw new Error("unexpected " + tool);
    const answer = replies[tool];
    if (answer instanceof Error) throw answer;
    return answer as never;
  });
};

const nineLimits = {
  tokens_per_call: 8000,
  tokens_per_day: 100000,
  tokens_per_week: null,
  tokens_per_month: 4000000,
  requests_per_minute: 30,
  requests_per_day: null,
  requests_per_week: null,
  tokens_per_test: 50000,
  scenarios_at_once: 2,
};

const farmers = { id: "r1", name: "Farmers' agent", account_id: "c1", ...nineLimits };

const model = { id: "c1", name: "Meta Model API", model_name: "Muse Spark 1.3", ...nineLimits };

const refusedMonth = { limit: "tokens_per_month", owner: "account", id: "c1", max: 4000000, used: 4000000, value: 6000000 };

const fitsThePageActions: ActionTool = limitRaiseAction;

describe("asking the chat to raise the limit that stopped a call", () => {
  it("offers the model one tool whose arguments are the four a refusal carries, an id and the new value", () => {
    expect(fitsThePageActions.spec).toBe(limitRaiseSpec);
    expect(limitRaiseSpec.name).toBe(showLimitRaiseTool);
    const properties = limitRaiseSpec.parameters.properties as Record<string, { enum?: string[] }>;
    expect(properties.limit.enum).toEqual([...roleLimitKeys]);
    expect(properties.owner.enum).toEqual(["role", "account"]);
    expect(limitRaiseSpec.parameters.required).toEqual(["limit", "owner", "id", "max", "used", "value"]);
  });

  it("lands the answer in the content area as the raise view with what the model gave", () => {
    expect(limitRaiseAction.answer("Why did it stop?", refusedMonth)).toEqual({
      kind: "action",
      prompt: "Why did it stop?",
      view: limitRaiseView,
      title: "",
      params: refusedMonth,
    });
    expect(limitRaiseAnswer("x", refusedMonth).params).not.toBe(refusedMonth);
  });

  it("reads the limit, whose it is, the maximum, the count, the id and the new value out of the params", () => {
    expect(limitRaiseParamsOf(refusedMonth)).toEqual({
      key: "tokens_per_month",
      owner: "account",
      max: 4000000,
      used: 4000000,
      id: "c1",
      value: 6000000,
    });
  });

  it.each([
    ["a limit that is not one of the nine", { ...refusedMonth, limit: "tokens_per_hour" }],
    ["an owner that is neither the role nor the account", { ...refusedMonth, owner: "agency" }],
    ["no id", { ...refusedMonth, id: "" }],
    ["a maximum that is not a number", { ...refusedMonth, max: "4,000,000" }],
    ["a count that is not a number", { ...refusedMonth, used: null }],
    ["a new value that is not a whole number", { ...refusedMonth, value: 6000000.5 }],
    ["a new value that is not higher than the maximum", { ...refusedMonth, value: 4000000 }],
    ["a lower new value", { ...refusedMonth, value: 1000 }],
  ])("reads nothing out of %s", (_name, params) => {
    expect(limitRaiseParamsOf(params)).toBeNull();
  });
});

describe("the card that raises one limit", () => {
  it("raises an account's limit with ai_set_limits, reading the account first and resending all nine", async () => {
    answerWith({ ai_get_account: model });
    const ask = limitRaiseParamsOf(refusedMonth);
    if (!ask) throw new Error("not understood");
    const approval = await limitRaiseApproval("h", ask);
    expect(calls).toEqual([{ tool: "ai_get_account", args: { accountID: "c1" } }]);
    expect(approval).toEqual({
      name: "Meta Model API",
      tool: "ai_set_limits",
      arguments: { accountID: "c1", ...nineLimits, tokens_per_month: 6000000 },
    });
  });

  it("raises a role's limit with ai_set_role_limits, reading the role first and resending all nine", async () => {
    answerWith({ ai_get_role: farmers });
    const ask = limitRaiseParamsOf({ limit: "tokens_per_day", owner: "role", id: "r1", max: 100000, used: 100000, value: 150000 });
    if (!ask) throw new Error("not understood");
    const approval = await limitRaiseApproval("h", ask);
    expect(calls).toEqual([{ tool: "ai_get_role", args: { roleID: "r1" } }]);
    expect(approval).toEqual({
      name: "Farmers' agent",
      tool: "ai_set_role_limits",
      arguments: { roleID: "r1", ...nineLimits, tokens_per_day: 150000 },
    });
  });

  it("keeps the two limits the Test page reads and every limit the holder does not apply", async () => {
    answerWith({ ai_get_role: farmers });
    const ask = limitRaiseParamsOf({ limit: "requests_per_minute", owner: "role", id: "r1", max: 30, used: 30, value: 60 });
    if (!ask) throw new Error("not understood");
    const { arguments: sent } = await limitRaiseApproval("h", ask);
    expect(sent).toMatchObject({ tokens_per_test: 50000, scenarios_at_once: 2, tokens_per_week: null, requests_per_day: null, requests_per_minute: 60 });
  });

  it("names the account by its model when it has no name", async () => {
    answerWith({ ai_get_account: { ...model, name: "" } });
    const ask = limitRaiseParamsOf(refusedMonth);
    if (!ask) throw new Error("not understood");
    expect((await limitRaiseApproval("h", ask)).name).toBe("Muse Spark 1.3");
  });

  it("sends nothing when the holder cannot be read", async () => {
    answerWith({ ai_get_account: new Error("gone") });
    const ask = limitRaiseParamsOf(refusedMonth);
    if (!ask) throw new Error("not understood");
    await expect(limitRaiseApproval("h", ask)).rejects.toThrow("gone");
    expect(calls.map((call) => call.tool)).toEqual(["ai_get_account"]);
  });
});
