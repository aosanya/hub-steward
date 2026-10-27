import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { listAccounts, type Account } from "../accounts";
import { pageModule } from "../registry";
import { agentsPage, createAgentForSeat, hubModel, roleItems } from "./agents";

vi.mock("../../wakala/mcp");
vi.mock("../accounts");

const anAccount = (over: Partial<Account> = {}): Account => ({
  id: "c1",
  name: "Claude",
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  modelName: "claude-sonnet-5-5",
  status: "enabled",
  keySet: true,
  lastTestResult: "",
  lastTestedAt: "",
  lastTestPrompt: "",
  lastTestReply: "",
  lastTestMs: null,
  chatEnabled: false,
  chatLabel: "",
  ...over,
});

const huggingFace = (over: Partial<Account> = {}) =>
  anAccount({
    id: "c2",
    name: "Hugging Face",
    provider: "openai_compatible",
    baseUrl: "https://router.huggingface.co/v1",
    modelName: "zai-org/GLM-5.3:novita",
    ...over,
  });

const keyIs = (keySet: boolean) => vi.mocked(listAccounts).mockResolvedValue([anAccount({ keySet })]);

const toolsCalled = () => vi.mocked(callTool).mock.calls.map((call) => call[1]);

const agentRows = () => agentsPage.rows("h", {});

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(listAccounts).mockReset();
  keyIs(true);
  vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
    if (tool === "ai_list_roles") {
      return {
        items: [
          { id: "a1", name: "Matcher", description: "Matches riders", account_id: "c1", agency_role_id: "r1" },
          { id: "a2", name: "New one", account_id: "", agency_role_id: "" },
        ],
      } as never;
    }
    if (tool === "ai_list_accounts") return { items: [{ id: "c1", model_name: "llama-3.3" }] } as never;
    if (tool === "agency_list_roles") return { items: [{ id: "r1", name: "Coordinator" }] } as never;
    return [] as never;
  });
});

