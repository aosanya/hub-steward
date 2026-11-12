import { useState } from "react";
import { Card } from "../ui/Card";
import type { Issue } from "./api";
import { CapTintChip } from "./caps/CapTintChip";
import { tintStyle } from "./caps/capTint";
import { useCapTintOf } from "./caps/CapTintScope";
import { IssueCode, IssueLine, IssueName, openUnlessControl } from "./IssueTitle";

type Props = {
  issue: Issue;
  chosen: string[];
  onTag?: (tag: string) => void;
  onOpen?: () => void;
  onPriority?: (priority: string) => Promise<unknown>;
  onEffort?: (effort: string) => Promise<unknown>;
  showStep?: boolean;
};

export function IssueCard({ issue, chosen, onTag, onOpen, onPriority, onEffort, showStep }: Props) {
  const found = useCapTintOf(issue.id);
  const [failed, setFailed] = useState("");
  const change = (field: string, set: (value: string) => Promise<unknown>) => (value: string) => {
    setFailed("");
    set(value).catch(() => setFailed(field));
  };
  const name = <IssueName title={issue.title} code={issue.code} />;
  return (
    <div className={["issue-row", onOpen ? "" : "static", found ? "cap-tinted" : ""].filter(Boolean).join(" ")} style={tintStyle(found)} onClick={onOpen ? openUnlessControl(onOpen) : undefined}>
      <Card title={<IssueCode title={issue.title} code={issue.code} />}>
        {onOpen ? (
          <button type="button" className="open">
            {name}
          </button>
        ) : (
          name
        )}
        <IssueLine issue={issue} chosen={chosen} onTag={onTag} showStep={showStep} onPriority={onPriority && change("priority", onPriority)} onEffort={onEffort && change("effort", onEffort)} />
        {found ? (
          <span className="issue-tags">
            <CapTintChip found={found} />
          </span>
        ) : null}
        {failed ? <p className="sub" role="alert">The {failed} was not changed.</p> : null}
      </Card>
    </div>
  );
}
