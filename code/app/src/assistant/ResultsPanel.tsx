import { useEffect, useState } from "react";
import { IssueRow } from "../backlogs/IssueRow";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ListRow, Rows } from "../ui/ListRow";
import { Segmented } from "../ui/Segmented";
import { chatTabWords, emptyResultsWords, labelOf, newResultsWords, noIssuesWords, pageSize, resultsOf, resultsTabWords, showMoreWords, type ResultList } from "./results";
import "./results.css";

export type Tab = "chat" | "results";

export function useResults(items: { lists?: ResultList[] }[]) {
  const results = resultsOf(items);
  const [tab, setTab] = useState<Tab>("chat");
  const [picked, setPicked] = useState("");
  const [seen, setSeen] = useState(0);
  const newest = results[0]?.id ?? "";
  useEffect(() => setPicked(newest), [newest]);
  useEffect(() => {
    if (tab === "results") setSeen(results.length);
  }, [tab, results.length]);
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

type PanelProps = { results: ResultList[]; picked: string; onPick: (id: string) => void; onOpen: (id: string) => void };

export function ResultsPanel({ results, picked, onPick, onOpen }: PanelProps) {
  const [visible, setVisible] = useState<Record<string, number>>({});
  const list = results.find((one) => one.id === picked) ?? results[0];
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
        {list.issues.length === 0 ? (
          <p className="assistant-empty">{noIssuesWords}</p>
        ) : (
          <Rows>
            {list.issues.slice(0, shown).map((issue) => (
              <IssueRow key={issue.id} issue={issue} chosen={[]} onOpen={() => onOpen(issue.id)} chevron />
            ))}
          </Rows>
        )}
        {list.total > list.issues.length ? <p className="assistant-count">{`Showing ${list.issues.length} of ${list.total}`}</p> : null}
        {list.issues.length > shown ? <Button onClick={() => setVisible({ ...visible, [list.id]: shown + pageSize })}>{showMoreWords}</Button> : null}
      </Card>
    </div>
  );
}
