import { useState, type ReactNode } from "react";
import { unitWordsOf } from "../market/unitWords";
import { Button } from "./Button";
import { Card } from "./Card";
import { Field } from "./Field";

export const wholeQuantity = (text: string) => {
  const n = Number(text.replace(/,/g, "").trim());
  return Number.isInteger(n) && n > 0 ? n : NaN;
};

type Props = {
  label: string;
  unit: string;
  action: string;
  current?: number;
  send: (quantity: number) => Promise<void>;
  children?: ReactNode;
};

export function JoinForm({ label, unit, action, current, send, children }: Props) {
  const [text, setText] = useState(current === undefined ? "" : String(current));
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const plural = unitWordsOf(unit, 2);
  const submit = async () => {
    const quantity = wholeQuantity(text);
    if (Number.isNaN(quantity)) return setProblem(`Give the ${plural} as a whole number.`);
    setProblem("");
    setBusy(true);
    try {
      await send(quantity);
    } catch {
      setProblem(`Your ${plural} were not sent. Try again.`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      {children}
      <Field label={label} inputMode="numeric" placeholder="0" value={text} onChange={(event) => setText(event.target.value)} />
      {problem ? <p className="ferr">{problem}</p> : null}
      <Button kind="primary" disabled={busy} onClick={submit}>
        {action}
      </Button>
    </Card>
  );
}
