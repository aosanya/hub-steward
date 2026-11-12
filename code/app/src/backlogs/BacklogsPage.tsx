import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { useLoad } from "../forms/useLoad";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Sheet } from "../ui/Sheet";
import { addSmartBacklogPath, smartBacklogPath } from "../smartBacklog/paths";
import { EmptyCard, LoadFailed } from "../ui/LoadState";
import { ListRow, Rows } from "../ui/ListRow";
import { Shell } from "../ui/Shell";
import { useOnceNotice } from "../ui/onceNotice";
import { allIssuesId, issuesHeld, mcpBacklogsClient, type BacklogsClient } from "./api";
import { addBacklogPath, useMayManage, type BacklogManageClient } from "../backlogManage";
import { mcpBacklogManageClient } from "../backlogManage/api";
import { nothingSharedWords } from "./access";
import { StepBubbles } from "./StepBubbles";
import { stepTotals, type StepCount } from "./stepCounts";
import { boardPath, issuesPath } from "./paths";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

type Props = { client?: BacklogsClient; manage?: BacklogManageClient };

export function BacklogsPage({ client = mcpBacklogsClient, manage = mcpBacklogManageClient }: Props) {
  const navigate = useNavigate();
  const notice = useOnceNotice();
  const [adding, setAdding] = useState(false);
  const backlogs = useLoad(() => client.backlogs(), `backlogs:${openAgencyId()}`);
  const mayManage = useMayManage(manage);
  const rows = backlogs.state === "ready" ? backlogs.data : [];
  const issues = issuesHeld(rows);
  const smarts = rows.filter((one) => one.kind === "smart");
  const smartCounts = useLoad(() => (client.smartCounts ? client.smartCounts(smarts) : Promise.resolve<Record<string, StepCount[]>>({})), `backlogs-smart-counts:${openAgencyId()}:${smarts.map((one) => one.id).join(",")}:${backlogs.state}`);
  const smartCountsOf = (id: string) => (smartCounts.state === "ready" ? smartCounts.data[id] ?? [] : []);
  return (
    <Shell title="Backlogs">
      {notice ? <p role="status" className="sub">{notice}</p> : null}
      {backlogs.state === "error" ? <LoadFailed words="The backlogs could not be loaded." /> : null}
      {backlogs.state === "ready" && rows.length === 0 ? <EmptyCard words={nothingSharedWords} /> : null}
      {backlogs.state === "ready" && rows.length > 0 ? (
        <Rows>
          <ListRow title="All issues" meta={plural(issues, "issue")} below={<StepBubbles counts={stepTotals(rows)} />} end="›" onClick={() => navigate(issuesPath(allIssuesId))} />
          {rows.map((one) =>
            one.kind === "smart" ? (
              <ListRow key={one.id} title={one.name} meta={plural(one.issues, "issue")} below={<StepBubbles counts={smartCountsOf(one.id)} />} end={<><Chip tone="info">Smart</Chip> ›</>} onClick={() => navigate(smartBacklogPath(one.id))} />
            ) : (
              <ListRow key={one.id} title={one.name} meta={`${plural(one.steps.length, "step")} · ${plural(one.issues, "issue")}`} below={<StepBubbles counts={one.counts ?? []} />} end="›" onClick={() => navigate(boardPath(one.id))} />
            ),
          )}
        </Rows>
      ) : null}
      {backlogs.state === "ready" && mayManage.state === "ready" && mayManage.data ? (
        <Button onClick={() => setAdding(true)}>Add a backlog</Button>
      ) : null}
      {backlogs.state === "ready" && rows.length > 0 && issues === 0 && mayManage.state === "ready" && mayManage.data ? (
        <EmptyCard words="No backlog yet">
          <p>Run the loader on your laptop to load the boards</p>
        </EmptyCard>
      ) : null}
      {adding ? (
        <Sheet title="Add a backlog" onClose={() => setAdding(false)}>
          <Rows>
            <ListRow title="Backlog with steps" end="›" onClick={() => navigate(addBacklogPath())} />
            <ListRow title="Smart backlog" end="›" onClick={() => navigate(addSmartBacklogPath())} />
          </Rows>
        </Sheet>
      ) : null}
    </Shell>
  );
}
