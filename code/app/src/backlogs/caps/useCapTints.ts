import { useEffect, useMemo, useState } from "react";
import type { Issue } from "../api";
import { listCap, settled } from "../api";
import { mcpCapsClient, type CapsClient } from "./api";
import { tintOfNearest, type CapTint } from "./capTint";

export const capsRefreshMs = 15_000;

const running = (issue: Issue) => issue.status === "in_progress";

const stoppedAtCap = (issue: Issue) => issue.topics.includes("Sinbin");

export const holdsFigures = (issue: Issue) => !settled.has(issue.status) && (running(issue) || stoppedAtCap(issue));

export type CapTints = Record<string, CapTint>;

export function useCapTints(issues: Issue[], client: CapsClient = mcpCapsClient): CapTints {
  const [found, setFound] = useState<CapTints>({});
  const asked = issues.filter(holdsFigures);
  const idsKey = asked
    .slice(0, listCap)
    .map((issue) => issue.id)
    .join(",");
  const refreshes = asked.some(running);
  const ids = useMemo(() => (idsKey === "" ? [] : idsKey.split(",")), [idsKey]);
  useEffect(() => {
    if (ids.length === 0) {
      setFound({});
      return;
    }
    let live = true;
    const read = () =>
      client.nearest(ids).then(
        (nearest) => {
          if (!live) return;
          const tints: CapTints = {};
          for (const id of ids) {
            const tint = nearest[id] ? tintOfNearest(nearest[id]) : null;
            if (tint) tints[id] = tint;
          }
          setFound(tints);
        },
        () => undefined,
      );
    read();
    const timer = refreshes ? setInterval(read, capsRefreshMs) : undefined;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
  }, [ids, refreshes, client]);
  return found;
}
