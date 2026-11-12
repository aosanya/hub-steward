import { callTool } from "../../wakala/mcp";
import type { Todo } from "./todoTree";

export const todoTools = { list: "taskmanager_task_todo_list_for_issue" };

export type TodosClient = {
  list: (issueId: string) => Promise<Todo[]>;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : Array.isArray(reply?.todos) ? reply.todos : []);

export const todoOf = (raw: any): Todo => ({
  id: text(raw?.id),
  number: typeof raw?.ordinality === "number" ? raw.ordinality : 0,
  title: text(raw?.title),
  status: text(raw?.status),
  waitsOn: Array.isArray(raw?.depends_on) ? raw.depends_on.filter((id: unknown): id is string => typeof id === "string" && id !== "") : [],
  blockedReason: text(raw?.blocked_reason),
});

export const todosOf = (reply: unknown): Todo[] =>
  itemsOf(reply)
    .map(todoOf)
    .filter((one) => one.id !== "")
    .sort((a, b) => a.number - b.number);

export const mcpTodosClient: TodosClient = {
  async list(issueId) {
    return todosOf(await callTool("", todoTools.list, { taskID: issueId }));
  },
};
