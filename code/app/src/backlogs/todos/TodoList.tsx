import { useState } from "react";
import { useLoad } from "../../forms/useLoad";
import { openAgencyId } from "../../agency/open";
import { Button } from "../../ui/Button";
import { loadingWords, tryAgainWords } from "../../ui/LoadState";
import { ListRow } from "../../ui/ListRow";
import { writesOf, type TodosClient } from "./api";
import { TitleForm } from "./TodoForms";
import { TodoRow } from "./TodoRow";
import { useAttempt } from "./todoEdit";
import { countOf, treeOf, type Todo } from "./todoTree";
import "./todos.css";

function AddPiece({ onAdd, refresh }: { onAdd: (title: string) => Promise<void>; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const attempt = useAttempt(refresh);
  const close = () => {
    attempt.clear();
    setOpen(false);
  };
  if (!open) return <ListRow className="todo-add" title="+ Add a piece" onClick={() => setOpen(true)} />;
  return <TitleForm label="Title of the new piece" submit="Add" busy={attempt.busy} message={attempt.message} onCancel={close} onSave={(title) => void attempt.run(() => onAdd(title)).then((done) => done && setOpen(false))} />;
}

export function TodoList({ issueId, client }: { issueId: string; client: TodosClient }) {
  const [version, setVersion] = useState(0);
  const [fresh, setFresh] = useState<Todo[] | null>(null);
  const loaded = useLoad(() => client.list(issueId), `todos:${openAgencyId()}:${issueId}:${version}`);
  const readyNow = fresh !== null || loaded.state === "ready";
  const held = fresh ?? (loaded.state === "ready" ? loaded.data : []);
  const { done, total } = countOf(held);
  const writes = writesOf(client);
  const retry = () => {
    setFresh(null);
    setVersion((now) => now + 1);
  };
  const refresh = () => {
    client.list(issueId).then(setFresh, retry);
  };
  const editing = writes ? { writes, todos: held, refresh } : undefined;
  return (
    <div className="todos">
      <div className="todos-head">
        <span>Todo list</span>
        {total > 0 ? <span className="line">{done} of {total} done</span> : null}
      </div>
      {loaded.state === "loading" && fresh === null ? (
        <p className="todos-none" role="status">
          {loadingWords}
        </p>
      ) : null}
      {loaded.state === "error" && fresh === null ? (
        <div className="todos-none">
          <p role="alert">The todo list could not be loaded.</p>
          <Button onClick={retry}>{tryAgainWords}</Button>
        </div>
      ) : null}
      {readyNow && total === 0 ? <p className="todos-none">No pieces yet.</p> : null}
      {treeOf(held).map((row) => (
        <TodoRow key={row.todo.id} row={row} editing={editing} />
      ))}
      {readyNow && writes ? <AddPiece onAdd={(title) => writes.add(issueId, title)} refresh={refresh} /> : null}
    </div>
  );
}
