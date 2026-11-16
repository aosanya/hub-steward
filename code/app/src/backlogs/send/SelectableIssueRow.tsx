import type { Issue } from "../api";
import { IssueCard } from "../IssueCard";
import { SelectionBox, type Selection } from "../../shared/ui/ListRow";

type Props = { issue: Issue; chosen: string[]; selection: Selection };

export function SelectableIssueRow({ issue, chosen, selection }: Props) {
  return (
    <div className="selrow">
      <SelectionBox selection={selection} />
      <IssueCard issue={issue} chosen={chosen} />
    </div>
  );
}
