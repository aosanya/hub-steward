import { callTool } from "../wakala/mcp";
import { showsDraftBar } from "./draft";
import { loadAssistantSettings, saveAssistantSettings } from "./assistantLimits";

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn() }));

const roleRow = (id: string, name: string, permissions: string[]) => ({ id, name, description: name, permissions, staff: false });

const replies: Record<string, unknown> = {
  agency_list_drafts: { items: [{ id: "d1", status: "open", description: "" }] },
  agency_list_roles: {
    items: [
      roleRow("r1", "Backlog member", ["task.read", "ai.chat"]),
      roleRow("r2", "Backlog worker", ["task.read", "task.move"]),
      roleRow("r3", "Backlog manager", ["task.read", "backlog.manage", "ai.chat"]),
      roleRow("r4", "Triager", ["task.read", "ai.use"]),
    ],
  },
  ai_get_assistant_limits: { tokens_per_person_day: 20000, tokens_per_person_month: 0 },
};

const answer = (overrides: Record<string, unknown> = {}) =>
  vi.mocked(callTool).mockImplementation(async (_hub, tool) => ({ ...replies, ...overrides })[tool] as never);

const callsTo = (tool: string) => vi.mocked(callTool).mock.calls.filter(([, name]) => name === tool).map(([, , args]) => args);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  answer();
});

describe("the assistant settings the console reads", () => {
  it("lists only the three Backlog roles and says which of them may ask", async () => {
    const settings = await loadAssistantSettings("h1");
    expect(settings.roles.map((role) => [role.name, role.may])).toEqual([
      ["Backlog member", true],
      ["Backlog worker", false],
      ["Backlog manager", true],
    ]);
  });

  it("reads the two numbers, with zero meaning no limit", async () => {
    const settings = await loadAssistantSettings("h1");
    expect(settings.limits).toEqual({ day: 20000, month: null });
  });

  it("reads the open draft the roles are listed in", async () => {
    const settings = await loadAssistantSettings("h1");
    expect(settings.draftId).toBe("d1");
    expect(callsTo("agency_list_roles")).toEqual([{ draft_id: "d1" }]);
  });
});

describe("saving the assistant settings", () => {
  it("gives ai.chat to a role switched on and keeps every other permission it holds", async () => {
    const before = await loadAssistantSettings("h1");
    const after = { ...before, roles: before.roles.map((role) => (role.id === "r2" ? { ...role, may: true } : role)) };
    await saveAssistantSettings("h1", before, after);
    expect(callsTo("agency_update_role")).toEqual([{ draft_id: "d1", role_id: "r2", name: "Backlog worker", permissions: ["task.read", "task.move", "ai.chat"] }]);
  });

  it("takes ai.chat away from a role switched off and keeps every other permission", async () => {
    const before = await loadAssistantSettings("h1");
    const after = { ...before, roles: before.roles.map((role) => (role.id === "r3" ? { ...role, may: false } : role)) };
    await saveAssistantSettings("h1", before, after);
    expect(callsTo("agency_update_role")).toEqual([{ draft_id: "d1", role_id: "r3", name: "Backlog manager", permissions: ["task.read", "backlog.manage"] }]);
  });

  it("leaves a role that did not change alone", async () => {
    const before = await loadAssistantSettings("h1");
    await saveAssistantSettings("h1", before, before);
    expect(callsTo("agency_update_role")).toEqual([]);
  });

  it("sends the two numbers, writing no limit as zero", async () => {
    const before = await loadAssistantSettings("h1");
    await saveAssistantSettings("h1", before, { ...before, limits: { day: null, month: 500000 } });
    expect(callsTo("ai_set_assistant_limits")).toEqual([{ tokens_per_person_day: 0, tokens_per_person_month: 500000 }]);
  });

  it("refuses a negative number before anything is sent", async () => {
    const before = await loadAssistantSettings("h1");
    await expect(saveAssistantSettings("h1", before, { ...before, limits: { day: -1, month: null } })).rejects.toThrow("a limit cannot be below zero");
    expect(callsTo("ai_set_assistant_limits")).toEqual([]);
    expect(callsTo("agency_update_role")).toEqual([]);
  });
});

describe("the draft bar on the Assistant page", () => {
  it("shows on the Assistant page, because the switches change the working draft", () => {
    expect(showsDraftBar("assistant")).toBe(true);
  });
});
