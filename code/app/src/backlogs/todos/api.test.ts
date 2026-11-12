import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../wakala/mcp";
import { mcpTodosClient, todoTools, todosOf } from "./api";

afterEach(() => vi.restoreAllMocks());

const reply = {
  items: [
    { id: "b", ordinality: 2, title: "Second", status: "dispatched", state: "In progress", depends_on: ["a"], blocked_reason: "" },
    { id: "a", ordinality: 1, title: "First", status: "completed", state: "Done" },
    { id: "c", ordinality: 3, title: "Third", status: "blocked", depends_on: ["a", 7, ""], blocked_reason: "Waiting for the owner." },
  ],
  done: 1,
  total: 3,
};

describe("the todos client", () => {
  it("reads the todos of one issue through the list-for-issue tool", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue(reply);
    const todos = await mcpTodosClient.list("issue-1");
    expect(todoTools.list).toBe("taskmanager_task_todo_list_for_issue");
    expect(call).toHaveBeenCalledWith("", "taskmanager_task_todo_list_for_issue", { taskID: "issue-1" });
    expect(todos.map((one) => one.title)).toEqual(["First", "Second", "Third"]);
  });

  it("keeps the number, the status, the ids it waits on and the reason of each todo", () => {
    expect(todosOf(reply)).toEqual([
      { id: "a", number: 1, title: "First", status: "completed", waitsOn: [], blockedReason: "" },
      { id: "b", number: 2, title: "Second", status: "dispatched", waitsOn: ["a"], blockedReason: "" },
      { id: "c", number: 3, title: "Third", status: "blocked", waitsOn: ["a"], blockedReason: "Waiting for the owner." },
    ]);
  });

  it("reads an issue with no todos as an empty list", () => {
    expect(todosOf({ items: [], done: 0, total: 0 })).toEqual([]);
    expect(todosOf(null)).toEqual([]);
  });

  it("lets a failed read fail", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("down"));
    await expect(mcpTodosClient.list("issue-1")).rejects.toThrow("down");
  });
});
