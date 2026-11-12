import { useEffect, useMemo, useState } from "react";
import type { Issue } from "../api";
import { mcpTodoCountsClient, type TodoCountsClient } from "./api";
import type { TodoCounts } from "./todoPill";

export function useTodoCounts(issues: Issue[], client: TodoCountsClient = mcpTodoCountsClient): TodoCounts {
  const [counts, setCounts] = useState<TodoCounts>({});
  const idsKey = issues.map((issue) => issue.id).join(",");
  const ids = useMemo(() => (idsKey === "" ? [] : idsKey.split(",")), [idsKey]);
  useEffect(() => {
    setCounts({});
    if (ids.length === 0) return;
    let live = true;
    client.counts(ids).then(
      (reading) => live && setCounts(reading),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [ids, client]);
  return counts;
}
