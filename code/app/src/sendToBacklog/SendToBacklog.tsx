import { useState } from "react";
import { LoadingLine } from "../ui/LoadState";
import { mcpSendClient } from "./api";
import { SendSheet } from "./SendSheet";
import type { SendClient, Target } from "./types";
import { useTargets } from "./useTargets";
import { outcomeWords } from "./words";

type Props = { ids: string[]; client?: SendClient; onClose: () => void; onDone: (words: string, moved: number) => void };

export function SendToBacklog({ ids, client = mcpSendClient, onClose, onDone }: Props) {
  const targets = useTargets(client);
  const [sending, setSending] = useState(false);
  const pick = async (target: Target) => {
    setSending(true);
    const result = await client.send(ids, target);
    setSending(false);
    onDone(outcomeWords(result, ids.length, target), result.sent);
  };
  if (targets.state !== "ready") return null;
  return sending ? <LoadingLine /> : <SendSheet count={ids.length} targets={targets.data} onPick={pick} onClose={onClose} />;
}
