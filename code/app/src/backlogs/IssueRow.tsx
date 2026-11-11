import type { Issue } from "./api";
import type { CapsClient } from "./caps/api";
import { CapTintChip } from "./caps/CapTintChip";
import { tintStyle } from "./caps/capTint";
import { useCapTint } from "./caps/useCapTint";
import { IssueLine, IssueTags, IssueTitle, openUnlessTag } from "./IssueTitle";

type Props = { issue: Issue; chosen: string[]; onTag?: (tag: string) => void; onOpen?: () => void; chevron?: boolean; showStep?: boolean; capsClient?: CapsClient };

export function IssueRow({ issue, chosen, onTag, onOpen, chevron, showStep, capsClient }: Props) {
  const found = useCapTint(issue, capsClient);
  const title = <IssueTitle title={issue.title} code={issue.code} />;
  return (
    <div className={[onOpen ? "row issue-row" : "row issue-row static", found ? "capped" : ""].filter(Boolean).join(" ")} style={tintStyle(found)} onClick={onOpen ? openUnlessTag(onOpen) : undefined}>
      <span className="txt">
        {onOpen ? (
          <button type="button" className="open">
            {title}
          </button>
        ) : (
          <span className="open">{title}</span>
        )}
        {onOpen ? <IssueLine issue={issue} chosen={chosen} onTag={onTag} showStep={showStep} /> : <IssueTags issue={issue} chosen={chosen} onTag={onTag} />}
        {found ? (
          <span className="issue-tags">
            <CapTintChip found={found} />
          </span>
        ) : null}
      </span>
      {chevron ? (
        <span className="end" aria-hidden="true">
          ›
        </span>
      ) : null}
    </div>
  );
}
