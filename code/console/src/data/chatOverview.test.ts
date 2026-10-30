import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, listTools } from "../wakala/mcp";
import { objectivesOverview } from "./chatOverview";
import { readObjectivesTool } from "./chatTools";
import { askModel, chatTool } from "./modelChat";

vi.mock("../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  callTool: vi.fn(),
  listTools: vi.fn(),
}));

const callToolMock = vi.mocked(callTool);
const listToolsMock = vi.mocked(listTools);

const agency: Record<string, unknown> = {
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_goals: { items: [{ id: "g1", code: "G-1", title: "Markets" }] },
  agency_list_objectives: {
    items: [
      {
        id: "o1",
        code: "O-1",
        title: "Sell produce",
        description: "Sell what is grown.",
        goal_id: "g1",
      },
      {
        id: "o2",
        code: "O-2",
        title: "Buy inputs",
        description: "",
        goal_id: "g1",
      },
    ],
  },
  agency_list_roles: {
    items: [
      { id: "r1", name: "Farmer" },
      { id: "r2", name: "Coordinator" },
    ],
  },
  agency_list_role_assignments: {
    items: [
      { work_item_id: "s1", role_id: "r1", label: "Responsible" },
      { work_item_id: "s1", role_id: "r2", label: "Accountable" },
      { work_item_id: "s2", role_id: "r2", label: "Responsible" },
      { work_item_id: "s3", role_id: "r1", label: "Informed" },
    ],
  },
  agency_list_workflows: {
    items: [
      { id: "w1", name: "Group order" },
      { id: "w2", name: "Input pooling" },
      { id: "w3", name: "Unlinked" },
    ],
  },
  agency_list_work_items: {
    items: [
      { id: "s1", workflow_id: "w1" },
      { id: "s2", workflow_id: "w2" },
      { id: "s3", workflow_id: "w3" },
    ],
  },
  agency_list_workflow_objectives: {
    items: [
      { workflow_id: "w1", objective_id: "o1" },
      { workflow_id: "w2", objective_id: "o2" },
    ],
  },
};

const calls = (name: string) =>
  callToolMock.mock.calls.filter((call) => call[1] === name);

beforeEach(() => {
  callToolMock.mockReset();
  listToolsMock.mockReset();
  callToolMock.mockImplementation(
    async (_hub: string, name: string) => agency[name] ?? { items: [] },
  );
});

describe("the objectives read in one call", () => {
  it("returns every objective with its goal, the roles on the steps of its workflows and those workflows, reading each list once", async () => {
    const all = (await objectivesOverview("h1")) as {
      objectives: Record<string, unknown>[];
    };

    expect(all.objectives).toEqual([
      {
        id: "o1",
        code: "O-1",
        title: "Sell produce",
        description: "Sell what is grown.",
        goal: "G-1 Markets",
        roles: { responsible: ["Farmer"], accountable: ["Coordinator"] },
        workflows: ["Group order"],
      },
      {
        id: "o2",
        code: "O-2",
        title: "Buy inputs",
        description: "",
        goal: "G-1 Markets",
        roles: { responsible: ["Coordinator"] },
        workflows: ["Input pooling"],
      },
    ]);
    expect(calls("agency_list_role_assignments")).toHaveLength(1);
    expect(calls("agency_list_objectives")).toHaveLength(1);
    expect(calls("agency_list_workflow_objectives")).toHaveLength(1);
  });

  it("gives an objective no workflow delivers no roles and no workflows", async () => {
    callToolMock.mockImplementation(async (_hub: string, name: string) =>
      name === "agency_list_workflow_objectives"
        ? { items: [] }
        : (agency[name] ?? { items: [] }),
    );

    const all = (await objectivesOverview("h1")) as {
      objectives: Record<string, unknown>[];
    };

    expect(all.objectives.map((objective) => [objective.roles, objective.workflows])).toEqual([
      [{}, []],
      [{}, []],
    ]);
  });

  it("returns only the objectives asked for, by code or id", async () => {
    const some = (await objectivesOverview("h1", {
      objectives: ["o-2", "o1"],
    })) as { objectives: { code: string }[] };

    expect(some.objectives.map((objective) => objective.code)).toEqual([
      "O-1",
      "O-2",
    ]);
    expect(
      (
        (await objectivesOverview("h1", { objectives: ["O-2"] })) as {
          objectives: unknown[];
        }
      ).objectives,
    ).toHaveLength(1);
  });

  it("returns only the objectives where a named role holds a seat", async () => {
    const some = (await objectivesOverview("h1", { roles: ["farmer"] })) as {
      objectives: { code: string }[];
    };

    expect(some.objectives.map((objective) => objective.code)).toEqual(["O-1"]);
  });
});

describe("the chat of the Objectives page", () => {
  const specs = () =>
    (
      callToolMock.mock.calls.find((call) => call[1] === chatTool)?.[2] as {
        tools: { name: string }[];
      }
    ).tools.map((spec) => spec.name);

  beforeEach(() => {
    listToolsMock.mockResolvedValue(
      ["agency_list_objectives", "agency_list_goals"].map((name) => ({
        name,
        description: name,
        inputSchema: {
          type: "object",
          properties: { instance_id: { type: "string" } },
        },
      })),
    );
  });

  it("is offered the one-call read on Objectives and Goals, and runs it with the filter the model gave", async () => {
    const queue: unknown[] = [
      {
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "t1",
              name: readObjectivesTool,
              arguments: { roles: ["Farmer"] },
            },
          ],
        },
      },
      { message: { role: "assistant", content: "Done." } },
    ];
    callToolMock.mockImplementation(async (_hub: string, name: string) =>
      name === chatTool
        ? queue.length > 1
          ? queue.shift()
          : queue[0]
        : (agency[name] ?? { items: [] }),
    );

    const reply = await askModel(
      "h1",
      "a1",
      [{ role: "user", content: "who owns what" }],
      "objectives",
    );

    expect(specs()).toContain(readObjectivesTool);
    expect(reply.calls.map((call) => call.name)).toEqual([readObjectivesTool]);
    expect(calls("agency_list_role_assignments")).toHaveLength(1);
  });

  it("is offered on Goals but not on a page with no objectives", async () => {
    callToolMock.mockImplementation(async (_hub: string, name: string) =>
      name === chatTool
        ? { message: { role: "assistant", content: "ok" } }
        : { items: [] },
    );
    await askModel("h1", "a1", [{ role: "user", content: "hi" }], "goals");
    expect(specs()).toContain(readObjectivesTool);

    callToolMock.mockClear();
    await askModel("h1", "a1", [{ role: "user", content: "hi" }], "roles");
    expect(specs()).not.toContain(readObjectivesTool);
  });
});
