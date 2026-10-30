import { callTool } from "../../wakala/mcp";
import type { Scenario } from "../scenario";
import { testPage } from "./test";

vi.mock("../../wakala/mcp");

const scenario = {
  id: "s1",
  name: "Buy now",
  summary: "",
  workflowId: "w1",
  workflow: "Buy now",
  result: "passed",
  lastRunId: "r1",
  rules: [],
  actors: [
    {
      id: "a1",
      name: "Farmer 1",
      kind: "role",
      roleId: "role-farmer",
      roleName: "Farmer",
      builtIn: false,
    },
  ],
  blocks: [],
  last: null,
} as Scenario;

describe("the edit action of the Test page", () => {
  beforeEach(() => {
    vi.mocked(callTool).mockReset();
    vi.mocked(callTool).mockImplementation((async (_hub: string, tool: string) =>
      tool === "agency_list_drafts" ? { items: [{ id: "d1", status: "open" }] } : {}) as never);
  });

  it("saves the scenario change, the actors and the fixed answers as one write", async () => {
    const result = await testPage.actions?.edit("h1", {
      scenario,
      name: " Buy now ",
      summary: "Asked once",
      actors: [
        { id: "a1", name: "Farmer One", roleId: "role-farmer" },
        { name: "Supplier 1", roleId: "role-supplier" },
      ],
      inputs: [{ stepId: "st1", field: "Product", value: "Urea" }],
    });

    expect(result).toBe("done");
    const writes = vi.mocked(callTool).mock.calls.filter(([, tool]) => tool === "agency_update_scenario");
    expect(writes).toHaveLength(1);
    expect(writes[0][2]).toEqual({
      draft_id: "d1",
      scenario_id: "s1",
      name: "Buy now",
      summary: "Asked once",
      workflow_id: "w1",
      actors: [
        { id: "a1", name: "Farmer One", role_id: "role-farmer" },
        { name: "Supplier 1", role_id: "role-supplier" },
      ],
      inputs: [{ step_id: "st1", field: "Product", value: "Urea" }],
    });
  });

  it("leaves actors and inputs out of the write when the tabs were not changed", async () => {
    await testPage.actions?.edit("h1", {
      scenario,
      name: "Buy now",
      summary: "",
      actors: [{ id: "a1", name: "Farmer 1", roleId: "role-farmer" }],
      inputs: [],
    });

    const payload = vi.mocked(callTool).mock.calls.find(([, tool]) => tool === "agency_update_scenario")![2] as object;
    expect(payload).not.toHaveProperty("actors");
    expect(payload).not.toHaveProperty("inputs");
  });

  it("reads the actors a scenario can use from the pickers, not from the roles and groups", () => {
    expect(testPage.spec.tools).toContain("agency_list_pickers");
    expect(testPage.spec.tools).not.toContain("agency_list_roles");
  });

  it("offers the tools those writes call", () => {
    expect(testPage.spec.tools).toEqual(
      expect.arrayContaining(["agency_update_scenario"]),
    );
  });
});
