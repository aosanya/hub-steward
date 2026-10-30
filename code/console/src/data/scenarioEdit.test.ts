import { callTool } from "../wakala/mcp";
import type { Scenario } from "./scenario";
import {
  duplicateActorName,
  saveEditScenario,
  scenarioEditWrite,
  scenariosHoldingRole,
  type ScenarioEdit,
} from "./scenarioEdit";

vi.mock("../wakala/mcp");

const scenario: Scenario = {
  id: "s1",
  name: "Buy now",
  summary: "Asked once",
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
    {
      id: "a2",
      name: "Supplier 1",
      kind: "role",
      roleId: "role-supplier",
      roleName: "Supplier",
      builtIn: false,
    },
    {
      id: "",
      name: "System",
      kind: "system",
      roleId: "",
      roleName: "",
      builtIn: true,
    },
  ],
  blocks: [
    {
      stepId: "st1",
      code: "ask",
      title: "Ask",
      kind: "form",
      action: "",
      actor: "Farmer 1",
      then: "",
      endpoint: "",
      fields: [
        { prompt: "Product", free: false, value: "Urea" },
        { prompt: "Bags", free: true, value: "" },
      ],
    },
  ],
  last: null,
};

const unchanged: ScenarioEdit = {
  name: "Buy now",
  summary: "Asked once",
  actors: [
    { id: "a1", name: "Farmer 1", roleId: "role-farmer" },
    { id: "a2", name: "Supplier 1", roleId: "role-supplier" },
  ],
  inputs: [{ stepId: "st1", field: "Product", value: "Urea" }],
};

const write = (edit: ScenarioEdit) => scenarioEditWrite(scenario, edit);

