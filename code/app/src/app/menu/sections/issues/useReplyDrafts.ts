import { useState } from "react";
import { callTool } from "../../../../shared/wakala/mcp";

export function useReplyDrafts() {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const draftOf = (id: string) => drafts[id] ?? "";
  const setDraft = (id: string, body: string) => setDrafts((current) => ({ ...current, [id]: body }));
  const send = (id: string) => {
    const body = draftOf(id).trim();
    if (!body) return;
    setFailed(false);
    callTool("", "forms_catalog_reply_send", { raisedItemID: id, body }).then(
      () => {
        setDraft(id, "");
        setVersion((current) => current + 1);
      },
      () => setFailed(true),
    );
  };
  return { draftOf, setDraft, send, version, failed };
}
