import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { mcpBacklogsClient, type Backlog, type BacklogsClient, type Issue } from "../backlogs/api";
import { FilterBar } from "../backlogs/FilterBar";
import { IssueRow } from "../backlogs/IssueRow";
import { backlogsHomePath, issuePath, issuesPath, queryParam, searchOf, tagParam } from "../backlogs/paths";
import { narrowed, toggled } from "../backlogs/tags";
import { backlogPagePath } from "../backlogPage/paths";
import { SelectableIssueRow, SelectButton, selectingShell, SendBar, SendToBacklog, useSelection, useTargets } from "../sendToBacklog";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { backState } from "../ui/backTo";
import { Shell } from "../ui/Shell";
import { BoardColumns } from "./BoardColumns";
import { ViewSwitch } from "./ViewSwitch";
import { columnsOf } from "./board";
import "./backlogBoard.css";

type Loaded = { backlog: Backlog | null; issues: Issue[] };

type Read = { state: "loading" } | { state: "failed" } | ({ state: "ready" } & Loaded);

const countWords = (shown: number, steps: number) => `${shown} ${shown === 1 ? "issue" : "issues"} · ${steps} ${steps === 1 ? "step" : "steps"}`;

export function BacklogBoard({ client = mcpBacklogsClient }: { client?: BacklogsClient }) {
  const { backlogId = "" } = useParams();
  const navigate = useNavigate();
  const here = useLocation();
  const [search, setSearch] = useSearchParams();
  const chosen = search.getAll(tagParam);
  const query = search.get(queryParam) ?? "";
  const [read, setRead] = useState<Read>({ state: "loading" });
  const [version, setVersion] = useState(0);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState("");
  const selecting = useSelection();
  const targets = useTargets();

  useEffect(() => {
    let current = true;
    setRead({ state: "loading" });
    Promise.all([client.backlogs(), client.issues(backlogId)]).then(
      ([backlogs, issues]) => current && setRead({ state: "ready", backlog: backlogs.find((backlog) => backlog.id === backlogId) ?? null, issues }),
      () => current && setRead({ state: "failed" }),
    );
    return () => {
      current = false;
    };
  }, [client, backlogId, version]);

  const choose = (next: string[]) => setSearch(searchOf(next, query), { replace: true });
  const typed = (text: string) => setSearch(searchOf(chosen, text), { replace: true });
  const toggle = (tag: string) => choose(toggled(chosen, tag));

  const loaded = read.state === "ready" ? read : null;
  const backlog = loaded?.backlog ?? null;
  const shown = loaded ? narrowed(loaded.issues, chosen, query) : [];
  const title = backlog?.name ?? "Backlog";
  const sub = backlog ? countWords(shown.length, backlog.steps.length) : undefined;
  const canSend = targets.state === "ready" && targets.data.length > 0 && shown.length > 0;
  const action = (
    <>
      {canSend ? <SelectButton onStart={selecting.start} /> : null}
      <Link className="act" to={backlogPagePath(backlogId)}>
        Backlog
      </Link>
    </>
  );
  const shell = selecting.on
    ? selectingShell(selecting, shown.map((issue) => issue.id))
    : { title, onBack: () => navigate(backlogsHomePath()), action: backlog ? action : undefined };

  return (
    <Shell {...shell} tabless={selecting.on}>
      {read.state === "loading" ? <LoadingLine /> : null}
      {read.state === "failed" ? <LoadFailed words="The board could not be read. Try again." /> : null}
      {loaded && !backlog ? <EmptyCard words="This backlog could not be found." /> : null}
      {loaded && backlog ? (
        <>
          <FilterBar query={query} onQuery={typed} count={sub} chosen={chosen} onTag={toggle} onClear={() => choose([])} />
          <ViewSwitch current="board" onChange={() => navigate(issuesPath(backlogId, chosen, query))} />
          <BoardColumns
            columns={columnsOf(backlog.steps, shown)}
            renderCard={(issue) =>
              selecting.on ? (
                <SelectableIssueRow issue={issue} chosen={chosen} selection={{ checked: selecting.has(issue.id), onChange: (checked) => selecting.toggle(issue.id, checked), label: `Select ${issue.title}` }} />
              ) : (
                <IssueRow issue={issue} chosen={chosen} onTag={toggle} onOpen={() => navigate(issuePath(issue.id), backState(here.pathname + here.search, "Board"))} />
              )
            }
          />
          {outcome && !selecting.on ? (
            <p className="sub" role="status">
              {outcome}
            </p>
          ) : null}
        </>
      ) : null}
      {selecting.on ? <SendBar count={selecting.count} from={selecting.ids.map(() => backlogId)} onSend={() => setSending(true)} /> : null}
      {sending ? (
        <SendToBacklog
          ids={selecting.ids}
          from={selecting.ids.map(() => backlogId)}
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
