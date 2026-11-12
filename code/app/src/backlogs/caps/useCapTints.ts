import { useEffect, useMemo, useState } from "react";
import type { Issue } from "../api";
import { listCap, settled } from "../api";
import { mcpCapsClient, type CapNearest, type CapsClient } from "./api";
import { interruptedTint, strongerTint, tintOfElapsed, tintOfNearest, type CapTint } from "./capTint";
import { elapsedSeconds } from "./elapsed";

export const capsRefreshMs = 15_000;

const running = (issue: Issue) => issue.status === "in_progress";

const stoppedAtCap = (issue: Issue) => issue.topics.includes("Sinbin");

export const holdsFigures = (issue: Issue) => !settled.has(issue.status) && (running(issue) || stoppedAtCap(issue));

export type CapTints = Record<string, CapTint>;

type Reading = Record<string, CapNearest>;

export function useCapTints(issues: Issue[], client: CapsClient = mcpCapsClient): CapTints {
  const [nearest, setNearest] = useState<Reading>({});
  const [now, setNow] = useState(() => Date.now());
  const asked = issues.filter(holdsFigures);
  const idsKey = asked
    .slice(0, listCap)
    .map((issue) => issue.id)
    .join(",");
  const runningKey = asked
    .filter(running)
    .map((issue) => issue.id)
    .join(",");
  const refreshes = runningKey !== "";
  const ids = useMemo(() => (idsKey === "" ? [] : idsKey.split(",")), [idsKey]);
  useEffect(() => {
    if (ids.length === 0) {
      setNearest({});
      return;
    }
    let live = true;
    const read = () =>
      client.nearest(ids).then(
        (reading) => live && setNearest(reading),
        () => undefined,
      );
    read();
    const timer = refreshes ? setInterval(read, capsRefreshMs) : undefined;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
  }, [ids, refreshes, client]);
  useEffect(() => {
    if (!refreshes) return;
    const timer = setInterval(() => setNow(Date.now()), capsRefreshMs);
    return () => clearInterval(timer);
  }, [refreshes]);
  return useMemo(() => {
    const tints: CapTints = {};
    const runningIds = new Set(runningKey === "" ? [] : runningKey.split(","));
    for (const id of ids) {
      const found = nearest[id];
      if (!found) continue;
      if (found.interrupted) {
        tints[id] = interruptedTint;
        continue;
      }
      const stored = found.ratio > 0 ? tintOfNearest(found) : null;
      const clocked = runningIds.has(id) && found.startedAt !== undefined && found.runtimeSeconds ? tintOfElapsed(elapsedSeconds(found.startedAt, now), found.runtimeSeconds) : null;
      const tint = strongerTint(stored, clocked);
      if (tint) tints[id] = tint;
    }
    return tints;
  }, [ids, nearest, now, runningKey]);
}
