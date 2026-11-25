import { Chip } from "../../../shared/ui/Chip";
import { chipOrder } from "./statuses";
import type { RuleKind } from "./types";
import { rowWords, statusWords } from "./words";
import "../shared/backlogs.css";

type Props = { kind: RuleKind; chosen: string[]; onToggle: (status: string) => void };

export function StatusChips({ kind, chosen, onToggle }: Props) {
  const words = statusWords[kind] as Record<string, string>;
  return (
    <div className="issue-tags" role="group" aria-label={rowWords.status}>
      {chipOrder(kind).map((status) => (
        <Chip key={status} pressed={chosen.includes(status)} onClick={() => onToggle(status)}>
          {words[status] ?? status}
        </Chip>
      ))}
    </div>
  );
}
