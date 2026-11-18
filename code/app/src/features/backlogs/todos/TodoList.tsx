import { useState } from "react";
import { useLoad } from "../../../features/forms/useLoad";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { Button } from "../../../shared/ui/Button";
import { loadingWords, tryAgainWords } from "../../../shared/ui/LoadState";
import { Card } from "../../../shared/ui/Card";
import { writesOf, type TodosClient } from "./api";
import { PieceForm } from "./TodoForms";
import { TodoRow } from "./TodoRow";
import { useAttempt } from "./todoEdit";
import { countOf, treeOf, type Todo } from "./todoTree";
import "./todos.css";

function AddPiece({ onAdd, refresh, onClose }: { onAdd: (title: string, details: string) => Promise<void>; refresh: () => void; onClose: () => void }) {
  const attempt = useAttempt(refresh);
  const close = () => {
    attempt.clear();
    onClose();
  };
  return <PieceForm submit="Add" busy={attempt.busy} message={attempt.message} onCancel={close} onSave={(title, details) => void attempt.run(() => onAdd(title, details)).then((done) => done && onClose())} />;
}

export function TodoList({ issueId, client }: { issueId: string; client: TodosClient }) {
  const [version, setVersion] = useState(0);
  const [fresh, setFresh] = useState<Todo[] | null>(null);
  const [adding, setAdding] = useState(false);
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
    <Card
      title={
        <>
          <span>Todo list</span>
          {total > 0 ? <span className="line"> {done} of {total} done</span> : null}
        </>
      }
      flush
      footer={readyNow && writes && !adding ? <Button onClick={() => setAdding(true)}>Add a piece</Button> : undefined}
    >
    <div className="todos">
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
      {readyNow && writes && adding ? <AddPiece onAdd={(title, details) => writes.add(issueId, title, details)} refresh={refresh} onClose={() => setAdding(false)} /> : null}
    </div>
    </Card>
  );
}
