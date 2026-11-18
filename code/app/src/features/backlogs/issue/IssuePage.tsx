import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../../../shared/language/language";
import { useLoad } from "../../../features/forms/useLoad";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { Card } from "../../../shared/ui/Card";
import { ListRow } from "../../../shared/ui/ListRow";
import { TextChip } from "../../../shared/ui/TextChip";
import { Section } from "../../../shared/ui/Section";
import { PageFrame } from "../../../app/menu/PageFrame";
import { LoadFailed, LoadingLine } from "../../../shared/ui/LoadState";
import { Markdown } from "../../../shared/ui/Markdown";
import { backState, useBackLabel, useBackTo } from "../../../shared/ui/backTo";
import { Shell } from "../../../app/Shell";
import "../shared/backlogs.css";
import "./issueWide.css";
import { mcpBacklogsClient, mcpNotesClient, settled, type BacklogsClient, type NotesClient } from "../shared/api";
import { SendToBacklogButton } from "../send";
import type { SendClient } from "../send/types";
import { IssueLog } from "./IssueLog";
import { mcpCapsClient, type CapsClient, type CapsReading } from "../caps/api";
import { CapsCard } from "../caps/CapsCard";
import { CapTintChip } from "../caps/CapTintChip";
import { tintOf, tintStyle } from "../caps/capTint";
import { mcpReferencesClient, mcpRepoClient, type ReferencesClient, type RepoClient } from "../references/api";
import { ReferencesCard } from "../references/ReferencesCard";
import { CapTintScope } from "../caps/CapTintScope";
import { IssueCard } from "../shared/IssueCard";
import { priorityPicker } from "../shared/priorityPicker";
import { titleParts } from "../shared/IssueTitle";
import { tagsOf } from "../shared/tags";
import { capitalised } from "../shared/capitalised";
import { effortKnown, effortWords } from "../shared/effort";
import { EffortMenu } from "../shared/EffortMenu";
import { PriorityMenu } from "../shared/PriorityMenu";
import { inDone } from "../shared/IssuePills";
import { issuePath, issuesPath } from "../shared/paths";
import { splitSource } from "./source";
import { mcpTodosClient, type TodosClient } from "../todos/api";
import { TodoList } from "../todos/TodoList";
import { ChatAboutBacklog } from "../shared/ChatAboutBacklog";

type Props = { client?: BacklogsClient; notesClient?: NotesClient; sendClient?: SendClient; referencesClient?: ReferencesClient; repoClient?: RepoClient; capsClient?: CapsClient; todosClient?: TodosClient };