describe("saving an edited scenario", () => {
  it("is one agency_update_scenario write, which sends the scenario back to Not run yet", () => {
    expect(write(unchanged)).toEqual({
      kind: "agency_update_scenario",
      summary: "Change the scenario Buy now",
      payload: {
        scenario_id: "s1",
        name: "Buy now",
        summary: "Asked once",
        workflow_id: "w1",
      },
    });
  });

  it("never touches the runs, so the old run stays in its Runs", () => {
    expect(
      write({ ...unchanged, name: "Buy now again", actors: [], inputs: [] })
        .kind,
    ).not.toMatch(/run|test_run/);
  });

  it("sends the trimmed name and summary", () => {
    expect(
      write({ ...unchanged, name: "  Buy later ", summary: " Twice " }).payload,
    ).toMatchObject({ name: "Buy later", summary: "Twice" });
  });

  it("leaves actors and inputs out when neither tab changed", () => {
    const { payload } = write(unchanged);

    expect(payload).not.toHaveProperty("actors");
    expect(payload).not.toHaveProperty("inputs");
  });

  it("leaves actors and inputs out when they are not given", () => {
    const { payload } = write({ name: "Buy now", summary: "Asked once" });

    expect(payload).not.toHaveProperty("actors");
    expect(payload).not.toHaveProperty("inputs");
  });

  it("sends the complete actor list when an actor is renamed, and no inputs", () => {
    const { payload } = write({
      ...unchanged,
      actors: [
        { id: "a1", name: " Farmer One ", roleId: "role-farmer" },
        unchanged.actors![1],
      ],
    });

    expect(payload.actors).toEqual([
      { id: "a1", name: "Farmer One", role_id: "role-farmer" },
      { id: "a2", name: "Supplier 1", role_id: "role-supplier" },
    ]);
    expect(payload).not.toHaveProperty("inputs");
  });

  it("sends the list without an actor that was taken out, and a new actor without an id", () => {
    const { payload } = write({
      ...unchanged,
      actors: [
        unchanged.actors![0],
        { id: "", name: "Buyer 1", roleId: "role-buyer" },
      ],
    });

    expect(payload.actors).toEqual([
      { id: "a1", name: "Farmer 1", role_id: "role-farmer" },
      { name: "Buyer 1", role_id: "role-buyer" },
    ]);
  });

  it("sends an empty list when every actor was taken out", () => {
    expect(write({ ...unchanged, actors: [] }).payload.actors).toEqual([]);
  });

  it("sends an actor whose role changed in the same list", () => {
    const { payload } = write({
      ...unchanged,
      actors: [
        { id: "a1", name: "Farmer 1", roleId: "role-buyer" },
        unchanged.actors![1],
      ],
    });

    expect(payload.actors).toEqual([
      { id: "a1", name: "Farmer 1", role_id: "role-buyer" },
      { id: "a2", name: "Supplier 1", role_id: "role-supplier" },
    ]);
  });

  it("leaves out an added actor that has no name yet, and sends nothing when that is the only difference", () => {
    const { payload } = write({
      ...unchanged,
      actors: [
        ...unchanged.actors!,
        { id: "", name: "  ", roleId: "role-buyer" },
      ],
    });

    expect(payload).not.toHaveProperty("actors");
  });

  it("sends the complete set of fixed inputs when the Blocks tab changed, and no actors", () => {
    const { payload } = write({
      ...unchanged,
      inputs: [
        { stepId: "st1", field: "Product", value: "Urea" },
        { stepId: "st1", field: "Bags", value: " 5 bags " },
      ],
    });

    expect(payload.inputs).toEqual([
      { step_id: "st1", field: "Product", value: "Urea" },
      { step_id: "st1", field: "Bags", value: "5 bags" },
    ]);
    expect(payload).not.toHaveProperty("actors");
  });

  it("leaves a field out of the set when its value was emptied, which frees it", () => {
    const { payload } = write({
      ...unchanged,
      inputs: [{ stepId: "st1", field: "Product", value: "  " }],
    });

    expect(payload.inputs).toEqual([]);
  });

  it("leaves inputs out when only the spacing around a value differs", () => {
    expect(
      write({
        ...unchanged,
        inputs: [{ stepId: "st1", field: "Product", value: " Urea " }],
      }).payload,
    ).not.toHaveProperty("inputs");
  });

  it("sends actors and inputs together when both tabs changed", () => {
    const { payload } = write({
      ...unchanged,
      actors: [unchanged.actors![0]],
      inputs: [{ stepId: "st1", field: "Bags", value: "5 bags" }],
    });

    expect(payload.actors).toEqual([
      { id: "a1", name: "Farmer 1", role_id: "role-farmer" },
    ]);
    expect(payload.inputs).toEqual([
      { step_id: "st1", field: "Bags", value: "5 bags" },
    ]);
  });

  it("throws when the name is empty", () => {
    expect(() => write({ ...unchanged, name: "  " })).toThrow();
  });

  it("throws when two actors share a name, whatever the case, or one is named like a built-in", () => {
    expect(() =>
      write({
        ...unchanged,
        actors: [
          unchanged.actors![0],
          { id: "a2", name: " farmer 1 ", roleId: "role-supplier" },
        ],
      }),
    ).toThrow();
    expect(() =>
      write({
        ...unchanged,
        actors: [{ id: "", name: "system", roleId: "role-buyer" }],
      }),
    ).toThrow();
  });
});

