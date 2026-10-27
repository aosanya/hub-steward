import { callTool } from "../wakala/mcp";
import {
  agentEditSpec,
  agentInstructions,
  agentLimits,
  agentRevisions,
  agentRows,
  agentStopped,
  restoreAgentRevision,
  saveAgentInstructions,
  saveAgentLimits,
  saveAgentModel,
} from "./agent";

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

const sent = (tool: string) => calls.find((call) => call.tool === tool)?.args;
const toolsCalled = () => calls.map((call) => call.tool);

const accounts = { items: [{ id: "c1", model_name: "llama-3.3" }, { id: "c2", model_name: "glm-5.3" }] };

describe("the agent edit page", () => {
  it("is registered with its tools and its two columns", () => {
    expect(agentEditSpec).toEqual({
      id: "agent-edit",
      title: "Agent",
      primary: "Save changes",
      tools: ["ai_get_role", "ai_list_accounts", "ai_map_role"],
      columns: [
        { key: "name", label: "Agent" },
        { key: "model", label: "Model" },
      ],
    });
  });

  it("shows the agent's name, its current model and every model it could use", async () => {
    answerWith({
      ai_get_role: { id: "a1", name: "Farmers' coordinator", account_id: "c2" },
      ai_list_accounts: accounts,
    });
    const { rows } = await agentRows("h", "a1");
    expect(rows).toHaveLength(1);
    expect(rows?.[0]).toEqual({
      id: "a1",
      name: "Farmers' coordinator",
      account_id: "c2",
      model: "glm-5.3",
      options: [
        { id: "c1", label: "llama-3.3", provider: "", baseUrl: "", modelName: "llama-3.3" },
        { id: "c2", label: "glm-5.3", provider: "", baseUrl: "", modelName: "glm-5.3" },
      ],
      primary: "Save changes",
    });
    expect(calls[0]).toEqual({ hubId: "h", tool: "ai_get_role", args: { roleID: "a1" } });
    expect(toolsCalled()).toEqual(["ai_get_role", "ai_list_accounts"]);
  });

  it("carries each model's provider and address so the choice can name the provider", async () => {
    answerWith({
      ai_get_role: { id: "a1", name: "x", account_id: "c1" },
      ai_list_accounts: { items: [{ id: "c1", provider: "anthropic", base_url: "https://api.anthropic.com", model_name: "claude-sonnet-5-5" }] },
    });
    const row = (await agentRows("h", "a1")).rows?.[0];
    expect(row?.options?.[0]).toEqual({
      id: "c1",
      label: "claude-sonnet-5-5",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      modelName: "claude-sonnet-5-5",
    });
  });

  it("reads a bare list of models as well as a wrapped one", async () => {
    answerWith({ ai_get_role: { name: "x", account_id: "c1" }, ai_list_accounts: accounts.items });
    expect((await agentRows("h", "a1")).rows?.[0].model).toBe("llama-3.3");
  });

  it("says the role cannot speak when it has no model", async () => {
    answerWith({ ai_get_role: { id: "a2", name: "New one", account_id: "" }, ai_list_accounts: accounts });
    const row = (await agentRows("h", "a2")).rows?.[0];
    expect(row?.model).toBe("No model: this role cannot speak");
    expect(row?.state).toBe("No model: this role cannot speak");
    expect(row?.options).toHaveLength(2);
  });

  it("says the role cannot speak when its model is not among the models", async () => {
    answerWith({ ai_get_role: { name: "x", account_id: "gone" }, ai_list_accounts: accounts });
    const row = (await agentRows("h", "a1")).rows?.[0];
    expect(row?.model).toBe("No model: this role cannot speak");
    expect(row?.account_id).toBe("gone");
  });

  it("refuses to show an agent without a role and calls nothing", async () => {
    answerWith({});
    await expect(agentRows("h", "")).rejects.toThrow("choose an agent to edit");
    expect(calls).toEqual([]);
  });

  it("fails when the models cannot be listed", async () => {
    answerWith({ ai_get_role: { name: "x" }, ai_list_accounts: {} });
    await expect(agentRows("h", "a1")).rejects.toThrow();
  });

  it("maps the role to the chosen model and keeps the agency role it belongs to", async () => {
    answerWith({ ai_get_role: { id: "a1", agency_role_id: "r1" }, ai_map_role: {} });
    await saveAgentModel("h", "a1", "c1");
    expect(sent("ai_map_role")).toEqual({ roleID: "a1", account_id: "c1", agency_role_id: "r1" });
  });

  it("surfaces the backend's refusal of a model plainly", async () => {
    answerWith({ ai_get_role: {}, ai_map_role: new Error("account belongs to another agency") });
    await expect(saveAgentModel("h", "a1", "c9")).rejects.toThrow("account belongs to another agency");
  });

  it("refuses an empty model choice without calling anything", async () => {
    answerWith({});
    await expect(saveAgentModel("h", "a1", "")).rejects.toThrow("choose a model");
    await expect(saveAgentModel("h", "", "c1")).rejects.toThrow("choose an agent to edit");
    expect(calls).toEqual([]);
  });
});

