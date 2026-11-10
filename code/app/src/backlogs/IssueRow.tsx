import type { Issue } from "./api";
import { IssueLine, IssueTags, IssueTitle, openUnlessTag } from "./IssueTitle";

type Props = { issue: Issue; chosen: string[]; onTag?: (tag: string) => void; onOpen?: () => void; chevron?: boolean; facts?: string[] };

export function IssueRow({ issue, chosen, onTag, onOpen, chevron, facts }: Props) {
  const title = <IssueTitle title={issue.title} />;
  return (
    <div className={onOpen ? "row issue-row" : "row issue-row static"} onClick={onOpen ? openUnlessTag(onOpen) : undefined}>
      <span className="txt">
        {onOpen ? (
          <button type="button" className="open">
            {title}
          </button>
        ) : (
          <span className="open">{title}</span>
        )}
        {onOpen ? <IssueLine issue={issue} chosen={chosen} onTag={onTag} /> : <IssueTags issue={issue} chosen={chosen} onTag={onTag} extra={facts} />}
      </span>
      {chevron ? (
        <span className="end" aria-hidden="true">
          ›
        </span>
      ) : null}
    </div>
  );
}
