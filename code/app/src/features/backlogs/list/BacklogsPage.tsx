import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { useLoad } from "../../../features/forms/useLoad";
import { Button } from "../../../shared/ui/Button";
import { Chip } from "../../../shared/ui/Chip";
import { ChoiceRow } from "../../../shared/ui/ChoiceRow";
import { Sheet } from "../../../shared/ui/Sheet";
import { addSmartBacklogPath, smartBacklogPath } from "../smart/paths";
import { EmptyCard, LoadFailed } from "../../../shared/ui/LoadState";
import { ListRow, Rows } from "../../../shared/ui/ListRow";
import { Shell } from "../../../app/Shell";
import { useBackToSection } from "../../../app/menu/useBackToSection";
import { useWide } from "../../../shared/ui/useWide";
import { useOnceNotice } from "../../../shared/ui/onceNotice";
import { allIssuesId, issuesHeld, mcpBacklogsClient, type BacklogsClient } from "../shared/api";
import { addBacklogPath, useMayManage, type BacklogManageClient } from "../manage";
import { mcpBacklogManageClient } from "../manage/api";
import { nothingSharedWords } from "../shared/access";
import { ChatAboutBacklog } from "../shared/ChatAboutBacklog";
import { StepBubbles } from "./StepBubbles";
import { stepTotals, type StepCount } from "../shared/stepCounts";
import { boardPath, issuesPath } from "../shared/paths";
import "../../../shared/ui/paneWindow.css";
import "./backlogsWide.css";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

type Props = { client?: BacklogsClient; manage?: BacklogManageClient };

export function BacklogsPage({ client = mcpBacklogsClient, manage = mcpBacklogManageClient }: Props) {
  const navigate = useNavigate();
  const wide = useWide();
  const back = useBackToSection();
  const notice = useOnceNotice();
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const backlogs = useLoad(() => client.backlogs(), `backlogs:${openAgencyId()}`);
  const mayManage = useMayManage(manage);
  const rows = backlogs.state === "ready" ? backlogs.data : [];
  const issues = issuesHeld(rows);
  const anyArchived = rows.some((one) => one.archived);
  const listed = showArchived ? rows : rows.filter((one) => !one.archived);
  const archivedMark = (one: { archived?: boolean }) => (one.archived ? <Chip>Archived</Chip> : null);
  const smarts = rows.filter((one) => one.kind === "smart");
  const smartCounts = useLoad(() => (client.smartCounts ? client.smartCounts(smarts) : Promise.resolve<Record<string, StepCount[]>>({})), `backlogs-smart-counts:${openAgencyId()}:${smarts.map((one) => one.id).join(",")}:${backlogs.state}`);
  const smartCountsOf = (id: string) => (smartCounts.state === "ready" ? smartCounts.data[id] ?? [] : []);
  const ready = backlogs.state === "ready";
  const mayAdd = ready && mayManage.state === "ready" && mayManage.data;
  const aboutBacklogs = <ChatAboutBacklog about={{ kind: "backlogs", id: allIssuesId, name: "Backlogs" }} />;
  const noticeLine = notice ? <p role="status" className="sub">{notice}</p> : null;
  const loadState = (
    <>
      {backlogs.state === "error" ? <LoadFailed words="The backlogs could not be loaded." /> : null}
      {ready && rows.length === 0 ? <EmptyCard words={nothingSharedWords} /> : null}
    </>
  );
  const list =
    ready && rows.length > 0 ? (
      <Rows>
        <ListRow title="All issues" meta={plural(issues, "issue")} below={<StepBubbles counts={stepTotals(rows)} />} end="›" onClick={() => navigate(issuesPath(allIssuesId))} />
        {listed.map((one) =>
          one.kind === "smart" ? (
            <ListRow key={one.id} title={one.name} meta={plural(one.issues, "issue")} below={<StepBubbles counts={smartCountsOf(one.id)} />} end={<>{archivedMark(one)}<Chip tone="info">Smart</Chip> ›</>} onClick={() => navigate(smartBacklogPath(one.id))} />
          ) : (
            <ListRow key={one.id} title={one.name} meta={`${plural(one.steps.length, "step")} · ${plural(one.issues, "issue")}`} below={<StepBubbles counts={one.counts ?? []} />} end={<>{archivedMark(one)} ›</>} onClick={() => navigate(boardPath(one.id))} />
          ),
        )}
      </Rows>
    ) : null;
  const actions = (
    <>
      {ready && anyArchived ? <ChoiceRow type="checkbox" label="Show archived" checked={showArchived} onChange={setShowArchived} /> : null}
      {mayAdd ? <Button onClick={() => setAdding(true)}>Add a backlog</Button> : null}
      {ready && rows.length > 0 && issues === 0 && mayAdd ? (
        <EmptyCard words="No backlog yet">
          <p>Run the loader on your laptop to load the boards</p>
        </EmptyCard>
      ) : null}
    </>
  );
  const addSheet = adding ? (
    <Sheet title="Add a backlog" onClose={() => setAdding(false)}>
      <Rows>
        <ListRow title="Backlog with steps" end="›" onClick={() => navigate(addBacklogPath())} />
        <ListRow title="Smart backlog" end="›" onClick={() => navigate(addSmartBacklogPath())} />
      </Rows>
    </Sheet>
  ) : null;
  if (wide) {
    return (
      <Shell title="Backlogs" onBack={back.onBack} backLabel={back.backLabel}>
        {aboutBacklogs}
        <div className="wf">
          <div className="wf-panes">
            <section className="wf-tree bl-list" aria-label="Backlogs">{list}</section>
            <section className="wf-main">
              <h2 className="wf-head">Backlogs</h2>
              <div className="wf-content bl-main">
                {noticeLine}
                {loadState}
                {actions}
              </div>
            </section>
          </div>
        </div>
        {addSheet}
      </Shell>
    );
  }
  return (
    <Shell title="Backlogs" onBack={back.onBack} backLabel={back.backLabel}>
      {aboutBacklogs}
      {noticeLine}
      {loadState}
      {list}
      {actions}
      {addSheet}
    </Shell>
  );
}