const heldRole = {
  id: "a1",
  name: "Dispatcher",
  description: "d",
  fine_tuning: "ft",
  use_agency_instructions: true,
  status: "enabled",
  agency_role_id: "r1",
  tokens_per_call: 500,
  tokens_per_day: 0,
  tokens_per_month: 0,
  requests_per_day: 40,
  requests_per_minute: 0,
  tokens_per_week: 900,
  requests_per_week: null,
  tokens_per_test: 40000,
  scenarios_at_once: 3,
};

const resolvedLimits = {
  account: {
    tokens_per_call: 1000,
    tokens_per_day: 50000,
    tokens_per_month: 0,
    requests_per_day: 100,
    requests_per_minute: 10,
    tokens_per_week: 2000,
    requests_per_week: null,
  },
  limits: [
    { limit: "weekly token", field: "tokens_per_week", max: 900, used: 70, source: "role" },
    { limit: "tokens per call", field: "tokens_per_call", max: 500, used: 0, source: "role" },
    { limit: "requests per day", field: "requests_per_day", max: 40, used: 12, source: "role" },
    { limit: "daily token", field: "tokens_per_day", max: 50000, used: 3000, source: "account" },
    { limit: "requests per minute", field: "requests_per_minute", max: 10, used: 1, source: "account" },
    { limit: "monthly token", field: "tokens_per_month", max: 0, used: 9, source: "none" },
  ],
};

const limitTools = () => ({
  ai_get_role: heldRole,
  ai_resolve_role: resolvedLimits,
  ai_update_role: {},
});

