import { useState, type ReactNode } from "react";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Sheet } from "../../../../shared/ui/Sheet";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { actionFailedWords } from "../../MenuDetail";
import { listOf, text, type Item } from "./financeData";
import { accountListTool } from "./markBillPaid";

const billCreateTool = "accounting_bill_create";

type Props = { onClose: () => void; onRaised: () => void };

const accountName = (account: Item) => [text(account, "code"), text(account, "name")].filter(Boolean).join(" ") || text(account, "category");

function AccountPick({ label, accounts, value, onChange }: { label: string; accounts: Item[]; value: string; onChange: (id: string) => void }): ReactNode {
  return (
    <div className="field">
      <label className="flabel" htmlFor={label}>{label}</label>
      <div className="input">
        <select id={label} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="" />
          {accounts.map((account) => (
            <option key={text(account, "id")} value={text(account, "id")}>{accountName(account)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function RaiseBillSheet({ onClose, onRaised }: Props) {
  const accounts = useLoad(() => listOf(accountListTool), "raise-bill-accounts");
  const all = accounts.state === "ready" ? accounts.data : [];
  const [income, setIncome] = useState("");
  const [receivable, setReceivable] = useState("");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [narration, setNarration] = useState("");
  const [failed, setFailed] = useState(false);
  const ready = income !== "" && receivable !== "" && Number(amount) > 0 && due !== "";
  const raise = async () => {
    setFailed(false);
    try {
      await callTool("", billCreateTool, { income_account_id: income, receivable_account_id: receivable, payer, amount: Number(amount), due_at: `${due}T00:00:00Z`, narration });
      onRaised();
    } catch {
      setFailed(true);
    }
  };
  return (
    <Sheet title="Raise a bill" onClose={onClose}>
      <AccountPick label="Income account" accounts={all.filter((account) => text(account, "type") === "income")} value={income} onChange={setIncome} />
      <AccountPick label="Receivable account" accounts={all.filter((account) => text(account, "category") === "receivable")} value={receivable} onChange={setReceivable} />
      <Field label="Payer" value={payer} onChange={(event) => setPayer(event.target.value)} />
      <Field label="Amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Field label="Due date" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
      <TextArea label="Narration" value={narration} onChange={(event) => setNarration(event.target.value)} />
      {failed ? <LoadFailed words={actionFailedWords} /> : null}
      <Button kind="primary" disabled={!ready} onClick={raise}>Raise bill</Button>
    </Sheet>
  );
}
