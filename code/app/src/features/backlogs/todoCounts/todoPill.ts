export type TodoCount = { done: number; total: number };

export type TodoCounts = Record<string, TodoCount>;

export type TodoPill = { label: string; title: string };

const whole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

const usable = (count: unknown): count is TodoCount => {
  const { done, total } = (count ?? {}) as Partial<TodoCount>;
  return whole(done) && whole(total) && total > 0 && done <= total;
};

export const todoPillOf = (count: TodoCount | undefined): TodoPill | null =>
  usable(count) ? { label: `${count.done} of ${count.total}`, title: `${count.done} of ${count.total} ${count.total === 1 ? "todo" : "todos"} done` } : null;

export const todoCountsOf = (reply: unknown): TodoCounts =>
  reply && typeof reply === "object" && !Array.isArray(reply)
    ? Object.fromEntries(Object.entries(reply).filter(([id, count]) => id !== "" && usable(count)).map(([id, count]) => [id, { done: (count as TodoCount).done, total: (count as TodoCount).total }]))
    : {};
