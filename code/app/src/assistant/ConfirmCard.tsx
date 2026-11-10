import { useCallback, useEffect, useState } from "react";
import type { BacklogsClient } from "../backlogs/api";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { ResultDraft } from "./results";
import { cancelWords, confirmWords, nameWrite, writeLines, type Confirm, type Held, type Names, type Write } from "./confirm";

type Pending = { write: Write; seen: ResultDraft[]; settle: (confirmed: boolean) => void };

export function useConfirmation(): { pending: Pending | null; confirm: Confirm } {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback<Confirm>(
    (write, seen = []) =>
      new Promise<boolean>((resolve) =>
        setPending({
          write,
          seen,
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

export function ConfirmCard({ write, settle, held, client }: { write: Write; settle: (confirmed: boolean) => void; held: Held; client: Pick<BacklogsClient, "backlogs" | "issue"> }) {
  const [names, setNames] = useState<Names>({});
  useEffect(() => {
    let current = true;
    void nameWrite(write, held, client).then((found) => current && setNames(found));
    return () => {
      current = false;
    };
  }, [write]);
  return (
    <Card>
      {writeLines(write, names).map((line) => (
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
