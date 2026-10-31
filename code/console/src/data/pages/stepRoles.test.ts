import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { loadStepAssignments, proposeAddStepRole, proposeRemoveStepRole, rowsOfStep } from "./stepRoles";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const call = vi.mocked(callTool);

type Args = Record<string, unknown>;

const answering = (replies: Record<string, unknown>) =>
  call.mockImplementation((async (_hub: string, tool: string) => replies[tool] ?? { items: [] }) as typeof callTool);

const callsTo = (tool: string) => call.mock.calls.filter(([, name]) => name === tool).map(([, , args]) => (args ?? {}) as Args);

beforeEach(() => {
  call.mockReset();
  answering({ agency_list_drafts: { items: [{ id: "d1", status: "open" }] } });
});

describe("reading the roles on a step", () => {
  it("asks the working draft for the step and keeps the four labels, a role under two labels included", async () => {
    answering({
      agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
      agency_list_role_assignments_for_work_item: {
        items: [
          { id: "a1", work_item_id: "s1", role_id: "r1", label: "responsible" },
          { id: "a2", work_item_id: "s1", role_id: "r1", label: "accountable" },
          { id: "a3", work_item_id: "s1", role_id: "r2", label: "Accountable" },
          { id: "a4", work_item_id: "s1", role_id: "r3", label: "consulted" },
          { id: "a5", work_item_id: "s1", role_id: "r3", label: "owner" },
        ],
      },
    });

    const assignments = await loadStepAssignments("h", "s1");

    expect(callsTo("agency_list_role_assignments_for_work_item")).toEqual([{ draft_id: "d1", work_item_id: "s1" }]);
    expect(assignments.map((assignment) => assignment.id)).toEqual(["a1", "a2", "a3", "a4"]);
    expect(rowsOfStep(assignments)).toEqual([
      { roleId: "r1", assignments: { responsible: "a1", accountable: "a2" } },
      { roleId: "r2", assignments: { accountable: "a3" } },
      { roleId: "r3", assignments: { consulted: "a4" } },
    ]);
  });

  it("allows two roles under the same label", () => {
    const rows = rowsOfStep([
      { id: "a1", roleId: "r1", label: "accountable" },
      { id: "a2", roleId: "r2", label: "accountable" },
    ]);

    expect(rows.map((row) => row.assignments.accountable)).toEqual(["a1", "a2"]);
  });
});

describe("changing the roles on a step", () => {
  it("proposes agency_set_raci with the step, the role and the label", async () => {
    await proposeAddStepRole("h", "s1", "Open the order", "r1", "Coordinator", "accountable");

    expect(callsTo("agency_propose_write")).toEqual([
      {
        kind: "agency_set_raci",
        summary: "Put Coordinator on the step Open the order as accountable",
        payload: JSON.stringify({ work_item_id: "s1", role_id: "r1", label: "accountable" }),
      },
    ]);
  });

  it("proposes agency_delete_role_assignment with the assignment", async () => {
    await proposeRemoveStepRole("h", "a2", "Open the order", "Coordinator", "accountable");

    expect(callsTo("agency_propose_write")).toEqual([
      {
        kind: "agency_delete_role_assignment",
        summary: "Take Coordinator off the step Open the order as accountable",
        payload: JSON.stringify({ assignment_id: "a2" }),
      },
    ]);
  });
});
