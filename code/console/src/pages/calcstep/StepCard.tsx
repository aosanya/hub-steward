import { useId } from "react";
import { useI18n } from "../../i18n";
import { Card, Segmented, SelectControl, SettingRows, Stack, TextControl } from "../../ui";
import { defaultRounding, failureChoiceProblem, otherSteps, roundingRules, type FailureChoice, type FailureProblem, type RoundingRule, type StepRef } from "./failureChoice";

export type RoleRef = { id: string; name: string };

export type Runner = { kind: "agency" } | { kind: "role"; roleId: string };

export type StepCardValue = { runner: Runner; failure: FailureChoice; resultName: string; rounding: RoundingRule | null };

export type StepCardProps = {
  stepId: string;
  steps: StepRef[];
  roles: RoleRef[];
  value: StepCardValue;
  onChange: (next: StepCardValue) => void;
};

export function StepCard({ stepId, steps, roles, value, onChange }: StepCardProps) {
  const { t } = useI18n();
  const resultId = useId();
  const problem = failureChoiceProblem(value.failure, steps, stepId);
  const failureSentence: Record<FailureProblem, string> = {
    empty: t("calcstep.step.failureEmpty"),
    itself: t("calcstep.step.failureItself"),
    "unknown-step": t("calcstep.step.failureUnknown"),
  };
  const roundingNames: Record<RoundingRule, string> = {
    down: t("calcstep.step.roundingDown"),
    up: t("calcstep.step.roundingUp"),
    "half-up": t("calcstep.step.roundingHalfUp"),
    "half-down": t("calcstep.step.roundingHalfDown"),
    "half-even": t("calcstep.step.roundingHalfEven"),
  };
  const chosenRule = value.rounding ?? defaultRounding;
  const goto = value.failure?.kind === "goto" ? value.failure : null;
  const options = otherSteps(steps, stepId).map((step) => ({ value: step.id, label: step.name }));
  const picked = goto !== null && options.some((option) => option.value === goto.stepId);
  const stepOptions = picked ? options : [{ value: "", label: t("calcstep.step.failureChoose") }, ...options];

  const runs = (
    <Stack gap={8}>
      <Segmented
        label=""
        items={[
          {
            key: "agency",
            label: t("calcstep.step.runsAgency"),
            current: value.runner.kind === "agency",
            onSelect: () => onChange({ ...value, runner: { kind: "agency" } }),
          },
          {
            key: "role",
            label: t("calcstep.step.runsRole"),
            current: value.runner.kind === "role",
            onSelect: () => onChange({ ...value, runner: { kind: "role", roleId: roles[0]?.id ?? "" } }),
          },
        ]}
      />
      {value.runner.kind === "role" && roles.length > 0 ? (
        <>
          <SelectControl
            id={`${resultId}-role`}
            label={t("calcstep.step.rolePicker")}
            value={value.runner.roleId}
            options={roles.map((role) => ({ value: role.id, label: role.name }))}
            onChange={(roleId) => onChange({ ...value, runner: { kind: "role", roleId } })}
          />
          <div className="hint">{t("calcstep.step.roleHint")}</div>
        </>
      ) : null}
      {value.runner.kind === "role" && roles.length === 0 ? <div className="hint">{t("calcstep.step.roleNone")}</div> : null}
    </Stack>
  );

  const failure = (
    <Stack gap={8}>
      <Segmented
        label=""
        items={[
          {
            key: "goto",
            label: t("calcstep.step.failureGoto"),
            current: goto !== null,
            onSelect: () => onChange({ ...value, failure: { kind: "goto", stepId: "" } }),
          },
          {
            key: "stop",
            label: t("calcstep.step.failureStop"),
            current: value.failure?.kind === "stop",
            onSelect: () => onChange({ ...value, failure: { kind: "stop" } }),
          },
        ]}
      />
      {goto !== null ? (
        <>
          <SelectControl
            id={`${resultId}-step`}
            label={t("calcstep.step.failurePicker")}
            value={goto.stepId}
            options={stepOptions}
            onChange={(next) => onChange({ ...value, failure: { kind: "goto", stepId: next } })}
          />
          <div className="hint">{t("calcstep.step.failureHint")}</div>
        </>
      ) : null}
      {problem !== null ? (
        <div className="hint field-error" role="alert">
          {failureSentence[problem]}
        </div>
      ) : null}
    </Stack>
  );

  const result = (
    <Stack gap={8}>
      <TextControl
        id={resultId}
        label={t("calcstep.step.resultName")}
        value={value.resultName}
        onChange={(resultName) => onChange({ ...value, resultName })}
      />
      <div className="hint">{t("calcstep.step.resultHint")}</div>
    </Stack>
  );

  const rounding = (
    <Stack gap={8}>
      <Segmented
        label=""
        items={roundingRules.map((rule) => ({
          key: rule,
          label: roundingNames[rule],
          current: chosenRule === rule,
          onSelect: () => onChange({ ...value, rounding: rule }),
        }))}
      />
      <div className="hint">{t("calcstep.step.roundingHint")}</div>
    </Stack>
  );

  return (
    <Card title={t("calcstep.step.title")}>
      <SettingRows
        rows={[
          { label: t("calcstep.step.runs"), control: runs },
          { label: `${t("calcstep.step.failure")} *`, control: failure },
          { label: `${t("calcstep.step.result")} *`, control: result, htmlFor: resultId },
          { label: t("calcstep.step.rounding"), control: rounding },
        ]}
      />
    </Card>
  );
}
