import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { ChoiceGroup, ChoiceRow } from "../../../../shared/ui/ChoiceRow";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { refusalWords } from "../../MenuEditForm";
import { ServiceAct } from "./ServicePage";
import { inspectAgainWords, inspectPermission, inspectTool, inspectionResults, inspectionWords, needsNote, noteWords, recordLabel, type InspectionResult } from "./inspection";

const recordWords = "Record an inspection";

type Props = { formId: string; memberId: string; inspected: boolean; onRecorded: () => void };

export function InspectionForm({ formId, memberId, inspected, onRecorded }: Props) {
  const may = useMay(inspectPermission);
  const [result, setResult] = useState<InspectionResult | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState("");
  if (!may) return null;
  const blocked = busy || result === "" || (needsNote(result) && note.trim() === "");
  const record = async () => {
    if (result === "" || blocked) return;
    setBusy(true);
    setRefused("");
    try {
      await callTool("", inspectTool, { form_id: formId, member_id: memberId, result, note: note.trim() });
      setResult("");
      setNote("");
      setBusy(false);
      onRecorded();
    } catch (error) {
      setRefused(refusalWords(error));
      setBusy(false);
    }
  };
  const fields = [
    <ChoiceGroup key="result" label={inspected ? inspectAgainWords : inspectionWords}>
      {inspectionResults.map((one) => (
        <ChoiceRow key={one.value} type="radio" name={`inspection:${memberId}`} label={one.label} checked={result === one.value} onChange={() => setResult(one.value)} />
      ))}
    </ChoiceGroup>,
    <TextArea key="note" label={noteWords} value={note} onChange={(event) => setNote(event.target.value)} />,
    ...(refused ? [<LoadFailed key="refused" words={refused} />] : []),
  ];
  return <Section word={recordWords} icon="document" plain rows={fields} foot={<ServiceAct label={recordLabel} disabled={blocked} onClick={record} />} />;
}
