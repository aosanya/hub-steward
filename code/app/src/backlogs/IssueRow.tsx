import type { Issue } from "./api";
import { IssueTags, IssueTitle } from "./IssueTitle";

type Props = { issue: Issue; onOpen: () => void };

export function IssueRow({ issue, onOpen }: Props) {
  return (
    <div className="row issue-row">
      <button type="button" className="open" onClick={onOpen}>
        <IssueTitle title={issue.title} />
        <IssueTags issue={issue} />
      </button>
    </div>
  );
}
