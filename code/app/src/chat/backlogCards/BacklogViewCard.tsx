import { Button } from "../../ui/Button";
import { openAgencyId } from "../../agency/open";
import { boardPath, issuesPath } from "../../backlogs/paths";
import { smartBacklogPath } from "../../smartBacklog/paths";
import { Chip } from "../../ui/Chip";
import { useBacklogSummaries } from "./summaries";
import { backlogViewOf } from "./views";
import { backlogLine, issuesWords } from "./words";
import "./backlogCards.css";

function OpenCard({ title, line, to, smart = false }: { title: string; line: string; to: string; smart?: boolean }) {
  return (
    <div className="rm-card">
      <span className="rm-ttl">{title}</span>
      {line ? (
        <span className="rm-line">
          {smart ? <Chip tone="info">Smart</Chip> : null}
          {line}
        </span>
      ) : null}
      <div className="rm-btns">
        <Button kind="primary" to={to}>
          Open
        </Button>
      </div>
    </div>
  );
}

function NotOpenable() {
  return (
    <div className="rm-card">
      <span className="rm-line">This could not be opened.</span>
    </div>
  );
}

function BacklogButtons() {
  const { backlogs, ready } = useBacklogSummaries();
  if (backlogs.length === 0) return ready ? <NotOpenable /> : null;
  return (
    <div className="rm-card">
      <span className="rm-ttl">Backlogs</span>
      <div className="rm-btns rm-stack">
        {backlogs.map((backlog) => (
          <Button key={backlog.id} to={backlog.smart ? smartBacklogPath(backlog.id) : boardPath(backlog.id)}>
            <span className="rm-pick">{backlog.name}</span>
            <span className="rm-line">
              {backlog.smart ? <Chip tone="info">Smart</Chip> : null}
              {backlogLine(backlog)}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export function BacklogViewCard({ targetId }: { targetId: string }) {
  const { backlogs, totals, ready } = useBacklogSummaries();
  const target = backlogViewOf(targetId);
  if (target === null || openAgencyId() === "") return <NotOpenable />;
  if (target.view === "all") {
    return <OpenCard title="All issues" line={totals === null ? "" : issuesWords(totals.issues)} to={issuesPath()} />;
  }
  if (target.view === "backlogs") return <BacklogButtons />;
  const backlog = backlogs.find((candidate) => candidate.id === target.backlogId);
  if (backlog === undefined) return ready ? <NotOpenable /> : null;
  return <OpenCard title={backlog.name} line={backlogLine(backlog)} to={backlog.smart ? smartBacklogPath(backlog.id) : boardPath(backlog.id)} smart={backlog.smart === true} />;
}
