import { useState } from "react";
import { Button } from "../ui/Button";
import { mcpSendClient } from "./api";
import { SendToBacklog } from "./SendToBacklog";
import type { SendClient } from "./types";
import { useTargets } from "./useTargets";
import { sendWords } from "./words";
import "./sendToBacklog.css";

type Props = { issueId: string; client?: SendClient };

export function SendToBacklogButton({ issueId, client = mcpSendClient }: Props) {
  const targets = useTargets(client);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  if (targets.state !== "ready" || targets.data.length === 0) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>{sendWords}</Button>
      {outcome ? (
        <p className="sub" role="status">
          {outcome}
        </p>
      ) : null}
      {open ? (
        <SendToBacklog
          ids={[issueId]}
          client={client}
          onClose={() => setOpen(false)}
          onDone={(words) => {
            setOpen(false);
            setOutcome(words);
          }}
        />
      ) : null}
    </>
  );
}
