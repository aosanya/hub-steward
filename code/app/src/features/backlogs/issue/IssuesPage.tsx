import { Fragment, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../features/entry/language";
import { useLoad } from "../../../features/forms/useLoad";
import { openAgencyId } from "../../agency/open";
import { EmptyCard, LoadFailed, LoadingLine } from "../../../shared/ui/LoadState";
import { backState } from "../../../shared/ui/backTo";
import { Shell } from "../../../shared/ui/Shell";
import "../shared/backlogs.css";
import { mcpBacklogManageClient } from "../manage/api";
import { useMayManage } from "../manage/useMayManage";
import type { BacklogManageClient } from "../manage/types";
import { listSmartBacklogs } from "../smart/api";
import { filterDraft } from "../smart/fromFilter";
import { addSmartBacklogPath, smartBacklogPath } from "../smart/paths";
import { sameRules } from "../smart/rulesKey";
import { toRuleSet } from "../smart/rulesDraft";
import type { SmartBacklog } from "../smart/types";
import { Button } from "../../../shared/ui/Button";
import { allIssuesId, issuesHeld, mcpBacklogsClient, type BacklogsClient, type Issue } from "../shared/api";
import { FilterBar } from "../shared/FilterBar";
import { SelectableIssueRow, SelectButton, selectingShell, SendBar, SendToBacklog, useSelection, useTargets } from "../send";
import { BoardColumns } from "../board/BoardColumns";
import { columnsOf, stepsOfIssues } from "../board/board";
import { useView, ViewSwitch } from "../board/ViewSwitch";
import type { CapsClient } from "../caps/api";
import { CapTintScope } from "../caps/CapTintScope";
import { IssueCard } from "../shared/IssueCard";
import type { TodoCountsClient } from "../todoCounts/api";
import { TodoCountScope } from "../todoCounts/TodoCountScope";
import { effortPicker } from "../shared/effortPicker";
import { issuesRefreshMs } from "../shared/refresh";
import { priorityPicker } from "../shared/priorityPicker";
import { backlogsHomePath, boardPath, issuePath, queryParam, searchOf, tagParam } from "../shared/paths";
import { countWords, narrowed, toggled } from "../shared/tags";

type Props = { client?: BacklogsClient; manage?: BacklogManageClient; smartBacklogs?: () => Promise<SmartBacklog[]>; capsClient?: CapsClient; todoCounts?: TodoCountsClient };

export function IssuesPage({ client = mcpBacklogsClient, manage = mcpBacklogManageClient, smartBacklogs = listSmartBacklogs, capsClient, todoCounts }: Props) {
  const navigate = useNavigate();
  const here = useLocation();
  const { words } = useLanguage();
  const backlogId = useParams().backlogId ?? allIssuesId;
  const [search, setSearch] = useSearchParams();
  const chosen = search.getAll(tagParam);
  const query = search.get(queryParam) ?? "";
  const [view, chooseView] = useView();
  const listed = backlogId === allIssuesId ? view : "list";
  const [version, setVersion] = useState(0);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState("");
  const selecting = useSelection();
  const targets = useTargets();
  const key = `issues:${openAgencyId()}:${backlogId}:${version}`;
  const issues = useLoad(() => client.issues(backlogId), key, issuesRefreshMs);
  const backlogs = useLoad(() => client.backlogs(), `backlogs:${openAgencyId()}`);
  const mayManage = useMayManage(manage);
  const smart = useLoad(() => smartBacklogs(), `smart-sets:${openAgencyId()}`);
  const title = backlogId === allIssuesId ? "All issues" : backlogs.state === "ready" ? (backlogs.data.find((one) => one.id === backlogId)?.name ?? "Backlog") : "Backlog";
  const choose = (tag: string) => setSearch(searchOf(toggled(chosen, tag), query), { replace: true });
  const typed = (text: string) => setSearch(searchOf(chosen, text), { replace: true });
  const filtering = chosen.length > 0 || query.trim() !== "";
  const loadedIssues = issues.state === "ready" ? issues.data : [];
  const shown = issues.state === "ready" ? narrowed(issues.data, chosen, query) : [];
  const total = issues.state === "ready" ? issues.data.length : 0;
  const sub = issues.state === "ready" && total > 0 ? countWords(shown.length, total, filtering) : undefined;
  const draft = filterDraft(chosen, query, backlogs.state === "ready" ? backlogs.data.filter((one) => one.kind !== "smart").map((one) => one.name) : []);
  const existing = smart.state === "ready" ? smart.data.find((one) => sameRules(one.set, toRuleSet(draft))) : undefined;
  const mayAdd = filtering && mayManage.state === "ready" && mayManage.data && smart.state === "ready";
  const save = !mayAdd ? undefined : existing ? (
    <Button to={smartBacklogPath(existing.id)}>Open {existing.name}</Button>
  ) : (
    <Button onClick={() => navigate(addSmartBacklogPath(), { state: { draft } })}>Save as smart backlog</Button>
  );
  const canSend = targets.state === "ready" && targets.data.length > 0 && shown.length > 0;
  const priorityOf = priorityPicker(client, () => setVersion((now) => now + 1));
  const effortOf = effortPicker(client, () => setVersion((now) => now + 1));
  const rowOf = (issue: Issue) =>
    selecting.on ? (
      <SelectableIssueRow issue={issue} chosen={chosen} selection={{ checked: selecting.has(issue.id), onChange: (checked) => selecting.toggle(issue.id, checked), label: `Select ${issue.title}` }} />
    ) : (
      <IssueCard issue={issue} chosen={chosen} onPriority={priorityOf(issue)} onEffort={effortOf(issue)} onOpen={() => navigate(issuePath(issue.id), backState(here.pathname + here.search, title))} onTag={choose} />
    );
  const shell = selecting.on
    ? selectingShell(selecting, shown.map((issue) => issue.id))
    : { title, onBack: () => navigate(backlogsHomePath()), backLabel: words.backBacklogs, action: canSend ? <SelectButton onStart={selecting.start} /> : undefined };
  return (
    <Shell {...shell} tabless={selecting.on}>
      <FilterBar query={query} onQuery={typed} count={sub} chosen={chosen} onTag={choose} save={save} />
      <ViewSwitch current={listed} onChange={(next) => (backlogId === allIssuesId ? chooseView(next) : navigate(boardPath(backlogId, chosen, query)))} />
      {issues.state === "loading" ? <LoadingLine /> : null}
      {issues.state === "error" ? <LoadFailed words="The issues could not be loaded." /> : null}
      {issues.state === "ready" && total === 0 && mayManage.state === "ready" && backlogs.state === "ready" ? (
        <EmptyCard words={mayManage.data && issuesHeld(backlogs.data) === 0 ? "No issues yet. Run the loader on your laptop to load the boards." : "Nothing here yet."} />
      ) : null}
      <CapTintScope issues={shown} client={capsClient}>
        {shown.length > 0 && listed === "board" && backlogs.state === "ready" ? (
          <TodoCountScope issues={shown} client={todoCounts}>
            <BoardColumns columns={columnsOf(stepsOfIssues(backlogs.data, shown), shown)} renderCard={rowOf} />
          </TodoCountScope>
        ) : null}
        {shown.length > 0 && listed === "list" ? <div className="issue-cards">{shown.map((issue) => <Fragment key={issue.id}>{rowOf(issue)}</Fragment>)}</div> : null}
      </CapTintScope>
      {total > 0 && shown.length === 0 ? <EmptyCard words="No issues match" /> : null}
      {outcome && !selecting.on ? (
        <p className="sub" role="status">
          {outcome}
        </p>
      ) : null}
      {selecting.on ? <SendBar count={selecting.count} from={selecting.ids.map((id) => loadedIssues.find((one) => one.id === id)?.backlogId ?? "")} onSend={() => setSending(true)} /> : null}
      {sending ? (
        <SendToBacklog
          ids={selecting.ids}
          from={selecting.ids.map((id) => loadedIssues.find((one) => one.id === id)?.backlogId ?? "")}
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
