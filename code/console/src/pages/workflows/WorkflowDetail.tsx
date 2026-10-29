import { useState } from "react";
import { actionOf, loadDesign, waitsOnPerson, type Choice, type QuestionDraft, type StepDraft } from "../../data/pages/workflowDesign";
import { proposeLinkObjective, type ObjectiveChoice } from "../../data/pages/workflows";
import type { ActionResult } from "../../data/types";
import { useI18n } from "../../i18n";
import { Button, Card, Detail, Empty, SectionTitle, Stack } from "../../ui";
import { Dash } from "../spec/usersParts";
import { listOf, textOf } from "../spec/usersRead";
import { useLoaded } from "../../shell/useLoaded";
import { LinkObjectiveForm, ObjectiveLines, unlinkedChoices } from "./WorkflowObjectives";
import { StepRoles } from "./StepRoles";

type WorkflowDetailProps = {
  hubId: string;
  workflowId: string;
  detail: Record<string, unknown>;
  choices: ObjectiveChoice[] | null;
  onChanged: (result: ActionResult) => void;
};

type Pair = [string, React.ReactNode];

const questionLine = (question: QuestionDraft) => (question.optionsFrom ? `${question.prompt} (${question.optionsFrom})` : question.prompt);

const nameOf = (choices: Choice[], id: string) => choices.find((choice) => choice.value === id)?.label ?? "";

const stepName = (steps: StepDraft[], key: string) => steps.find((step) => step.key === key)?.name ?? "";

const routeLine = (route: StepDraft["routes"][number], steps: StepDraft[], t: (key: string) => string) =>
  `${t("workflows.match")} ${t(route.match === "any" ? "workflows.matchAny" : "workflows.matchAll")}: ` +
  route.rules.map((rule) => `${rule.question} ${t("workflows.operator." + rule.operator)} ${rule.value}`).join(", ") +
  ` → ${stepName(steps, route.goTo)}`;

function StepDetail({ number, step, steps, roles, workflows }: { number: number; step: StepDraft; steps: StepDraft[]; roles: Choice[]; workflows: Choice[] }) {
  const { t, lang } = useI18n();
  const agency = t("workflows.agency");
  const recipient = nameOf(roles, step.recipientRoleId);
  const sent = stepName(steps, step.sentKey);
  const questions = step.questions.map(questionLine).filter(Boolean).join(", ");
  const pairs: Pair[] = [
    [t("field.description"), step.description || <Dash />],
    [t("workflows.kindLabel"), t("workflows.kind." + step.kind)],
    [t("workflows.actor"), nameOf(roles, step.roleId) || agency],
    [t("workflows.action"), actionOf(step, steps, workflows)],
  ];
  if (recipient) pairs.push([t(step.kind === "notify" ? "workflows.notifies" : "workflows.sendsTo"), recipient]);
  if (sent) pairs.push([t("workflows.answersForm"), sent]);
  if (step.kind === "route") {
    pairs.push([t("workflows.routes"), step.routes.map((route) => routeLine(route, steps, t)).join("; ") || <Dash />]);
    if (step.otherwiseKey) pairs.push([t("workflows.otherwise"), stepName(steps, step.otherwiseKey)]);
  }
  if (questions) pairs.push([t("workflows.questions"), questions]);
  const minutes = Number(step.timeLimit);
  if (waitsOnPerson(step) && minutes > 0) {
    const limit = t(minutes === 1 ? "workflows.limitOne" : "workflows.limitMany").replace("{n}", new Intl.NumberFormat(lang).format(minutes));
    pairs.push([t("workflows.timeLimit"), `${limit}, ${t("workflows.limitThen").replace("{name}", nameOf(workflows, step.cancelWorkflowId))}`]);
  }
  return (
    <Card title={`${number} · ${step.name}`}>
      <Detail pairs={pairs} />
      <StepRoles stepId={step.id} stepName={step.name} roles={roles} />
    </Card>
  );
}

const ordersLine = (workflow: Record<string, unknown>, t: (key: string) => string, lang: string): string => {
  const count = Number(workflow.orders_under_way);
  if (!(count > 0)) return t("workflows.orderNone");
  const versions = (Array.isArray(workflow.order_versions) ? workflow.order_versions : []).map(Number).filter((version) => version > 0);
  if (versions.length === 0) return String(count);
  const listed = new Intl.ListFormat(lang, { type: "conjunction" }).format(versions.map(String));
  return t("workflows.orderLine").replace("{n}", String(count)).replaceAll("{versions}", listed);
};

export function WorkflowDetail({ hubId, workflowId, detail, choices, onChanged }: WorkflowDetailProps) {
  const { t, lang } = useI18n();
  const [linking, setLinking] = useState(false);
  const workflow = (detail.workflow ?? {}) as Record<string, unknown>;
  const workflowName = textOf(workflow.name);
  const links = listOf(detail.links);
  const available = choices ? unlinkedChoices(choices, links) : [];
  const changed = (result: ActionResult) => {
    setLinking(false);
    onChanged(result);
  };
  const link = async (objective: ObjectiveChoice) => changed(await proposeLinkObjective(hubId, workflowId, workflowName, objective));
  const { state } = useLoaded(async () => ({ design: await loadDesign(hubId, workflowId) }), [hubId, workflowId]);

  const design = state.kind === "ready" ? state.value.design : null;
  const version = Number(workflow.version);
  const pairs: Pair[] = [
    [t("workflows.version"), version > 0 ? String(version) : <Dash />],
    [t("workflows.objectives"), <ObjectiveLines hubId={hubId} workflowName={workflowName} links={links} choices={choices} onChanged={changed} />],
  ];
  if (state.kind === "ready") {
    pairs.push([t("workflows.orders"), ordersLine(workflow, t, lang)]);
    const records = state.value.design.workflow.records.map((record) => record.name).filter(Boolean);
    pairs.push([t("workflows.records"), records.length > 0 ? records.join(", ") : <Dash />]);
  }
  const steps = design?.workflow.steps ?? [];

  return (
    <Stack gap={20}>
      {linking ? <LinkObjectiveForm choices={available} onLink={link} onCancel={() => setLinking(false)} /> : null}
      <Card
        title={t("workflows.card")}
        actions={
          available.length > 0 ? (
            <Button kind="quiet" size="sm" onClick={() => setLinking(true)}>
              {t("workflows.linkObjective")}
            </Button>
          ) : undefined
        }
      >
        <Detail pairs={pairs} />
      </Card>
      <SectionTitle title={t("workflows.steps")} />
      {state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : null}
      {state.kind === "ready" && steps.length === 0 ? <Empty text={t("noRows")} /> : null}
      <Stack gap={12}>
        {steps.map((step, index) => (
          <StepDetail key={step.key} number={index + 1} step={step} steps={steps} roles={design?.choices.roles ?? []} workflows={design?.choices.workflows ?? []} />
        ))}
      </Stack>
    </Stack>
  );
}
