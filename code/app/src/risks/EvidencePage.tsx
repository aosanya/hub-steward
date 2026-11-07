import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../entry/language";
import { routes } from "../routes";
import { BottomBar } from "../ui/BottomBar";
import { Button } from "../ui/Button";
import { ChoiceGroup, ChoiceRow } from "../ui/ChoiceRow";
import { EmptyCard } from "../ui/LoadState";
import { Field } from "../ui/Field";
import { Shell } from "../ui/Shell";
import { evidenceKinds, evidenceOutcomes, mcpRisksClient, type RisksClient } from "./api";
import { filled, labelOf } from "./labels";

type Status = "idle" | "sending" | "sent" | "failed";

export function EvidencePage({ client = mcpRisksClient }: { client?: RisksClient }) {
  const { riskId = "", barrierId = "" } = useParams();
  const { words } = useLanguage();
  const go = useNavigate();
  const [kind, setKind] = useState(evidenceKinds[0]);
  const [outcome, setOutcome] = useState(evidenceOutcomes[0]);
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState("");
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const toRisk = () => go(routes.risk.path({ riskId }));

  const send = async () => {
    if (summary.trim() === "") {
      setMissing(true);
      return;
    }
    setMissing(false);
    setStatus("sending");
    try {
      await client.recordEvidence({ barrierId, kind, outcome, summary: summary.trim(), reference: file });
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  };

  if (status === "sent") {
    return (
      <Shell title={words.evidenceTitle} onBack={toRisk}>
        <EmptyCard words={words.evidenceSent} />
        <Button kind="primary" onClick={toRisk}>{words.evidenceBack}</Button>
      </Shell>
    );
  }

  return (
    <Shell title={words.evidenceTitle} onBack={toRisk} tabless>
      <ChoiceGroup label={words.evidenceKind}>
        {evidenceKinds.map((value) => (
          <ChoiceRow key={value} type="radio" name="kind" label={labelOf(words, "kind", value)} checked={kind === value} onChange={() => setKind(value)} />
        ))}
      </ChoiceGroup>
      <ChoiceGroup label={words.evidenceOutcome}>
        {evidenceOutcomes.map((value) => (
          <ChoiceRow key={value} type="radio" name="outcome" label={labelOf(words, "outcome", value)} checked={outcome === value} onChange={() => setOutcome(value)} />
        ))}
      </ChoiceGroup>
      <Field label={words.evidenceSummary} value={summary} error={missing ? words.evidenceSummaryNeeded : undefined} onChange={(e) => setSummary(e.target.value)} />
      <Field
        label={words.evidenceFile}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.txt"
        onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")}
      />
      {file ? <p className="meta">{filled(words.evidenceFileChosen, { name: file })}</p> : null}
      {status === "failed" ? <p role="alert" className="ferr">{words.evidenceFailed}</p> : null}
      <BottomBar>
        <Button kind="primary" disabled={status === "sending"} onClick={send}>
          {status === "sending" ? words.evidenceSending : words.evidenceSend}
        </Button>
      </BottomBar>
    </Shell>
  );
}
