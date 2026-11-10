import { mcpSendClient } from "./api";
import { canSendFrom } from "./leftOut";
import type { Selecting } from "./selection";
import type { SendClient } from "./types";
import { useTargets } from "./useTargets";
import { allWords, cancelWords, selectedWords, selectWords, sendWords, someOnlySeenWords } from "./words";
import "./sendToBacklog.css";

export function SelectButton({ onStart }: { onStart: () => void }) {
  return (
    <button type="button" className="send-act" onClick={onStart}>
      {selectWords}
    </button>
  );
}

export const selectingShell = (selecting: Selecting, shownIds: string[]) => ({
  title: selectedWords(selecting.count),
  onBack: selecting.cancel,
  backLabel: cancelWords,
  action: (
    <button type="button" className="send-act" onClick={() => selecting.selectAll(shownIds)}>
      {allWords}
    </button>
  ),
});

type SendBarProps = { count: number; from?: string[]; client?: SendClient; onSend: () => void };

export function SendBar({ count, from = [], client = mcpSendClient, onSend }: SendBarProps) {
  const targets = useTargets(client);
  const onlySeen = targets.state === "ready" && !canSendFrom(targets.data, from);
  return (
    <div className="bottombar">
      {onlySeen ? <p className="sub">{someOnlySeenWords}</p> : null}
      <button type="button" className="btn primary" disabled={count === 0 || onlySeen} onClick={onSend}>
        {sendWords}
      </button>
    </div>
  );
}
