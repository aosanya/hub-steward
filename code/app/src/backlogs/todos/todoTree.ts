export type TodoState = "todo" | "progress" | "done" | "blocked";

export type Todo = {
  id: string;
  number: number;
  title: string;
  status: string;
  waitsOn: string[];
  blockedReason: string;
};

export type TodoRowData = { todo: Todo; depth: number; waitsOn: number[]; reason: string };

export type TodoCount = { done: number; total: number };

const states: Record<string, TodoState> = { pending: "todo", dispatched: "progress", completed: "done", blocked: "blocked", failed: "blocked" };

export const statusOf = (status: unknown): TodoState => states[String(status)] ?? "todo";

export const countOf = (todos: Todo[]): TodoCount => ({ done: todos.filter((one) => statusOf(one.status) === "done").length, total: todos.length });

const pieces = (n: number) => `${n} ${n === 1 ? "piece" : "pieces"}`;

export function treeOf(todos: Todo[]): TodoRowData[] {
  const position = new Map(todos.map((one, at) => [one.id, at]));
  const byId = new Map(todos.map((one) => [one.id, one]));
  const known = (one: Todo) => one.waitsOn.filter((id) => byId.has(id) && id !== one.id);
  const parentOf = (one: Todo) => known(one).reduce<string | null>((last, id) => (last === null || position.get(id)! > position.get(last)! ? id : last), null);
  const children = new Map<string, Todo[]>();
  const roots: Todo[] = [];
  todos.forEach((one) => {
    const parent = parentOf(one);
    if (parent === null) roots.push(one);
    else children.set(parent, [...(children.get(parent) ?? []), one]);
  });
  const rowOf = (one: Todo, depth: number): TodoRowData => {
    const waitsOn = known(one).map((id) => byId.get(id)!.number).sort((a, b) => a - b);
    const open = known(one).filter((id) => statusOf(byId.get(id)!.status) !== "done").length;
    const typed = one.blockedReason.trim();
    const derived = statusOf(one.status) === "blocked" && open > 0 ? `waits on ${pieces(open)}` : "";
    return { todo: one, depth, waitsOn, reason: statusOf(one.status) === "blocked" ? typed || derived : "" };
  };
  const seen = new Set<string>();
  const rows: TodoRowData[] = [];
  const walk = (one: Todo, depth: number) => {
    if (seen.has(one.id)) return;
    seen.add(one.id);
    rows.push(rowOf(one, depth));
    (children.get(one.id) ?? []).forEach((child) => walk(child, depth + 1));
  };
  roots.forEach((one) => walk(one, 0));
  todos.forEach((one) => walk(one, 0));
  return rows;
}
