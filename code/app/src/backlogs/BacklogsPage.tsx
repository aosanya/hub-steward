import { useNavigate } from "react-router-dom";
import { mcpAgencyClient, type AgencyClient } from "../agency/modules";
import { openAgencyId } from "../agency/open";
import { useLoad } from "../forms/useLoad";
import { Button } from "../ui/Button";
import { EmptyCard, LoadFailed } from "../ui/LoadState";
import { ListRow, Rows } from "../ui/ListRow";
import { Shell } from "../ui/Shell";
import { chatListPath } from "../routes";
import { allIssuesId, mcpBacklogsClient, type BacklogsClient } from "./api";
import { issuesPath } from "./paths";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function BacklogsPage({ client = mcpBacklogsClient, agency = mcpAgencyClient }: { client?: BacklogsClient; agency?: AgencyClient }) {
  const navigate = useNavigate();
  const backlogs = useLoad(() => client.backlogs(), `backlogs:${openAgencyId()}`);
  const named = useLoad(() => agency.read(), `backlogs-agency:${openAgencyId()}`);
  const rows = backlogs.state === "ready" ? backlogs.data : [];
  const issues = rows.reduce((sum, one) => sum + one.issues, 0);
  return (
    <Shell title="Backlogs" sub={named.state === "ready" && named.data.name ? named.data.name : undefined}>
      {backlogs.state === "error" ? <LoadFailed words="The backlogs could not be loaded." /> : null}
      {backlogs.state === "ready" ? (
        <Rows>
          <ListRow title="All issues" meta={plural(issues, "issue")} end="›" onClick={() => navigate(issuesPath(allIssuesId))} />
          {issues > 0
            ? rows.map((one) => (
                <ListRow key={one.id} title={one.name} meta={`${plural(one.steps.length, "step")} · ${plural(one.issues, "issue")}`} end="›" onClick={() => navigate(issuesPath(one.id))} />
              ))
            : null}
        </Rows>
      ) : null}
      {backlogs.state === "ready" && issues === 0 ? (
        <EmptyCard words="No backlog yet">
          <p>Ask in Chat to load the boards</p>
          <Button kind="primary" onClick={() => navigate(chatListPath())}>
            Open Chat
          </Button>
        </EmptyCard>
      ) : null}
    </Shell>
  );
}
