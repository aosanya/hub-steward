import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../entry/language";
import { useLoad } from "../forms/useLoad";
import { openAgencyId } from "../agency/open";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { LoadFailed, LoadingLine } from "../ui/LoadState";
import { ListRow, Rows } from "../ui/ListRow";
import { Markdown } from "../ui/Markdown";
import { SectionHeading } from "../ui/SectionHeading";
import { Shell } from "../ui/Shell";
import "./backlogs.css";
import { allIssuesId, mcpBacklogsClient, type BacklogsClient } from "./api";
import { titleParts } from "./IssueTitle";
import { issuePath, issuesPath } from "./paths";
import { splitSource } from "./source";
import { tagsOf, toneOf } from "./tags";

export function IssuePage({ client = mcpBacklogsClient }: { client?: BacklogsClient }) {
  const navigate = useNavigate();
  const { words } = useLanguage();
  const id = useParams().issueId ?? "";
  const issue = useLoad(() => client.issue(id), `issue:${openAgencyId()}:${id}`);
  const ready = issue.state === "ready" ? issue.data : null;
  const place = ready ? [ready.backlog, ready.step].filter((part) => part !== "").join(" · ") : "";
  const parts = ready ? titleParts(ready.title) : null;
  const { body, source } = splitSource(ready?.description ?? "");
  return (
    <Shell title={parts?.code || "Issue"} onBack={() => navigate(issuesPath())} backLabel={words.backAllIssues}>
      {issue.state === "loading" ? <LoadingLine /> : null}
      {issue.state === "error" ? <LoadFailed words="This issue could not be loaded." /> : null}
      {ready && parts ? (
        <>
          <h2 className="headline">
            {parts.code ? <span className="issue-code">{parts.code}</span> : null}
            {parts.code ? " " : null}
            {parts.rest}
          </h2>
          <div className="issue-tags">
            {tagsOf(ready).map((tag) => (
              <Chip key={tag} tone={toneOf(tag, ready)} onClick={() => navigate(issuesPath(allIssuesId, [tag]))}>
                {tag}
              </Chip>
            ))}
          </div>
          {place ? <p className="sub">{place}</p> : null}
          {ready.priority ? <p className="sub">Priority: {ready.priority}</p> : null}
          {body ? (
            <Card>
              <Markdown text={body} className="issue-body" />
            </Card>
          ) : null}
          {ready.waitsOn.length > 0 ? (
            <>
              <SectionHeading>Waits on</SectionHeading>
              <Rows>
                {ready.waitsOn.map((one) => (
                  <ListRow key={one.id} title={one.title || one.id} end="›" onClick={() => navigate(issuePath(one.id))} />
                ))}
              </Rows>
            </>
          ) : null}
          {source ? (
            <>
              <SectionHeading>Source</SectionHeading>
              <Card>
                <p className="sub issue-source">{source}</p>
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}
