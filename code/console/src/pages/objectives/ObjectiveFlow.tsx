import { useI18n } from "../../i18n";
import {
  Cell,
  DataTable,
  Empty,
  Row,
  SectionTitle,
  Stack,
  TextLink,
} from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import {
  labelLetter,
  loadObjectiveFlow,
  type StepRole,
} from "./objectiveFlowData";
import type { ObjectiveRef } from "./objectivesData";
import { objectivesHref, workflowHref } from "./objectivesLinks";
import { RoleCell } from "./RoleCell";

export function ObjectiveCodes({
  hubId,
  objectives,
}: {
  hubId: string;
  objectives: ObjectiveRef[];
}) {
  return (
    <Row gap={8}>
      {objectives
        .filter((objective) => objective.code !== "")
        .map((objective) => (
          <TextLink
            key={objective.id}
            to={objectivesHref(hubId, { objective: objective.id })}
          >
            {objective.code}
          </TextLink>
        ))}
    </Row>
  );
}

export function StepRoleLines({
  hubId,
  roles,
}: {
  hubId: string;
  roles: StepRole[];
}) {
  const { t } = useI18n();
  if (roles.length === 0)
    return <span className="muted">{t("workflows.noStepRoles")}</span>;
  return (
    <Stack gap={6}>
      {roles.map((role) => (
        <RoleCell
          key={role.roleId}
          hubId={hubId}
          name={role.name}
          ai={role.ai}
          sub={role.labels.map(labelLetter).join(" ")}
        />
      ))}
    </Stack>
  );
}

export function ObjectiveFlow({
  hubId,
  objectiveId,
}: {
  hubId: string;
  objectiveId: string;
}) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadObjectiveFlow(hubId, objectiveId), [hubId, objectiveId]);

  if (state.kind === "loading") return null;
  if (state.kind === "failed") return <Empty text={t("loadFailed")} failed />;
  const { workflows, steps } = state.value;
  return (
    <>
      <SectionTitle title={t("menu.workflows")} />
      <DataTable
        columns={[
          t("objectives.workflow"),
          t("workflows.steps"),
          t("goals.objectives"),
        ]}
        empty={t("objectives.noWorkflow")}
        rows={workflows.map((workflow) => ({
          key: workflow.id,
          cells: [
            <Cell
              key="workflow"
              to={workflowHref(hubId, workflow.id)}
              text={workflow.name}
              sub={workflow.code}
            />,
            String(workflow.steps),
            <ObjectiveCodes
              key="objectives"
              hubId={hubId}
              objectives={workflow.objectives}
            />,
          ],
          actions: (
            <TextLink to={workflowHref(hubId, workflow.id)} size="sm">
              {t("goals.open")}
            </TextLink>
          ),
        }))}
      />
      <SectionTitle title={t("workflows.steps")} />
      <DataTable
        columns={[
          t("objectives.step"),
          t("objectives.workflow"),
          t("workflows.roles"),
        ]}
        empty={t("workflows.noSteps")}
        rows={steps.map((step) => ({
          key: step.id,
          cells: [
            <Cell
              key="step"
              to={objectivesHref(hubId, { step: step.id })}
              text={step.name}
              sub={step.code}
            />,
            step.workflow.name,
            <StepRoleLines key="roles" hubId={hubId} roles={step.roles} />,
          ],
          actions: (
            <TextLink to={objectivesHref(hubId, { step: step.id })} size="sm">
              {t("goals.open")}
            </TextLink>
          ),
        }))}
      />
    </>
  );
}