describe("the agents page", () => {
  it("is registered with four columns, no key column, no primary button and no add action", () => {
    expect(pageModule("agents")).toBe(agentsPage);
    expect(agentsPage.spec.id).toBe("agents");
    expect(agentsPage.spec.title).toBe("Agents");
    expect(agentsPage.spec.primary).toBe("");
    expect(agentsPage.spec.tools[0]).toBe("ai_create_role");
    expect(agentsPage.spec.columns.map((column) => column.key)).toEqual(["name", "works_for", "model", "state"]);
    expect(agentsPage.spec.columns.map((column) => column.label)).toEqual(["Agent", "Works for", "Model", "State"]);
    expect(agentsPage.actions).toBeUndefined();
  });

  it("lists an agent as Running with the role it works for and its model when the hub has a key and the agent has a model", async () => {
    const rows = await agentRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "a1",
      name: "Matcher",
      description: "Matches riders",
      works_for: "Coordinator",
      model: "llama-3.3",
      state: "Running",
    });
  });

  it("lists an agent as Skipped with a link to the models when the hub has no key", async () => {
    keyIs(false);
    const rows = await agentRows();
    expect(rows[0]).toMatchObject({ model: "llama-3.3", state: "Skipped", link: "models" });
    expect(rows[0].action).toBeUndefined();
  });

  it("lists a new agent as Cannot speak, asking for a model, and not assigned to a role", async () => {
    const rows = await agentRows();
    expect(rows[1]).toMatchObject({ state: "Cannot speak", model: "Choose a model", action: "Choose a model", works_for: "Not assigned" });
    expect(rows[1].link).toBeUndefined();
  });

  it("lists a new agent as Cannot speak whether or not the hub has a key", async () => {
    keyIs(false);
    expect((await agentRows())[1]).toMatchObject({ state: "Cannot speak", model: "Choose a model" });
  });

  it("lists an agent that is switched off as Stopped and keeps its model", async () => {
    const base = vi.mocked(callTool).getMockImplementation()!;
    vi.mocked(callTool).mockImplementation(async (hubId, tool, args) => {
      if (tool === "ai_list_roles") {
        return { items: [{ id: "a1", name: "Matcher", account_id: "c1", agency_role_id: "r1", status: "disabled" }] } as never;
      }
      return base(hubId, tool, args);
    });
    const rows = await agentRows();
    expect(rows[0]).toMatchObject({ model: "llama-3.3", state: "Stopped" });
    expect(rows[0].link).toBeUndefined();
  });

  it("lists a switched-off agent as Stopped even when the hub has no key", async () => {
    keyIs(false);
    const base = vi.mocked(callTool).getMockImplementation()!;
    vi.mocked(callTool).mockImplementation(async (hubId, tool, args) => {
      if (tool === "ai_list_roles") {
        return { items: [{ id: "a1", name: "Matcher", account_id: "c1", agency_role_id: "r1", status: "disabled" }] } as never;
      }
      return base(hubId, tool, args);
    });
    expect((await agentRows())[0]).toMatchObject({ state: "Stopped" });
  });

  describe("an agent without a model", () => {
    const withWatcher = (agencyRole: Record<string, unknown>) => {
      const base = vi.mocked(callTool).getMockImplementation()!;
      vi.mocked(callTool).mockImplementation(async (hubId, tool, args) => {
        if (tool === "ai_list_roles") {
          return { items: [{ id: "a3", name: "Network Watcher", account_id: "", agency_role_id: "r9", status: "enabled" }] } as never;
        }
        if (tool === "agency_list_roles") return { items: [{ id: "r9", name: "The manager", ...agencyRole }] } as never;
        return base(hubId, tool, args);
      });
    };

    it("is Running with no model when the agency role it works for does not use AI", async () => {
      withWatcher({ permissions: ["form.send"] });
      const rows = await agentRows();
      expect(rows[0]).toMatchObject({ name: "Network Watcher", model: "", state: "Running" });
      expect(rows[0].action).toBeUndefined();
      expect(rows[0].link).toBeUndefined();
    });

    it("is Running with no model whether or not the hub has a key", async () => {
      withWatcher({ permissions: [] });
      keyIs(false);
      expect((await agentRows())[0]).toMatchObject({ model: "", state: "Running" });
    });

    it("cannot speak when the agency role it works for uses AI by permission", async () => {
      withWatcher({ permissions: ["ai.use"] });
      expect((await agentRows())[0]).toMatchObject({ model: "Choose a model", state: "Cannot speak", action: "Choose a model" });
    });

    it("cannot speak when the agency role it works for is of the AI kind", async () => {
      withWatcher({ kind: "ai" });
      expect((await agentRows())[0]).toMatchObject({ state: "Cannot speak" });
    });

    it("cannot speak when it works for no agency role that can be found", async () => {
      const base = vi.mocked(callTool).getMockImplementation()!;
      vi.mocked(callTool).mockImplementation(async (hubId, tool, args) => {
        if (tool === "ai_list_roles") return { items: [{ id: "a3", name: "Loose", account_id: "", agency_role_id: "gone" }] } as never;
        return base(hubId, tool, args);
      });
      expect((await agentRows())[0]).toMatchObject({ state: "Cannot speak" });
    });
  });

  it("gives every agent row its id and the link to edit the agent", async () => {
    const rows = await agentRows();
    for (const row of rows) {
      expect(row.edit).toBe("agent-edit");
      expect(row.id).toBeTruthy();
    }
  });

  it("reads the agents, the accounts, the open drafts and the agency roles in that order, with the key from the hub's accounts", async () => {
    await agentRows();
    expect(toolsCalled()).toEqual(["ai_list_roles", "ai_list_accounts", "agency_list_drafts", "agency_list_roles"]);
    expect(vi.mocked(listAccounts).mock.calls).toEqual([["h"]]);
  });

  it("names the role an agent works for from the newest open draft", async () => {
    const base = vi.mocked(callTool).getMockImplementation()!;
    vi.mocked(callTool).mockImplementation(async (hubId, tool, args) => {
      if (tool === "agency_list_drafts") return { items: [{ id: "d1", status: "open" }, { id: "d2", status: "open" }] } as never;
      if (tool === "agency_list_roles") return (args?.draft_id === "d2" ? { items: [{ id: "r1", name: "Dispatcher" }] } : { items: [] }) as never;
      return base(hubId, tool, args);
    });
    expect((await agentRows())[0]).toMatchObject({ works_for: "Dispatcher" });
    const roleCalls = vi.mocked(callTool).mock.calls.filter((call) => call[1] === "agency_list_roles");
    expect(roleCalls.map((call) => call[2])).toEqual([{ draft_id: "d2" }]);
  });

  it("reads the published agency roles, sending no draft id, when no draft is open", async () => {
    await agentRows();
    const roleCalls = vi.mocked(callTool).mock.calls.filter((call) => call[1] === "agency_list_roles");
    expect(roleCalls.map((call) => call[2])).toEqual([{}]);
  });

  it("fails when every one of its tools fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("boom"));
    await expect(agentRows()).rejects.toThrow("boom");
  });

  it("lists nothing when the hub has no agents", async () => {
    vi.mocked(callTool).mockResolvedValue({ items: [] } as never);
    expect(await agentRows()).toEqual([]);
  });
});

