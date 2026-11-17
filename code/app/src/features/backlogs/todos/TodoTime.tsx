import { useEffect, useState } from "react";
import { useLanguage } from "../../../shared/language/language";
import { Chip } from "../../../shared/ui/Chip";
import { ageOfSpan, ageWords } from "../../../shared/ui/age";
import { statusOf, type Todo } from "./todoTree";

const minute = 60_000;

const useRunningMilliseconds = (read: number, running: boolean) => {
  const [passed, setPassed] = useState(0);
  useEffect(() => {
    setPassed(0);
    if (!running) return;
    const readAt = Date.now();
    const timer = setInterval(() => setPassed(Date.now() - readAt), minute);
    return () => clearInterval(timer);
  }, [read, running]);
  return read + passed;
};

export function TodoTime({ todo }: { todo: Todo }) {
  const { words } = useLanguage();
  const running = !todo.doneAt && statusOf(todo.status) !== "done";
  const read = (todo.elapsedSeconds ?? 0) * 1000;
  const milliseconds = useRunningMilliseconds(read, running && todo.elapsedSeconds !== undefined);
  if (todo.elapsedSeconds === undefined) return null;
  return <Chip>{ageWords(ageOfSpan(milliseconds), words)}</Chip>;
}