describe("proposing an edited scenario", () => {
  beforeEach(() => {
    vi.mocked(callTool).mockReset();
    vi.mocked(callTool).mockImplementation((async (_hub: string, tool: string) =>
      tool === "agency_list_drafts" ? { items: [{ id: "d1", status: "open" }] } : {}) as never);
  });

  it("makes one proposal for the whole save, however many actors and inputs changed", async () => {
    const edit: ScenarioEdit = {
      ...unchanged,
      actors: [
        unchanged.actors![0],
        { id: "", name: "Buyer 1", roleId: "role-buyer" },
      ],
      inputs: [{ stepId: "st1", field: "Bags", value: "5 bags" }],
    };

    const result = await saveEditScenario("h1", scenario, edit);

    expect(result).toBe("done");
    const writes = vi.mocked(callTool).mock.calls.filter(([, tool]) => tool === "agency_update_scenario");
    expect(writes).toHaveLength(1);
    const [hubId, tool, args] = writes[0];
    expect([hubId, tool]).toEqual(["h1", "agency_update_scenario"]);
    expect(args).toEqual({
      draft_id: "d1",
      scenario_id: "s1",
      name: "Buy now",
      summary: "Asked once",
      workflow_id: "w1",
      actors: [
        { id: "a1", name: "Farmer 1", role_id: "role-farmer" },
        { name: "Buyer 1", role_id: "role-buyer" },
      ],
      inputs: [{ step_id: "st1", field: "Bags", value: "5 bags" }],
    });
  });

  it("makes one write for a change to the name alone", async () => {
    await saveEditScenario("h1", scenario, {
      ...unchanged,
      name: "Buy later",
    });

    const writes = vi.mocked(callTool).mock.calls.filter(([, tool]) => tool === "agency_update_scenario");
    expect(writes).toHaveLength(1);
  });

  it("sends nothing when the name is empty", async () => {
    await expect(
      saveEditScenario("h1", scenario, { ...unchanged, name: "  " }),
    ).rejects.toThrow();

    expect(callTool).not.toHaveBeenCalled();
  });

  it("sends nothing when two actors share a name, whatever the case", async () => {
    const edit = {
      ...unchanged,
      actors: [
        unchanged.actors![0],
        { id: "a2", name: " farmer 1 ", roleId: "role-supplier" },
      ],
    };

    await expect(saveEditScenario("h1", scenario, edit)).rejects.toThrow();

    expect(callTool).not.toHaveBeenCalled();
  });
});

describe("actor names in one scenario", () => {
  it("are duplicates when two match after trimming and ignoring case", () => {
    expect(
      duplicateActorName([{ name: "Farmer 1" }, { name: " farmer 1 " }], []),
    ).toBe(true);
  });

  it("are not duplicates when different", () => {
    expect(
      duplicateActorName([{ name: "Farmer 1" }, { name: "Farmer 2" }], []),
    ).toBe(false);
  });

  it("count the built-in agents and the System", () => {
    expect(
      duplicateActorName([{ name: "system" }], ["System", "Farmers' agent"]),
    ).toBe(true);
  });

  it("let blank names stand until they are filled in", () => {
    expect(duplicateActorName([{ name: "" }, { name: " " }], [])).toBe(false);
  });
});

describe("a role a scenario uses", () => {
  const other: Scenario = {
    ...scenario,
    id: "s2",
    name: "Cancel",
    actors: [scenario.actors[1], scenario.actors[2]],
  };

  it("names the scenarios that hold it, so removing the role is refused", () => {
    expect(scenariosHoldingRole([scenario, other], "role-supplier")).toEqual([
      "Buy now",
      "Cancel",
    ]);
    expect(scenariosHoldingRole([scenario, other], "role-farmer")).toEqual([
      "Buy now",
    ]);
  });

  it("is free to remove when no scenario holds it", () => {
    expect(scenariosHoldingRole([scenario, other], "role-buyer")).toEqual([]);
  });

  it("does not count the built-in actors, which hold no role", () => {
    expect(scenariosHoldingRole([scenario], "")).toEqual([]);
  });
});

describe("the endpoint of a block", () => {
  it("is sent as the complete set when the designer changed one", () => {
    const { payload } = scenarioEditWrite(scenario, {
      ...unchanged,
      endpoints: [{ stepId: "st1", endpoint: " comm_notify " }],
    });

    expect(payload.endpoints).toEqual([
      { step_id: "st1", endpoint: "comm_notify" },
    ]);
  });

  it("is left out when it matches what the block holds", () => {
    expect(
      scenarioEditWrite(scenario, { ...unchanged, endpoints: [] }).payload,
    ).not.toHaveProperty("endpoints");
  });
});
