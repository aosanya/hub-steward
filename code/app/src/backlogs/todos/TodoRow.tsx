import { useState, type CSSProperties } from "react";
import { ActionsMenu } from "../../ui/ActionsMenu";
import { Chip, type ChipTone } from "../../ui/Chip";
import { ListRow } from "../../ui/ListRow";
import type { TodoWrites } from "./api";
import { ReasonForm, StatusChoices, TitleForm, WaitsOnForm } from "./TodoForms";
import { useAttempt, waitChoices } from "./todoEdit";
import { statusOf, type Todo, type TodoRowData, type TodoState } from "./todoTree";

const stateWords: Record<TodoState, string> = { todo: "To do", progress: "In progress", done: "Done", blocked: "Blocked" };

const stateTones: Record<TodoState, ChipTone | undefined> = { todo: undefined, progress: "info", done: "success", blocked: "danger" };

type Mode = "rename" | "waits" | "status" | "blocked" | null;

type Editing = { writes: TodoWrites; todos: Todo[]; refresh: () => void };

export function TodoRow({ row, editing }: { row: TodoRowData; editing?: Editing }) {
  const state = statusOf(row.todo.status);
  const [mode, setMode] = useState<Mode>(null);
  const attempt = useAttempt(() => editing?.refresh());
  const open = (next: Mode) => () => {
    attempt.clear();
    setMode(next);
  };
  const close = open(null);
  const apply = (write: () => Promise<void>) => attempt.run(write).then((done) => done && setMode(null));
  const form = { busy: attempt.busy, message: attempt.message, onCancel: close };
  const actions = editing
    ? [
        { label: "Rename", onSelect: open("rename") },
        { label: "Waits on", onSelect: open("waits") },
        { label: "Set status", onSelect: open("status") },
        { label: "Mark Blocked", onSelect: open("blocked") },
        { label: "Delete", danger: true, onSelect: () => void apply(() => editing.writes.remove(row.todo.id)) },
      ]
    : [];
  return (
    <div className="todo" style={{ "--depth": row.depth } as CSSProperties}>
      <ListRow
        title={row.todo.title}
        start={<span className="rank">{row.todo.number}</span>}
        end={editing ? <ActionsMenu icon="⋯" label={`Piece ${row.todo.number} menu`} actions={actions} /> : undefined}
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
      {editing && mode === null && attempt.message ? (
        <p className="ferr todo-note" role="alert">
          {attempt.message}
        </p>
      ) : null}
      {editing && mode === "rename" ? <TitleForm {...form} label={`Piece ${row.todo.number} · Title`} submit="Done" start={row.todo.title} onSave={(title) => void apply(() => editing.writes.rename(row.todo.id, title))} /> : null}
      {editing && mode === "waits" ? <WaitsOnForm {...form} todo={row.todo} choices={waitChoices(row.todo, editing.todos)} onSave={(ids) => void apply(() => editing.writes.setWaitsOn(row.todo.id, ids))} /> : null}
      {editing && mode === "blocked" ? <ReasonForm {...form} todo={row.todo} onSave={(reason) => void apply(() => editing.writes.block(row.todo.id, reason))} /> : null}
      {editing && mode === "status" ? <StatusChoices {...form} todo={row.todo} onPick={(status) => void apply(() => editing.writes.setStatus(row.todo.id, status))} onBlocked={open("blocked")} /> : null}
    </div>
  );
}
