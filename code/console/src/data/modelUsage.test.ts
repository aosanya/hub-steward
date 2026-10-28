import { callTool } from "../wakala/mcp";
import { heldLimitKeys, type HeldLimits, type ModelAccount } from "./modelLimits";
import { isReached, modelUsage, shareOf } from "./modelUsage";

vi.mock("../wakala/mcp");

type Args = Record<string, unknown>;
type Reply = unknown | ((args: Args) => unknown);

let calls: { hubId: string; tool: string; args: Args }[] = [];

const answerWith = (replies: Record<string, Reply>) => {
  calls = [];
  vi.mocked(callTool).mockImplementation(async (hubId, tool, args = {}) => {
    calls.push({ hubId, tool, args });
    if (!(tool in replies)) throw new Error("unexpected " + tool);
    const reply = replies[tool];
    const answer = typeof reply === "function" ? reply(args) : reply;
    if (answer instanceof Error) throw answer;
    return answer as never;
  });
};

const toolsCalled = () => calls.map((call) => call.tool);

const none = Object.fromEntries(heldLimitKeys.map((key) => [key, null])) as HeldLimits;

const account = (limits: Partial<HeldLimits> = {}): ModelAccount => ({
  id: "c1",
  name: "Hugging Face · GLM-5.3",
  baseUrl: "https://router.huggingface.co/v1",
  modelName: "zai-org/GLM-5.3:novita",
  limits: { ...none, tokens_per_call: 8000, tokens_per_day: 200000, tokens_per_month: 4000000, requests_per_day: 1500, requests_per_minute: 30, ...limits },
});

const report = (used: Record<string, number> = {}) => ({
  account_id: "c1",
  counts: [
    { limit: "requests per minute", max: 30, used: used["requests per minute"] ?? 6 },
    { limit: "requests per day", max: 1500, used: used["requests per day"] ?? 412 },
    { limit: "daily token", max: 200000, used: used["daily token"] ?? 61200 },
    { limit: "monthly token", max: 4000000, used: used["monthly token"] ?? 1480000 },
    { limit: "weekly request", max: 0, used: 900 },
    { limit: "weekly token", max: 0, used: 90000 },
  ],
});

const roles = {
  items: [
    { id: "r1", name: "Dispatcher", account_id: "c1" },
    { id: "r2", name: "Hub Steward", account_id: "c1" },
    { id: "r3", name: "Elsewhere", account_id: "c9" },
    { id: "r4", name: "No model", account_id: "" },
  ],
};

const resolved: Record<string, unknown> = {
  r1: {
    limits: [
      { limit: "tokens per call", max: 8000, used: 0, source: "account" },
      { limit: "daily token", max: 200000, used: 27100, source: "account" },
      { limit: "monthly token", max: 4000000, used: 640000, source: "account" },
      { limit: "requests per day", max: 1500, used: 171, source: "account" },
    ],
  },
  r2: {
    limits: [
      { limit: "daily token", max: 200000, used: 17800, source: "account" },
      { limit: "monthly token", max: 4000000, used: 960000, source: "account" },
      { limit: "requests per day", max: 1500, used: 112, source: "account" },
    ],
  },
};

const standard = (extra: Record<string, Reply> = {}) => ({
  ai_list_usage: report(),
  ai_list_roles: roles,
  ai_resolve_role: (args: Args) => resolved[args.roleID as string],
  ...extra,
});

