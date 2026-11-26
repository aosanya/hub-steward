import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { hubPath } from "../../api";
import { goalDetail, objectiveDetail, type GoalDetail } from "../../data/pages/goals";
import { useI18n } from "../../i18n";
import { Button, Card, Detail, Empty, Note, Stack, TextLink, PageHeader } from "../../ui";
import { ObjectiveFlow } from "../objectives/ObjectiveFlow";
import { EditGoalForm, RemoveGoalAsk } from "./goalsChange";
import { goalsHref, withCode } from "./goalsLinks";
import { useLoaded } from "../../shell/useLoaded";

type ObjectivePageProps = { hubId: string; objectiveId: string; goalId: string };

const goalOf = async (hubId: string, goalId: string): Promise<GoalDetail | null> => {
  if (!goalId) return null;
  try {
    return await goalDetail(hubId, goalId);
  } catch {
    return null;
  }
};

export function ObjectivePage({ hubId, objectiveId, goalId }: ObjectivePageProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { state, reload } = useLoaded(async () => {
    const objective = await objectiveDetail(hubId, objectiveId);
    const goal = await goalOf(hubId, objective.goalId || goalId);
    return { objective, goal };
  }, [hubId, objectiveId, goalId]);

  if (state.kind !== "ready") {
    return (
      <>
        <PageHeader title={t("goals.objective")} />
        <div className="content">{state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : null}</div>
      </>
    );
  }

  const { objective, goal } = state.value;
  return (
    <>
      <PageHeader
        title={withCode(t("goals.objectiveCode"), objective.code, objective.title || t("goals.objective"))}
        actions={editing ? [] : [{ label: t("edit"), icon: "edit", primary: true, onClick: () => setEditing(true) }]}
      />
      <div className="content">
        <Stack gap={20}>
          {editing ? (
            <EditGoalForm
              hubId={hubId}
              kind="objective"
              id={objectiveId}
              title={objective.title}
              description={objective.description}
              onSaved={() => {
                setEditing(false);
                reload();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : null}
          {removing ? (
            <RemoveGoalAsk
              hubId={hubId}
              kind="objective"
              id={objectiveId}
              title={objective.title}
              onRemoved={() => navigate(goalId ? goalsHref(hubId, { goal: goalId }) : hubPath(hubId, "objectives"))}
              onCancel={() => setRemoving(false)}
            />
          ) : null}
          <Card
            title={objective.title || t("goals.objective")}
            actions={
              <Button kind="quiet" size="sm" onClick={() => setRemoving(true)}>
                {t("goals.remove")}
              </Button>
            }
          >
            {objective.description ? <Note>{objective.description}</Note> : null}
            {goal ? (
              <Detail
                pairs={[
                  [
                    t("goals.goal"),
                    <TextLink key="goal" to={goalsHref(hubId, { goal: goal.id })}>
                      {[goal.code, goal.title].filter(Boolean).join(" · ")}
                    </TextLink>,
                  ],
                ]}
              />
            ) : null}
          </Card>
          <ObjectiveFlow hubId={hubId} objectiveId={objectiveId} />
        </Stack>
      </div>
    </>
  );
}
