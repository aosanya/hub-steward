import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLoad } from "../forms/useLoad";
import { openAgencyId } from "../agency/open";
import { Chip } from "../ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { Rows } from "../ui/ListRow";
import { Shell } from "../ui/Shell";
import { Button } from "../ui/Button";
import { chatListPath } from "../routes";
import "./backlogs.css";
import { allIssuesId, mcpBacklogsClient, type BacklogsClient } from "./api";
import { IssueRow } from "./IssueRow";
import { backlogsHomePath, issuePath, tagParam } from "./paths";
import { countWords, toggled, withAllTags } from "./tags";

export function IssuesPage({ client = mcpBacklogsClient }: { client?: BacklogsClient }) {
  const navigate = useNavigate();
  const backlogId = useParams().backlogId ?? allIssuesId;
  const [search, setSearch] = useSearchParams();
  const chosen = search.getAll(tagParam);
  const key = `issues:${openAgencyId()}:${backlogId}`;
  const issues = useLoad(() => client.issues(backlogId), key);
  const backlogs = useLoad(() => client.backlogs(), `backlogs:${openAgencyId()}`);
  const title = backlogId === allIssuesId ? "All issues" : backlogs.state === "ready" ? (backlogs.data.find((one) => one.id === backlogId)?.name ?? "Backlog") : "Backlog";
  const choose = (tag: string) => setSearch({ [tagParam]: toggled(chosen, tag) }, { replace: true });
  const shown = issues.state === "ready" ? withAllTags(issues.data, chosen) : [];
  const total = issues.state === "ready" ? issues.data.length : 0;
  const sub = issues.state === "ready" && total > 0 ? countWords(shown.length, total, chosen.length > 0) : undefined;
  return (
    <Shell title={title} sub={sub} onBack={() => navigate(backlogsHomePath())}>
      {issues.state === "loading" ? <LoadingLine /> : null}
      {issues.state === "error" ? <LoadFailed words="The issues could not be loaded." /> : null}
      {issues.state === "ready" && total === 0 ? (
        <EmptyCard words="No issues yet. Ask in Chat to load the boards.">
          <Button kind="primary" onClick={() => navigate(chatListPath())}>
            Open Chat
          </Button>
        </EmptyCard>
      ) : null}
      {chosen.length > 0 ? (
        <div className="chosen">
          {chosen.map((tag) => (
            <Chip key={tag} tone="accent" pressed onClick={() => choose(tag)}>
              {tag} ✕
            </Chip>
          ))}
        </div>
      ) : null}
      {shown.length > 0 ? (
        <Rows>
          {shown.map((issue, at) => (
            <IssueRow key={issue.id} issue={issue} place={at + 1} chosen={chosen} onOpen={() => navigate(issuePath(issue.id))} onTag={choose} />
          ))}
        </Rows>
      ) : null}
      {total > 0 && shown.length === 0 ? <EmptyCard words="No issues have all of those tags." /> : null}
    </Shell>
  );
}
