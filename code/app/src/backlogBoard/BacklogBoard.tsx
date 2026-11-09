import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../entry/language";
import { mcpBacklogsClient, type Backlog, type BacklogsClient, type Issue } from "../backlogs/api";
import { IssueRow } from "../backlogs/IssueRow";
import { backlogsHomePath, issuePath, issuesPath, queryParam, searchOf, tagParam } from "../backlogs/paths";
import { narrowed, toggled } from "../backlogs/tags";
import { backlogPagePath } from "../backlogPage/paths";
import { Chip } from "../ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { SearchBox } from "../ui/SearchBox";
import { Segmented } from "../ui/Segmented";
import { Shell } from "../ui/Shell";
import { columnsOf } from "./board";
import "./backlogBoard.css";

type Loaded = { backlog: Backlog | null; issues: Issue[] };

type Read = { state: "loading" } | { state: "failed" } | ({ state: "ready" } & Loaded);

const views = [
  { id: "list", label: "List" },
  { id: "board", label: "Board" },
] as const;

const countWords = (shown: number, steps: number) => `${shown} ${shown === 1 ? "issue" : "issues"} · ${steps} ${steps === 1 ? "step" : "steps"}`;

export function BacklogBoard({ client = mcpBacklogsClient }: { client?: BacklogsClient }) {
  const { backlogId = "" } = useParams();
  const navigate = useNavigate();
  const { words } = useLanguage();
  const [search, setSearch] = useSearchParams();
  const chosen = search.getAll(tagParam);
  const query = search.get(queryParam) ?? "";
  const [read, setRead] = useState<Read>({ state: "loading" });

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
  }, [client, backlogId]);

  const choose = (next: string[]) => setSearch(searchOf(next, query), { replace: true });
  const typed = (text: string) => setSearch(searchOf(chosen, text), { replace: true });
  const toggle = (tag: string) => choose(toggled(chosen, tag));

  const loaded = read.state === "ready" ? read : null;
  const backlog = loaded?.backlog ?? null;
  const shown = loaded ? narrowed(loaded.issues, chosen, query) : [];
  const title = backlog?.name ?? "Backlog";
  const sub = backlog ? countWords(shown.length, backlog.steps.length) : undefined;
  const action = (
    <Link className="act" to={backlogPagePath(backlogId)}>
      Backlog
    </Link>
  );

  return (
    <Shell title={title} onBack={() => navigate(backlogsHomePath())} backLabel={words.backBacklogs} action={backlog ? action : undefined}>
      {read.state === "loading" ? <LoadingLine /> : null}
      {read.state === "failed" ? <LoadFailed words="The board could not be read. Try again." /> : null}
      {loaded && !backlog ? <EmptyCard words="This backlog could not be found." /> : null}
      {loaded && backlog ? (
        <>
          <SearchBox label="Search issues" value={query} onChange={typed} />
          {sub ? <p className="sub">{sub}</p> : null}
          <Segmented items={[...views]} current="board" onChange={() => navigate(issuesPath(backlogId, chosen, query))} />
          {chosen.length > 0 ? (
            <div className="bb-chosen">
              {chosen.map((tag) => (
                <Chip key={tag} tone="accent" pressed onClick={() => toggle(tag)}>
                  {tag} ×
                </Chip>
              ))}
              <button type="button" className="bb-clear" onClick={() => choose([])}>
                Clear
              </button>
            </div>
          ) : null}
          <div className="bb-board">
            {columnsOf(backlog.steps, shown).map((column) => (
              <section key={column.step} className="bb-col" aria-label={column.step}>
                <h3>
                  <span>{column.step}</span>
                  <span>{column.issues.length}</span>
                </h3>
                {column.issues.map((issue) => (
                  <div key={issue.id} className="bb-card">
                    <IssueRow issue={issue} chosen={chosen} onTag={toggle} onOpen={() => navigate(issuePath(issue.id))} />
                  </div>
                ))}
                {column.issues.length === 0 ? <p className="bb-none">Nothing here</p> : null}
              </section>
            ))}
          </div>
        </>
      ) : null}
    </Shell>
  );
}
