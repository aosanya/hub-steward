import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { loadStepAccountable, proposeClearAccountableRole, proposeSetAccountableRole } from "./stepRoles";

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
  answering({ agency_list_drafts: { items: [{ id: "d1", status: "open" }] }, agency_propose_write: {} });
});

describe("reading the accountable role of a step", () => {
  it("reads the step and returns its accountable role beside its own role", async () => {
    answering({ agency_get_work_item: { id: "s1", role_id: "r1", accountable_role_id: "r2" } });

    expect(await loadStepAccountable("h", "s1")).toEqual({ accountableRoleId: "r2", ownRoleId: "r1" });
    expect(callsTo("agency_get_work_item")).toEqual([{ work_item_id: "s1" }]);
  });

  it("returns empty ids for a step with neither", async () => {
    answering({ agency_get_work_item: { id: "s1" } });

    expect(await loadStepAccountable("h", "s1")).toEqual({ accountableRoleId: "", ownRoleId: "" });
  });

  it("never asks for role assignments", async () => {
    answering({ agency_get_work_item: { id: "s1" } });
    await loadStepAccountable("h", "s1");

    expect(callsTo("agency_list_role_assignments_for_work_item")).toEqual([]);
  });
});

describe("changing the accountable role of a step", () => {
  it("proposes agency_update_work_item with the step and the role", async () => {
    await proposeSetAccountableRole("h", "s1", "Open the order", "r1", "Coordinator");

    expect(callsTo("agency_propose_write")).toEqual([
      {
        kind: "agency_update_work_item",
        summary: "Make Coordinator accountable for the step Open the order",
        payload: JSON.stringify({ work_item_id: "s1", accountable_role_id: "r1" }),
      },
    ]);
  });

  it("proposes the same write with no role to take the accountable role off", async () => {
    await proposeClearAccountableRole("h", "s1", "Open the order");

    expect(callsTo("agency_propose_write")).toEqual([
      {
        kind: "agency_update_work_item",
        summary: "Take the accountable role off the step Open the order",
        payload: JSON.stringify({ work_item_id: "s1", accountable_role_id: "" }),
      },
    ]);
  });
});
