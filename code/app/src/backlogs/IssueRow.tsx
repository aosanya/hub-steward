import type { Issue } from "./api";
import { IssueLine, IssueTags, IssueTitle, openUnlessTag } from "./IssueTitle";

type Props = { issue: Issue; chosen: string[]; onTag?: (tag: string) => void; onOpen?: () => void; chevron?: boolean; showStep?: boolean };

export function IssueRow({ issue, chosen, onTag, onOpen, chevron, showStep }: Props) {
  const title = <IssueTitle title={issue.title} code={issue.code} />;
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
        {onOpen ? <IssueLine issue={issue} chosen={chosen} onTag={onTag} showStep={showStep} /> : <IssueTags issue={issue} chosen={chosen} onTag={onTag} />}
      </span>
      {chevron ? (
        <span className="end" aria-hidden="true">
          ›
        </span>
      ) : null}
    </div>
  );
}
