import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n";
import { TitleRow } from "../../ui";
import { FormCard, FormText, FormTextarea } from "./goalsForm";
import { goalsHref, type Arrival } from "./goalsLinks";
import { sendAction } from "./sendAction";

type AddGoalProps = { hubId: string };

export function AddGoalPage({ hubId }: AddGoalProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const back = goalsHref(hubId);

  const submit = async () => {
    if (!title.trim()) {
      setError(`${t("required")}: ${t("field.name")}`);
      return;
    }
    setError("");
    setBusy(true);
    const result = await sendAction("goals", "goals", hubId, { title, description });
    setBusy(false);
    if (result === "failed") {
      setError(t("submitFailed"));
      return;
    }
    navigate(back, { state: { outcome: result } satisfies Arrival });
  };

  return (
    <>
      <TitleRow title={t("goals.add")} />
      <div className="content">
        <FormCard
          title={t("goals.newGoal")}
          submit={t("save")}
          cancel={t("cancel")}
          note={t("goals.formNote")}
          error={error}
          busy={busy}
          onSubmit={submit}
          onCancel={() => navigate(back)}
        >
          <FormText label={t("field.name")} value={title} onChange={setTitle} />
          <FormTextarea label={t("field.description")} value={description} onChange={setDescription} />
        </FormCard>
      </div>
    </>
  );
}
