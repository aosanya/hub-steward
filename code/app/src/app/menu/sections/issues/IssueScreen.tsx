import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Chip } from "../../../../shared/ui/Chip";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { Shell } from "../../../Shell";
import { MenuDetail, actionFailedWords } from "../../MenuDetail";
import { useBackToSection } from "../../useBackToSection";
import { IssueReplies } from "./IssueReplies";
import { issueFromState } from "./issueRow";

export const replyLabel = "Reply";

export function IssueScreen() {
  const back = useBackToSection();
  const id = useParams().id ?? "";
  const issue = issueFromState(useLocation().state, id);
  const [draft, setDraft] = useState("");
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setFailed(false);
    callTool("", "forms_catalog_reply_send", { raisedItemID: id, body }).then(
      () => {
        setDraft("");
        setVersion((current) => current + 1);
      },
      () => setFailed(true),
    );
  };
  return (
    <Shell title={issue.title} titleUnder {...back}>
      {issue.status ? <Chip>{issue.status}</Chip> : null}
      <IssueReplies raisedItemID={id} version={version} />
      <TextArea label="Your reply" value={draft} onChange={(event) => setDraft(event.target.value)} />
      {failed ? <LoadFailed words={actionFailedWords} /> : null}
      <MenuDetail bare title={issue.title} tool="forms_catalog_reply_send" fields={{}} status="" id={id} load={async () => ({ id })} action={{ label: replyLabel, tool: "forms_catalog_reply_send", run: send }} />
    </Shell>
  );
}
