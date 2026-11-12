import type { TodoCounts } from "./todoPill";

export type TodoCountsClient = {
  counts: (issueIds: string[]) => Promise<TodoCounts>;
};

export const unwiredTodoCounts: TodoCountsClient = {
  async counts() {
    throw new Error("the todo counts tool is not wired");
  },
};
