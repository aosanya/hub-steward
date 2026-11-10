import { useState } from "react";
import { Button } from "../ui/Button";
import { mcpSendClient } from "./api";
import { withoutCurrent } from "./leftOut";
import { SendToBacklog } from "./SendToBacklog";
import type { SendClient } from "./types";
import { useTargets } from "./useTargets";
import { sendWords } from "./words";
import "./sendToBacklog.css";

type Props = { issueId: string; from?: string[]; onSent?: () => void; client?: SendClient };

export function SendToBacklogButton({ issueId, from = [], onSent, client = mcpSendClient }: Props) {
  const targets = useTargets(client);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  if (targets.state !== "ready" || withoutCurrent(targets.data, from).length === 0) return null;
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
          from={from}
          client={client}
          onClose={() => setOpen(false)}
          onDone={(words, moved) => {
            setOpen(false);
            setOutcome(words);
            if (moved > 0) onSent?.();
          }}
        />
      ) : null}
    </>
  );
}
