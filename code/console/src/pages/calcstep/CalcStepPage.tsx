import { useState } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "../../i18n";
import { useLoaded } from "../../shell/useLoaded";
import { Button, Empty, Stack, TitleRow } from "../../ui";
import { calcStepApi, written, type CalcStepApi, type FunctionChoice } from "./calcStepApi";
import { FunctionCard } from "./FunctionCard";

type SavedStep = { stepId: string; function: string };

type CalcStepPageProps = {
  hubId: string;
  stepId: string;
  api?: CalcStepApi;
  onSave?: (saved: SavedStep) => void;
};

export function CalcStepPage({ hubId, stepId, api = calcStepApi, onSave }: CalcStepPageProps) {
  const { t } = useI18n();
  const { state } = useLoaded(
    () => Promise.all([api.openStep(hubId, stepId), api.listFunctions(hubId), api.chosenFunction(hubId, stepId)]),
    [hubId, stepId],
  );
  const [picked, setPicked] = useState<FunctionChoice | null | undefined>(undefined);

  if (state.kind !== "ready") {
    return (
      <>
        <TitleRow title={t("calcstep.title")} />
        <div className="content">{state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : null}</div>
      </>
    );
  }

  const [header, functions, stored] = state.value;
  const chosen = picked === undefined ? stored : picked;
  const save = () => {
    if (chosen && onSave) onSave({ stepId, function: written(chosen) });
  };
  return (
    <>
      <TitleRow title={header.title || t("calcstep.title")}>
        <Button disabled={!onSave || !chosen} onClick={save}>
          {t("calcstep.save")}
        </Button>
      </TitleRow>
      <div className="content">
        <Stack gap={20}>
          <FunctionCard functions={functions} chosen={chosen} onChange={setPicked} />
        </Stack>
      </div>
    </>
  );
}

export function CalcStepRoute() {
  const { hubId = "", stepId = "" } = useParams();
  return <CalcStepPage hubId={hubId} stepId={stepId} />;
}
