import { callTool } from "../../wakala/mcp";
import { itemsOf } from "../api";
import { todoCountsOf, type TodoCounts } from "./todoPill";

export const todoCountTools = {
  counts: "taskmanager_task_todo_count_for_issues",
};

export type TodoCountsClient = {
  counts: (issueIds: string[]) => Promise<TodoCounts>;
};

export const todoCountsOfItems = (reply: unknown): TodoCounts =>
  todoCountsOf(Object.fromEntries(itemsOf(reply).filter((item) => typeof item?.task_id === "string").map((item) => [item.task_id, { done: item.done, total: item.total }])));

export const mcpTodoCountsClient: TodoCountsClient = {
  async counts(issueIds) {
    return todoCountsOfItems(await callTool("", todoCountTools.counts, { task_id: issueIds }));
  },
};
