import { useEffect, useState, type ReactNode } from "react";
import { mcpBacklogsClient, type BacklogsClient } from "../../backlogs/api";
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
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    client.backlogs().then(
      (found) => live && setBacklogs(found.map((b) => ({ id: b.id, name: b.name, steps: b.steps.length, issues: b.issues }))),
      () => live && setBacklogs([]),
    );
    return () => {
      live = false;
    };
  }, [wanted]);
  const totals = backlogs.length === 0 ? null : { issues: backlogs.reduce((sum, b) => sum + b.issues, 0) };
  return (
    <BacklogSummariesProvider backlogs={backlogs} totals={totals}>
      {children}
    </BacklogSummariesProvider>
  );
}
