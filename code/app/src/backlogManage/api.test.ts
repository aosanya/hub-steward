import { McpError } from "../wakala/mcp";
import { allowedIn, backlogTools,  detailOf, mcpBacklogManageClient, refusalText } from "./api";
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

  it("saves in a safe order: rename, add, remove last, then the new order", async () => {
    answer = async (_hub, name, args) => {
      if (name === backlogTools.list) return { items: [summary([["a", "To do", 0], ["b", "Doing", 0], ["c", "Done", 0]])] };
      if (name === backlogTools.addStep) return summary([["a", "To do", 0], ["r", args.name, 0], ["b", "Doing", 0], ["c", "Done", 0]]);
      if (name === backlogTools.removeStep) return summary([["a", "To do", 0], ["r", "Review", 0], ["c", "Done", 0]]);
      return summary([]);
    };
    await mcpBacklogManageClient.save("software", "Engineering", [savedStep("a", "To do", 0), { key: "n", id: "", name: "Review", held: 0 }, savedStep("c", "Done", 0)]);
    expect(calls().slice(1)).toEqual([
      [backlogTools.rename, { backlogID: "software", name: "Engineering" }],
      [backlogTools.addStep, { backlogID: "software", name: "Review", after: "a" }],
      [backlogTools.removeStep, { backlogID: "software", stepID: "b" }],
    ]);
  });

  it("never passes through zero steps when every step is replaced", async () => {
    let steps: [string, string, number][] = [["a", "Open", 0]];
    answer = async (_hub, name, args) => {
      if (name === backlogTools.list) return { items: [summary(steps)] };
      if (name === backlogTools.addStep) steps = [...steps, ["z", args.name, 0]];
      if (name === backlogTools.removeStep) steps = steps.filter(([id]) => id !== args.stepID);
      expect(steps.length).toBeGreaterThan(0);
      return summary(steps);
    };
    await mcpBacklogManageClient.save("software", "Software", [{ key: "n", id: "", name: "New", held: 0 }]);
    expect(calls().slice(1).map(([name]) => name)).toEqual([backlogTools.addStep, backlogTools.removeStep]);
  });

  it("adds a step at the end without a reorder call", async () => {
    answer = async (_hub, name, args) => {
      if (name === backlogTools.list) return { items: [summary([["a", "To do", 0]])] };
      if (name === backlogTools.addStep) return summary([["a", "To do", 0], ["z", args.name, 0]]);
      return summary([]);
    };
    await mcpBacklogManageClient.save("software", "Software", [savedStep("a", "To do", 0), { key: "n", id: "", name: "Done", held: 0 }]);
    expect(calls().slice(1)).toEqual([[backlogTools.addStep, { backlogID: "software", name: "Done", after: "a" }]]);
  });

  it("says what was saved and which step failed when a later call is refused", async () => {
    answer = async (_hub, name, args) => {
      if (name === backlogTools.list) return { items: [summary([["a", "To do", 0], ["b", "Doing", 2]])] };
      if (name === backlogTools.addStep) return summary([["a", "To do", 0], ["b", "Doing", 2], ["z", args.name, 0]]);
      if (name === backlogTools.removeStep) throw new McpError("taskmanager_backlog_step_remove: step holds issues: Doing");
      return summary([]);
    };
    let words = "";
    try {
      await mcpBacklogManageClient.save("software", "Engineering", [savedStep("a", "To do", 0), { key: "n", id: "", name: "Review", held: 0 }]);
    } catch (error) {
      words = (error as Error).message;
    }
    expect(words).toBe("Could not remove Doing: step holds issues: Doing Saved so far: renamed the backlog, added Review.");
  });

  it("reads the refusal without the tool name", () => {
    expect(refusalText(new McpError("taskmanager_backlog_delete: backlog holds issues: Software"))).toBe("backlog holds issues: Software");
    expect(refusalText(new Error("other"))).toBe("");
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
