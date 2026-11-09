import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { mcpBacklogsClient, type Backlog, type BacklogsClient, type Issue } from "../backlogs/api";
import { backlogsHomePath, issuesPath, tagParam } from "../backlogs/paths";
import { tagsOf, toggled, toneOf, withAllTags } from "../backlogs/tags";
import { backlogPagePath } from "../backlogPage/paths";
import { Chip } from "../ui/Chip";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
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
  const [search, setSearch] = useSearchParams();
  const chosen = search.getAll(tagParam);
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

  const choose = (next: string[]) => setSearch(new URLSearchParams(next.map((tag) => [tagParam, tag])), { replace: true });
  const toggle = (tag: string) => choose(toggled(chosen, tag));

  const loaded = read.state === "ready" ? read : null;
  const backlog = loaded?.backlog ?? null;
  const shown = loaded ? withAllTags(loaded.issues, chosen) : [];
  const title = backlog?.name ?? "Backlog";
  const sub = backlog ? countWords(shown.length, backlog.steps.length) : undefined;
  const action = (
    <Link className="act" to={backlogPagePath(backlogId)}>
      Backlog
    </Link>
  );

  return (
    <Shell title={title} sub={sub} onBack={() => navigate(backlogsHomePath())} action={backlog ? action : undefined}>
      {read.state === "loading" ? <LoadingLine /> : null}
      {read.state === "failed" ? <LoadFailed words="The board could not be read. Try again." /> : null}
      {loaded && !backlog ? <EmptyCard words="This backlog could not be found." /> : null}
      {loaded && backlog ? (
        <>
          <Segmented items={[...views]} current="board" onChange={() => navigate(issuesPath(backlogId, chosen))} />
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
                  <article key={issue.id} className="bb-card">
                    <span className="bb-title">{issue.title}</span>
                    <span className="bb-meta">
                      {tagsOf(issue).map((tag) => (
                        <Chip key={tag} tone={toneOf(tag, issue)} pressed={chosen.includes(tag)} onClick={() => toggle(tag)}>
                          {tag}
                        </Chip>
                      ))}
                    </span>
                  </article>
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