export function IssuePage({ client = mcpBacklogsClient, notesClient = mcpNotesClient, sendClient, referencesClient = mcpReferencesClient, repoClient = mcpRepoClient, capsClient = mcpCapsClient, todosClient = mcpTodosClient }: Props) {
  const navigate = useNavigate();
  const here = useLocation();
  const { words } = useLanguage();
  const backTo = useBackTo(issuesPath());
  const backLabel = useBackLabel(words.backAllIssues);
  const id = useParams().issueId ?? "";
  const [version, setVersion] = useState(0);
  const [sent, setSent] = useState("");
  const [failed, setFailed] = useState("");
  const [caps, setCaps] = useState<{ issueId: string; reading: CapsReading } | null>(null);
  const issue = useLoad(() => client.issue(id), `issue:${openAgencyId()}:${id}:${version}`);
  const ready = issue.state === "ready" ? issue.data : null;
  const parts = ready ? titleParts(ready.title, ready.code) : null;
  const found = ready && !settled.has(ready.status) && caps?.issueId === ready.id ? tintOf(caps.reading) : null;
  const { body, source } = splitSource(ready?.description ?? "");
  const { setPriority, setEffort } = client;
  const reload = () => setVersion((now) => now + 1);
  const priorityOf = priorityPicker(client, reload);
  const change = (field: string, set: (id: string, value: string) => Promise<void>) => (value: string) => {
    setFailed("");
    set(id, value).then(
      () => setVersion((now) => now + 1),
      () => setFailed(field),
    );
  };
  return (
    <Shell title={parts?.rest || "Issue"} titleless onBack={() => navigate(backTo)} backLabel={backLabel}>
      {ready ? <ChatAboutBacklog about={{ kind: "backlog-issue", id: ready.id, name: ready.title }} /> : null}
      {issue.state === "loading" ? <LoadingLine /> : null}
      {issue.state === "error" ? <LoadFailed words="This issue could not be loaded." /> : null}
      {sent ? (
        <p className="sub" role="status">
          {sent}
        </p>
      ) : null}
      {failed ? (
        <p className="sub" role="alert">
          The {failed} was not changed.
        </p>
      ) : null}
      {ready && parts ? (
        <PageFrame wide title={parts.rest} line={[parts.code, ready.step].filter((part) => part !== "").join(" · ")}>
        <div className="issue-wide">
          <div className={found ? "issue-main cap-tinted" : "issue-main"} style={tintStyle(found)}>
            <Section
              word="Details"
              plain
              rows={[
                ready.priority ? <ListRow key="priority" title="Priority" meta={capitalised(ready.priority)} /> : null,
                effortKnown(ready.effort) ? <ListRow key="effort" title="Effort" meta={effortWords(ready.effort ?? "")} /> : null,
                tagsOf(ready).length > 0 ? (
                  <ListRow
                    key="tags"
                    title="Tags"
                    below={
                      <span className="issue-tags">
                        {tagsOf(ready).map((tag) => (
                          <TextChip key={tag} text={tag} />
                        ))}
                      </span>
                    }
                  />
                ) : null,
              ].filter((row) => row !== null)}
              foot={
                <>
                  {setPriority && !inDone(ready) ? <PriorityMenu priority={ready.priority ?? ""} onPick={change("priority", setPriority)} /> : null}
                  {setEffort ? <EffortMenu effort={ready.effort ?? ""} onPick={change("effort", setEffort)} /> : null}
                </>
              }
            />
            {found ? (
              <span className="issue-tags">
                <CapTintChip found={found} />
              </span>
            ) : null}
            {body ? (
              <Card title="Description">
                <Markdown text={body} className="issue-body" />
              </Card>
            ) : null}
            <TodoList key={ready.id} issueId={ready.id} client={todosClient} />
          </div>
          <div className="issue-side">
            <ReferencesCard key={ready.id} issueId={ready.id} client={referencesClient} repoClient={repoClient} />
            <CapsCard key={ready.id} issueId={ready.id} client={capsClient} notesClient={notesClient} running={ready.step === "Doing"} onReading={(reading) => setCaps({ issueId: ready.id, reading })} />
            <IssueLog key={ready.id} issueId={ready.id} client={notesClient} />
            <Card title="Backlog" footer={<SendToBacklogButton issueId={ready.id} from={[ready.backlogId ?? ""]} client={sendClient} onOutcome={setSent} onSent={() => setVersion((now) => now + 1)} />}>
              <ListRow title={[ready.backlog, ready.step].filter((part) => part !== "").join(" · ")} />
            </Card>
            {[
              { heading: "Waits on", issues: ready.waitsOn },
              { heading: "Waited on by", issues: ready.waitedOnBy },
            ].map(({ heading, issues }) =>
              issues.length > 0 ? (
                <Card key={heading} title={heading} collapsible>
                  <CapTintScope issues={issues} client={capsClient}>
                    {issues.map((one) => (
                      <IssueCard key={one.id} issue={one} chosen={[]} showStep onPriority={priorityOf(one)} onOpen={() => navigate(issuePath(one.id), backState(here.pathname + here.search, parts.code))} />
                    ))}
                  </CapTintScope>
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
        </PageFrame>
      ) : null}
    </Shell>
  );
}
