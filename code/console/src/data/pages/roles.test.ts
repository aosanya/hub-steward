import { beforeEach, expect, test, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { agentPermission } from "./agents";
import { objectiveCodes, roleAgents, rolesPage, unlinkedAgents } from "./roles";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

vi.mock("./agents", async (importOriginal) => ({ ...(await importOriginal<object>()), agentPermission: "role.is-an-agent" }));

type Args = Record<string, unknown>;

const call = vi.mocked(callTool);

const answerWith = (replies: Record<string, unknown>) =>
  call.mockImplementation((async (_hub: string, tool: string) => (tool in replies ? replies[tool] : [])) as typeof callTool);

const callsTo = (tool: string) => call.mock.calls.filter(([, name]) => name === tool);

const argsOf = (tool: string): Args => callsTo(tool).at(-1)?.[2] ?? {};

const lab = {
  agency_list_roles: {
    items: [
      { id: "r1", code: "R-1", name: "Group coordinator", kind: "human" },
      { id: "r2", code: "R-2", name: "Matching agent", kind: "ai" },
      { id: "r3", code: "R-3", name: "Farmer" },
    ],
  },
  agency_get_role: { id: "r1", name: "Group coordinator" },
  agency_list_rules: { items: [{ text: "Never share a farmer's phone number" }] },
};

const rowsFor = (query: Record<string, string> = {}) => rolesPage.rows("h1", query);

const addRole = (values: Record<string, unknown>) => rolesPage.actions!.roles("h", values);

const editRole = (values: Record<string, unknown>) => rolesPage.actions!.role("h", values);

beforeEach(() => {
  call.mockReset();
  answerWith(lab);
});

test("the Roles page offers Add a role with the code, role, kind and what it does columns", () => {
  expect(rolesPage.spec).toEqual({
    id: "roles",
    title: "Roles",
    primary: "Add a role",
    tools: [
      "agency_create_role",
      "agency_update_role",
      "agency_delete_role",
      "agency_list_scenarios",
      "agency_list_roles",
      "agency_get_role",
      "agency_list_rules",
      "agency_list_objectives",
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Role" },
      { key: "kind", label: "Kind" },
      { key: "description", label: "What it does" },
    ],
  });
});

test("the role list carries the kind for human and AI roles and asks the open drafts before the list tool", async () => {
  const rows = await rowsFor();
  expect(rows).toHaveLength(3);
  expect(rows.map((row) => row.kind)).toEqual(["human", "ai", "human"]);
  expect(call.mock.calls.map(([, tool]) => tool)).toEqual(["agency_list_drafts", "agency_list_roles"]);
});

test("a role row keeps every field the tool returned", async () => {
  const rows = await rowsFor();
  expect(rows[1]).toEqual({ id: "r2", code: "R-2", name: "Matching agent", kind: "ai" });
});

test("a tool answering with a bare list is read like one wrapped in items", async () => {
  answerWith({ agency_list_roles: [{ id: "r9", name: "Bare" }] });
  expect(await rowsFor()).toEqual([{ id: "r9", name: "Bare", kind: "human" }]);
});

test("a role list that is an empty list shows no rows", async () => {
  answerWith({ agency_list_roles: { items: [] } });
  expect(await rowsFor()).toEqual([]);
});

test("a role list answered as neither a list nor items fails the rows", async () => {
  answerWith({ agency_list_roles: {} });
  await expect(rowsFor()).rejects.toThrow("the answer was not a list");
});

test("the role list fails when the tool fails", async () => {
  call.mockImplementation((async () => {
    throw new McpError("agency_list_roles: down");
  }) as typeof callTool);
  await expect(rowsFor()).rejects.toThrow("down");
});

test("a role's detail has its rules and no members, and no assignments", async () => {
  const rows = await rowsFor({ role: "r1" });
  expect(rows).toEqual([
    {
      role: { id: "r1", name: "Group coordinator" },
      rules: [{ text: "Never share a farmer's phone number" }],
      members: null,
    },
  ]);
  expect(Object.hasOwn(rows[0], "members")).toBe(true);
});

test("a role's detail asks for that role and its rules by id and invents no members call", async () => {
  await rowsFor({ role: "r1" });
  expect(argsOf("agency_get_role")).toEqual({ role_id: "r1" });
  expect(argsOf("agency_list_rules")).toEqual({ role_id: "r1" });
  expect(callsTo("actor_list_members")).toEqual([]);
  expect(callsTo("agency_list_roles")).toEqual([]);
  expect(callsTo("agency_list_role_assignments")).toEqual([]);
});

test("a role's detail fails when the role cannot be read as a role", async () => {
  answerWith({ ...lab, agency_get_role: [] });
  await expect(rowsFor({ role: "r1" })).rejects.toThrow("the answer was not a role");
});

test("a role's detail fails when a tool fails", async () => {
  call.mockImplementation((async (_hub: string, tool: string) => {
    if (tool === "agency_list_rules") throw new McpError("agency_list_rules: down");
    return lab.agency_get_role;
  }) as typeof callTool);
  await expect(rowsFor({ role: "r1" })).rejects.toThrow("down");
});

test("adding a role creates it in the draft directly", async () => {
  expect(await addRole({ name: "  Treasurer ", description: " Keeps the books " })).toBe("done");
  expect(callsTo("agency_propose_write")).toEqual([]);
  expect(argsOf("agency_create_role")).toMatchObject({ name: "Treasurer", description: "Keeps the books" });
});

test("adding a role without a description sends an empty description", async () => {
  await addRole({ name: "Treasurer" });
  expect(argsOf("agency_create_role")).toMatchObject({ name: "Treasurer", description: "" });
});

test("adding a role with an empty name is refused without calling any tool", async () => {
  await expect(addRole({ name: "  " })).rejects.toThrow("name is required");
  await expect(addRole({})).rejects.toThrow("name is required");
  expect(call).not.toHaveBeenCalled();
});

test("adding a role whose tool fails reports the failure", async () => {
  call.mockImplementation((async () => {
    throw new McpError("agency_propose_write: boom");
  }) as typeof callTool);
  await expect(addRole({ name: "A" })).rejects.toThrow("boom");
});

test("editing a role updates it directly with the role id, the trimmed name, the description and the permissions it already holds", async () => {
  answerWith({ agency_get_role: { id: "r3", permissions: ["market.browse"], staff: true } });
  expect(await editRole({ role_id: "r3", name: " Grower ", description: " Grows crops " })).toBe("done");
  expect(callsTo("agency_propose_write")).toEqual([]);
  expect(argsOf("agency_update_role")).toMatchObject({ role_id: "r3", name: "Grower", description: "Grows crops", permissions: ["market.browse"], staff: true });
});

test("turning the agent switch on adds the agent permission to the permissions a role holds and off takes it away", async () => {
  answerWith({ agency_get_role: { id: "r3", permissions: ["market.browse"], staff: false } });
  await editRole({ role_id: "r3", name: "Grower", agent: true });
  expect(argsOf("agency_update_role")).toMatchObject({ permissions: ["market.browse", agentPermission] });
  answerWith({ agency_get_role: { id: "r3", permissions: ["market.browse", agentPermission], staff: false } });
  await editRole({ role_id: "r3", name: "Grower", agent: false });
  expect(argsOf("agency_update_role")).toMatchObject({ permissions: ["market.browse"] });
});

test("editing a role with an empty name or no role id is refused without calling any tool", async () => {
  await expect(editRole({ role_id: "r3", name: "  " })).rejects.toThrow("name is required");
  await expect(editRole({ name: "Grower" })).rejects.toThrow("role_id is required");
  expect(call).not.toHaveBeenCalled();
});

test("adding a role with a value that is not text is not understood and calls nothing", async () => {
  await expect(addRole({ name: 12 })).rejects.toThrow("that was not understood");
  expect(call).not.toHaveBeenCalled();
});

test("objectives are named by their code under their id", async () => {
  answerWith({ agency_list_objectives: { items: [{ id: "o1", code: "O-1" }, { id: "o2", code: "O-2" }] } });
  expect(await objectiveCodes("h")).toEqual({ o1: "O-1", o2: "O-2" });
});

test("the objective codes fail when the tool answers neither a list nor items", async () => {
  answerWith({ agency_list_objectives: {} });
  await expect(objectiveCodes("h")).rejects.toThrow("the answer was not a list");
});

const twoOpenDrafts = {
  items: [
    { id: "d0", description: "Shelved", status: "archived" },
    { id: "d1", description: "Initial draft", status: "open" },
    { id: "d2", description: "Imported from Siaya Farmers' Group", status: "open" },
  ],
};

test("the role list reads the newest open draft, asking only the open drafts", async () => {
  answerWith({ ...lab, agency_list_drafts: twoOpenDrafts });
  await rowsFor();
  expect(callsTo("agency_list_drafts").map(([, , args]) => args)).toEqual([{ status: "open" }]);
  expect(argsOf("agency_list_roles")).toEqual({ draft_id: "d2" });
});

test("the role list reads the published agency, sending no draft id, when no draft is open", async () => {
  answerWith({ ...lab, agency_list_drafts: { items: [{ id: "d0", status: "archived" }] } });
  await rowsFor();
  expect(argsOf("agency_list_roles")).toEqual({});
});

test("the role list reads the draft named in the query without asking for the drafts", async () => {
  answerWith({ ...lab, agency_list_drafts: twoOpenDrafts });
  await rowsFor({ draft_id: "d1" });
  expect(argsOf("agency_list_roles")).toEqual({ draft_id: "d1" });
  expect(callsTo("agency_list_drafts")).toEqual([]);
});

test("the role list fails, listing no role, when the open drafts cannot be read", async () => {
  call.mockImplementation((async (_hub: string, tool: string) => {
    if (tool === "agency_list_drafts") throw new McpError("agency_list_drafts: down");
    return lab[tool as keyof typeof lab];
  }) as typeof callTool);
  await expect(rowsFor()).rejects.toThrow("agency_list_drafts: down");
  expect(callsTo("agency_list_roles")).toEqual([]);
});

test("a role's detail reads the rules of the newest open draft and the role by its id alone", async () => {
  answerWith({ ...lab, agency_list_drafts: twoOpenDrafts });
  await rowsFor({ role: "r1" });
  expect(argsOf("agency_get_role")).toEqual({ role_id: "r1" });
  expect(argsOf("agency_list_rules")).toEqual({ draft_id: "d2", role_id: "r1" });
});

test("the objective codes read the objectives of the newest open draft", async () => {
  answerWith({ agency_list_drafts: twoOpenDrafts, agency_list_objectives: { items: [] } });
  await objectiveCodes("h");
  expect(argsOf("agency_list_objectives")).toEqual({ draft_id: "d2" });
});

test("the objective codes read the published agency when no draft is open", async () => {
  answerWith({ agency_list_objectives: { items: [] } });
  await objectiveCodes("h");
  expect(argsOf("agency_list_objectives")).toEqual({});
});

test("the agents of a role are the AI roles mapped to it, by the agency role id", async () => {
  answerWith({
    ai_list_roles: [
      { id: "a1", name: "Farmers' agent", agency_role_id: "r1" },
      { id: "a2", name: "Matching agent", agency_role_id: "r2" },
      { id: "a3", name: "Unmapped agent" },
    ],
  });
  expect(await roleAgents("h1", "r1")).toEqual([{ id: "a1", name: "Farmers' agent" }]);
  expect(callsTo("ai_list_roles")).toHaveLength(1);
});

test("a hub with no AI roles has no agents for any role", async () => {
  answerWith({ ai_list_roles: null });
  expect(await roleAgents("h1", "r1")).toEqual([]);
});

test("the agents of a role fail when the AI roles cannot be read", async () => {
  call.mockRejectedValue(new McpError("ai_list_roles: down"));
  await expect(roleAgents("h1", "r1")).rejects.toThrow("ai_list_roles: down");
});

test("the agents with no agency role are the AI roles mapped to none", async () => {
  answerWith({
    ai_list_roles: [
      { id: "a1", name: "Farmers' agent", agency_role_id: "r1" },
      { id: "a3", name: "Unmapped agent" },
      { id: "a4", name: "Cleared agent", agency_role_id: "" },
    ],
  });
  expect(await unlinkedAgents("h1")).toEqual([
    { id: "a3", name: "Unmapped agent" },
    { id: "a4", name: "Cleared agent" },
  ]);
});

test("a hub with no AI roles has no unlinked agents", async () => {
  answerWith({ ai_list_roles: null });
  expect(await unlinkedAgents("h1")).toEqual([]);
});
