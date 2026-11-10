import { useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../entry/language";
import { useLoad } from "../forms/useLoad";
import { openAgencyId } from "../agency/open";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { Rows } from "../ui/ListRow";
import { Segmented } from "../ui/Segmented";
import { backState } from "../ui/backTo";
import { Shell } from "../ui/Shell";
import "./backlogs.css";
import { allIssuesId, mcpBacklogsClient, type BacklogsClient } from "./api";
import { FilterBar } from "./FilterBar";
import { SelectableIssueRow, SelectButton, selectingShell, SendBar, SendToBacklog, useSelection, useTargets } from "../sendToBacklog";
import { IssueRow } from "./IssueRow";
import { backlogsHomePath, boardPath, issuePath, queryParam, searchOf, tagParam } from "./paths";
import { countWords, narrowed, toggled } from "./tags";

export function IssuesPage({ client = mcpBacklogsClient }: { client?: BacklogsClient }) {
  const navigate = useNavigate();
  const here = useLocation();
  const { words } = useLanguage();
  const backlogId = useParams().backlogId ?? allIssuesId;
  const [search, setSearch] = useSearchParams();
  const chosen = search.getAll(tagParam);
  const query = search.get(queryParam) ?? "";
  const [version, setVersion] = useState(0);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState("");
  const selecting = useSelection();
  const targets = useTargets();
  const key = `issues:${openAgencyId()}:${backlogId}:${version}`;
  const issues = useLoad(() => client.issues(backlogId), key);
  const backlogs = useLoad(() => client.backlogs(), `backlogs:${openAgencyId()}`);
  const title = backlogId === allIssuesId ? "All issues" : backlogs.state === "ready" ? (backlogs.data.find((one) => one.id === backlogId)?.name ?? "Backlog") : "Backlog";
  const choose = (tag: string) => setSearch(searchOf(toggled(chosen, tag), query), { replace: true });
  const typed = (text: string) => setSearch(searchOf(chosen, text), { replace: true });
  const filtering = chosen.length > 0 || query.trim() !== "";
  const shown = issues.state === "ready" ? narrowed(issues.data, chosen, query) : [];
  const total = issues.state === "ready" ? issues.data.length : 0;
  const sub = issues.state === "ready" && total > 0 ? countWords(shown.length, total, filtering) : undefined;
  const canSend = targets.state === "ready" && targets.data.length > 0 && shown.length > 0;
  const shell = selecting.on
    ? selectingShell(selecting, shown.map((issue) => issue.id))
    : { title, onBack: () => navigate(backlogsHomePath()), backLabel: words.backBacklogs, action: canSend ? <SelectButton onStart={selecting.start} /> : undefined };
  return (
    <Shell {...shell} tabless={selecting.on}>
      <FilterBar query={query} onQuery={typed} count={sub} chosen={chosen} onTag={choose} />
      {backlogId !== allIssuesId ? (
        <Segmented
          items={[
            { id: "list", label: "List" },
            { id: "board", label: "Board" },
          ]}
          current="list"
          onChange={() => navigate(boardPath(backlogId, chosen, query))}
        />
      ) : null}
      {issues.state === "loading" ? <LoadingLine /> : null}
      {issues.state === "error" ? <LoadFailed words="The issues could not be loaded." /> : null}
      {issues.state === "ready" && total === 0 ? (
        <EmptyCard words="No issues yet. Run the loader on your laptop to load the boards." />
      ) : null}
      {shown.length > 0 ? (
        <Rows>
          {shown.map((issue) =>
            selecting.on ? (
              <SelectableIssueRow key={issue.id} issue={issue} chosen={chosen} selection={{ checked: selecting.has(issue.id), onChange: (checked) => selecting.toggle(issue.id, checked), label: `Select ${issue.title}` }} />
            ) : (
              <IssueRow key={issue.id} issue={issue} chosen={chosen} onOpen={() => navigate(issuePath(issue.id), backState(here.pathname + here.search, title))} onTag={choose} />
            ),
          )}
        </Rows>
      ) : null}
      {total > 0 && shown.length === 0 ? <EmptyCard words="No issues match" /> : null}
      {outcome && !selecting.on ? (
        <p className="sub" role="status">
          {outcome}
        </p>
      ) : null}
      {selecting.on ? <SendBar count={selecting.count} onSend={() => setSending(true)} /> : null}
      {sending ? (
        <SendToBacklog
          ids={selecting.ids}
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
