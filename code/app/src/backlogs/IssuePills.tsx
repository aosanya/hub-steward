import { Chip } from "../ui/Chip";
import type { Issue } from "./api";
import { EffortPill } from "./EffortPill";
import { PriorityMenu, priorityLabel } from "./PriorityMenu";

type Props = { issue: Issue; onPriority?: (priority: string) => void; onEffort?: (effort: string) => void };

export function IssuePills({ issue, onPriority, onEffort }: Props) {
  return (
    <>
      {onPriority ? <PriorityMenu priority={issue.priority ?? ""} onPick={onPriority} /> : issue.priority ? <Chip>{priorityLabel(issue.priority)}</Chip> : null}
      <EffortPill effort={issue.effort} onPick={onEffort} />
    </>
  );
}
