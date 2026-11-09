import type { Issue } from "./api";
import { IssueTags, IssueTitle, openUnlessTag } from "./IssueTitle";

type Props = { issue: Issue; chosen: string[]; onOpen: () => void; onTag: (tag: string) => void };

export function IssueRow({ issue, chosen, onOpen, onTag }: Props) {
  return (
    <div className="row issue-row" onClick={openUnlessTag(onOpen)}>
      <span className="txt">
        <button type="button" className="open">
          <IssueTitle title={issue.title} />
        </button>
        <IssueTags issue={issue} chosen={chosen} onTag={onTag} />
      </span>
    </div>
  );
}
