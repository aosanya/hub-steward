import { LoadFailed } from "../../../../shared/ui/LoadState";
import { TextArea } from "../../../../shared/ui/TextArea";
import { actionFailedWords } from "../../MenuDetail";
import { IssueEdit } from "./IssueEdit";
import { IssueReplies } from "./IssueReplies";
import type { IssueRow } from "./issueRow";

type Props = { issue: IssueRow; version: number; draft: string; onDraft: (body: string) => void; failed: boolean };

export function IssueThread({ issue, version, draft, onDraft, failed }: Props) {
  return (
    <>
      <IssueEdit issue={issue} />
      <IssueReplies raisedItemID={issue.id} version={version} />
      <TextArea label="Your reply" value={draft} onChange={(event) => onDraft(event.target.value)} />
      {failed ? <LoadFailed words={actionFailedWords} /> : null}
    </>
  );
}
