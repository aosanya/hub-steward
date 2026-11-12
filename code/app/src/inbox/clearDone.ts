import { useEffect, useRef } from "react";
import type { NotificationItem } from "./api";
import { isTaskNotice, mcpReader, stateOf, type Reader } from "./subjectCheck";

export function useClearDone(items: NotificationItem[] | null, markIdsRead: (ids: string[]) => Promise<boolean>, read: Reader = mcpReader) {
  const checked = useRef(new Set<string>());

  useEffect(() => {
    const fresh = (items ?? []).filter((n) => !n.read && isTaskNotice(n) && !checked.current.has(n.id));
    if (fresh.length === 0) return;
    fresh.forEach((n) => checked.current.add(n.id));
    Promise.all(fresh.map(async (n) => ((await stateOf(n, read)) === "done" ? n.id : "")))
      .then((ids) => ids.filter(Boolean))
      .then((done) => (done.length > 0 ? markIdsRead(done) : undefined))
      .catch(() => undefined);
  }, [items]);
}
