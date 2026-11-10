import { useCallback, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cancelWords, confirmWords, writeLines, type Confirm, type Write } from "./confirm";

type Pending = { write: Write; settle: (confirmed: boolean) => void };

export function useConfirmation(): { pending: Pending | null; confirm: Confirm } {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback<Confirm>(
    (write) =>
      new Promise<boolean>((resolve) =>
        setPending({
          write,
          settle: (confirmed) => {
            setPending(null);
            resolve(confirmed);
          },
        }),
      ),
    [],
  );
  return { pending, confirm };
}

export function ConfirmCard({ write, settle }: { write: Write; settle: (confirmed: boolean) => void }) {
  return (
    <Card>
      {writeLines(write).map((line) => (
        <p key={line}>{line}</p>
      ))}
      <div className="rm-btns">
        <Button kind="primary" onClick={() => settle(true)}>
          {confirmWords[write.tool] ?? "Confirm"}
        </Button>
        <Button onClick={() => settle(false)}>{cancelWords}</Button>
      </div>
    </Card>
  );
}
