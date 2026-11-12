import { useState } from "react";
import type { Todo } from "./todoTree";

export const waitingOn = (todo: Todo, todos: Todo[]): Set<string> => {
  const found = new Set<string>();
  const grow = (id: string) =>
    todos.forEach((one) => {
      if (one.waitsOn.includes(id) && !found.has(one.id)) {
        found.add(one.id);
        grow(one.id);
      }
    });
  grow(todo.id);
  return found;
};

export const waitChoices = (todo: Todo, todos: Todo[]): Todo[] => {
  const blocked = waitingOn(todo, todos);
  return todos.filter((one) => one.id !== todo.id && !blocked.has(one.id)).sort((a, b) => a.number - b.number);
};

const toolPrefix = /^taskmanager_[a-z_]+:\s*/;

export const refusalOf = (error: unknown): string => {
  const words = error instanceof Error ? error.message.replace(toolPrefix, "").trim() : "";
  return words || "The change was not made.";
};

export function useAttempt(after: () => void) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const run = async (write: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setMessage("");
    try {
      await write();
    } catch (error) {
      setMessage(refusalOf(error));
      setBusy(false);
      return false;
    }
    setBusy(false);
    after();
    return true;
  };
  return { busy, message, run, clear: () => setMessage("") };
}
