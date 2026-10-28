import { callTool } from "../wakala/mcp";
import { heldLimitKeys, limitKeys, modelAccounts, saveModelLimits, type LimitValues } from "./modelLimits";

vi.mock("../wakala/mcp");

type Args = Record<string, unknown>;

let calls: { hubId: string; tool: string; args: Args }[] = [];

const answerWith = (replies: Record<string, unknown>) => {
  calls = [];
  vi.mocked(callTool).mockImplementation(async (hubId, tool, args = {}) => {
    calls.push({ hubId, tool, args });
    if (!(tool in replies)) throw new Error("unexpected " + tool);
    const answer = replies[tool];
    if (answer instanceof Error) throw answer;
    return answer as never;
  });
};

const heldAccount = {
  id: "c1",
  agency_id: "h",
  name: "Hugging Face · GLM-5.3",
  provider: "openai_compatible",
  base_url: "https://router.huggingface.co/v1",
  model_name: "zai-org/GLM-5.3:novita",
  status: "enabled",
  key_set: true,
  tokens_per_call: 8000,
  tokens_per_day: 200000,
  tokens_per_month: 4000000,
  requests_per_day: 1500,
  requests_per_minute: 30,
  tokens_per_week: null,
  requests_per_week: null,
  tokens_per_test: 40000,
  scenarios_at_once: 3,
};

const none: LimitValues = Object.fromEntries(limitKeys.map((key) => [key, null])) as LimitValues;

describe("the models of a hub", () => {
  it("lists the seven limits in the order the design draws them", () => {
    expect(limitKeys).toEqual([
      "tokens_per_call",
      "tokens_per_day",
      "tokens_per_week",
      "tokens_per_month",
      "requests_per_minute",
      "requests_per_day",
      "requests_per_week",
    ]);
  });

  it("reads every account of the hub with its address, its model and its nine limits", async () => {
    answerWith({ ai_list_accounts: { items: [heldAccount] } });
    const accounts = await modelAccounts("h");
    expect(accounts).toEqual([
      {
        id: "c1",
        name: "Hugging Face · GLM-5.3",
        baseUrl: "https://router.huggingface.co/v1",
        modelName: "zai-org/GLM-5.3:novita",
        limits: {
          tokens_per_call: 8000,
          tokens_per_day: 200000,
          tokens_per_week: null,
          tokens_per_month: 4000000,
          requests_per_minute: 30,
          requests_per_day: 1500,
          requests_per_week: null,
          tokens_per_test: 40000,
          scenarios_at_once: 3,
        },
      },
    ]);
    expect(calls).toEqual([{ hubId: "h", tool: "ai_list_accounts", args: {} }]);
  });

  it("reads a bare list as well as a wrapped one", async () => {
    answerWith({ ai_list_accounts: [heldAccount] });
    expect(await modelAccounts("h")).toHaveLength(1);
  });

  it("reads a list the backend answers as null as no models", async () => {
    answerWith({ ai_list_accounts: { items: null } });
    expect(await modelAccounts("h")).toEqual([]);
  });

  it("keeps a limit that is zero as zero and one that is missing as null", async () => {
    answerWith({ ai_list_accounts: { items: [{ id: "c2", tokens_per_day: 0 }] } });
    const [account] = await modelAccounts("h");
    expect(account.limits.tokens_per_day).toBe(0);
    expect(account.limits.tokens_per_week).toBeNull();
  });

  it("skips an account that has no id", async () => {
    answerWith({ ai_list_accounts: { items: [{ name: "stray" }, heldAccount] } });
    expect((await modelAccounts("h")).map((account) => account.id)).toEqual(["c1"]);
  });

  it("fails when the answer is not a list", async () => {
    answerWith({ ai_list_accounts: {} });
    await expect(modelAccounts("h")).rejects.toThrow("the answer was not a list");
  });

  it("fails when the tool is not there", async () => {
    answerWith({ ai_list_accounts: new Error('unknown tool "ai_list_accounts"') });
    await expect(modelAccounts("h")).rejects.toThrow("unknown tool");
  });
});

