import { useState } from "react";
import { Button } from "../../../../shared/ui/Button";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { PaidMark } from "./PaidMark";

type Phase = "idle" | "busy" | "failed" | "paid";

export function MarkPaidButton({ orderId }: { orderId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const markPaid = async () => {
    setPhase("busy");
    try {
      await callTool("", "market_mark_paid", { orderID: orderId });
      setPhase("paid");
    } catch {
      setPhase("failed");
    }
  };
  if (phase === "paid") return <PaidMark />;
  return (
    <>
      <Button kind="primary" disabled={phase === "busy"} onClick={markPaid}>Mark paid</Button>
      {phase === "failed" ? <LoadFailed words={actionFailedWords} /> : null}
    </>
  );
}
