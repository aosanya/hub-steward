import {
  actionOf,
  agencyKinds,
  emptyQuestion,
  stepKinds,
  takesForm,
  waitsOnPerson,
  type AnswerType,
  type Choice,
  type StepDraft,
  type StepKind,
} from "../../data/pages/workflowDesign";
import { useI18n } from "../../i18n";
import { Button, Card, Chip, Labelled, TextareaControl } from "../../ui";
import { PickLabelled, TextLabelled } from "./editParts";
import { QuestionCards } from "./QuestionCards";
import { arrivalsAt } from "./reachedFrom";
import { RouteFields } from "./RouteFields";

type Props = {
  number: number;
  step: StepDraft;
  steps: StepDraft[];
  roles: Choice[];
  workflows: Choice[];
  cancels: Choice[];
  lists: Choice[];
  answerTypes: AnswerType[];
  open: boolean;
  onToggle: () => void;
  onChange: (next: StepDraft) => void;
  onRemove: () => void;
  onInsertAbove: () => void;
  onNewThanks: (apply: (key: string) => StepDraft) => void;
  onMove: (by: number) => void;
};

const withKind = (step: StepDraft, kind: StepKind): StepDraft => ({
  ...step,
  kind,
  roleId: agencyKinds.includes(kind) ? "" : step.roleId,
  sentKey: kind === "yes_no" || kind === "route" ? step.sentKey : "",
  recipientRoleId:
    kind === "send_form" || kind === "notify" ? step.recipientRoleId : "",
  runWorkflowId: kind === "run_workflow" ? step.runWorkflowId : "",
  routes: kind === "route" ? step.routes : [],
  otherwiseKey: kind === "route" ? step.otherwiseKey : "",
  questions: !takesForm(kind)
    ? []
    : step.questions.length > 0
      ? step.questions
      : [emptyQuestion()],
});

