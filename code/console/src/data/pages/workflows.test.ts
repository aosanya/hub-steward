import { beforeEach, expect, test, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { objectiveChoices, proposeLinkObjective, proposeUnlinkObjective, workflowsPage } from "./workflows";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

type Args = Record<string, unknown>;

const call = vi.mocked(callTool);

const answerWith = (replies: Record<string, unknown>) =>
  call.mockImplementation((async (_hub: string, tool: string) => (tool in replies ? replies[tool] : [])) as typeof callTool);

const callsTo = (tool: string) => call.mock.calls.filter(([, name]) => name === tool);

const argsOf = (tool: string): Args => callsTo(tool).at(-1)?.[2] ?? {};

const lab = {
  agency_list_workflows: {
    items: [
      { id: "w1", code: "W-1", name: "Group order", description: "Farmers buy together" },
      { id: "w2", code: "W-2", name: "Find it", description: "" },
      { id: "w3", code: "W-3", name: "Empty", description: "" },
    ],
  },
  agency_get_workflow: { id: "w1", code: "W-1", name: "Group order" },
  agency_list_work_items: {
    items: [
      { id: "i1", workflow_id: "w1", objective_id: "o1", title: "Start" },
      { id: "i2", workflow_id: "w1", objective_id: "o1", title: "Open" },
      { id: "i3", workflow_id: "w1", objective_id: "o2", title: "Send" },
      { id: "i4", workflow_id: "w2", objective_id: "o3", title: "Ask" },
    ],
  },
  agency_list_workflow_objectives: {
    items: [
      { id: "l1", workflow_id: "w1", objective_id: "o1" },
      { id: "l2", workflow_id: "w1", objective_id: "o2" },
      { id: "l3", workflow_id: "w2", objective_id: "o3" },
    ],
  },
  agency_list_objectives: {
    items: [
      { id: "o1", code: "O-1", title: "Gather" },
      { id: "o2", code: "O-2" },
    ],
  },
};

const rowsFor = (query: Record<string, string> = {}) => workflowsPage.rows("h1", query);

beforeEach(() => {
  call.mockReset();
  answerWith(lab);
});

test("the Workflows page offers Add a workflow with the code, workflow, what it is for and steps columns", () => {
  expect(workflowsPage.spec).toEqual({
    id: "workflows",
    title: "Workflows",
    primary: "Add a workflow",
    tools: ["agency_list_workflows", "agency_get_workflow", "agency_list_default_workflows", "agency_list_work_items", "agency_list_workflow_objectives", "agency_list_objectives"],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Workflow" },
      { key: "description", label: "What it is for" },
      { key: "steps", label: "Steps" },
    ],
  });
});

test("each workflow row keeps what the tool returned and counts its steps and lists the objectives linked to it", async () => {
  const rows = await rowsFor();
  expect(rows).toEqual([
    { id: "w1", code: "W-1", name: "Group order", description: "Farmers buy together", steps: 3, objectives: ["o1", "o2"], roles: [""] },
    { id: "w2", code: "W-2", name: "Find it", description: "", steps: 1, objectives: ["o3"], roles: [""] },
    { id: "w3", code: "W-3", name: "Empty", description: "", steps: 0, objectives: [], roles: [] },
  ]);
});

test("a workflow that opens in a chat carries the name of the role its chat step chats with", async () => {
  answerWith({
    ...lab,
    agency_list_workflows: { items: [{ id: "w1", code: "W-1", name: "Buy inputs", opens_in: "chat" }, { id: "w2", code: "W-2", name: "Find it" }] },
    agency_list_work_items: {
      items: [
        { id: "i1", workflow_id: "w1", title: "Chat", kind: "chat", role_id: "r2", agent_role_id: "r1" },
        { id: "i2", workflow_id: "w2", title: "Ask", kind: "fill_form", role_id: "r2" },
      ],
    },
    agency_list_pickers: {
      actors: [
        { id: "r1", name: "Farmers' agent", kind: "role" },
        { id: "r2", name: "Farmer", kind: "role" },
      ],
    },
  });

  const rows = await rowsFor();

  expect(rows[0]).toMatchObject({ opens_in: "chat", chats_with: "Farmers' agent", roles: ["Farmer"] });
  expect(rows[1]).not.toHaveProperty("chats_with");
});

