import type { Issue } from "../shared/api";
import { IssueCard } from "../shared/IssueCard";
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
