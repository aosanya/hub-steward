import { useState } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "../../i18n";
import { useLoaded } from "../../shell/useLoaded";
import { useConsole } from "../../shell/context";
import { Button, Empty, Stack, TitleRow } from "../../ui";
import { calcStepApi, written, type CalcStepApi, type FunctionChoice } from "./calcStepApi";
import { CalcStepScreen } from "./CalcStepScreen";
import { FunctionCard } from "./FunctionCard";
import { saveStep, type StepDraft } from "./saveStep";
import { sourceFlag, type InputRow, type SourceKind } from "./sourceFlags";
import { loanPaymentSetup, type StepSetup } from "./stepSetup";
import type { StepCardValue } from "./StepCard";
import type { Posting } from "./postingSentence";

type SavedStep = { stepId: string; function: string };

type CalcStepPageProps = {
  hubId: string;
  stepId: string;
  api?: CalcStepApi;
  setup?: StepSetup;
  onSave?: (saved: SavedStep) => void;
  onSaveStep?: (hubId: string, draft: StepDraft) => Promise<void>;
};

const withChoice = (rows: InputRow[], input: string, kind: SourceKind | null, change?: string): InputRow[] =>
  rows.map((row) => {
    if (row.name !== input) return row;
    if (kind === null) return { ...row, source: null };
    if (kind === "ledger") return { ...row, source: { kind } };
    if (kind === "fixed") return { ...row, source: { kind, value: change ?? "" } };
    if (kind === "step") return { ...row, source: { kind, step: "", question: "", type: row.type } };
    return { ...row, source: { kind, record: "", question: "", type: row.type } };
  });

export function CalcStepPage({ hubId, stepId, api = calcStepApi, setup, onSave, onSaveStep }: CalcStepPageProps) {
  const { t } = useI18n();
  const { refreshMenu } = useConsole();
  const { state } = useLoaded(
    () => Promise.all([api.openStep(hubId, stepId), api.listFunctions(hubId), api.chosenFunction(hubId, stepId)]),
    [hubId, stepId],
  );
  const [picked, setPicked] = useState<FunctionChoice | null | undefined>(undefined);
  const [inputs, setInputs] = useState<InputRow[] | undefined>(undefined);
  const [step, setStep] = useState<StepCardValue | undefined>(undefined);
  const [posting, setPosting] = useState<Posting | undefined>(undefined);
  const [saving, setSaving] = useState(false);

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
  const rows = inputs ?? setup?.inputs ?? [];
  const stepValue = step ?? setup?.step;
  const postingValue = posting ?? setup?.posting;
  const flagged = rows.some((row) => sourceFlag(row) !== null);
  const writes = onSaveStep ?? (setup ? saveStep : undefined);
  const save = async () => {
    if (!chosen) return;
    if (onSave) onSave({ stepId, function: written(chosen) });
    if (writes && setup && stepValue && postingValue) {
      setSaving(true);
      await writes(hubId, {
        stepId,
        function: written(chosen),
        inputs: rows,
        steps: setup.steps,
        step: stepValue,
        postStepId: setup.postStepId,
        posting: postingValue,
      });
      setSaving(false);
      refreshMenu();
    }
  };
  return (
    <>
      <TitleRow title={header.title || t("calcstep.title")}>
        <Button disabled={(!onSave && !(writes && setup)) || !chosen || flagged || saving} onClick={save}>
          {t("calcstep.save")}
        </Button>
      </TitleRow>
      <div className="content">
        <Stack gap={20}>
          {setup && stepValue && postingValue ? (
            <CalcStepScreen
              stepId={stepId}
              setup={setup}
              functions={functions}
              chosen={chosen}
              inputs={rows}
              step={stepValue}
              posting={postingValue}
              onFunction={setPicked}
              onChoose={(input, kind) => setInputs(withChoice(rows, input, kind))}
              onFixedValue={(input, value) => setInputs(withChoice(rows, input, "fixed", value))}
              onStep={setStep}
              onPosting={setPosting}
            />
          ) : (
            <FunctionCard functions={functions} chosen={chosen} onChange={setPicked} />
          )}
        </Stack>
      </div>
    </>
  );
}

export function CalcStepRoute() {
  const { hubId = "", stepId = "" } = useParams();
  return <CalcStepPage hubId={hubId} stepId={stepId} setup={loanPaymentSetup} />;
}
