import { useState } from "react";
import { Chip } from "../ui/Chip";
import { RulesSheet } from "./RulesSheet";
import type { RuleSet } from "./types";
import { moreWords, ruleWords } from "./words";

export function RulesHead({ set }: { set: RuleSet }) {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = set.rules;
  return (
    <div className="smart-head">
      <Chip tone="info">Smart</Chip>
      {first ? <span className="sub rule-text">{ruleWords(first)}</span> : null}
      {rest.length > 0 ? <Chip onClick={() => setOpen(true)}>{moreWords(rest.length)}</Chip> : null}
      {open ? <RulesSheet set={set} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
