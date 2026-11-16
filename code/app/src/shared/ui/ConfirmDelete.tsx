import { useState } from "react";
import { Button } from "./Button";

type Props = { label: string; question: string; onDelete: () => void; busy: boolean; disabled?: boolean };

export function ConfirmDelete({ label, question, onDelete, busy, disabled = false }: Props) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button kind="danger" onClick={() => setConfirming(true)} disabled={busy || disabled}>
        {label}
      </Button>
    );
  }
  return (
    <>
      <p className="ferr" role="alert">{question}</p>
      <Button kind="danger" onClick={onDelete} disabled={busy}>
        Delete
      </Button>
      <Button onClick={() => setConfirming(false)} disabled={busy}>
        Cancel
      </Button>
    </>
  );
}
