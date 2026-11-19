import { useState } from "react";
import { refusalText } from "../../../../features/backlogs";
import { Button } from "../../../../shared/ui/Button";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { ActButton } from "./FinanceRecord";
import { tools } from "./financeData";

const manageRole = "accounting.manage";

type Props = { paymentID: string; onReversed: () => void };

export function ReversePaymentAct({ paymentID, onReversed }: Props) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState("");
  const reverse = async () => {
    setRefused("");
    setBusy(true);
    try {
      await callTool("", tools.paymentReverse, { paymentID });
      onReversed();
    } catch (error) {
      setRefused((error instanceof Error ? refusalText(error) || error.message : "") || actionFailedWords);
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };
  if (!asking) {
    return (
      <>
        {refused ? <LoadFailed words={refused} /> : null}
        <ActButton permission={manageRole} label="Reverse payment" onAct={() => setAsking(true)} />
      </>
    );
  }
  return (
    <>
      <p className="ferr" role="alert">Reverse this payment? The bill will owe what it owed before.</p>
      <Button kind="danger" onClick={reverse} disabled={busy}>Reverse</Button>
      <Button onClick={() => setAsking(false)} disabled={busy}>Cancel</Button>
    </>
  );
}
