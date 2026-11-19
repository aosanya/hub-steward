import { useEffect, useState } from "react";
import { refusalText } from "../../../../features/backlogs";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Segmented } from "../../../../shared/ui/Segmented";
import { Sheet } from "../../../../shared/ui/Sheet";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { cashAccountId } from "./markBillPaid";
import { dayStart, tools } from "./financeData";
import { defaultPaymentMethods, loadPaymentMethods } from "./paymentSettings";

const noCashAccountWords = "There is no cash account to pay from.";

const todayIso = () => new Date().toISOString().slice(0, 10);

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

const refusalWords = (error: unknown) => (error instanceof Error ? refusalText(error) || error.message : "") || actionFailedWords;

type Props = { billID: string; outstanding: string; onSaved: () => void; onCancel: () => void };

export function AddPaymentSheet({ billID, outstanding, onSaved, onCancel }: Props) {
  const [amount, setAmount] = useState(outstanding);
  const [paidOn, setPaidOn] = useState(todayIso());
  const [methods, setMethods] = useState(defaultPaymentMethods);
  const [method, setMethod] = useState(defaultPaymentMethods[0]);
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const [refused, setRefused] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    loadPaymentMethods().then((ways) => {
      setMethods(ways);
      setMethod(ways[0]);
    });
  }, []);
  const figure = Number(amount);
  const valid = amount.trim() !== "" && Number.isFinite(figure) && figure > 0 && isDay(paidOn);
  const save = async () => {
    setRefused("");
    setBusy(true);
    try {
      const cash = await cashAccountId();
      if (!cash) throw new Error(noCashAccountWords);
      await callTool("", tools.paymentMarkPaid, {
        billID,
        cash_account_id: cash,
        amount: figure,
        paid_on: dayStart(paidOn),
        method: method.toLowerCase(),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(narration.trim() ? { narration: narration.trim() } : {}),
      });
      onSaved();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Add payment" onClose={onCancel}>
      <Field label="Amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Field label="Paid on" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
      <Segmented label="How it was paid" items={methods.map((way) => ({ id: way, label: way }))} current={method} onChange={setMethod} />
      <Field label="Reference" value={reference} onChange={(event) => setReference(event.target.value)} />
      <TextArea label="Narration" value={narration} onChange={(event) => setNarration(event.target.value)} />
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="primary" disabled={!valid || busy} onClick={save}>Save</Button>
      <Button onClick={onCancel}>Cancel</Button>
    </Sheet>
  );
}
