import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { openAgencyId } from "../agency/open";
import { useLoad } from "../forms/useLoad";
import { mcpBacklogsClient } from "../backlogs/api";
import { issuePath } from "../backlogs/paths";
import { backState } from "../ui/backTo";
import { IssueRow } from "../backlogs/IssueRow";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ListRow, Rows } from "../ui/ListRow";
import { Segmented } from "../ui/Segmented";
import { assistantBackWords, chatTabWords, emptyResultsWords, labelOf, newResultsWords, backlogsView, openAllTarget, openAllWholeNote, pageSize, resultsOf, resultsTabWords, showMoreWords, type ResultList } from "./results";
import { keepConversation, keptConversation, type Tab } from "./session";
import "./results.css";

export type { Tab };

export function useResults(items: { lists?: ResultList[] }[]) {
  const results = resultsOf(items);
  const [tab, setTab] = useState<Tab>(() => keptConversation().tab);
  const [picked, setPicked] = useState(() => keptConversation().picked);
  const [seen, setSeen] = useState(() => keptConversation().seen);
  const restored = useRef(results.some((one) => one.id === picked));
  const newest = results[0]?.id ?? "";
  useEffect(() => {
    if (restored.current) restored.current = false;
    else setPicked(newest);
  }, [newest]);
  useEffect(() => {
    if (tab === "results") setSeen(results.length);
  }, [tab, results.length]);
  useEffect(() => keepConversation({ tab, picked, seen }), [tab, picked, seen]);
  const pick = (id: string) => {
    setPicked(id);
    setTab("results");
  };
  return { results, tab, setTab, picked, setPicked, pick, unseen: tab === "chat" && results.length > seen };
}

export function ResultTabs({ tab, onTab, unseen }: { tab: Tab; onTab: (tab: Tab) => void; unseen: boolean }) {
  return (
    <Segmented
      label="Conversation"
      current={tab}
      onChange={onTab}
      items={[
        { id: "chat", label: chatTabWords },
        {
          id: "results",
          label: (
            <>
              {resultsTabWords}
              {unseen ? <i className="assistant-dot" role="img" aria-label={newResultsWords} /> : null}
            </>
          ),
        },
      ]}
    />
  );
}

export function ListEntries({ lists, onPick }: { lists: ResultList[]; onPick: (id: string) => void }) {
  return (
    <Rows>
      {lists.map((list) => (
        <ListRow key={list.id} title={labelOf(list)} end="›" onClick={() => onPick(list.id)} />
      ))}
    </Rows>
  );
}

type PanelProps = { results: ResultList[]; picked: string; onPick: (id: string) => void; onOpen?: (id: string) => void };

export function ResultsPanel({ results, picked, onPick, onOpen }: PanelProps) {
  const [visible, setVisible] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const here = useLocation();
  const list = results.find((one) => one.id === picked) ?? results[0];
  const unnamed = list?.issues.some((issue) => issue.backlog === "" && (issue.backlogId ?? "") !== "") ?? false;
  const cutShort = list !== undefined && list.view !== backlogsView && list.total > list.issues.length;
  const namesBacklog = cutShort && (list.filter?.backlog ?? "") !== "";
  const wanted = unnamed || namesBacklog;
  const backlogs = useLoad(() => (wanted ? mcpBacklogsClient.backlogs() : Promise.resolve([])), `result-backlogs:${openAgencyId()}:${wanted}`);
  const known = backlogs.state === "ready" ? backlogs.data : [];
  const names = new Map(known.map((one) => [one.id, one.name]));
  const openAll = cutShort ? openAllTarget(list, known) : null;
  const open = onOpen ?? ((id: string) => navigate(issuePath(id), backState(here.pathname + here.search, assistantBackWords)));
  if (!list) {
    return (
      <Card>
        <p className="assistant-empty">{emptyResultsWords}</p>
      </Card>
    );
  }
  const shown = visible[list.id] ?? pageSize;
  return (
    <div className="assistant-results">
      <label className="input">
        <select aria-label={resultsTabWords} value={list.id} onChange={(event) => onPick(event.target.value)}>
          {results.map((one) => (
            <option key={one.id} value={one.id}>
              {labelOf(one)}
            </option>
          ))}
        </select>
      </label>
      <Card title={labelOf(list)} flush>
        <Rows>
          {list.issues.slice(0, shown).map((issue) => (
            <IssueRow key={issue.id} issue={issue.backlog === "" ? { ...issue, backlog: names.get(issue.backlogId ?? "") ?? "" } : issue} chosen={[]} onOpen={() => open(issue.id)} chevron />
          ))}
        </Rows>
        {list.total > list.issues.length ? <p className="assistant-count">{`Showing ${list.issues.length} of ${list.total}`}</p> : null}
        {list.issues.length > shown ? <Button onClick={() => setVisible({ ...visible, [list.id]: shown + pageSize })}>{showMoreWords}</Button> : null}
        {openAll ? (
          <>
            {openAll.whole ? <p className="assistant-count">{openAllWholeNote}</p> : null}
            <Button onClick={() => navigate(openAll.to, backState(here.pathname + here.search, assistantBackWords))}>{openAll.label}</Button>
          </>
        ) : null}
      </Card>
    </div>
  );
}