describe("the agents page when the AI tools do not answer", () => {
  const agencyRoles = {
    items: [
      { id: "r1", name: "Coordinator", kind: "human", description: "Looks after the group" },
      { id: "r2", name: "Matching agent", kind: "ai", description: "Matches riders to requests" },
      { id: "r3", name: "Night desk", permissions: ["ai.use", "form.send"], description: "" },
      { id: "r4", name: "Treasurer", permissions: ["form.send"] },
    ],
  };

  const aiToolsRefuse = (refused: string[]) =>
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (refused.includes(tool)) throw new Error(`unknown tool "${tool}"`);
      if (tool === "agency_list_roles") return agencyRoles as never;
      return { items: [] } as never;
    });

  it("lists the agency's AI roles with the state No model when the AI roles cannot be read", async () => {
    aiToolsRefuse(["ai_list_roles", "ai_list_accounts"]);
    const rows = await agentRows();
    expect(rows.map((row) => row.name)).toEqual(["Matching agent", "Night desk"]);
    expect(rows[0]).toMatchObject({
      id: "r2",
      works_for: "Matches riders to requests",
      model: "Choose a model",
      state: "No model",
    });
  });

  it("recognises an AI role by its kind or by the permission to use AI, and leaves the human roles out", async () => {
    aiToolsRefuse(["ai_list_roles"]);
    const names = (await agentRows()).map((row) => row.name);
    expect(names).toContain("Matching agent");
    expect(names).toContain("Night desk");
    expect(names).not.toContain("Coordinator");
    expect(names).not.toContain("Treasurer");
  });

  it("gives these rows no link to edit, because there is no AI role to edit yet", async () => {
    aiToolsRefuse(["ai_list_roles"]);
    for (const row of await agentRows()) {
      expect(row.edit).toBeUndefined();
      expect(row.action).toBeUndefined();
      expect(row.link).toBeUndefined();
    }
  });

  it("also lists them when the models cannot be read but the AI roles can", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (tool === "ai_list_accounts") throw new Error("down");
      if (tool === "ai_list_roles") return { items: [{ id: "a1", name: "Matcher" }] } as never;
      return agencyRoles as never;
    });
    expect((await agentRows()).map((row) => row.state)).toEqual(["No model", "No model"]);
  });

  it("asks the agency's roles only after the AI tools failed", async () => {
    aiToolsRefuse(["ai_list_roles"]);
    await agentRows();
    expect(toolsCalled()).toEqual(["ai_list_roles", "agency_list_drafts", "agency_list_roles"]);
  });

  it("lists nothing when the agency has no AI role either", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (tool === "ai_list_roles") throw new Error("unknown tool");
      return { items: [{ id: "r1", name: "Coordinator" }] } as never;
    });
    expect(await agentRows()).toEqual([]);
  });

  it("fails with the AI tool's own error when the agency's roles cannot be read either", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      throw new Error(`${tool} refused`);
    });
    await expect(agentRows()).rejects.toThrow("ai_list_roles refused");
  });
});

