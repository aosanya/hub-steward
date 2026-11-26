import { Chip } from "../../../shared/ui/Chip";
import { TextChip } from "../../../shared/ui/TextChip";
import { priorityTone, statusLabel, statusTone } from "./ruleStatus";
import { useRulebookWords } from "./words";
import type { Rule } from "./types";
import "../shared/backlogs.css";

export function StatusMark({ rule }: { rule: Rule }) {
  const words = useRulebookWords();
  return <Chip tone={statusTone(rule.status)}>{statusLabel(rule, words)}</Chip>;
}

export function StatusMarks({ rule }: { rule: Rule }) {
  return (
    <span className="issue-tags">
      {rule.kind === "question" && rule.priority !== "" ? <Chip tone={priorityTone(rule.priority)}>{rule.priority}</Chip> : null}
      <StatusMark rule={rule} />
    </span>
  );
}

export function TagMarks({ tags }: { tags: string[] }) {
  return (
    <span className="issue-tags">
      {tags.map((tag) => (
        <TextChip key={tag} text={tag} />
      ))}
    </span>
  );
}