export function StepCard({
  number,
  step,
  steps,
  roles,
  workflows,
  cancels,
  lists,
  answerTypes,
  open,
  onToggle,
  onChange,
  onRemove,
  onInsertAbove,
  onNewThanks,
  onMove,
}: Props) {
  const { t } = useI18n();
  const id = "step-" + step.key;
  const agency = { value: "", label: t("workflows.agency") };
  const actorName =
    (step.roleId && roles.find((role) => role.value === step.roleId)?.label) ||
    agency.label;
  const sendSteps = steps.filter(
    (other) => other.kind === "send_form" && other.key !== step.key,
  );
  const sent = steps.find((other) => other.key === step.sentKey);
  const others = steps
    .filter((other) => other.key !== step.key)
    .map((other) => ({
      value: other.key,
      label: `${steps.indexOf(other) + 1} · ${other.name}`,
    }));
  const chosen = workflows.find((choice) => choice.value === step.cancelWorkflowId);
  const cancelOptions =
    chosen && !cancels.some((choice) => choice.value === chosen.value)
      ? [...cancels, chosen]
      : cancels;
  const set = (change: Partial<StepDraft>) => onChange({ ...step, ...change });
  const answers = step.kind === "yes_no" && step.sentKey !== "";
  const heading = `${number} · ${step.name}`;
  const chatStepAbove = steps[number - 2]?.kind === "chat";
  const arrivals = arrivalsAt(steps, number - 1);
  const reached =
    number === 1
      ? t("workflows.startsHere")
      : arrivals.length === 0
        ? t("workflows.nothingLeadsHere")
        : `${t("workflows.reachedFrom")}: ${arrivals
            .map(
              ({ from, via }) =>
                `${steps.indexOf(from) + 1} · ${from.name} (${t("workflows." + via)})`,
            )
            .join(", ")}`;

  return (
    <Card
      title={heading}
      actions={
        <>
          <Chip>{t("workflows.kind." + step.kind)}</Chip>
          <Button
            kind="quiet"
            size="xs"
            disabled={number === 1 || chatStepAbove}
            onClick={() => onMove(-1)}
          >
            {t("workflows.up")}
          </Button>
          <Button
            kind="quiet"
            size="xs"
            disabled={number === steps.length}
            onClick={() => onMove(1)}
          >
            {t("workflows.down")}
          </Button>
          <Button
            kind="quiet"
            size="xs"
            aria-expanded={open}
            onClick={onToggle}
          >
            {open ? t("workflows.fold") : t("workflows.unfold")}
          </Button>
        </>
      }
    >
      <span className="muted">
        {actorName} · {actionOf(step, steps, workflows)}
      </span>
      <span className="muted">{reached}</span>
      {open ? (
        <>
          <TextLabelled
            id={id + "-name"}
            label={t("field.name")}
            value={step.name}
            onChange={(name) => set({ name })}
          />
          <Labelled
            id={id + "-description"}
            label={t("field.description")}
            required={false}
          >
            <TextareaControl
              id={id + "-description"}
              label={t("field.description")}
              value={step.description}
              onChange={(description) => set({ description })}
            />
          </Labelled>
          <PickLabelled
            id={id + "-kind"}
            label={t("workflows.kindLabel")}
            value={step.kind}
            options={stepKinds.map((kind) => ({
              value: kind,
              label: t("workflows.kind." + kind),
            }))}
            onChange={(kind) => onChange(withKind(step, kind as StepKind))}
          />
          <PickLabelled
            id={id + "-actor"}
            label={t("workflows.actor")}
            value={agencyKinds.includes(step.kind) ? "" : step.roleId}
            options={[agency, ...roles]}
            disabled={agencyKinds.includes(step.kind)}
            onChange={(roleId) => set({ roleId })}
          />
          {step.kind === "send_form" || step.kind === "notify" ? (
            <PickLabelled
              id={id + "-to"}
              label={t(
                step.kind === "send_form"
                  ? "workflows.sendsTo"
                  : "workflows.notifies",
              )}
              value={step.recipientRoleId}
              options={[
                { value: "", label: t("workflows.everyone") },
                ...roles,
              ]}
              onChange={(recipientRoleId) => set({ recipientRoleId })}
            />
          ) : null}
          {step.kind === "yes_no" ? (
            <PickLabelled
              id={id + "-sent"}
              label={t("workflows.answersForm")}
              value={step.sentKey}
              options={[
                { value: "", label: t("workflows.ownForm") },
                ...sendSteps.map((other) => ({
                  value: other.key,
                  label: other.name,
                })),
              ]}
              onChange={(sentKey) => set({ sentKey })}
            />
          ) : null}
          {step.kind === "run_workflow" ? (
            <PickLabelled
              id={id + "-runs"}
              label={t("workflows.runs")}
              value={step.runWorkflowId}
              options={[{ value: "", label: "" }, ...workflows]}
              onChange={(runWorkflowId) => set({ runWorkflowId })}
            />
          ) : null}
          {step.kind === "route" ? (
            <>
              <p className="lead">{t("workflows.routeLead")}</p>
              <PickLabelled
                id={id + "-form"}
                label={t("workflows.checksAnswersTo")}
                value={step.sentKey}
                options={[
                  { value: "", label: "" },
                  ...sendSteps.map((other) => ({
                    value: other.key,
                    label: other.name,
                  })),
                ]}
                onChange={(sentKey) => set({ sentKey })}
              />
              <RouteFields
                id={id}
                step={step}
                sent={sent}
                steps={others}
                onChange={onChange}
                onNewThanks={onNewThanks}
              />
            </>
          ) : null}
          {takesForm(step.kind) && !answers ? (
            <QuestionCards
              id={id}
              questions={step.questions}
              lists={lists}
              answerTypes={answerTypes}
              fixedText={step.kind === "notify"}
              onChange={(questions) => set({ questions })}
            />
          ) : null}
          {waitsOnPerson(step) ? (
            <>
              <TextLabelled
                id={id + "-limit"}
                label={t("workflows.timeLimit")}
                value={step.timeLimit}
                placeholder={t("workflows.noLimit")}
                onChange={(timeLimit) => set({ timeLimit })}
              />
              <PickLabelled
                id={id + "-cancel"}
                label={t("workflows.whenItPasses")}
                value={step.cancelWorkflowId}
                options={[{ value: "", label: "" }, ...cancelOptions]}
                disabled={step.timeLimit.trim() === ""}
                onChange={(cancelWorkflowId) => set({ cancelWorkflowId })}
              />
            </>
          ) : null}
          <div>
            <Button kind="quiet" size="sm" onClick={onInsertAbove}>
              {t("workflows.insertStep")}
            </Button>
            <Button kind="quiet" size="sm" onClick={onRemove}>
              {t("workflows.removeStep")}
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
