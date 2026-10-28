import { useState } from "react";
import { useI18n } from "../../i18n";
import { FormCard, FormText } from "./goalsForm";
import { sendAction, type Outcome } from "./sendAction";

type RenameHubFormProps = { hubId: string; onOutcome: (result: Outcome) => void; onCancel: () => void };

export function RenameHubForm({ hubId, onOutcome, onCancel }: RenameHubFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError(`${t("required")}: ${t("field.name")}`);
      return;
    }
    setError("");
    setBusy(true);
    const result = await sendAction("profile", "hubname", hubId, { name });
    setBusy(false);
    if (result === "failed") {
      setError(t("submitFailed"));
      return;
    }
    onOutcome(result);
  };

  return (
    <FormCard
      title={t("renameHub")}
      submit={t("save")}
      cancel={t("cancel")}
      note={t("goals.formNote")}
      error={error}
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <FormText label={t("field.name")} value={name} onChange={setName} />
    </FormCard>
  );
}
