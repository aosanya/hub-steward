import { Button } from "../../ui/Button";
import { openAgencyId } from "../../agency/open";
import { allIssuesPath, backlogPath } from "./paths";
import { useBacklogSummaries } from "./summaries";
import { backlogViewOf } from "./views";
import { backlogLine, issuesWords } from "./words";
import "./backlogCards.css";

function OpenCard({ title, line, to }: { title: string; line: string; to: string }) {
  return (
    <div className="rm-card">
      <span className="rm-ttl">{title}</span>
      {line ? <span className="rm-line">{line}</span> : null}
      <div className="rm-btns">
        <Button kind="primary" to={to}>
          Open
        </Button>
      </div>
    </div>
  );
}

function BacklogButtons({ agencyId }: { agencyId: string }) {
  const { backlogs } = useBacklogSummaries();
  if (backlogs.length === 0) return null;
  return (
    <div className="rm-card">
      <span className="rm-ttl">Backlogs</span>
      <div className="rm-btns rm-stack">
        {backlogs.map((backlog) => (
          <Button key={backlog.id} to={backlogPath(agencyId, backlog.id)}>
            <span className="rm-pick">{backlog.name}</span>
            <span className="rm-line">{backlogLine(backlog)}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export function BacklogViewCard({ targetId }: { targetId: string }) {
  const { backlogs, totals } = useBacklogSummaries();
  const agencyId = openAgencyId();
  const target = backlogViewOf(targetId);
  if (target === null || agencyId === "") return null;
  if (target.view === "all") {
    return <OpenCard title="All issues" line={totals === null ? "" : issuesWords(totals.issues)} to={allIssuesPath(agencyId)} />;
  }
  if (target.view === "backlogs") return <BacklogButtons agencyId={agencyId} />;
  const backlog = backlogs.find((candidate) => candidate.id === target.backlogId);
  if (backlog === undefined) return null;
  return <OpenCard title={backlog.name} line={backlogLine(backlog)} to={backlogPath(agencyId, backlog.id)} />;
}
