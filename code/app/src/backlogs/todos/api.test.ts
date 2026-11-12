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

  it("pins the name of each edit tool", () => {
    expect(todoTools).toEqual({
      list: "taskmanager_task_todo_list_for_issue",
      create: "taskmanager_task_todo_create",
      update: "taskmanager_task_todo_update",
      reorder: "taskmanager_task_todo_reorder",
      remove: "taskmanager_task_todo_delete",
      setStatus: "taskmanager_task_todo_set_status",
    });
  });
});

describe("the edit calls of the todos client", () => {
  const sent = () => vi.spyOn(mcp, "callTool").mockResolvedValue({});

  it("adds a piece to the end of an issue with its title as the title and the instructions", async () => {
    const call = sent();
    await mcpTodosClient.add!("issue-1", "Check the links");
    expect(call).toHaveBeenCalledWith("", "taskmanager_task_todo_create", { parent_task_id: "issue-1", title: "Check the links", instructions: "Check the links" });
  });

  it("renames a piece by sending only its title", async () => {
    const call = sent();
    await mcpTodosClient.rename!("t4", "Check every link");
    expect(call).toHaveBeenCalledWith("", "taskmanager_task_todo_update", { todoID: "t4", title: "Check every link" });
  });

  it("sets what a piece waits on as the ids of the pieces, an empty list clearing it", async () => {
    const call = sent();
    await mcpTodosClient.setWaitsOn!("t4", ["t1", "t2"]);
    expect(call).toHaveBeenLastCalledWith("", "taskmanager_task_todo_update", { todoID: "t4", depends_on: ["t1", "t2"] });
    await mcpTodosClient.setWaitsOn!("t4", []);
    expect(call).toHaveBeenLastCalledWith("", "taskmanager_task_todo_update", { todoID: "t4", depends_on: [] });
  });

  it("sets To do, In progress or Done by the status words and sends no reason", async () => {
    const call = sent();
    await mcpTodosClient.setStatus!("t4", "In progress");
    expect(call).toHaveBeenLastCalledWith("", "taskmanager_task_todo_set_status", { todoID: "t4", status: "In progress" });
    await mcpTodosClient.setStatus!("t4", "To do");
    expect(call).toHaveBeenLastCalledWith("", "taskmanager_task_todo_set_status", { todoID: "t4", status: "To do" });
  });

  it("marks a piece Blocked with the typed reason", async () => {
    const call = sent();
    await mcpTodosClient.block!("t4", "Waiting for the owner.");
    expect(call).toHaveBeenCalledWith("", "taskmanager_task_todo_set_status", { todoID: "t4", status: "Blocked", blocked_reason: "Waiting for the owner." });
  });

  it("deletes a piece by its id", async () => {
    const call = sent();
    await mcpTodosClient.remove!("t4");
    expect(call).toHaveBeenCalledWith("", "taskmanager_task_todo_delete", { todoID: "t4" });
  });

  it("puts the pieces of an issue in a new order by sending every id first to last", async () => {
    const call = sent();
    await mcpTodosClient.reorder!("issue-1", ["t2", "t1", "t3"]);
    expect(call).toHaveBeenCalledWith("", "taskmanager_task_todo_reorder", { taskID: "issue-1", ids: ["t2", "t1", "t3"] });
  });

  it("lets a refused change fail with the API's message", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("taskmanager_task_todo_update: a piece cannot wait on a piece that waits on it"));
    await expect(mcpTodosClient.setWaitsOn!("t1", ["t2"])).rejects.toThrow("a piece cannot wait on a piece that waits on it");
  });
});
