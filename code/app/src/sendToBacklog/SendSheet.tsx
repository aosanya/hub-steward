import { ListRow, Rows } from "../ui/ListRow";
import { Sheet } from "../ui/Sheet";
import type { Target } from "./types";
import { landsAtWords, noTargetsWords, sheetTitleWords } from "./words";

type Props = { count: number; targets: Target[]; onPick: (target: Target) => void; onClose: () => void };

export function SendSheet({ count, targets, onPick, onClose }: Props) {
  return (
    <Sheet title={sheetTitleWords(count)} onClose={onClose}>
      {targets.length === 0 ? (
        <p className="sub">{noTargetsWords}</p>
      ) : (
        <Rows>
          {targets.map((target) => (
            <ListRow key={target.backlogId} title={target.name} meta={landsAtWords(target)} end="›" onClick={() => onPick(target)} />
          ))}
        </Rows>
      )}
    </Sheet>
  );
}
