import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { listAccounts, type Account } from "../accounts";
import { pageModule } from "../registry";
import { modelCheck, statusChecks, statusPage } from "./status";

vi.mock("../../wakala/mcp");
vi.mock("../accounts");

type Tools = { agency: unknown; joinMode: unknown; roles: unknown; drafts: unknown; draftRoles: unknown; failOn?: string };

const tools: Tools = { agency: {}, joinMode: {}, roles: {}, drafts: {}, draftRoles: {} };

const farmersRoles = {
  items: [
    { id: "r1", name: "Group coordinator" },
    { id: "r2", name: "Farmer" },
    { id: "r5", name: "Farmers' coordinator", permissions: ["ai.use"] },
  ],
};

const freshTools = () => {
  tools.agency = { name: "Siaya Farmers' Group" };
  tools.joinMode = { instance_id: "h1", join_mode: "open" };
  tools.roles = farmersRoles;
  tools.drafts = { items: [] };
  tools.draftRoles = { items: [] };
  tools.failOn = undefined;
};

const anAccount = (over: Partial<Account> = {}): Account => ({
  id: "c1",
  name: "Hugging Face",
  provider: "openai_compatible",
  baseUrl: "https://router.huggingface.co/v1",
  modelName: "zai-org/GLM-5.3:novita",
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

const accountsOfProvider = new Map<string, Partial<Account>>([
  ["claude", { provider: "anthropic", baseUrl: "https://api.anthropic.com", modelName: "claude-sonnet-5-5" }],
  ["meta", { baseUrl: "https://api.meta.ai/v1", modelName: "muse-spark-1.3" }],
  ["custom", { baseUrl: "https://llm.example.org/v1", modelName: "my-org/llama-4-open" }],
]);

const accountsOfHub = new Map<string, Account[]>();

const keyIs = (keySet: boolean, provider = "") => {
  accountsOfHub.set("h1", [anAccount({ ...accountsOfProvider.get(provider), keySet })]);
  accountsOfHub.set("other", [anAccount({ ...accountsOfProvider.get("claude"), keySet: !keySet })]);
};

const toolsCalled = () => vi.mocked(callTool).mock.calls.map((call) => call[1]);

const statusRows = () => statusPage.rows("h1", {});

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(listAccounts).mockReset();
  vi.mocked(listAccounts).mockImplementation(async (hubId) => accountsOfHub.get(hubId) ?? []);
  accountsOfHub.clear();
  freshTools();
  keyIs(false);
  vi.mocked(callTool).mockImplementation(async (_hubId, tool, args) => {
    if (tool === tools.failOn) throw new Error("boom");
    if (tool === "agency_get_agency") return tools.agency as never;
    if (tool === "instance_get_join_mode") return tools.joinMode as never;
    if (tool === "agency_list_roles") return (args?.draft_id ? tools.draftRoles : tools.roles) as never;
    if (tool === "agency_list_drafts") return tools.drafts as never;
    return {} as never;
  });
});

