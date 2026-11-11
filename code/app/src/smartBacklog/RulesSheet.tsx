import { ListRow, Rows } from "../ui/ListRow";
import { Sheet } from "../ui/Sheet";
import type { RuleSet } from "./types";
import { matchWords, ruleWords, rulesSheetTitle } from "./words";

type Props = { set: RuleSet; onClose: () => void };

export function RulesSheet({ set, onClose }: Props) {
  return (
    <Sheet title={rulesSheetTitle} onClose={onClose}>
      <p className="sub">{matchWords(set.match)}</p>
      <Rows role="list">
        {set.rules.map((rule, index) => (
          <ListRow key={index} role="listitem" title={ruleWords(rule)} />
        ))}
      </Rows>
    </Sheet>
  );
}