describe("the limits of an agent", () => {
  it("shows the role's limit, the model's ceiling, the limit in force and the use so far for all seven limits", async () => {
    answerWith(limitTools());
    const { rows } = await agentLimits("h", "a1");
    expect(rows).toHaveLength(7);
    expect(rows?.map((row) => row.key)).toEqual([
      "tokens_per_call",
      "tokens_per_day",
      "tokens_per_week",
      "tokens_per_month",
      "requests_per_minute",
      "requests_per_day",
      "requests_per_week",
    ]);
    const byKey = Object.fromEntries((rows ?? []).map((row) => [row.key, row]));
    expect(byKey.requests_per_day).toEqual({
      key: "requests_per_day",
      label: "Requests per day",
      role_limit: 40,
      ceiling: 100,
      in_force: 40,
      used: 12,
      source: "role",
    });
    expect(byKey.tokens_per_week).toMatchObject({ role_limit: 900, ceiling: 2000, in_force: 900, used: 70, source: "role" });
    expect(byKey.tokens_per_day).toMatchObject({ in_force: 50000, used: 3000, source: "account" });
    expect(byKey.tokens_per_month).toMatchObject({ in_force: 0, used: 9, source: "none" });
  });

  it("shows a limit the role leaves off as null", async () => {
    answerWith(limitTools());
    const weekly = (await agentLimits("h", "a1")).rows?.find((row) => row.key === "requests_per_week");
    expect(weekly?.role_limit).toBeNull();
    expect(weekly?.ceiling).toBeNull();
    expect(weekly).toMatchObject({ in_force: 0, used: 0, source: "none" });
  });

  it("shows a ceiling of zero when the model's limits are not known", async () => {
    answerWith({ ...limitTools(), ai_resolve_role: { account: null, limits: null } });
    const rows = (await agentLimits("h", "a1")).rows ?? [];
    expect(rows.every((row) => row.ceiling === 0 && row.in_force === 0 && row.used === 0 && row.source === "none")).toBe(true);
  });

  it("reads the role first and then what is in force, for the right role", async () => {
    answerWith(limitTools());
    await agentLimits("h", "a1");
    expect(calls).toEqual([
      { hubId: "h", tool: "ai_get_role", args: { roleID: "a1" } },
      { hubId: "h", tool: "ai_resolve_role", args: { roleID: "a1" } },
    ]);
  });

  it("refuses to show limits without a role", async () => {
    answerWith({});
    await expect(agentLimits("h", "")).rejects.toThrow("choose an agent to edit");
  });

  it("sends all nine limits, the form's seven as set and the two test limits as the role holds them, and keeps the rest of the role", async () => {
    answerWith(limitTools());
    await saveAgentLimits("h", "a1", {
      tokens_per_call: 300,
      requests_per_day: 0,
      requests_per_minute: 5,
      tokens_per_week: 7000,
      requests_per_week: null,
    });
    const update = sent("ai_update_role");
    expect(update).toEqual({
      roleID: "a1",
      name: "Dispatcher",
      description: "d",
      fine_tuning: "ft",
      use_agency_instructions: true,
      status: "enabled",
      tokens_per_call: 300,
      tokens_per_day: null,
      tokens_per_month: null,
      requests_per_day: 0,
      requests_per_minute: 5,
      tokens_per_week: 7000,
      requests_per_week: null,
      tokens_per_test: 40000,
      scenarios_at_once: 3,
    });
    expect(Object.keys(update ?? {})).toContain("requests_per_week");
  });

  it("sends the two test limits as null when the role holds none", async () => {
    answerWith({ ...limitTools(), ai_get_role: { id: "a1", name: "Dispatcher", status: "enabled" } });
    await saveAgentLimits("h", "a1", { tokens_per_day: 1 });
    const update = sent("ai_update_role");
    expect(update).toHaveProperty("tokens_per_test", null);
    expect(update).toHaveProperty("scenarios_at_once", null);
  });

  it("keeps a test limit of zero as zero", async () => {
    answerWith({ ...limitTools(), ai_get_role: { ...heldRole, tokens_per_test: 0, scenarios_at_once: 0 } });
    await saveAgentLimits("h", "a1", { tokens_per_day: 1 });
    expect(sent("ai_update_role")).toMatchObject({ tokens_per_test: 0, scenarios_at_once: 0 });
  });

  it("refuses a limit below zero without calling anything", async () => {
    for (const key of ["tokens_per_day", "tokens_per_week", "requests_per_week"]) {
      answerWith(limitTools());
      await expect(saveAgentLimits("h", "a1", { [key]: -1 })).rejects.toThrow("a limit cannot be below zero");
      expect(calls).toEqual([]);
    }
  });

  it("refuses a limit that is not a whole number without calling anything", async () => {
    answerWith(limitTools());
    await expect(saveAgentLimits("h", "a1", { tokens_per_day: 1.5 })).rejects.toThrow("that was not understood");
    await expect(saveAgentLimits("h", "a1", { tokens_per_day: Number.NaN })).rejects.toThrow("that was not understood");
    expect(calls).toEqual([]);
  });

  it("refuses to save limits without a role", async () => {
    answerWith({});
    await expect(saveAgentLimits("h", "", { tokens_per_day: 1 })).rejects.toThrow("choose an agent to edit");
    expect(calls).toEqual([]);
  });

  it("saves one limit and turns every other off", async () => {
    answerWith(limitTools());
    await saveAgentLimits("h", "a1", { tokens_per_day: 7 });
    expect(sent("ai_update_role")).toMatchObject({ tokens_per_day: 7, tokens_per_call: null, requests_per_week: null });
  });

  it("saves a weekly request limit and turns the weekly token limit off", async () => {
    answerWith(limitTools());
    await saveAgentLimits("h", "a1", { requests_per_week: 3, tokens_per_week: null });
    const update = sent("ai_update_role");
    expect(update?.requests_per_week).toBe(3);
    expect(update?.tokens_per_week).toBeNull();
    expect(update?.tokens_per_day).toBeNull();
  });

  it("surfaces the backend's refusal of a limit", async () => {
    answerWith({ ...limitTools(), ai_update_role: new Error("ai_update_role: over the ceiling") });
    await expect(saveAgentLimits("h", "a1", { tokens_per_day: 9 })).rejects.toThrow("over the ceiling");
  });
});

