import type { Selecting } from "./selection";
import { allWords, cancelWords, selectedWords, selectWords, sendWords } from "./words";
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

export function SendBar({ count, onSend }: { count: number; onSend: () => void }) {
  return (
    <div className="bottombar">
      <button type="button" className="btn primary" disabled={count === 0} onClick={onSend}>
        {sendWords}
      </button>
    </div>
  );
}