test("the workflow list asks the open drafts, then the workflows and the work items of the same scope", async () => {
  await rowsFor();
  expect(call.mock.calls.map(([, tool]) => tool)).toEqual([
    "agency_list_drafts",
    "agency_list_workflows",
    "agency_list_work_items",
    "agency_list_workflow_objectives",
    "agency_list_default_workflows",
    "agency_list_pickers",
  ]);
});

test("the workflow list reads the newest open draft", async () => {
  answerWith({
    ...lab,
    agency_list_drafts: {
      items: [
        { id: "d1", status: "open" },
        { id: "d2", status: "open" },
      ],
    },
  });
  await rowsFor();
  expect(argsOf("agency_list_workflows")).toEqual({ draft_id: "d2" });
  expect(argsOf("agency_list_work_items")).toEqual({ draft_id: "d2" });
  expect(argsOf("agency_list_workflow_objectives")).toEqual({ draft_id: "d2" });
});

test("the workflow list reads the draft named in the query without asking for the drafts", async () => {
  await rowsFor({ draft_id: "d1" });
  expect(argsOf("agency_list_workflows")).toEqual({ draft_id: "d1" });
  expect(callsTo("agency_list_drafts")).toEqual([]);
});

test("a bare list is read like one wrapped in items and an empty answer shows no rows", async () => {
  answerWith({ agency_list_workflows: [{ id: "w9", name: "Bare" }], agency_list_work_items: { items: [] } });
  expect(await rowsFor()).toEqual([{ id: "w9", name: "Bare", steps: 0, objectives: [], roles: [] }]);
  answerWith({ agency_list_workflows: { items: [] } });
  expect(await rowsFor()).toEqual([]);
});

test("a workflow list answered as neither a list nor items fails the rows", async () => {
  answerWith({ ...lab, agency_list_workflows: {} });
  await expect(rowsFor()).rejects.toThrow("the answer was not a list");
});

test("the workflow list fails when a tool fails", async () => {
  call.mockImplementation((async (_hub: string, tool: string) => {
    if (tool === "agency_list_work_items") throw new McpError("agency_list_work_items: down");
    return lab.agency_list_workflows;
  }) as typeof callTool);
  await expect(rowsFor()).rejects.toThrow("down");
});

test("a workflow's detail has the workflow and only its own steps in the order served", async () => {
  const rows = await rowsFor({ workflow: "w1" });
  expect(rows).toEqual([
    {
      workflow: { id: "w1", code: "W-1", name: "Group order" },
      links: lab.agency_list_workflow_objectives.items,
      steps: [
        { id: "i1", workflow_id: "w1", objective_id: "o1", title: "Start" },
        { id: "i2", workflow_id: "w1", objective_id: "o1", title: "Open" },
        { id: "i3", workflow_id: "w1", objective_id: "o2", title: "Send" },
      ],
    },
  ]);
});

test("a workflow's detail asks for the workflow by id and lists no workflows", async () => {
  await rowsFor({ workflow: "w1" });
  expect(argsOf("agency_get_workflow")).toEqual({ workflow_id: "w1" });
  expect(callsTo("agency_list_workflows")).toEqual([]);
});

test("a workflow's detail asks for the objectives linked to that workflow in the open draft", async () => {
  await rowsFor({ workflow: "w1", draft_id: "d1" });
  expect(argsOf("agency_list_workflow_objectives")).toEqual({ draft_id: "d1", workflow_id: "w1" });
});