describe("saving the limits of a model", () => {
  const sentToSet = () => calls.filter((call) => call.tool === "ai_set_limits");

  it("lists the nine limits the backend replaces on a save", () => {
    expect(heldLimitKeys).toEqual([...limitKeys, "tokens_per_test", "scenarios_at_once"]);
    expect(heldLimitKeys).toHaveLength(9);
  });

  it("reads the account first and sends all nine limits, a switched-off one as null", async () => {
    answerWith({ ai_get_account: heldAccount, ai_set_limits: heldAccount });
    await saveModelLimits("h", "c1", { ...none, tokens_per_day: 150000, requests_per_week: 0 });
    expect(calls).toEqual([
      { hubId: "h", tool: "ai_get_account", args: { accountID: "c1" } },
      {
        hubId: "h",
        tool: "ai_set_limits",
        args: {
          accountID: "c1",
          tokens_per_call: null,
          tokens_per_day: 150000,
          tokens_per_week: null,
          tokens_per_month: null,
          requests_per_minute: null,
          requests_per_day: null,
          requests_per_week: 0,
          tokens_per_test: 40000,
          scenarios_at_once: 3,
        },
      },
    ]);
  });

  it("changes one limit and keeps the other eight as they were read", async () => {
    answerWith({ ai_list_accounts: { items: [heldAccount] }, ai_get_account: heldAccount, ai_set_limits: heldAccount });
    const [account] = await modelAccounts("h");
    await saveModelLimits("h", "c1", { ...account.limits, tokens_per_day: 150000 });
    expect(sentToSet()[0].args).toEqual({
      accountID: "c1",
      tokens_per_call: 8000,
      tokens_per_day: 150000,
      tokens_per_week: null,
      tokens_per_month: 4000000,
      requests_per_minute: 30,
      requests_per_day: 1500,
      requests_per_week: null,
      tokens_per_test: 40000,
      scenarios_at_once: 3,
    });
  });

  it("sends no change to the model, only its nine limits", async () => {
    answerWith({ ai_get_account: heldAccount, ai_set_limits: heldAccount });
    await saveModelLimits("h", "c1", none);
    expect(Object.keys(sentToSet()[0].args).sort()).toEqual(["accountID", ...heldLimitKeys].sort());
  });

  it("sends a limit the account does not hold as null", async () => {
    answerWith({ ai_get_account: { id: "c1" }, ai_set_limits: heldAccount });
    await saveModelLimits("h", "c1", none);
    expect(sentToSet()[0].args.tokens_per_test).toBeNull();
    expect(sentToSet()[0].args.scenarios_at_once).toBeNull();
  });

  it("does not send the limits when the account cannot be read", async () => {
    answerWith({ ai_get_account: new Error("account not found"), ai_set_limits: heldAccount });
    await expect(saveModelLimits("h", "c1", none)).rejects.toThrow("account not found");
    expect(sentToSet()).toEqual([]);
  });

  it("refuses a limit below zero without calling the tool", async () => {
    answerWith({ ai_get_account: heldAccount, ai_set_limits: heldAccount });
    await expect(saveModelLimits("h", "c1", { ...none, tokens_per_day: -1 })).rejects.toThrow("a limit cannot be below zero");
    expect(calls).toEqual([]);
  });

  it("refuses a limit that is not a whole number without calling the tool", async () => {
    answerWith({ ai_get_account: heldAccount, ai_set_limits: heldAccount });
    await expect(saveModelLimits("h", "c1", { ...none, tokens_per_day: 1.5 })).rejects.toThrow("that was not understood");
    expect(calls).toEqual([]);
  });

  it("refuses to save with no model chosen", async () => {
    answerWith({ ai_get_account: heldAccount, ai_set_limits: heldAccount });
    await expect(saveModelLimits("h", "", none)).rejects.toThrow("choose a model");
    expect(calls).toEqual([]);
  });

  it("fails when the tool refuses", async () => {
    answerWith({ ai_get_account: heldAccount, ai_set_limits: new Error("ai_set_limits: not found") });
    await expect(saveModelLimits("h", "c1", none)).rejects.toThrow("not found");
  });
});
