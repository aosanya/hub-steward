import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { mcpBacklogsClient, type Backlog, type BacklogsClient, type Issue } from "../shared/api";
import { FilterBar } from "../shared/FilterBar";
import type { CapsClient } from "../caps/api";
import { CapTintScope } from "../caps/CapTintScope";
import { IssueCard } from "../shared/IssueCard";
import type { TodoCountsClient } from "../todoCounts/api";
import { TodoCountScope } from "../todoCounts/TodoCountScope";
import { effortPicker } from "../shared/effortPicker";
import { priorityPicker } from "../shared/priorityPicker";
import { useLanguage } from "../../../shared/language/language";
import { backlogsHomePath, issuePath, issuesPath, queryParam, searchOf, tagParam } from "../shared/paths";
import { narrowed, toggled } from "../shared/tags";
import { backlogPagePath } from "../page/paths";
import { SelectableIssueRow, SelectButton, selectingShell, SendBar, SendToBacklog, useSelection, useTargets } from "../../backlogs/send";
import { EmptyCard, LoadFailed, LoadingLine } from "../../../shared/ui/LoadState";
import { backState } from "../../../shared/ui/backTo";
import { Shell } from "../../../app/Shell";
import { BoardColumns } from "./BoardColumns";
import { ViewSwitch } from "./ViewSwitch";
import { columnsOf } from "./board";
import { ChatAboutBacklog } from "../shared/ChatAboutBacklog";
import { useMayReadRules } from "../rulebook/useMayReadRules";
import { useOpenRulebook } from "../rulebook/viewChoice";
import { useQuietRefresh } from "./useQuietRefresh";
import "./backlogBoard.css";

type Loaded = { backlog: Backlog | null; issues: Issue[] };

type Read = { state: "loading" } | { state: "failed" } | ({ state: "ready" } & Loaded);

const sameBoard = (before: Loaded, after: Loaded) => JSON.stringify([before.backlog, before.issues]) === JSON.stringify([after.backlog, after.issues]);

const countWords = (shown: number, steps: number) => `${shown} ${shown === 1 ? "issue" : "issues"} · ${steps} ${steps === 1 ? "step" : "steps"}`;

export function BacklogBoard({ client = mcpBacklogsClient, capsClient, todoCounts }: { client?: BacklogsClient; capsClient?: CapsClient; todoCounts?: TodoCountsClient }) {
  const { backlogId = "" } = useParams();
  const navigate = useNavigate();
  const { words } = useLanguage();
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
  const mayReadRules = useMayReadRules();
  const openRulebook = useOpenRulebook();
  const generation = useRef(0);
  const shownRead = useRef(read);
  shownRead.current = read;

  useEffect(() => {
    let current = true;
    generation.current += 1;
    setRead({ state: "loading" });
    Promise.all([client.backlogs(), client.issues(backlogId)]).then(
      ([backlogs, issues]) => current && setRead({ state: "ready", backlog: backlogs.find((backlog) => backlog.id === backlogId) ?? null, issues }),
      () => current && setRead({ state: "failed" }),
    );
    return () => {
      current = false;
      generation.current += 1;
    };
  }, [client, backlogId, version]);

  useQuietRefresh(() => {
    const started = generation.current;
    Promise.all([client.backlogs(), client.issues(backlogId)]).then(([backlogs, issues]) => {
      if (generation.current !== started) return;
      const next: Loaded = { backlog: backlogs.find((backlog) => backlog.id === backlogId) ?? null, issues };
      const before = shownRead.current;
      if (before.state === "loading" || (before.state === "ready" && sameBoard(before, next))) return;
      setRead({ state: "ready", ...next });
    }, () => undefined);
  }, selecting.on || sending);

  const choose = (next: string[]) => setSearch(searchOf(next, query), { replace: true });
  const typed = (text: string) => setSearch(searchOf(chosen, text), { replace: true });
  const toggle = (tag: string) => choose(toggled(chosen, tag));

  const priorityOf = priorityPicker(client, () => setVersion((now) => now + 1));
  const effortOf = effortPicker(client, () => setVersion((now) => now + 1));
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
    : { title, onBack: () => navigate(backlogsHomePath()), backLabel: words.backBacklogs, titleUnder: true, action: backlog ? action : undefined };

  return (
    <Shell {...shell} tabless={selecting.on}>
      <ChatAboutBacklog about={{ kind: "backlog", id: backlogId, name: title }} />
      {read.state === "loading" ? <LoadingLine /> : null}
      {read.state === "failed" ? <LoadFailed words="The board could not be read. Try again." /> : null}
      {loaded && !backlog ? <EmptyCard words="This backlog could not be found." /> : null}
      {loaded && backlog ? (
        <>
          <FilterBar query={query} onQuery={typed} count={sub} chosen={chosen} onTag={toggle} onClear={() => choose([])} />
          <ViewSwitch mayReadRules={mayReadRules} current="board" onChange={(next) => openRulebook(backlogId, next) || navigate(issuesPath(backlogId, chosen, query))} />
          <CapTintScope issues={shown} client={capsClient}>
            <TodoCountScope issues={shown} client={todoCounts}>
              <BoardColumns
                columns={columnsOf(backlog.steps, shown)}
                renderCard={(issue) =>
                  selecting.on ? (
                    <SelectableIssueRow issue={issue} chosen={chosen} selection={{ checked: selecting.has(issue.id), onChange: (checked) => selecting.toggle(issue.id, checked), label: `Select ${issue.title}` }} />
                  ) : (
                    <IssueCard issue={issue} chosen={chosen} onTag={toggle} onPriority={priorityOf(issue)} onEffort={effortOf(issue)} onOpen={() => navigate(issuePath(issue.id), backState(here.pathname + here.search, "Board"))} />
                  )
                }
              />
            </TodoCountScope>
          </CapTintScope>
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