const instructionTools = () => ({
  ai_get_role: {
    id: "a1",
    name: "Dispatcher",
    description: "d",
    fine_tuning: "Be brief.",
    use_agency_instructions: true,
    status: "enabled",
    tokens_per_call: 500,
    tokens_per_day: 0,
    tokens_per_month: 0,
    requests_per_day: 40,
    requests_per_minute: 0,
    tokens_per_week: 900,
    requests_per_week: null,
    tokens_per_test: 40000,
    scenarios_at_once: 3,
  },
  ai_resolve_role: {
    parts: [
      { source: "agency", text: "Serve the farmers." },
      { source: "fine_tuning", text: "Be brief." },
    ],
  },
  ai_update_role: {},
  ai_list_role_revisions: {
    items: [
      { id: "v2", fine_tuning: "Be brief.", use_agency_instructions: true, saved_by: "Amina Test", saved_at: "2026-10-27T10:00:00Z" },
      { id: "v1", fine_tuning: "", use_agency_instructions: false, saved_by: "Joy Test", saved_at: "2026-10-26T10:00:00Z" },
    ],
  },
  ai_restore_role_revision: {},
});

describe("the instructions of an agent", () => {
  it("gives the parts, the fine-tuning and the agency switch", async () => {
    answerWith(instructionTools());
    const got = await agentInstructions("h", "a1");
    expect(got.parts).toHaveLength(2);
    expect(got.parts?.[0].source).toBe("agency");
    expect(got.fine_tuning).toBe("Be brief.");
    expect(got.use_agency_instructions).toBe(true);
  });

  it("gives an empty list of parts, no fine-tuning and the switch off when the role holds none of them", async () => {
    answerWith({ ai_get_role: {}, ai_resolve_role: { parts: null } });
    expect(await agentInstructions("h", "a1")).toEqual({ parts: [], fine_tuning: "", use_agency_instructions: false });
  });

  it("refuses to show instructions without a role", async () => {
    answerWith({});
    await expect(agentInstructions("h", "")).rejects.toThrow("choose an agent to edit");
  });

  it("sends the text and the switch and keeps the rest of the role, including a limit that is off", async () => {
    answerWith(instructionTools());
    await saveAgentInstructions("h", "a1", { fine_tuning: "Greet first.", use_agency_instructions: false });
    const update = sent("ai_update_role");
    expect(update).toMatchObject({ roleID: "a1", fine_tuning: "Greet first.", use_agency_instructions: false });
    expect(update).toMatchObject({
      name: "Dispatcher",
      description: "d",
      status: "enabled",
      requests_per_day: 40,
      tokens_per_call: 500,
      tokens_per_week: 900,
    });
    expect(update).toHaveProperty("requests_per_week", null);
  });

  it("sends all nine limits as the role holds them, the two test limits among them", async () => {
    answerWith(instructionTools());
    await saveAgentInstructions("h", "a1", { fine_tuning: "Greet first.", use_agency_instructions: false });
    expect(sent("ai_update_role")).toEqual({
      roleID: "a1",
      name: "Dispatcher",
      description: "d",
      status: "enabled",
      tokens_per_call: 500,
      tokens_per_day: 0,
      tokens_per_month: 0,
      requests_per_day: 40,
      requests_per_minute: 0,
      tokens_per_week: 900,
      requests_per_week: null,
      tokens_per_test: 40000,
      scenarios_at_once: 3,
      fine_tuning: "Greet first.",
      use_agency_instructions: false,
    });
  });

  it("sends the two test limits as null when the role holds none", async () => {
    answerWith({ ...instructionTools(), ai_get_role: { id: "a1", name: "Dispatcher", status: "enabled" } });
    await saveAgentInstructions("h", "a1", { fine_tuning: "Greet first.", use_agency_instructions: true });
    const update = sent("ai_update_role");
    expect(update).toHaveProperty("tokens_per_test", null);
    expect(update).toHaveProperty("scenarios_at_once", null);
  });

  it("refuses to save instructions without a role", async () => {
    answerWith({});
    await expect(saveAgentInstructions("h", "", { fine_tuning: "", use_agency_instructions: true })).rejects.toThrow(
      "choose an agent to edit",
    );
  });

  it("lists the earlier versions newest first", async () => {
    answerWith(instructionTools());
    const { rows } = await agentRevisions("h", "a1");
    expect(rows).toHaveLength(2);
    expect(rows?.[0].id).toBe("v2");
    expect((rows?.[1] as Record<string, unknown>).saved_by).toBe("Joy Test");
    expect(sent("ai_list_role_revisions")).toEqual({ roleID: "a1" });
  });

  it("lists the earlier versions from a bare list, and none from an answer without items", async () => {
    answerWith({ ai_list_role_revisions: [{ id: "v9" }] });
    expect((await agentRevisions("h", "a1")).rows).toEqual([{ id: "v9" }]);
    answerWith({ ai_list_role_revisions: {} });
    expect((await agentRevisions("h", "a1")).rows).toEqual([]);
  });

  it("refuses to list earlier versions without a role", async () => {
    answerWith({});
    await expect(agentRevisions("h", "")).rejects.toThrow("choose an agent to edit");
  });

  it("restores the chosen version of the chosen role", async () => {
    answerWith(instructionTools());
    await restoreAgentRevision("h", "a1", "v1");
    expect(sent("ai_restore_role_revision")).toEqual({ roleID: "a1", revisionID: "v1" });
  });

  it("refuses to restore without a version or without a role", async () => {
    answerWith(instructionTools());
    await expect(restoreAgentRevision("h", "a1", "")).rejects.toThrow("a revision is needed");
    await expect(restoreAgentRevision("h", "", "v1")).rejects.toThrow("choose an agent to edit");
    expect(calls).toEqual([]);
  });
});

