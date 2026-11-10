import type { Issue } from "../backlogs/api";
import { IssueRow } from "../backlogs/IssueRow";
import { SelectionBox, type Selection } from "../ui/ListRow";

type Props = { issue: Issue; chosen: string[]; selection: Selection };

export function SelectableIssueRow({ issue, chosen, selection }: Props) {
  return (
    <div className="selrow">
      <SelectionBox selection={selection} />
      <IssueRow issue={issue} chosen={chosen} />
    </div>
  );
}
