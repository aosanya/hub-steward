import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n";
import { TitleRow } from "../../ui";
import { FormCard, FormText } from "../spec/goalsForm";
import { createRisk } from "./riskAddWrite";
import { risksHref } from "./risksLinks";

export function RiskAdd({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [topEvent, setTopEvent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const back = risksHref(hubId);

  const submit = async () => {
    if (!title.trim()) {
      setError(`${t("required")}: ${t("field.title")}`);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await createRisk(hubId, { title, topEvent });
    } catch {
      setBusy(false);
      setError(t("submitFailed"));
      return;
    }
    navigate(back);
  };

  return (
    <>
      <TitleRow title={t("risks.add")} />
      <div className="content">
        <FormCard
          title={t("risks.newRisk")}
          submit={t("save")}
          cancel={t("cancel")}
          note={t("risks.saved")}
          error={error}
          busy={busy}
          onSubmit={submit}
          onCancel={() => navigate(back)}
        >
          <FormText label={t("field.title")} value={title} onChange={setTitle} />
          <FormText label={t("risks.topEvent")} value={topEvent} onChange={setTopEvent} />
        </FormCard>
      </div>
    </>
  );
}
