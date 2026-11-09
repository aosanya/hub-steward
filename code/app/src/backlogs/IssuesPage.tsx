import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../entry/language";
import { useLoad } from "../forms/useLoad";
import { openAgencyId } from "../agency/open";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { Rows } from "../ui/ListRow";
import { Segmented } from "../ui/Segmented";
import { Shell } from "../ui/Shell";
import "./backlogs.css";
import { allIssuesId, mcpBacklogsClient, type BacklogsClient } from "./api";
import { FilterBar } from "./FilterBar";
import { IssueRow } from "./IssueRow";
import { backlogsHomePath, boardPath, issuePath, queryParam, searchOf, tagParam } from "./paths";
import { countWords, narrowed, toggled } from "./tags";

export function IssuesPage({ client = mcpBacklogsClient }: { client?: BacklogsClient }) {
  const navigate = useNavigate();
  const { words } = useLanguage();
  const backlogId = useParams().backlogId ?? allIssuesId;
  const [search, setSearch] = useSearchParams();
  const chosen = search.getAll(tagParam);
  const query = search.get(queryParam) ?? "";
  const key = `issues:${openAgencyId()}:${backlogId}`;
  const issues = useLoad(() => client.issues(backlogId), key);
  const backlogs = useLoad(() => client.backlogs(), `backlogs:${openAgencyId()}`);
  const title = backlogId === allIssuesId ? "All issues" : backlogs.state === "ready" ? (backlogs.data.find((one) => one.id === backlogId)?.name ?? "Backlog") : "Backlog";
  const choose = (tag: string) => setSearch(searchOf(toggled(chosen, tag), query), { replace: true });
  const typed = (text: string) => setSearch(searchOf(chosen, text), { replace: true });
  const filtering = chosen.length > 0 || query.trim() !== "";
  const shown = issues.state === "ready" ? narrowed(issues.data, chosen, query) : [];
  const total = issues.state === "ready" ? issues.data.length : 0;
  const sub = issues.state === "ready" && total > 0 ? countWords(shown.length, total, filtering) : undefined;
  return (
    <Shell title={title} onBack={() => navigate(backlogsHomePath())} backLabel={words.backBacklogs}>
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
          {shown.map((issue) => (
            <IssueRow key={issue.id} issue={issue} chosen={chosen} onOpen={() => navigate(issuePath(issue.id))} onTag={choose} />
          ))}
        </Rows>
      ) : null}
      {total > 0 && shown.length === 0 ? <EmptyCard words="No issues match" /> : null}
    </Shell>
  );
}
