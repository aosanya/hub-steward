import { useLocation, useParams } from "react-router-dom";
import { Chip } from "../../../../shared/ui/Chip";
import { Shell } from "../../../Shell";
import { MenuDetail } from "../../MenuDetail";
import { useBackToSection } from "../../useBackToSection";
import { IssueThread } from "./IssueThread";
import { issueFromState } from "./issueRow";
import { useReplyDrafts } from "./useReplyDrafts";

export const replyLabel = "Reply";

export function IssueScreen() {
  const back = useBackToSection();
  const id = useParams().id ?? "";
  const issue = issueFromState(useLocation().state, id);
  const replies = useReplyDrafts();
  return (
    <Shell title={issue.title} titleUnder {...back}>
      {issue.status ? <Chip>{issue.status}</Chip> : null}
      <IssueThread issue={issue} version={replies.version} draft={replies.draftOf(id)} onDraft={(body) => replies.setDraft(id, body)} failed={replies.failed} />
      <MenuDetail bare title={issue.title} tool="forms_catalog_reply_send" fields={{}} status="" id={id} load={async () => ({ id })} action={{ label: replyLabel, tool: "forms_catalog_reply_send", run: () => replies.send(id) }} />
    </Shell>
  );
}
