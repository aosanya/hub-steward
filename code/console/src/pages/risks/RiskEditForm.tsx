import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import type { RiskSummary } from "../../data/pages/risks";
import { listHazards, type LibraryPart } from "../../data/pages/library";
import { FormCard, FormSelect, FormText } from "../spec/goalsForm";
import { updateRisk } from "./riskAddWrite";

type RiskEditFormProps = { hubId: string; risk: RiskSummary; onSaved: () => void; onCancel: () => void };

export function RiskEditForm({ hubId, risk, onSaved, onCancel }: RiskEditFormProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(risk.title);
  const [topEvent, setTopEvent] = useState(risk.topEvent);
  const [hazardCode, setHazardCode] = useState(risk.hazardCode);
  const [hazards, setHazards] = useState<LibraryPart[]>([]);
  const [owner, setOwner] = useState(risk.owner);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    listHazards(hubId)
      .then((found) => live && setHazards(found))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [hubId]);

  const chosenTitle = hazards.find((one) => one.code === hazardCode)?.title ?? risk.hazard;

  const submit = async () => {
    if (!title.trim()) {
      setError(`${t("required")}: ${t("field.title")}`);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await updateRisk(hubId, risk.id, { title, topEvent, hazard: chosenTitle, hazardCode, owner });
    } catch {
      setBusy(false);
      setError(t("submitFailed"));
      return;
    }
    setBusy(false);
    onSaved();
  };

  return (
    <FormCard
      title={t("risks.editRisk")}
      submit={t("save")}
      cancel={t("cancel")}
      note={t("risks.saved")}
      error={error}
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <FormText label={t("field.title")} value={title} onChange={setTitle} />
      <FormText label={t("risks.topEvent")} value={topEvent} onChange={setTopEvent} />
      <FormSelect
        label={t("risks.hazard")}
        value={hazardCode}
        options={[{ value: "", label: t("library.chooseHazard") }, ...hazards.map((one) => ({ value: one.code, label: one.title }))]}
        onChange={setHazardCode}
        hint={hazards.length === 0 ? t("library.noHazardsYet") : undefined}
      />
      <FormText label={t("risks.owner")} value={owner} onChange={setOwner} />
    </FormCard>
  );
}
