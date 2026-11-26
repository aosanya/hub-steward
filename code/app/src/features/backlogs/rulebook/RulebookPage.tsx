import { useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Shell } from "../../../app/Shell";
import { useLanguage } from "../../../shared/language/language";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { EmptyCard, LoadFailed, LoadingLine } from "../../../shared/ui/LoadState";
import { backState } from "../../../shared/ui/backTo";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { useLoad } from "../../forms/useLoad";
import { ViewSwitch, type View } from "../board/ViewSwitch";
import { allIssuesId, mcpBacklogsClient, type BacklogsClient } from "../shared/api";
import { ChatAboutBacklog } from "../shared/ChatAboutBacklog";
import { QuestionsList, mcpQuestionsClient, type QuestionsClient } from "../questions";
import { FilterBar } from "../shared/FilterBar";
import { backlogsHomePath, queryParam } from "../shared/paths";
import { allIssuesTitle, backlogTitle } from "../shared/titles";
import { bookPath } from "../book/paths";
import { guardedRulebook } from "./access";
import { mcpRulebookClient } from "./api";
import { issueViewPath } from "./otherViews";
import { rulebookPath } from "./paths";
import { narrowedRules } from "./search";
import { RulesTable } from "./RulesTable";
import { firstOn, kindStatuses } from "./statuses";
import { StatusChips } from "./StatusChips";
import type { Answer, Rule, RuleKind, RulebookClient } from "./types";
import { rulebookKindOf, viewOfKind } from "./viewChoice";
import { countWords, emptyWords, loadFailedWords, noAccessWords, noMatchWords, noSearchMatchWords, searchWords, viewWords } from "./words";
import { readAsBookButton, readAsBookHint } from "../book/words";
import "./rulebook.css";

type Props = { client?: RulebookClient; backlogs?: BacklogsClient; questions?: QuestionsClient };

const kindOf = (value: string | null): RuleKind => (value === "decision" || value === "question" ? value : "rule");

const startStatuses = (kind: RuleKind, asked: string[]) => {
  const offered = asked.filter((status) => kindStatuses[kind].includes(status));
  return offered.length > 0 ? offered : firstOn[kind];
};

const noRules: Answer<Rule[]> = { state: "ready", data: [] };

type ListProps = { client: RulebookClient; backlogs: BacklogsClient; questions: QuestionsClient; backlogId: string; kind: RuleKind; asked: string[]; asking: string };

function RulebookList({ client, backlogs, questions, backlogId, kind, asked, asking }: ListProps) {
  const navigate = useNavigate();
  const here = useLocation();
  const { words } = useLanguage();
  const [chosen, setChosen] = useState(() => startStatuses(kind, asked));
  const [query, setQuery] = useState(asking);
  const [version, setVersion] = useState(0);
  const agency = openAgencyId();
  const known = useLoad(() => backlogs.backlogs(), `rulebook-backlogs:${agency}`);
  const backlog = known.state === "ready" ? known.data.find((one) => one.id === backlogId) : undefined;
  const title = backlogId === allIssuesId ? allIssuesTitle : (backlog?.name ?? backlogTitle);
  const read = useLoad(() => (chosen.length === 0 ? Promise.resolve(noRules) : client.list(backlogId, kind, { statuses: chosen })), `rulebook:${agency}:${backlogId}:${kind}:${chosen.join(",")}:${version}`);
  const answer = read.state === "ready" ? read.data : null;
  const loaded = answer?.state === "ready" ? answer.data : [];
  const held = narrowedRules(loaded, query);
  const toggle = (status: string) => {
    const next = chosen.includes(status) ? chosen.filter((one) => one !== status) : [...chosen, status];
    setChosen(next);
    if (next.length > 0) navigate(rulebookPath(backlogId, kind, next, query), { replace: true });
  };
  const typed = (text: string) => {
    setQuery(text);
    navigate(rulebookPath(backlogId, kind, chosen, text), { replace: true });
  };
  const openBook = () => navigate(bookPath(), backState(here.pathname + here.search, viewWords.rules));
  const choose = (next: View) => {
    const asked = rulebookKindOf(next);
    if (asked) navigate(rulebookPath(backlogId, asked));
    else navigate(issueViewPath(backlogId, backlog, next === "list" ? "list" : "board"));
  };
  const about = backlogId === allIssuesId ? { kind: "backlogs" as const, id: allIssuesId, name: title } : { kind: "backlog" as const, id: backlogId, name: title };
  return (
    <Shell title={title} titleUnder onBack={() => navigate(backlogsHomePath())} backLabel={words.backBacklogs}>
      <ChatAboutBacklog about={about} />
      {answer?.state === "no_access" ? (
        <EmptyCard words={noAccessWords} />
      ) : (
        <>
          <FilterBar label={searchWords[kind]} query={query} onQuery={typed} count={answer?.state === "ready" ? countWords(kind, held.length) : undefined} chosen={[]} onTag={() => undefined} save={kind === "rule" ? <Button onClick={openBook} title={readAsBookHint}><Icon name="book" />{readAsBookButton}</Button> : undefined} />
          <ViewSwitch mayReadRules current={viewOfKind[kind]} onChange={choose} />
          <StatusChips kind={kind} chosen={chosen} onToggle={toggle} />
          {read.state === "loading" ? <LoadingLine /> : null}
          {read.state === "error" || (answer && answer.state !== "ready") ? <LoadFailed words={loadFailedWords.list} onRetry={() => setVersion((now) => now + 1)} /> : null}
          {answer?.state === "ready" && held.length === 0 ? <EmptyCard words={chosen.length === 0 ? noMatchWords : loaded.length > 0 ? noSearchMatchWords : emptyWords[kind]} /> : null}
          {held.length > 0 && kind === "question" ? <QuestionsList backlogId={backlogId} statuses={chosen} client={questions} query={query} state={backState(here.pathname + here.search, viewWords[viewOfKind[kind]]).state} /> : null}
          {held.length > 0 && kind !== "question" ? <RulesTable rules={held} state={backState(here.pathname + here.search, viewWords[viewOfKind[kind]]).state} /> : null}
        </>
      )}
    </Shell>
  );
}

export function RulebookPage({ client = guardedRulebook(mcpRulebookClient()), backlogs = mcpBacklogsClient, questions = mcpQuestionsClient }: Props) {
  const backlogId = useParams().backlogId ?? allIssuesId;
  const [search] = useSearchParams();
  const kind = kindOf(search.get("kind"));
  return <RulebookList key={`${backlogId}:${kind}`} client={client} backlogs={backlogs} questions={questions} backlogId={backlogId} kind={kind} asked={search.getAll("status")} asking={search.get(queryParam) ?? ""} />;
}
