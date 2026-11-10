import { useEffect, useState, type ReactNode } from "react";
import { issuesHeld, mcpBacklogsClient, type BacklogsClient } from "../../backlogs/api";
import { BacklogSummariesProvider, type BacklogSummary } from "./summaries";
import { backlogViewKind } from "./views";

type Props = {
  kinds: string[];
  client?: BacklogsClient;
  children: ReactNode;
};

export function BacklogSummariesLoader({ kinds, client = mcpBacklogsClient, children }: Props) {
  const wanted = kinds.includes(backlogViewKind);
  const [backlogs, setBacklogs] = useState<BacklogSummary[]>([]);
  const [ready, setReady] = useState(!wanted);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    client.backlogs().then(
      (found) => {
        if (!live) return;
        setBacklogs(found.map((b) => ({ id: b.id, name: b.name, steps: b.steps.length, issues: b.issues })));
        setReady(true);
      },
      () => {
        if (!live) return;
        setBacklogs([]);
        setReady(true);
      },
    );
    return () => {
      live = false;
    };
  }, [wanted]);
  const totals = backlogs.length === 0 ? null : { issues: issuesHeld(backlogs) };
  return (
    <BacklogSummariesProvider backlogs={backlogs} totals={totals} ready={ready}>
      {children}
    </BacklogSummariesProvider>
  );
}
