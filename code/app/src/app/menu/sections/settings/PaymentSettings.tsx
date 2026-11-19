import { useState } from "react";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { Segmented } from "../../../../shared/ui/Segmented";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { loadFailedWords } from "../../MenuDetail";
import { refusalWords } from "../../MenuEditForm";
import { PageFrame } from "../../PageFrame";
import { useBackToSection } from "../../useBackToSection";
import { loadPaymentSettings, methodProblem, savePaymentSettings, type PaymentSettings as Settings } from "../finance/paymentSettings";
import { useOwner } from "./useOwner";

const title = "Payments";

const line = "Whether a payment may be more than what is owed, and the ways a payment can be made.";

const aboveWords = "Payment above what is owed";

const waysWords = "Ways to pay";

type Choice = "refused" | "allowed";

function Editor({ saved, onSaved }: { saved: Settings; onSaved: () => void }) {
  const [overpayment, setOverpayment] = useState<Choice>(saved.overpayment ? "allowed" : "refused");
  const [methods, setMethods] = useState(saved.methods);
  const [added, setAdded] = useState("");
  const [problem, setProblem] = useState("");
  const [refused, setRefused] = useState("");
  const [busy, setBusy] = useState(false);
  const add = () => {
    const wrong = methodProblem(methods, added);
    setProblem(wrong);
    if (wrong) return;
    setMethods([...methods, added.trim()]);
    setAdded("");
  };
  const save = async () => {
    setBusy(true);
    setRefused("");
    try {
      await savePaymentSettings(saved, { overpayment: overpayment === "allowed", methods });
      onSaved();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setBusy(false);
    }
  };
  const changed = (overpayment === "allowed") !== saved.overpayment || JSON.stringify(methods) !== JSON.stringify(saved.methods);
  return (
    <div className="sec-tools">
      <Segmented
        label={aboveWords}
        items={[{ id: "refused", label: "Refused" }, { id: "allowed", label: "Allowed" }]}
        current={overpayment}
        onChange={setOverpayment}
      />
      {methods.length > 1 ? methods.map((way) => <Button key={way} kind="quiet" onClick={() => setMethods(methods.filter((other) => other !== way))}>{`Remove ${way}`}</Button>) : null}
      <Field label="New way to pay" value={added} error={problem || undefined} onChange={(event) => setAdded(event.target.value)} />
      <Button onClick={add}>Add way to pay</Button>
      <Button kind="primary" disabled={busy || !changed} onClick={save}>Save</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </div>
  );
}

export function PaymentSettings() {
  const back = useBackToSection();
  const owner = useOwner();
  const [attempt, setAttempt] = useState(0);
  const view = useLoad(loadPaymentSettings, `payment-settings:${openAgencyId()}:${attempt}`);
  const retry = () => setAttempt((was) => was + 1);
  return (
    <Shell title={title} onBack={back.onBack} backLabel={back.backLabel}>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={loadFailedWords} onRetry={retry} /> : null}
      {view.state === "ready" ? (
        <PageFrame title={title} line={line}>
          <Section
            word="Payments"
            plain
            rows={[
              <ListRow key="above" title={aboveWords} meta={view.data.overpayment ? "Allowed" : "Refused"} />,
              <ListRow key="ways" title={waysWords} meta={view.data.methods.join(", ")} />,
            ]}
            empty={{ words: "" }}
            foot={owner ? <Editor key={attempt} saved={view.data} onSaved={retry} /> : undefined}
          />
        </PageFrame>
      ) : null}
    </Shell>
  );
}