describe("the model key of a hub", () => {
  it("is read from the hub's AI accounts by hub id", async () => {
    expect(await hubModel("h")).toEqual({ keySet: true, provider: "claude" });
    expect(vi.mocked(listAccounts).mock.calls).toEqual([["h"]]);
    keyIs(false);
    expect((await hubModel("h")).keySet).toBe(false);
  });

  it("is set when any one account holds a key, even a disabled one", async () => {
    vi.mocked(listAccounts).mockResolvedValue([huggingFace({ keySet: false }), anAccount({ status: "disabled" })]);
    expect((await hubModel("h")).keySet).toBe(true);
  });

  it("names the provider of the first enabled account that holds a key", async () => {
    vi.mocked(listAccounts).mockResolvedValue([
      huggingFace({ id: "c3", keySet: false }),
      anAccount({ id: "c4", status: "disabled" }),
      huggingFace({ id: "c5" }),
      anAccount({ id: "c6" }),
    ]);
    expect(await hubModel("h")).toEqual({ keySet: true, provider: "huggingface" });
  });

  it("names the provider of the first account when no enabled account holds a key", async () => {
    vi.mocked(listAccounts).mockResolvedValue([anAccount({ keySet: false }), huggingFace({ keySet: false })]);
    expect(await hubModel("h")).toEqual({ keySet: false, provider: "claude" });
    vi.mocked(listAccounts).mockResolvedValue([anAccount({ status: "disabled" }), huggingFace({ keySet: false })]);
    expect(await hubModel("h")).toEqual({ keySet: true, provider: "claude" });
  });

  it("names the catalog provider each kind of account maps to", async () => {
    const providerOf = async (account: Account) => {
      vi.mocked(listAccounts).mockResolvedValue([account]);
      return (await hubModel("h")).provider;
    };
    expect(await providerOf(huggingFace())).toBe("huggingface");
    expect(await providerOf(anAccount({ provider: "openai_compatible", baseUrl: "https://api.meta.ai/v1", modelName: "muse-spark-1.3" }))).toBe("meta");
    expect(await providerOf(anAccount({ provider: "openai_compatible", baseUrl: "https://llm.example.org/v1", modelName: "muse-spark-open" }))).toBe("meta_open");
    expect(await providerOf(anAccount({ provider: "openai_compatible", baseUrl: "https://llm.example.org/v1", modelName: "my-org/llama-4-open" }))).toBe("custom");
  });

  it("reads as not set, with Hugging Face, when the hub has no account", async () => {
    vi.mocked(listAccounts).mockResolvedValue([]);
    expect(await hubModel("h")).toEqual({ keySet: false, provider: "huggingface" });
  });

  it("reads as not set, with Hugging Face, when the accounts cannot be read", async () => {
    vi.mocked(listAccounts).mockRejectedValue(new Error("wakala answered 500: down"));
    expect(await hubModel("h")).toEqual({ keySet: false, provider: "huggingface" });
  });
});

describe("a tool's list answer", () => {
  it("is read from items, from a bare list, and with empty places for null entries", () => {
    expect(roleItems({ items: [{ id: "1" }] })).toEqual([{ id: "1" }]);
    expect(roleItems([{ id: "2" }])).toEqual([{ id: "2" }]);
    expect(roleItems({ items: [null] })).toEqual([{}]);
    expect(roleItems({ items: [] })).toEqual([]);
  });

  it("is refused when it is neither a list nor an object holding items, nor a list of objects", () => {
    expect(() => roleItems({})).toThrow();
    expect(() => roleItems({ items: null })).toThrow();
    expect(() => roleItems("nothing")).toThrow();
    expect(() => roleItems({ items: [1] })).toThrow();
  });
});

describe("the agents page for the agency's agent roles", () => {
  const withSeats = (seats: unknown[], agents: unknown[]) =>
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (tool === "ai_list_roles") return { items: agents } as never;
      if (tool === "ai_list_accounts") return { items: [] } as never;
      if (tool === "agency_list_roles") return { items: seats } as never;
      return [] as never;
    });

  const farmersSeats = [
    { id: "s1", name: "Farmer" },
    { id: "s2", name: "Farmers' agent", description: "Answers farmers", permissions: ["ai.use"] },
    { id: "s3", name: "Suppliers' agent", description: "Answers suppliers", kind: "agentic" },
  ];

  it("lists every agent role as an agent to configure when none has been made yet, and leaves the human roles out", async () => {
    withSeats(farmersSeats, []);
    const rows = await agentRows();
    expect(rows.map((row) => row.name)).toEqual(["Farmers' agent", "Suppliers' agent"]);
    expect(rows[0]).toMatchObject({ seat_id: "s2", works_for: "Farmers' agent", state: "Cannot speak" });
    expect(rows[0].edit).toBeUndefined();
  });

  it("lists a role once, as its agent, when an agent already works for it", async () => {
    withSeats(farmersSeats, [{ id: "a9", name: "Farmers' agent", account_id: "", agency_role_id: "s2" }]);
    const rows = await agentRows();
    expect(rows.map((row) => row.name)).toEqual(["Farmers' agent", "Suppliers' agent"]);
    expect(rows[0]).toMatchObject({ id: "a9", edit: "agent-edit" });
    expect(rows[1]).toMatchObject({ seat_id: "s3" });
  });

  it("makes the agent of a role named after it, enabled, and maps it to the role", async () => {
    vi.mocked(callTool).mockReset();
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => (tool === "ai_create_role" ? ({ id: "a7" } as never) : ({} as never)));
    expect(await createAgentForSeat("h", "s2", "Farmers' agent", "Answers farmers")).toBe("a7");
    expect(vi.mocked(callTool).mock.calls).toEqual([
      ["h", "ai_create_role", { name: "Farmers' agent", description: "Answers farmers", status: "enabled" }],
      ["h", "ai_map_role", { roleID: "a7", account_id: "", agency_role_id: "s2" }],
    ]);
  });
});