test("a workflow with no link shows no objectives in the list and an empty links list in its detail", async () => {
  answerWith({ ...lab, agency_list_workflow_objectives: { items: [] } });
  expect((await rowsFor()).map((row) => row.objectives)).toEqual([[], [], []]);
  expect((await rowsFor({ workflow: "w1" }))[0].links).toEqual([]);
});

test("the objectives to choose from carry id, code and title", async () => {
  expect(await objectiveChoices("h1")).toEqual([
    { id: "o1", code: "O-1", title: "Gather" },
    { id: "o2", code: "O-2", title: "" },
  ]);
});

test("linking an objective proposes agency_link_workflow_objective for the workflow in the open draft", async () => {
  answerWith({ ...lab, agency_list_drafts: { items: [{ id: "d1", status: "open" }] } });
  await proposeLinkObjective("h1", "w1", "Group order", { id: "o2", code: "O-2", title: "Fund" });
  expect(argsOf("agency_propose_write")).toEqual({
    kind: "agency_link_workflow_objective",
    summary: "Link the objective O-2 Fund to the workflow Group order",
    payload: JSON.stringify({ workflow_id: "w1", objective_id: "o2", draft_id: "d1" }),
  });
});

test("unlinking an objective proposes agency_delete_workflow_objective for that link", async () => {
  await proposeUnlinkObjective("h1", "l1", "Group order", { id: "o1", code: "O-1", title: "Gather" });
  expect(argsOf("agency_propose_write")).toEqual({
    kind: "agency_delete_workflow_objective",
    summary: "Unlink the objective O-1 Gather from the workflow Group order",
    payload: JSON.stringify({ workflow_objective_id: "l1" }),
  });
});

test("a workflow's detail fails when the workflow cannot be read as a workflow", async () => {
  answerWith({ ...lab, agency_get_workflow: "gone" });
  await expect(rowsFor({ workflow: "w1" })).rejects.toThrow("the answer was not a workflow");
});

test("a workflow's detail fails when a tool fails", async () => {
  call.mockImplementation((async (_hub: string, tool: string) => {
    if (tool === "agency_get_workflow") throw new McpError("agency_get_workflow: down");
    return lab.agency_list_work_items;
  }) as typeof callTool);
  await expect(rowsFor({ workflow: "w1" })).rejects.toThrow("down");
});

test("the built-in defaults follow the agency's workflows, marked default, and drop out once the agency has one with the same code", async () => {
  const cancel = { code: "cancel", name: "Cancel", description: "At once", default: true, in_use: false, version: 0 };
  answerWith({ ...lab, agency_list_default_workflows: { items: [cancel] } });
  const rows = await rowsFor();
  expect(rows.at(-1)).toEqual({ ...cancel, objectives: [] });
  expect(rows).toHaveLength(4);

  answerWith({
    ...lab,
    agency_list_default_workflows: { items: [cancel] },
    agency_list_workflows: { items: [{ id: "w7", code: "cancel", name: "Own cancel" }] },
  });
  expect((await rowsFor()).map((row) => row.id)).toEqual(["w7"]);
});

test("a role id nobody can name is left out of the roles and an empty role id means the agency", async () => {
  answerWith({
    ...lab,
    agency_list_workflows: { items: [{ id: "w1", code: "W-1", name: "Group order" }] },
    agency_list_work_items: {
      items: [
        { id: "i2", workflow_id: "w1", ordinality: 2, role_id: "r2" },
        { id: "i1", workflow_id: "w1", ordinality: 1, role_id: "r1" },
        { id: "i3", workflow_id: "w1", ordinality: 3, role_id: "gone" },
        { id: "i4", workflow_id: "w1", ordinality: 4 },
      ],
    },
    agency_list_pickers: {
      actors: [
        { id: "r1", name: "Group coordinator", kind: "role" },
        { id: "r2", name: "Farmer", kind: "role" },
        { id: "g1", name: "Siaya", kind: "group" },
      ],
    },
  });
  expect((await rowsFor())[0].roles).toEqual(["Group coordinator", "Farmer", ""]);
});
