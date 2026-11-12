import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../../ui/Button";
import { ChoiceGroup, ChoiceRow } from "../../ui/ChoiceRow";
import { Field } from "../../ui/Field";
import { TextArea } from "../../ui/TextArea";
import type { SettableStatus } from "./api";
import { statusOf, type Todo } from "./todoTree";

type Shell = { onSubmit: () => void; onCancel: () => void; submit: string; ready: boolean; busy: boolean; message: string; children: ReactNode };

function FormShell({ onSubmit, onCancel, submit, ready, busy, message, children }: Shell) {
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (ready && !busy) onSubmit();
  };
  return (
    <form className="todo-edit" onSubmit={send}>
      {children}
      {message ? (
        <p className="ferr" role="alert">
          {message}
        </p>
      ) : null}
      <div className="todo-btns">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button kind="primary" type="submit" disabled={!ready || busy}>
          {submit}
        </Button>
      </div>
    </form>
  );
}

type Common = { busy: boolean; message: string; onCancel: () => void };

export function TitleForm({ label, submit, start = "", onSave, ...common }: Common & { label: string; submit: string; start?: string; onSave: (title: string) => void }) {
  const [title, setTitle] = useState(start);
  return (
    <FormShell {...common} submit={submit} ready={title.trim() !== ""} onSubmit={() => onSave(title.trim())}>
      <Field label={label} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
    </FormShell>
  );
}

export function WaitsOnForm({ todo, choices, onSave, ...common }: Common & { todo: Todo; choices: Todo[]; onSave: (ids: string[]) => void }) {
  const [ticked, setTicked] = useState(() => todo.waitsOn.filter((id) => choices.some((one) => one.id === id)));
  const flip = (id: string, on: boolean) => setTicked(choices.map((one) => one.id).filter((one) => (one === id ? on : ticked.includes(one))));
  return (
    <FormShell {...common} submit="Save" ready onSubmit={() => onSave(ticked)}>
      <ChoiceGroup label={`Piece ${todo.number} · Waits on`}>
        {choices.length === 0 ? <p className="line">No other piece can be waited on.</p> : null}
        {choices.map((one) => (
          <ChoiceRow key={one.id} type="checkbox" label={`${one.number} ${one.title}`} checked={ticked.includes(one.id)} onChange={(on) => flip(one.id, on)} />
        ))}
      </ChoiceGroup>
    </FormShell>
  );
}

export function ReasonForm({ todo, onSave, ...common }: Common & { todo: Todo; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <FormShell {...common} submit="Mark Blocked" ready={reason.trim() !== ""} onSubmit={() => onSave(reason.trim())}>
      <TextArea label={`Piece ${todo.number} · Why is it blocked?`} value={reason} onChange={(event) => setReason(event.target.value)} autoFocus />
    </FormShell>
  );
}

const settable: SettableStatus[] = ["To do", "In progress", "Done"];

export function StatusChoices({ todo, busy, message, onCancel, onPick, onBlocked }: Common & { todo: Todo; onPick: (status: SettableStatus) => void; onBlocked: () => void }) {
  const current = statusOf(todo.status);
  const now: Record<string, string> = { todo: "To do", progress: "In progress", done: "Done", blocked: "Blocked" };
  const choice = (word: string, pick: () => void) => (
    <Button key={word} onClick={pick} disabled={busy} aria-current={now[current] === word ? "true" : undefined}>
      {word}
    </Button>
  );
  return (
    <div className="todo-edit">
      <div className="todo-btns">
        {settable.map((word) => choice(word, () => onPick(word)))}
        {choice("Blocked", onBlocked)}
      </div>
      {message ? (
        <p className="ferr" role="alert">
          {message}
        </p>
      ) : null}
      <div className="todo-btns">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
