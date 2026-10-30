import { useState } from "react";
import { objectiveDetail } from "../../data/pages/goals";
import { useI18n } from "../../i18n";
import { Card, Detail, Note, Stack, StatusLine } from "../../ui";
import { FormCard, FormText } from "../spec/goalsForm";
import { useLoaded } from "../../shell/useLoaded";
import { sendAction } from "../spec/sendAction";
import { measureProgress, measuresFor, type Measure } from "./objectivesData";

function MeasureDetail({ measure }: { measure: Measure }) {
  const { t } = useI18n();
  const pairs: [string, string][] = [
    [t("objectives.measure"), measure.name],
    [t("objectives.now"), measureProgress(measure)],
    [t("objectives.target"), measure.target],
  ];
  if (measure.unit) pairs.push([t("objectives.unit"), measure.unit]);
  if (measure.status) pairs.push([t("objectives.status"), measure.status]);
  return <Detail pairs={pairs} />;
}

function SetMeasure({
  hubId,
  objectiveId,
  code,
}: {
  hubId: string;
  objectiveId: string;
  code: string;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setSent(false);
    const missing = [
      !name.trim() ? t("objectives.measure") : "",
      !target.trim() ? t("objectives.target") : "",
    ].filter(Boolean);
    if (missing.length > 0) {
      setError(`${t("required")}: ${missing.join(", ")}`);
      return;
    }
    setError("");
    setBusy(true);
    const result = await sendAction("objectives", "setMeasure", hubId, {
      objective_id: objectiveId,
      objective_code: code,
      name,
      target,
      unit,
    });
    setBusy(false);
    if (result === "failed") {
      setError(t("submitFailed"));
      return;
    }
    setSent(true);
    setName("");
    setTarget("");
    setUnit("");
  };

  return (
    <Stack gap={12}>
      {sent ? <StatusLine text={t("waitingForApproval")} /> : null}
      <FormCard
        title={t("objectives.setMeasure")}
        submit={t("save")}
        cancel={t("cancel")}
        note={t("goals.formNote")}
        error={error}
        busy={busy}
        onSubmit={submit}
        onCancel={() => {
          setName("");
          setTarget("");
          setUnit("");
          setError("");
        }}
      >
        <FormText
          label={t("objectives.measure")}
          value={name}
          onChange={setName}
          placeholder={t("objectives.measureHint")}
        />
        <FormText
          label={t("objectives.target")}
          value={target}
          onChange={setTarget}
          placeholder={t("objectives.targetFigureHint")}
        />
        <FormText
          label={t("objectives.unit")}
          value={unit}
          onChange={setUnit}
          placeholder={t("objectives.unitHint")}
        />
      </FormCard>
    </Stack>
  );
}

export function ObjectiveMeasures({
  hubId,
  objectiveId,
}: {
  hubId: string;
  objectiveId: string;
}) {
  const { t } = useI18n();
  const { state } = useLoaded(async () => {
    const objective = await objectiveDetail(hubId, objectiveId);
    return {
      code: objective.code,
      measures: await measuresFor(hubId, objectiveId),
    };
  }, [hubId, objectiveId]);

  if (state.kind !== "ready") return null;
  const { code, measures } = state.value;
  return (
    <div className="content">
      <Stack gap={20}>
        <Card title={t("objectives.measure")}>
          {measures.length === 0 ? (
            <Note>{t("objectives.noMeasure")}</Note>
          ) : null}
          <Stack gap={12}>
            {measures.map((measure, index) => (
              <MeasureDetail
                key={measure.id || String(index)}
                measure={measure}
              />
            ))}
          </Stack>
        </Card>
        <SetMeasure hubId={hubId} objectiveId={objectiveId} code={code} />
      </Stack>
    </div>
  );
}
