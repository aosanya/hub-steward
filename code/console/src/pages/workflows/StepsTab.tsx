import { useState } from "react";
import {
  emptyQuestion,
  emptyStep,
  type DesignChoices,
  type StepDraft,
  type WorkflowDraft,
} from "../../data/pages/workflowDesign";
import { useI18n } from "../../i18n";
import { Button, Empty, Stack } from "../../ui";
import { ChatStepCard } from "./ChatStepCard";
import { moved, replaced, without } from "./editParts";
import { StepCard } from "./StepCard";

type Props = {
  workflow: WorkflowDraft;
  choices: DesignChoices;
  onChange: (steps: StepDraft[]) => void;
};

export function StepsTab({ workflow, choices, onChange }: Props) {
  const { t } = useI18n();
  const { steps } = workflow;
  const [opened, setOpened] = useState<string | null>(null);
  const openKey =
    opened !== null && steps.some((step) => step.key === opened)
      ? opened
      : (steps[0]?.key ?? null);
  const otherWorkflows = choices.workflows.filter(
    (choice) => choice.value !== workflow.id,
  );

  const add = () => {
    const step = emptyStep();
    onChange([...steps, step]);
    setOpened(step.key);
  };

  const insertAt = (index: number) => {
    const step = emptyStep();
    onChange([...steps.slice(0, index), step, ...steps.slice(index)]);
    setOpened(step.key);
  };

  const addThanks = (index: number, apply: (key: string) => StepDraft) => {
    const thanks: StepDraft = {
      ...emptyStep("notify"),
      name: t("workflows.thanksName"),
      questions: [{ ...emptyQuestion(), fixed: t("workflows.thanksText") }],
    };
    onChange([
      ...steps.map((step, at) => (at === index ? apply(thanks.key) : step)),
      thanks,
    ]);
  };

  const addButton = (
    <Button kind="quiet" size="sm" icon="plus" onClick={add}>
      {t("workflows.addStep")}
    </Button>
  );

  return (
    <Stack gap={12}>
      {steps.length === 0 ? (
        <Empty text={t("workflows.noSteps")} action={addButton} />
      ) : (
        <div>{addButton}</div>
      )}
      {steps.map((step, index) =>
        step.kind === "chat" ? (
          <ChatStepCard
            key={step.key}
            number={index + 1}
            step={step}
            roles={choices.roles}
          />
        ) : (
          <StepCard
            key={step.key}
            number={index + 1}
            step={step}
            steps={steps}
            roles={choices.roles}
            workflows={otherWorkflows}
            lists={choices.lists}
            answerTypes={choices.answerTypes}
            open={step.key === openKey}
            onToggle={() => setOpened(step.key === openKey ? "" : step.key)}
            onChange={(next) => onChange(replaced(steps, index, next))}
            onRemove={() => onChange(without(steps, index))}
            onMove={(by) => onChange(moved(steps, index, by))}
            onInsertAbove={() => insertAt(index)}
            onNewThanks={(apply) => addThanks(index, apply)}
          />
        ),
      )}
    </Stack>
  );
}
