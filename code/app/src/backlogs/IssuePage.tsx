import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../entry/language";
import { useLoad } from "../forms/useLoad";
import { openAgencyId } from "../agency/open";
import { Card } from "../ui/Card";
import { LoadFailed, LoadingLine } from "../ui/LoadState";
import { Rows } from "../ui/ListRow";
import { Markdown } from "../ui/Markdown";
import { SectionHeading } from "../ui/SectionHeading";
import { Shell } from "../ui/Shell";
import "./backlogs.css";
import { mcpBacklogsClient, type BacklogsClient } from "./api";
import { IssueRow } from "./IssueRow";
import { titleParts } from "./IssueTitle";
import { issuePath, issuesPath } from "./paths";
import { splitSource } from "./source";

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
          <Rows>
            <IssueRow issue={ready} chosen={[]} facts={[place, ready.priority ?? ""]} />
          </Rows>
          {body ? (
            <Card>
              <Markdown text={body} className="issue-body" />
            </Card>
          ) : null}
          {[
            { heading: "Waits on", issues: ready.waitsOn },
            { heading: "Waited on by", issues: ready.waitedOnBy },
          ].map(({ heading, issues }) =>
            issues.length > 0 ? (
              <section key={heading} className="issue-list">
                <SectionHeading>{heading}</SectionHeading>
                <Rows>
                  {issues.map((one) => (
                    <IssueRow key={one.id} issue={one} chosen={[]} chevron onOpen={() => navigate(issuePath(one.id))} />
                  ))}
                </Rows>
              </section>
            ) : null,
          )}
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
