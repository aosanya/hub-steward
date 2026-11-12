import { useState } from "react";
import { useLoad } from "../../forms/useLoad";
import { openAgencyId } from "../../agency/open";
import { Button } from "../../ui/Button";
import { Chip, type ChipTone } from "../../ui/Chip";
import { loadingWords, tryAgainWords } from "../../ui/LoadState";
import { ListRow } from "../../ui/ListRow";
import type { CSSProperties } from "react";
import type { TodosClient } from "./api";
import { countOf, statusOf, treeOf, type TodoRowData, type TodoState } from "./todoTree";
import "./todos.css";

const stateWords: Record<TodoState, string> = { todo: "To do", progress: "In progress", done: "Done", blocked: "Blocked" };

const stateTones: Record<TodoState, ChipTone | undefined> = { todo: undefined, progress: "info", done: "success", blocked: "danger" };

export function TodoRow({ row }: { row: TodoRowData }) {
  const state = statusOf(row.todo.status);
  return (
    <div className="todo" style={{ "--depth": row.depth } as CSSProperties}>
      <ListRow
        title={row.todo.title}
        start={<span className="rank">{row.todo.number}</span>}
        below={
          <>
            <span className="todo-meta">
              <Chip tone={stateTones[state]}>{stateWords[state]}</Chip>
              {row.waitsOn.length > 0 ? <span className="line">waits on {row.waitsOn.join(", ")}</span> : null}
            </span>
            {row.reason ? <span className="why">{row.reason}</span> : null}
          </>
        }
      />
    </div>
  );
}

export function TodoList({ issueId, client }: { issueId: string; client: TodosClient }) {
  const [version, setVersion] = useState(0);
  const loaded = useLoad(() => client.list(issueId), `todos:${openAgencyId()}:${issueId}:${version}`);
  const held = loaded.state === "ready" ? loaded.data : [];
  const { done, total } = countOf(held);
  return (
    <div className="todos">
      <div className="todos-head">
        <span>Todo list</span>
        {total > 0 ? <span className="line">{done} of {total} done</span> : null}
      </div>
      {loaded.state === "loading" ? (
        <p className="todos-none" role="status">
          {loadingWords}
        </p>
      ) : null}
      {loaded.state === "error" ? (
        <div className="todos-none">
          <p role="alert">The todo list could not be loaded.</p>
          <Button onClick={() => setVersion((now) => now + 1)}>{tryAgainWords}</Button>
        </div>
      ) : null}
      {loaded.state === "ready" && total === 0 ? <p className="todos-none">No pieces yet.</p> : null}
      {treeOf(held).map((row) => (
        <TodoRow key={row.todo.id} row={row} />
      ))}
    </div>
  );
}
