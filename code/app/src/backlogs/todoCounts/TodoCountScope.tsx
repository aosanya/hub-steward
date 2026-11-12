import { createContext, useContext, type ReactNode } from "react";
import type { Issue } from "../api";
import type { TodoCountsClient } from "./api";
import type { TodoCount, TodoCounts } from "./todoPill";
import { useTodoCounts } from "./useTodoCounts";

const TodoCountsContext = createContext<TodoCounts>({});

type Props = { issues: Issue[]; client?: TodoCountsClient; children: ReactNode };

export function TodoCountScope({ issues, client, children }: Props) {
  return <TodoCountsContext.Provider value={useTodoCounts(issues, client)}>{children}</TodoCountsContext.Provider>;
}

export const useTodoCountOf = (issueId: string): TodoCount | undefined => useContext(TodoCountsContext)[issueId];
