import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { mcpAgencyClient, type AgencyClient } from "../agency/modules";
import { openAgencyId } from "../agency/open";
import { useLoad } from "../forms/useLoad";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Sheet } from "../ui/Sheet";
import { addSmartBacklogPath, smartBacklogPath } from "../smartBacklog/paths";
import { EmptyCard, LoadFailed } from "../ui/LoadState";
import { ListRow, Rows } from "../ui/ListRow";
import { Shell } from "../ui/Shell";
import { allIssuesId, issuesHeld, mcpBacklogsClient, type BacklogsClient } from "./api";
import { addBacklogPath, useMayManage, type BacklogManageClient } from "../backlogManage";
import { mcpBacklogManageClient } from "../backlogManage/api";
import { nothingSharedWords } from "./access";
import { boardPath, issuesPath } from "./paths";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

type Props = { client?: BacklogsClient; agency?: AgencyClient; manage?: BacklogManageClient };

export function BacklogsPage({ client = mcpBacklogsClient, agency = mcpAgencyClient, manage = mcpBacklogManageClient }: Props) {
  const navigate = useNavigate();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const [adding, setAdding] = useState(false);
  const backlogs = useLoad(() => client.backlogs(), `backlogs:${openAgencyId()}`);
  const named = useLoad(() => agency.read(), `backlogs-agency:${openAgencyId()}`);
  const mayManage = useMayManage(manage);
  const rows = backlogs.state === "ready" ? backlogs.data : [];
  const issues = issuesHeld(rows);
  return (
    <Shell title="Backlogs" sub={named.state === "ready" && named.data.name ? named.data.name : undefined}>
      {notice ? <p role="status" className="sub">{notice}</p> : null}
      {backlogs.state === "error" ? <LoadFailed words="The backlogs could not be loaded." /> : null}
      {backlogs.state === "ready" && rows.length === 0 ? <EmptyCard words={nothingSharedWords} /> : null}
      {backlogs.state === "ready" && rows.length > 0 ? (
        <Rows>
          <ListRow title="All issues" meta={plural(issues, "issue")} end="›" onClick={() => navigate(issuesPath(allIssuesId))} />
          {rows.map((one) =>
            one.kind === "smart" ? (
              <ListRow key={one.id} title={one.name} meta={plural(one.issues, "issue")} end={<><Chip tone="info">Smart</Chip> ›</>} onClick={() => navigate(smartBacklogPath(one.id))} />
            ) : (
              <ListRow key={one.id} title={one.name} meta={`${plural(one.steps.length, "step")} · ${plural(one.issues, "issue")}`} end="›" onClick={() => navigate(boardPath(one.id))} />
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
