import { useCallback, useState } from "react";
import { useI18n } from "../../i18n";
import type { Outcome } from "./sendAction";

export type Note = { text: string; failed: boolean };

export const noNote: Note = { text: "", failed: false };

export function useOutcomeNote(onDone: () => void) {
  const { t } = useI18n();
  const [note, setNote] = useState<Note>(noNote);

  const report = useCallback(
    (result: Outcome) => {
      if (result === "accepted") setNote({ text: t("waitingForApproval"), failed: false });
      else if (result === "failed") setNote({ text: t("submitFailed"), failed: true });
      else setNote(noNote);
      if (result === "done") onDone();
    },
    [t, onDone],
  );

  const clear = useCallback(() => setNote(noNote), []);

  return { note, report, clear };
}