describe("the status page", () => {
  it("is registered with Add a model as its primary and four columns and no actions of its own", () => {
    expect(pageModule("status")).toBe(statusPage);
    expect(statusPage.spec.id).toBe("status");
    expect(statusPage.spec.title).toBe("Status");
    expect(statusPage.spec.primary).toBe("Add a model");
    expect(statusPage.spec.tools).toEqual(["agency_get_agency", "instance_get_join_mode", "agency_list_roles", "agency_list_drafts"]);
    expect(statusPage.spec.columns.map((column) => column.key)).toEqual(["check", "detail", "done", "progress"]);
    expect(statusPage.spec.columns.map((column) => column.label)).toEqual(["Check", "Detail", "Done", "Progress"]);
    expect(statusPage.actions).toBeUndefined();
  });

  it("shows three of four ready with the model key marked as needed to reply while no key is set", async () => {
    const rows = await statusRows();
    expect(rows).toHaveLength(4);
    expect(rows[3]).toMatchObject({ check: "Model key", detail: "Needed to reply", done: false, target: "models" });
    expect(rows[0]).toMatchObject({ id: "coordinator", check: "Group coordinator", detail: "You", done: true, target: "roles" });
    expect(rows[1]).toMatchObject({ check: "Members", detail: "Open to join", done: true, target: "users" });
    expect(rows[2]).toMatchObject({ check: "Farmers' coordinator", detail: "Agent connected", done: true, target: "agents" });
    expect(rows.map((row) => row.progress)).toEqual(Array(4).fill("3 of 4 ready"));
  });

  it("names every agent seat of the hub on the agent tile", async () => {
    tools.roles = {
      items: [
        { id: "r1", name: "Group coordinator" },
        { id: "r5", name: "Farmers' agent", permissions: ["ai.use"] },
        { id: "r6", name: "Suppliers' agent", permissions: ["ai.use"] },
      ],
    };
    expect((await statusRows())[2]).toMatchObject({
      check: "Farmers' agent and Suppliers' agent",
      detail: "Agent connected",
      done: true,
      target: "agents",
    });
  });

  it("lists three agent seats with commas and a last and", async () => {
    tools.roles = {
      items: [{ id: "r1", name: "Hub Steward", permissions: ["ai.use"] }, { id: "r5", name: "Farmers' agent", permissions: ["ai.use"] }, { id: "r6", name: "Suppliers' agent", permissions: ["ai.use"] }],
    };
    expect((await statusRows())[2].check).toBe("Hub Steward, Farmers' agent and Suppliers' agent");
  });

  it("names the one agent seat alone when only one exists", async () => {
    tools.roles = { items: [{ id: "r6", name: "Suppliers' agent", permissions: ["ai.use"] }] };
    expect((await statusRows())[2]).toMatchObject({ check: "Suppliers' agent", done: true });
  });

  it("names the provider next to the key once it is set, and Hugging Face when the account is the Hugging Face one", async () => {
    keyIs(true, "claude");
    const claude = await statusRows();
    expect(claude[3]).toMatchObject({ detail: "Claude · set", done: true, progress: "4 of 4 ready" });
    keyIs(true, "");
    expect((await statusRows())[3].detail).toBe("Hugging Face · set");
    keyIs(true, "huggingface");
    expect((await statusRows())[3].detail).toBe("Hugging Face · set");
  });

  it("names Meta Model API and Other (OpenAI-compatible) next to the key once it is set", async () => {
    keyIs(true, "meta");
    expect((await statusRows())[3].detail).toBe("Meta Model API · set");
    keyIs(true, "custom");
    expect((await statusRows())[3].detail).toBe("Other (OpenAI-compatible) · set");
  });

  it("marks a hub with no roles anywhere and joining by approval as not done where nothing exists", async () => {
    tools.roles = { items: [] };
    tools.joinMode = { join_mode: "confirmed" };
    const rows = await statusRows();
    expect(rows[0]).toMatchObject({ check: "Hub manager", detail: "No role yet", done: false });
    expect(rows[2]).toMatchObject({ check: "Agent", detail: "No agent yet", done: false });
    expect(rows[1]).toMatchObject({ detail: "Approval required", done: true });
    expect(rows[0].progress).toBe("1 of 4 ready");
  });

  it("reads joining closed to everyone but invited people as By invitation", async () => {
    tools.joinMode = { join_mode: "invite" };
    expect((await statusRows())[1]).toMatchObject({ detail: "By invitation", done: true });
    tools.joinMode = {};
    expect((await statusRows())[1]).toMatchObject({ detail: "By invitation", done: true });
  });

  it("reads the agency when the answer wraps it", async () => {
    tools.agency = { agency: { name: "Siaya Farmers' Group" } };
    expect((await statusRows())[1]).toMatchObject({ detail: "Open to join", done: true });
  });

  it("says No hub yet when the agency has no name", async () => {
    tools.agency = {};
    const rows = await statusRows();
    expect(rows[1]).toMatchObject({ detail: "No hub yet", done: false, target: "users" });
    expect(rows[1].progress).toBe("2 of 4 ready");
  });

  it("reads the roles of the newest open draft, where the imported roles are", async () => {
    tools.roles = { items: [] };
    tools.drafts = {
      items: [
        { id: "d1", description: "Initial draft", status: "open" },
        { id: "d2", description: "Imported from Siaya Farmers' Group", status: "open" },
      ],
    };
    tools.draftRoles = farmersRoles;
    const rows = await statusRows();
    expect(rows[0]).toMatchObject({ check: "Group coordinator", detail: "You", done: true });
    expect(rows[2]).toMatchObject({ check: "Farmers' coordinator", done: true });
    const roleCalls = vi.mocked(callTool).mock.calls.filter((call) => call[1] === "agency_list_roles");
    expect(roleCalls.map((call) => call[2])).toEqual([{ draft_id: "d2" }]);
  });

  it("asks only the open drafts which one is the working draft", async () => {
    await statusRows();
    const draftCalls = vi.mocked(callTool).mock.calls.filter((call) => call[1] === "agency_list_drafts");
    expect(draftCalls.map((call) => call[2])).toEqual([{ status: "open" }]);
  });

  it("reads the only open draft, and the published roles when no draft is open", async () => {
    tools.drafts = { items: [{ id: "d1", description: "Initial draft", status: "open" }] };
    tools.draftRoles = farmersRoles;
    tools.roles = { items: [] };
    expect((await statusRows())[0]).toMatchObject({ detail: "You", done: true });
    tools.drafts = { items: [{ id: "d0", description: "Shelved", status: "archived" }] };
    expect((await statusRows())[0]).toMatchObject({ detail: "No role yet", done: false });
    const roleCalls = vi.mocked(callTool).mock.calls.filter((call) => call[1] === "agency_list_roles");
    expect(roleCalls.map((call) => call[2])).toEqual([{ draft_id: "d1" }, {}]);
  });

  it("names the Hub Steward as the agent when the agency has that role", async () => {
    tools.roles = { items: [{ id: "r1", name: "Hub manager" }, { id: "r2", name: "Hub Steward", permissions: ["ai.use"] }] };
    expect((await statusRows())[2]).toMatchObject({ check: "Hub Steward", detail: "Agent connected", done: true });
  });

  it("takes a role for the agent by what it holds, whatever it is called", async () => {
    tools.roles = {
      items: [
        { id: "r1", name: "Lab manager", permissions: ["chat.thread"] },
        { id: "r2", name: "Night assistant", permissions: ["chat.thread", "ai.use"] },
        { id: "r3", name: "Greeter", kind: "ai" },
      ],
    };
    expect((await statusRows())[2]).toMatchObject({ check: "Night assistant and Greeter", detail: "Agent connected", done: true });
  });

  it("does not take a role for the agent by its name alone", async () => {
    tools.roles = { items: [{ id: "r1", name: "Hub Steward", permissions: ["chat.thread"] }, { id: "r2", name: "Farmers' agent" }] };
    expect((await statusRows())[2]).toMatchObject({ check: "Agent", detail: "No agent yet", done: false });
  });

  it("does not take a human role for the agent", async () => {
    tools.roles = { items: [{ id: "r1", name: "Group coordinator" }, { id: "r2", name: "Farmer" }] };
    expect((await statusRows())[2]).toMatchObject({ detail: "No agent yet", done: false });
  });

  it("reads the open drafts and then the roles of the agency once", async () => {
    await statusRows();
    expect(toolsCalled()).toEqual(["agency_get_agency", "instance_get_join_mode", "agency_list_drafts", "agency_list_roles"]);
    expect(vi.mocked(listAccounts).mock.calls).toEqual([["h1"]]);
  });

  it("reads the key of the hub asked about and sends that hub's id with every tool", async () => {
    keyIs(true, "claude");
    expect((await statusPage.rows("h1", {}))[3]).toMatchObject({ detail: "Claude · set", done: true });
    expect((await statusPage.rows("other", {}))[3]).toMatchObject({ detail: "Needed to reply", done: false });
    expect(vi.mocked(callTool).mock.calls.map((call) => call[0])).toEqual(Array(4).fill("h1").concat(Array(4).fill("other")));
  });

  it("treats the key as not set when the accounts cannot be read or the hub has none", async () => {
    vi.mocked(listAccounts).mockRejectedValue(new TypeError("network down"));
    expect((await statusRows())[3]).toMatchObject({ detail: "Needed to reply", done: false });
    vi.mocked(listAccounts).mockResolvedValue([]);
    expect((await statusRows())[3]).toMatchObject({ detail: "Needed to reply", done: false });
    vi.mocked(listAccounts).mockResolvedValue([anAccount({ keySet: false })]);
    expect((await statusRows())[3]).toMatchObject({ detail: "Needed to reply", done: false });
  });

  it("fails when any of its tools fails", async () => {
    for (const tool of ["agency_get_agency", "instance_get_join_mode", "agency_list_roles"]) {
      tools.failOn = tool;
      await expect(statusRows()).rejects.toThrow("boom");
    }
  });

  it("fails when the open drafts cannot be read", async () => {
    tools.failOn = "agency_list_drafts";
    await expect(statusRows()).rejects.toThrow("boom");
  });

  it("fails when a role list does not come back as a list", async () => {
    tools.roles = {};
    await expect(statusRows()).rejects.toThrow();
  });
});