const dispatcherTools = (resolved: unknown, extra: Record<string, Reply> = {}) => ({
  ai_get_role: { id: "a1", name: "Dispatcher", updated_at: "2026-10-20T09:00:00Z" },
  ai_resolve_role: resolved,
  comm_chat_message_list: {
    items: [{ body: "hello" }, { body: "the role's requests per day limit is reached" }, { body: "thanks" }],
  },
  ...extra,
});

const roleReached = {
  limits: [
    { limit: "requests per day", field: "requests_per_day", max: 40, used: 40, source: "role" },
    { limit: "daily token", field: "tokens_per_day", max: 50000, used: 3, source: "account" },
  ],
};

const modelReached = {
  limits: [
    { limit: "requests per day", field: "requests_per_day", max: 40, used: 1, source: "role" },
    { limit: "daily token", field: "tokens_per_day", max: 50000, used: 50000, source: "account" },
  ],
};

describe("why an agent stopped", () => {
  it("names the role's limit, where it is set and the message posted, when the role sets the limit", async () => {
    answerWith(dispatcherTools(roleReached));
    const got = await agentStopped("h", "a1", "room1", "t1");
    expect(got).toEqual({
      stopped: "Dispatcher stopped because the role's Requests per day limit is reached.",
      limit: "Requests per day: 40 (40 used)",
      set_on: "2026-10-20T09:00:00Z",
      posted: "the role's requests per day limit is reached",
    });
    expect(sent("comm_chat_message_list")).toEqual({ structure_id: "room1", thread_id: "t1" });
  });

  it("names the model's limit when the account sets it, with nothing set on the role", async () => {
    answerWith(dispatcherTools(modelReached));
    const got = await agentStopped("h", "a1");
    expect(got.stopped).toContain("the model's Tokens per day limit");
    expect(got.limit).toBe("Tokens per day: 50000 (50000 used)");
    expect(got.set_on).toBe("");
    expect(got.posted).toBe("");
    expect(toolsCalled()).not.toContain("comm_chat_message_list");
  });

  it("looks for the AI limit thread in the hub's rooms when no room and thread are given", async () => {
    answerWith(
      dispatcherTools(roleReached, {
        actor_list_groups: { items: [{ id: "room-a" }, { id: "room-b" }] },
        comm_chat_thread_list: (args: Args) =>
          args.structure_id === "room-a"
            ? { items: [{ id: "t-chat", label: "Chat" }] }
            : { items: [{ id: "t-limit", label: "AI limit" }] },
        comm_chat_message_list: { items: [{ body: "the role's requests per day limit is reached" }] },
      }),
    );
    const got = await agentStopped("h", "a1");
    expect(got.posted).toBe("the role's requests per day limit is reached");
    expect(calls.filter((call) => call.tool === "comm_chat_message_list").map((call) => call.args)).toEqual([
      { structure_id: "room-b", thread_id: "t-limit" },
    ]);
  });

  it("takes the newest limit line across every room's AI limit thread", async () => {
    answerWith(
      dispatcherTools(roleReached, {
        actor_list_groups: { items: [{ id: "room-a" }, { id: "room-b" }] },
        comm_chat_thread_list: (args: Args) => ({ items: [{ id: "t-" + args.structure_id, label: "AI limit" }] }),
        comm_chat_message_list: (args: Args) => ({
          items: [
            args.structure_id === "room-a"
              ? { body: "newer: limit is reached", created_at: "2026-10-29T09:12:00Z" }
              : { body: "older: limit is reached", created_at: "2026-10-28T09:12:00Z" },
          ],
        }),
      }),
    );
    expect((await agentStopped("h", "a1")).posted).toBe("newer: limit is reached");
  });

  it("leaves the posted line empty, and still explains the stop, when the rooms cannot be read", async () => {
    answerWith(dispatcherTools(roleReached, { actor_list_groups: new Error("actor_list_groups: down") }));
    const got = await agentStopped("h", "a1");
    expect(got.limit).toBe("Requests per day: 40 (40 used)");
    expect(got.posted).toBe("");
  });

  it("does not search the rooms when the room and thread are given", async () => {
    answerWith(dispatcherTools(roleReached));
    await agentStopped("h", "a1", "room1", "t1");
    expect(toolsCalled()).not.toContain("actor_list_groups");
  });

  it("says nothing stopped when no limit is reached, and asks the room nothing", async () => {
    answerWith(dispatcherTools({ limits: [{ limit: "requests per day", field: "requests_per_day", max: 40, used: 1, source: "role" }] }));
    const got = await agentStopped("h", "a1", "room1", "t1");
    expect(got).toEqual({ stopped: "Dispatcher has not stopped on a limit.", limit: "", set_on: "", posted: "" });
    expect(toolsCalled()).not.toContain("comm_chat_message_list");
  });

  it("ignores a limit of zero, which means none", async () => {
    answerWith(dispatcherTools({ limits: [{ limit: "daily token", field: "tokens_per_day", max: 0, used: 9, source: "none" }] }));
    expect((await agentStopped("h", "a1")).limit).toBe("");
  });

  it("names the first limit reached and no other", async () => {
    answerWith(
      dispatcherTools({
        limits: [
          { limit: "weekly token", field: "tokens_per_week", max: 10, used: 10, source: "account" },
          { limit: "requests per day", field: "requests_per_day", max: 40, used: 40, source: "role" },
        ],
      }),
    );
    const got = await agentStopped("h", "a1");
    expect(got.limit).toBe("Tokens per week: 10 (10 used)");
    expect(got.set_on).toBe("");
  });

  it("leaves the posted message empty when no message in the thread says a limit is reached", async () => {
    answerWith(dispatcherTools(roleReached, { comm_chat_message_list: { items: [{ body: "hello" }] } }));
    expect((await agentStopped("h", "a1", "room1", "t1")).posted).toBe("");
  });

  it("takes the latest message that says a limit is reached", async () => {
    answerWith(
      dispatcherTools(roleReached, {
        comm_chat_message_list: { items: [{ body: "old: limit is reached" }, { body: "new: limit is reached" }, { body: "ok" }] },
      }),
    );
    expect((await agentStopped("h", "a1", "room1", "t1")).posted).toBe("new: limit is reached");
  });

  it("fails when the room cannot be read", async () => {
    answerWith(dispatcherTools(roleReached, { comm_chat_message_list: new Error("comm_chat_message_list: no room") }));
    await expect(agentStopped("h", "a1", "room1", "t1")).rejects.toThrow("no room");
  });

  it("names a backend limit it does not know as it came", async () => {
    answerWith(dispatcherTools({ limits: [{ limit: "burst", max: 5, used: 5, source: "role" }] }));
    expect((await agentStopped("h", "a1")).limit).toBe("burst: 5 (5 used)");
  });

  it("refuses to explain without a role", async () => {
    answerWith({});
    await expect(agentStopped("h", "")).rejects.toThrow("choose an agent to edit");
  });
});