describe("the use of a model against its limits", () => {
  it("reads the account's use and lists each limit that applies, in the design's order, with what is used and the maximum", async () => {
    answerWith(standard());
    const { rows } = await modelUsage("h", account());
    expect(rows).toEqual([
      { key: "tokens_per_call", max: 8000, used: null },
      { key: "tokens_per_day", max: 200000, used: 61200 },
      { key: "tokens_per_month", max: 4000000, used: 1480000 },
      { key: "requests_per_day", max: 1500, used: 412 },
      { key: "requests_per_minute", max: 30, used: 6 },
    ]);
    expect(calls[0]).toEqual({ hubId: "h", tool: "ai_list_usage", args: { accountID: "c1" } });
  });

  it("leaves out a limit that does not apply, whatever its count", async () => {
    answerWith(standard());
    const { rows } = await modelUsage("h", account());
    expect(rows.map((row) => row.key)).not.toContain("tokens_per_week");
    expect(rows.map((row) => row.key)).not.toContain("requests_per_week");
  });

  it("shows the two weekly limits between their neighbours once they apply", async () => {
    const counts = [
      ...report().counts.filter((count) => !count.limit.startsWith("weekly")),
      { limit: "weekly request", max: 9000, used: 900 },
      { limit: "weekly token", max: 900000, used: 90000 },
    ];
    answerWith(standard({ ai_list_usage: { counts } }));
    const { rows } = await modelUsage("h", account({ tokens_per_week: 900000, requests_per_week: 9000 }));
    expect(rows.map((row) => row.key)).toEqual([
      "tokens_per_call",
      "tokens_per_day",
      "tokens_per_week",
      "tokens_per_month",
      "requests_per_day",
      "requests_per_week",
      "requests_per_minute",
    ]);
    expect(rows.find((row) => row.key === "tokens_per_week")).toEqual({ key: "tokens_per_week", max: 900000, used: 90000 });
    expect(rows.find((row) => row.key === "requests_per_week")).toEqual({ key: "requests_per_week", max: 9000, used: 900 });
  });

  it("reads tokens per call as not counted, because it caps each call", async () => {
    answerWith(standard());
    const call = (await modelUsage("h", account())).rows[0];
    expect(call).toEqual({ key: "tokens_per_call", max: 8000, used: null });
    expect(isReached(call)).toBe(false);
  });

  it("lists no limit when none applies", async () => {
    answerWith(standard({ ai_list_usage: { counts: [] } }));
    expect((await modelUsage("h", account(none))).rows).toEqual([]);
  });

  it("reads an answer with no counts as use of zero", async () => {
    answerWith(standard({ ai_list_usage: { counts: null } }));
    const { rows } = await modelUsage("h", account());
    expect(rows.find((row) => row.key === "tokens_per_day")).toEqual({ key: "tokens_per_day", max: 200000, used: 0 });
  });

  it("does not check the limits while none is reached", async () => {
    answerWith(standard());
    const use = await modelUsage("h", account());
    expect(use.reached).toBe("");
    expect(toolsCalled()).not.toContain("ai_check_limits");
  });

  it("asks the backend why when a limit is reached, and gives its answer as one sentence", async () => {
    answerWith(
      standard({
        ai_list_usage: report({ "monthly token": 4000000 }),
        ai_check_limits: { allowed: false, reason: "this account's monthly token limit is reached" },
      }),
    );
    const use = await modelUsage("h", account());
    expect(use.reached).toBe("This account's monthly token limit is reached.");
    expect(use.rows.filter(isReached).map((row) => row.key)).toEqual(["tokens_per_month"]);
    expect(calls.find((call) => call.tool === "ai_check_limits")?.args).toEqual({ account_id: "c1", role_limits: {} });
  });

  it("gives no sentence when the backend lets the call go ahead", async () => {
    answerWith(standard({ ai_list_usage: report({ "monthly token": 4000000 }), ai_check_limits: { allowed: true, max_tokens: 8000 } }));
    expect((await modelUsage("h", account())).reached).toBe("");
  });

  it("still shows the use when the check cannot be asked", async () => {
    answerWith(standard({ ai_list_usage: report({ "monthly token": 4000000 }), ai_check_limits: new Error("refused") }));
    const use = await modelUsage("h", account());
    expect(use.reached).toBe("");
    expect(use.rows.filter(isReached)).toHaveLength(1);
  });

  it("fails when the usage cannot be read", async () => {
    answerWith(standard({ ai_list_usage: new Error('unknown tool "ai_list_usage"') }));
    await expect(modelUsage("h", account())).rejects.toThrow("unknown tool");
  });
});

describe("the use of a model by AI role", () => {
  it("lists the roles that use this model, each with today's tokens, this month's tokens and today's requests, the largest user first", async () => {
    answerWith(standard());
    const { roles: found } = await modelUsage("h", account());
    expect(found).toEqual([
      { id: "r2", name: "Hub Steward", today: 17800, month: 960000, requests: 112, share: 60 },
      { id: "r1", name: "Dispatcher", today: 27100, month: 640000, requests: 171, share: 40 },
    ]);
  });

  it("reads each role through its own resolution, and no role of another model", async () => {
    answerWith(standard());
    await modelUsage("h", account());
    expect(calls.filter((call) => call.tool === "ai_resolve_role").map((call) => call.args)).toEqual([{ roleID: "r1" }, { roleID: "r2" }]);
  });

  it("lists no role when none uses the model", async () => {
    answerWith(standard({ ai_list_roles: { items: null } }));
    expect((await modelUsage("h", account())).roles).toEqual([]);
  });

  it("gives every role a share of zero when nothing has been used this month", async () => {
    answerWith(standard({ ai_resolve_role: { limits: [] } }));
    const { roles: found } = await modelUsage("h", account());
    expect(found?.map((role) => role.share)).toEqual([0, 0]);
  });

  it("says the roles could not be read, and still gives the limits, when the roles are refused", async () => {
    answerWith(standard({ ai_list_roles: new Error("refused") }));
    const use = await modelUsage("h", account());
    expect(use.roles).toBeNull();
    expect(use.rows.length).toBeGreaterThan(0);
  });

  it("says the roles could not be read when one role cannot be resolved", async () => {
    answerWith(standard({ ai_resolve_role: new Error("refused") }));
    expect((await modelUsage("h", account())).roles).toBeNull();
  });
});

describe("the share of a limit", () => {
  it("rounds to a whole percent", () => {
    expect(shareOf(61200, 200000)).toBe(31);
    expect(shareOf(1480000, 4000000)).toBe(37);
  });

  it("is zero when there is no maximum", () => {
    expect(shareOf(5, 0)).toBe(0);
  });

  it("calls a limit reached once the count has reached the maximum", () => {
    expect(isReached({ key: "tokens_per_month", max: 100, used: 100 })).toBe(true);
    expect(isReached({ key: "tokens_per_month", max: 100, used: 99 })).toBe(false);
  });
});