describe("the three checks the page reads from the backend", () => {
  it("come without the model key and without a progress count", async () => {
    const checks = await statusChecks("h1");
    expect(checks.map((row) => row.tile)).toEqual(["coordinator", "members", "agent"]);
    checks.forEach((row) => expect(row).not.toHaveProperty("progress"));
    expect(vi.mocked(listAccounts)).not.toHaveBeenCalled();
  });
});

describe("the model key check", () => {
  it("is needed to reply while no key is set", () => {
    expect(modelCheck(false, "claude")).toMatchObject({ tile: "model", word: "missing", done: false, target: "models" });
  });

  it("names the provider once a key is set", () => {
    expect(modelCheck(true, "claude")).toMatchObject({ tile: "model", word: "set", detail: "Claude · set", provider: "Claude", done: true });
  });

  it("shows the provider id as it is when the provider has no label", () => {
    expect(modelCheck(true, "mistral")).toMatchObject({ detail: "mistral · set", provider: "mistral" });
  });

  it("names Meta Model API and Other (OpenAI-compatible) once a key is set", () => {
    expect(modelCheck(true, "meta")).toMatchObject({ detail: "Meta Model API · set", provider: "Meta Model API", done: true });
    expect(modelCheck(true, "custom")).toMatchObject({ detail: "Other (OpenAI-compatible) · set", provider: "Other (OpenAI-compatible)" });
  });
});
