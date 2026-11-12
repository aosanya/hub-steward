import { callTool } from "../../wakala/mcp";
import type { Todo } from "./todoTree";

export const todoTools = {
  list: "taskmanager_task_todo_list_for_issue",
  create: "taskmanager_task_todo_create",
  update: "taskmanager_task_todo_update",
  reorder: "taskmanager_task_todo_reorder",
  remove: "taskmanager_task_todo_delete",
  setStatus: "taskmanager_task_todo_set_status",
};

export type SettableStatus = "To do" | "In progress" | "Done";

export type TodoWrites = {
  add: (issueId: string, title: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  setWaitsOn: (id: string, waitsOn: string[]) => Promise<void>;
  setStatus: (id: string, status: SettableStatus) => Promise<void>;
  block: (id: string, reason: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (issueId: string, ids: string[]) => Promise<void>;
};

export type TodosClient = {
  list: (issueId: string) => Promise<Todo[]>;
} & Partial<TodoWrites>;

export const writesOf = (client: TodosClient): TodoWrites | null =>
  client.add && client.rename && client.setWaitsOn && client.setStatus && client.block && client.remove && client.reorder ? (client as TodoWrites) : null;

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
  async add(issueId, title) {
    await callTool("", todoTools.create, { parent_task_id: issueId, title, instructions: title });
  },
  async rename(id, title) {
    await callTool("", todoTools.update, { todoID: id, title });
  },
  async setWaitsOn(id, waitsOn) {
    await callTool("", todoTools.update, { todoID: id, depends_on: waitsOn });
  },
  async setStatus(id, status) {
    await callTool("", todoTools.setStatus, { todoID: id, status });
  },
  async block(id, reason) {
    await callTool("", todoTools.setStatus, { todoID: id, status: "Blocked", blocked_reason: reason });
  },
  async remove(id) {
    await callTool("", todoTools.remove, { todoID: id });
  },
  async reorder(issueId, ids) {
    await callTool("", todoTools.reorder, { taskID: issueId, ids });
  },
};
