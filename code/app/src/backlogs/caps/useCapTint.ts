import { useEffect, useState } from "react";
import type { Issue } from "../api";
import { settled } from "../api";
import { mcpCapsClient, type CapsClient } from "./api";
import { tintOf, type CapTint } from "./capTint";

export const capsRefreshMs = 15_000;

const running = (issue: Issue) => issue.status === "in_progress";

const stoppedAtCap = (issue: Issue) => issue.topics.includes("Sinbin");

export const holdsFigures = (issue: Issue) => !settled.has(issue.status) && (running(issue) || stoppedAtCap(issue));

export function useCapTint(issue: Issue, client: CapsClient = mcpCapsClient): CapTint | null {
  const [found, setFound] = useState<CapTint | null>(null);
  const reads = holdsFigures(issue);
  const refreshes = reads && running(issue);
  const id = issue.id;
  useEffect(() => {
    if (!reads) {
      setFound(null);
      return;
    }
    let live = true;
    const read = () =>
      client.read(id).then(
        (reading) => live && setFound(tintOf(reading)),
        () => undefined,
      );
    read();
    const timer = refreshes ? setInterval(read, capsRefreshMs) : undefined;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
  }, [id, reads, refreshes, client]);
  return found;
}
