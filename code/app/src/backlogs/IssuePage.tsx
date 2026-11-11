import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../entry/language";
import { useLoad } from "../forms/useLoad";
import { openAgencyId } from "../agency/open";
import { Card } from "../ui/Card";
import { LoadFailed, LoadingLine } from "../ui/LoadState";
import { Rows } from "../ui/ListRow";
import { Markdown } from "../ui/Markdown";
import { backState, useBackLabel, useBackTo } from "../ui/backTo";
import { Shell } from "../ui/Shell";
import "./backlogs.css";
import "./issueWide.css";
import { mcpBacklogsClient, mcpNotesClient, settled, type BacklogsClient, type NotesClient } from "./api";
import { SendToBacklogButton } from "../sendToBacklog";
import type { SendClient } from "../sendToBacklog/types";
import { IssueLog } from "./IssueLog";
import { mcpCapsClient, type CapsClient, type CapsReading } from "./caps/api";
import { CapsCard } from "./caps/CapsCard";
import { CapTintChip } from "./caps/CapTintChip";
import { tintOf, tintStyle } from "./caps/capTint";
import { mcpReferencesClient, mcpRepoClient, type ReferencesClient, type RepoClient } from "./references/api";
import { ReferencesCard } from "./references/ReferencesCard";
import { IssueRow } from "./IssueRow";
import { IssueTags, IssueTitle, titleParts } from "./IssueTitle";
import { PriorityMenu } from "./PriorityMenu";
import { issuePath, issuesPath } from "./paths";
import { splitSource } from "./source";

type Props = { client?: BacklogsClient; notesClient?: NotesClient; sendClient?: SendClient; referencesClient?: ReferencesClient; repoClient?: RepoClient; capsClient?: CapsClient };

export function IssuePage({ client = mcpBacklogsClient, notesClient = mcpNotesClient, sendClient, referencesClient = mcpReferencesClient, repoClient = mcpRepoClient, capsClient = mcpCapsClient }: Props) {
  const navigate = useNavigate();
  const here = useLocation();
  const { words } = useLanguage();
  const backTo = useBackTo(issuesPath());
  const backLabel = useBackLabel(words.backAllIssues);
  const id = useParams().issueId ?? "";
  const [version, setVersion] = useState(0);
  const [sent, setSent] = useState("");
  const [failed, setFailed] = useState(false);
  const [caps, setCaps] = useState<{ issueId: string; reading: CapsReading } | null>(null);
  const issue = useLoad(() => client.issue(id), `issue:${openAgencyId()}:${id}:${version}`);
  const ready = issue.state === "ready" ? issue.data : null;
  const place = ready ? [ready.backlog, ready.step].filter((part) => part !== "").join(" · ") : "";
  const parts = ready ? titleParts(ready.title, ready.code) : null;
  const found = ready && !settled.has(ready.status) && caps?.issueId === ready.id ? tintOf(caps.reading) : null;
  const { body, source } = splitSource(ready?.description ?? "");
  const setPriority = client.setPriority;
  const pick = (priority: string) => {
    setFailed(false);
    setPriority?.(id, priority).then(
      () => setVersion((now) => now + 1),
      () => setFailed(true),
    );
  };
  return (
    <Shell title={parts?.code || "Issue"} onBack={() => navigate(backTo)} backLabel={backLabel}>
      {issue.state === "loading" ? <LoadingLine /> : null}
      {issue.state === "error" ? <LoadFailed words="This issue could not be loaded." /> : null}
      {sent ? (
        <p className="sub" role="status">
          {sent}
        </p>
      ) : null}
      {failed ? (
        <p className="sub" role="alert">
          The priority was not changed.
        </p>
      ) : null}
      {ready && parts ? (
        <div className="issue-wide">
          <div className={found ? "issue-main cap-tinted" : "issue-main"} style={tintStyle(found)}>
            <Card title={<IssueTitle title={ready.title} code={ready.code} />} action={setPriority ? <PriorityMenu priority={ready.priority ?? ""} onPick={pick} /> : undefined}>
              <IssueTags issue={ready} chosen={[]} extra={[place]} />
              {found ? (
                <span className="issue-tags">
                  <CapTintChip found={found} />
                </span>
              ) : null}
              {body ? <Markdown text={body} className="issue-body" /> : null}
            </Card>
          </div>
          <div className="issue-side">
            <ReferencesCard key={ready.id} issueId={ready.id} client={referencesClient} repoClient={repoClient} />
            <CapsCard key={ready.id} issueId={ready.id} client={capsClient} running={ready.step === "Doing"} onReading={(reading) => setCaps({ issueId: ready.id, reading })} />
            <IssueLog key={ready.id} issueId={ready.id} client={notesClient} />
            <SendToBacklogButton issueId={ready.id} from={[ready.backlogId ?? ""]} client={sendClient} onOutcome={setSent} onSent={() => setVersion((now) => now + 1)} />
            {[
              { heading: "Waits on", issues: ready.waitsOn },
              { heading: "Waited on by", issues: ready.waitedOnBy },
            ].map(({ heading, issues }) =>
              issues.length > 0 ? (
                <Card key={heading} title={heading} collapsible flush>
                  <Rows>
                    {issues.map((one) => (
                      <IssueRow key={one.id} issue={one} chosen={[]} chevron showStep onOpen={() => navigate(issuePath(one.id), backState(here.pathname + here.search, parts.code))} />
                    ))}
                  </Rows>
                </Card>
              ) : null,
            )}
            {source ? (
              <Card title="Source" collapsible>
                <p className="sub issue-source">{source}</p>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
