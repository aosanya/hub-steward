import { useState } from "react";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Field } from "../../ui/Field";

export function StartThread({ onStart, bare = false }: { onStart: (label: string) => Promise<void>; bare?: boolean }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [problem, setProblem] = useState("");
  const start = async () => {
    setProblem("");
    try {
      await onStart(label.trim());
    } catch {
      setProblem("The thread was not started. Try again.");
    }
  };
  if (!open) return <Button onClick={() => setOpen(true)}>Start a thread</Button>;
  const form = (
    <>
      <Field label="What is the thread about?" value={label} onChange={(e) => setLabel(e.target.value)} error={problem} />
      <Button kind="primary" disabled={label.trim() === ""} onClick={start}>
        Start
      </Button>
    </>
  );
  return bare ? form : <Card>{form}</Card>;
}
