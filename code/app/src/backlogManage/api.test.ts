import { McpError } from "../wakala/mcp";
import { allowedIn, backlogTools, detailOf, mcpBacklogManageClient } from "./api";
import { savedStep } from "./stepsDraft";
import { ManageRefused } from "./types";

type Answer = (hub: string, name: string, args: any) => Promise<any>;

const recorded: [string, string, any][] = [];

let answer: Answer = async () => ({});

vi.mock("../wakala/mcp", async () => {
  const actual = await vi.importActual<typeof import("../wakala/mcp")>("../wakala/mcp");
  return {
    ...actual,
    callTool: (hub: string, name: string, args: any) => {
      recorded.push([hub, name, args]);
      return answer(hub, name, args);
    },
  };
});

const summary = (steps: [string, string, number][]) => ({ id: "software", name: "Software", issues: 0, steps: steps.map(([id, name, issues]) => ({ id, name, issues })) });

const calls = () => recorded.map(([, name, args]) => [name, args]);

beforeEach(() => {
  recorded.length = 0;
  answer = async () => ({});
});

describe("backlog manage client", () => {
  it("reads a summary into steps with how many issues each holds", () => {
    expect(detailOf(summary([["a", "To do", 2]]))).toEqual({ id: "software", name: "Software", steps: [savedStep("a", "To do", 2)] });
  });

  it("names each tool after its action with the dots turned to underscores", () => {
    expect(backlogTools).toEqual({
      list: "taskmanager_backlog_list",
      create: "taskmanager_backlog_create",
      rename: "taskmanager_backlog_rename",
      remove: "taskmanager_backlog_delete",
      addStep: "taskmanager_backlog_step_add",
      removeStep: "taskmanager_backlog_step_remove",
      reorder: "taskmanager_backlog_step_reorder",
      mayPerform: "permissions_check_read",
    });
  });

  it("reads the permission answer whether it is bare or wrapped", () => {
    expect(allowedIn(true)).toBe(true);
    expect(allowedIn({ allowed: true })).toBe(true);
    expect(allowedIn({ result: true })).toBe(true);
    expect(allowedIn({ result: false })).toBe(false);
    expect(allowedIn({})).toBe(false);
  });

  it("creates a backlog with its steps in order", async () => {
    answer = async () => ({ id: "support" });
    expect(await mcpBacklogManageClient.create("Support", ["New", "Closed"])).toBe("support");
    expect(calls()).toEqual([[backlogTools.create, { name: "Support", steps: ["New", "Closed"] }]]);
  });

  it("saves a rename, a removal, an addition after its neighbour and the new order", async () => {
    answer = async (_hub, name, args) => {
      if (name === backlogTools.list) return { items: [summary([["a", "To do", 0], ["b", "Doing", 0], ["c", "Done", 0]])] };
      if (name === backlogTools.removeStep) return summary([["a", "To do", 0], ["c", "Done", 0]]);
      if (name === backlogTools.addStep) return summary([["a", "To do", 0], ["r", args.name, 0], ["c", "Done", 0]]);
      return summary([]);
    };
    await mcpBacklogManageClient.save("software", "Engineering", [savedStep("a", "To do", 0), { key: "n", id: "", name: "Review", held: 0 }, savedStep("c", "Done", 0)]);
    expect(calls().slice(1)).toEqual([
      [backlogTools.rename, { backlogID: "software", name: "Engineering" }],
      [backlogTools.removeStep, { backlogID: "software", stepID: "b" }],
      [backlogTools.addStep, { backlogID: "software", name: "Review", after: "a" }],
    ]);
  });

  it("reorders when only the order changed", async () => {
    answer = async (_hub, name) => (name === backlogTools.list ? { items: [summary([["a", "To do", 0], ["b", "Doing", 0]])] } : summary([]));
    await mcpBacklogManageClient.save("software", "Software", [savedStep("b", "Doing", 0), savedStep("a", "To do", 0)]);
    expect(calls().slice(1)).toEqual([[backlogTools.reorder, { backlogID: "software", steps: ["b", "a"] }]]);
  });

  it("turns a tool refusal into words without the tool name", async () => {
    answer = async () => {
      throw new McpError("taskmanager_backlog_delete: backlog holds issues: Software");
    };
    let words = "";
    let refusedByClient = false;
    try {
      await mcpBacklogManageClient.remove("software");
    } catch (error) {
      refusedByClient = error instanceof ManageRefused;
      words = (error as Error).message;
    }
    expect(refusedByClient).toBe(true);
    expect(words).toBe("backlog holds issues: Software");
  });
});
