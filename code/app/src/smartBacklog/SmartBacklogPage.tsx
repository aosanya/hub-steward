import "./smartBacklog.css";
import { Fragment, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mcpBacklogManageClient } from "../backlogManage/api";
import { useMayManage } from "../backlogManage/useMayManage";
import type { BacklogManageClient } from "../backlogManage/types";
import { mcpBacklogsClient, type BacklogsClient, type Issue } from "../backlogs/api";
import { IssueRow } from "../backlogs/IssueRow";
import { backlogAccessPath } from "../backlogAccess/paths";
import { BoardColumns, columnsOf, stepsOfIssues, useView, ViewSwitch } from "../backlogBoard";
import { backlogsHomePath, issuePath } from "../backlogs/paths";
import { openAgencyId } from "../agency/open";
import { SelectableIssueRow, SelectButton, selectingShell, SendBar, SendToBacklog, useSelection, useTargets } from "../sendToBacklog";
import { useLoad } from "../forms/useLoad";
import { Button } from "../ui/Button";
import { ActionsMenu } from "../ui/ActionsMenu";
import { Chip } from "../ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { Rows } from "../ui/ListRow";
import { Shell } from "../ui/Shell";
import { mcpSmartBacklogClient } from "./api";
import { editRulesPath } from "./paths";
import type { SmartBacklogClient } from "./types";
import { rulesWords } from "./words";

type Props = { client?: SmartBacklogClient; issues?: BacklogsClient; manage?: BacklogManageClient };

export function SmartBacklogPage({ client = mcpSmartBacklogClient, issues = mcpBacklogsClient, manage = mcpBacklogManageClient }: Props) {
  const navigate = useNavigate();
  const backlogId = useParams().backlogId ?? "";
  const [version, setVersion] = useState(0);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [view, chooseView] = useView();
  const selecting = useSelection();
  const targets = useTargets();
  const loaded = useLoad(async () => ({ backlog: await client.read(backlogId), rows: await issues.issues(backlogId), all: await issues.backlogs() }), `smart:${openAgencyId()}:${backlogId}:${version}`);
  const may = useMayManage(manage);
  const mayEdit = may.state === "ready" && may.data;
  const back = () => navigate(backlogsHomePath());
  if (loaded.state === "loading") return <Shell title="Backlog" onBack={back} fluid><LoadingLine /></Shell>;
  if (loaded.state === "error") return <Shell title="Backlog" onBack={back} fluid><LoadFailed words="This smart backlog could not be loaded." /></Shell>;
  const { backlog, rows, all } = loaded.data;
  const rowOf = (issue: Issue) =>
    selecting.on ? (
      <SelectableIssueRow issue={issue} chosen={[]} selection={{ checked: selecting.has(issue.id), onChange: (checked) => selecting.toggle(issue.id, checked), label: `Select ${issue.title}` }} />
    ) : (
      <IssueRow issue={issue} chosen={[]} onOpen={() => navigate(issuePath(issue.id))} chevron={view === "list"} />
    );
  const edit = () => navigate(editRulesPath(backlogId));
  const canSend = targets.state === "ready" && targets.data.length > 0 && rows.length > 0;
  const shell = selecting.on
    ? selectingShell(selecting, rows.map((issue) => issue.id))
    : { title: backlog.name, onBack: back, action: canSend ? <SelectButton onStart={selecting.start} /> : undefined };
  return (
    <Shell {...shell} headEnd={mayEdit ? <ActionsMenu actions={[{ label: "Edit rules", onSelect: edit }, { label: "Change who has access", to: backlogAccessPath(backlogId) }]} /> : undefined} tabless={selecting.on} fluid>
      <div className="smart-head">
        <Chip tone="info">Smart</Chip>
        <span className="sub">{rulesWords(backlog.set)}</span>
      </div>
      {rows.length === 0 ? (
        <EmptyCard words="Nothing matches yet">{mayEdit ? <Button kind="primary" onClick={edit}>Edit rules</Button> : null}</EmptyCard>
      ) : (
        <>
          <p className="sub count">{rows.length === 1 ? "1 issue" : `${rows.length} issues`}</p>
          <ViewSwitch current={view} onChange={chooseView} />
          {view === "board" ? (
            <BoardColumns columns={columnsOf(stepsOfIssues(all, rows), rows)} renderCard={rowOf} />
          ) : (
            <Rows>{rows.map((issue) => <Fragment key={issue.id}>{rowOf(issue)}</Fragment>)}</Rows>
          )}
        </>
      )}
      {outcome && !selecting.on ? (
        <p className="sub" role="status">
          {outcome}
        </p>
      ) : null}
      {selecting.on ? <SendBar count={selecting.count} from={selecting.ids.map((id) => rows.find((one) => one.id === id)?.backlogId ?? "")} onSend={() => setSending(true)} /> : null}
      {sending ? (
        <SendToBacklog
          ids={selecting.ids}
          from={selecting.ids.map((id) => rows.find((one) => one.id === id)?.backlogId ?? "")}
          onClose={() => setSending(false)}
          onDone={(words, moved) => {
            setSending(false);
            selecting.cancel();
            setOutcome(words);
            if (moved > 0) setVersion((now) => now + 1);
          }}
        />
      ) : null}
    </Shell>
  );
}
