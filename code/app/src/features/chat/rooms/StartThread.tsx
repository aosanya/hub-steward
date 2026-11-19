import { useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Field } from "../../../shared/ui/Field";

type Words = { open: string; about: string; problem: string };

const threadWords: Words = { open: "Start a thread", about: "What is the thread about?", problem: "The thread was not started. Try again." };

export const questionWords: Words = { open: "Ask a question", about: "What is your question about?", problem: "Your question was not sent. Try again." };

export function StartThread({ onStart, bare = false, words = threadWords }: { onStart: (label: string) => Promise<void>; bare?: boolean; words?: Words }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [problem, setProblem] = useState("");
  const start = async () => {
    setProblem("");
    try {
      await onStart(label.trim());
    } catch {
      setProblem(words.problem);
    }
  };
  if (!open) return <Button onClick={() => setOpen(true)}>{words.open}</Button>;
  const form = (
    <>
      <Field label={words.about} value={label} onChange={(e) => setLabel(e.target.value)} error={problem} />
      <Button kind="primary" disabled={label.trim() === ""} onClick={start}>
        Start
      </Button>
    </>
  );
  return bare ? form : <Card>{form}</Card>;
}
