import { callTool } from "../wakala/mcp";
import { drawnSchema } from "./actionSchema";
import { limitedRoles, pendingRaise, roleLimitArguments, roleLimitDrawing, roleLimitKeys, setRoleLimit } from "./roleLimits";

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

const farmers = {
  id: "r1",
  name: "Farmers' agent",
  account_id: "c1",
  tokens_per_call: 8000,
  tokens_per_day: 100000,
  tokens_per_week: null,
  tokens_per_month: 2000000,
  requests_per_minute: 30,
  requests_per_day: null,
  requests_per_week: null,
  tokens_per_test: 50000,
  scenarios_at_once: 2,
};

const sentTo = (tool: string) => calls.filter((call) => call.tool === tool);

describe("the limits of an AI role", () => {
  it("are nine, the seven an account has and the two the Test page reads", () => {
    expect(roleLimitKeys).toEqual([
      "tokens_per_call",
      "tokens_per_day",
      "tokens_per_week",
      "tokens_per_month",
      "requests_per_minute",
      "requests_per_day",
      "requests_per_week",
      "tokens_per_test",
      "scenarios_at_once",
    ]);
  });

  it("are read for every role of the hub with the model it speaks through", async () => {
    answerWith({ ai_list_roles: { items: [farmers, { id: "", name: "nameless" }] } });
    const roles = await limitedRoles("h");
    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({ id: "r1", name: "Farmers' agent", accountId: "c1" });
    expect(roles[0].limits).toEqual({
      tokens_per_call: 8000,
      tokens_per_day: 100000,
      tokens_per_week: null,
      tokens_per_month: 2000000,
      requests_per_minute: 30,
      requests_per_day: null,
      requests_per_week: null,
      tokens_per_test: 50000,
      scenarios_at_once: 2,
    });
  });
});

describe("changing one limit of an AI role", () => {
  it("sends all nine through ai_set_role_limits, the eight it holds and the one it changes", async () => {
    answerWith({ ai_get_role: farmers, ai_set_role_limits: {} });
    await setRoleLimit("h", "r1", "tokens_per_day", 150000);
    expect(sentTo("ai_get_role")[0].args).toEqual({ roleID: "r1" });
    expect(sentTo("ai_set_role_limits")).toHaveLength(1);
    expect(sentTo("ai_set_role_limits")[0].args).toEqual({
      roleID: "r1",
      tokens_per_call: 8000,
      tokens_per_day: 150000,
      tokens_per_week: null,
      tokens_per_month: 2000000,
      requests_per_minute: 30,
      requests_per_day: null,
      requests_per_week: null,
      tokens_per_test: 50000,
      scenarios_at_once: 2,
    });
  });

  it("keeps the two test limits when a call limit changes", async () => {
    answerWith({ ai_get_role: farmers, ai_set_role_limits: {} });
    await setRoleLimit("h", "r1", "requests_per_minute", 0);
    expect(sentTo("ai_set_role_limits")[0].args).toMatchObject({ requests_per_minute: 0, tokens_per_test: 50000, scenarios_at_once: 2 });
  });

  it("refuses a negative value, a fraction, a missing agent and an unknown limit before it sends anything", async () => {
    answerWith({ ai_get_role: farmers, ai_set_role_limits: {} });
    await expect(setRoleLimit("h", "r1", "tokens_per_day", -1)).rejects.toThrow("a limit cannot be below zero");
    await expect(setRoleLimit("h", "r1", "tokens_per_day", 1.5)).rejects.toThrow("that was not understood");
    await expect(setRoleLimit("h", "", "tokens_per_day", 1)).rejects.toThrow("choose an agent");
    await expect(setRoleLimit("h", "r1", "tokens_per_hour" as never, 1)).rejects.toThrow("that is not a limit");
    expect(calls).toEqual([]);
  });

  it("does not send the new limits when the role cannot be read", async () => {
    answerWith({ ai_get_role: new Error("gone"), ai_set_role_limits: {} });
    await expect(setRoleLimit("h", "r1", "tokens_per_day", 1)).rejects.toThrow("gone");
    expect(sentTo("ai_set_role_limits")).toEqual([]);
  });
});

describe("the form that changes one limit of an AI role", () => {
  const offered = {
    type: "object",
    properties: {
      roleID: { type: "string" },
      tokens_per_day: { type: ["integer", "null"] },
      tokens_per_month: { type: ["integer", "null"] },
    },
    required: ["roleID"],
  };

  it("is drawn from the tool's input schema with the agent and the one limit", () => {
    const schema = drawnSchema(offered, roleLimitDrawing("tokens_per_day")) as { properties: object; required: string[] };
    expect(Object.keys(schema.properties)).toEqual(["roleID", "tokens_per_day"]);
    expect(schema.required).toEqual(["roleID"]);
  });

  it("reads the limit as a whole number even when the tool allows it to be null", () => {
    const schema = drawnSchema(offered, roleLimitDrawing("tokens_per_day")) as { properties: Record<string, { type: unknown }> };
    expect(schema.properties.tokens_per_day.type).toBe("integer");
  });
});

describe("a refused check that offers a raise", () => {
  it("names the limit, whose it is, its maximum and how much is used", () => {
    expect(pendingRaise({ allowed: false, reason: "the role's daily token limit is reached", limit: "tokens_per_day", owner: "role", max: 100000, used: 100000 })).toEqual({
      key: "tokens_per_day",
      owner: "role",
      max: 100000,
      used: 100000,
    });
  });

  it("is nothing when the call was allowed", () => {
    expect(pendingRaise({ allowed: true, limit: "", owner: "", max: 0, used: 0 })).toBeNull();
    expect(pendingRaise({ allowed: true, limit: "tokens_per_day", owner: "role", max: 100, used: 10 })).toBeNull();
  });

  it("is nothing when the limit or its owner is one it does not know", () => {
    expect(pendingRaise({ allowed: false, limit: "tokens_per_hour", owner: "role", max: 1, used: 1 })).toBeNull();
    expect(pendingRaise({ allowed: false, limit: "tokens_per_day", owner: "hub", max: 1, used: 1 })).toBeNull();
    expect(pendingRaise({ allowed: false, limit: "tokens_per_day", owner: "role", max: "1", used: 1 })).toBeNull();
    expect(pendingRaise(null)).toBeNull();
  });
});

describe("the arguments of an approval card that changes one limit", () => {
  it("are the role, the eight limits it holds and the one that changes, and send nothing", async () => {
    answerWith({ ai_get_role: farmers });
    const args = await roleLimitArguments("h", "r1", "tokens_per_day", 200000);
    expect(args).toEqual({
      roleID: "r1",
      tokens_per_call: 8000,
      tokens_per_day: 200000,
      tokens_per_week: null,
      tokens_per_month: 2000000,
      requests_per_minute: 30,
      requests_per_day: null,
      requests_per_week: null,
      tokens_per_test: 50000,
      scenarios_at_once: 2,
    });
    expect(calls.map((call) => call.tool)).toEqual(["ai_get_role"]);
  });
});
