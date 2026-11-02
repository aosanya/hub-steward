import { useI18n } from "../../i18n";
import {
  Card,
  DataTable,
  Detail,
  Empty,
  Icon,
  SectionTitle,
  Stack,
  TextLink,
  TitleRow,
} from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { raciLabels } from "../../data/pages/stepRoles";
import { ObjectiveCodes } from "./ObjectiveFlow";
import { labelLetter } from "./objectiveFlowData";
import { workflowHref } from "./objectivesLinks";
import { RoleCell } from "./RoleCell";
import { loadStepDetail } from "./stepDetail";

export function StepPage({ hubId, stepId }: { hubId: string; stepId: string }) {
  const { t } = useI18n();
  const { state } = useLoaded(() => loadStepDetail(hubId, stepId), [hubId, stepId]);

  if (state.kind !== "ready") {
    return (
      <>
        <TitleRow title={t("objectives.step")} />
        <div className="content">
          {state.kind === "failed" ? (
            <Empty text={t("loadFailed")} failed />
          ) : null}
        </div>
      </>
    );
  }

  const step = state.value;
  return (
    <>
      <TitleRow
        title={
          step.code
            ? t("objectives.stepCode").replace("{code}", step.code)
            : t("objectives.step")
        }
      />
      <div className="content">
        <Stack gap={20}>
          <Card title={step.name || t("objectives.step")}>
            <Detail
              pairs={[
                [
                  t("objectives.workflow"),
                  step.workflow ? (
                    <TextLink
                      key="workflow"
                      to={workflowHref(hubId, step.workflow.id)}
                    >
                      {step.workflow.name}
                    </TextLink>
                  ) : (
                    "—"
                  ),
                ],
                [
                  t("goals.objectives"),
                  <ObjectiveCodes
                    key="objectives"
                    hubId={hubId}
                    objectives={step.objectives}
                  />,
                ],
              ]}
            />
          </Card>
          <SectionTitle title={t("workflows.roles")} />
          <DataTable
            columns={[t("goals.role"), ...raciLabels.map(labelLetter)]}
            empty={t("workflows.noStepRoles")}
            rows={step.roles.map((role) => ({
              key: role.roleId,
              cells: [
                <RoleCell
                  key="role"
                  hubId={hubId}
                  name={role.name}
                  ai={role.ai}
                  sub={role.ai ? t("goals.aiRole") : t("goals.human")}
                />,
                ...raciLabels.map((label) =>
                  role.labels.includes(label) ? (
                    <span key={label}>
                      <Icon name="check" size={16} />
                      <span className="sr">{t("workflows.raci." + label)}</span>
                    </span>
                  ) : null,
                ),
              ],
            }))}
          />
        </Stack>
      </div>
    </>
  );
}
