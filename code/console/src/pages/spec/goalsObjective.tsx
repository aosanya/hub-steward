import { goalDetail, objectiveDetail, type GoalDetail } from "../../data/pages/goals";
import { useI18n } from "../../i18n";
import { Card, Detail, Empty, Note, Stack, TextLink, TitleRow } from "../../ui";
import { ObjectiveFlow } from "../objectives/ObjectiveFlow";
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
  const { state } = useLoaded(async () => {
    const objective = await objectiveDetail(hubId, objectiveId);
    const goal = await goalOf(hubId, objective.goalId || goalId);
    return { objective, goal };
  }, [hubId, objectiveId, goalId]);

  if (state.kind !== "ready") {
    return (
      <>
        <TitleRow title={t("goals.objective")} />
        <div className="content">{state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : null}</div>
      </>
    );
  }

  const { objective, goal } = state.value;
  return (
    <>
      <TitleRow title={withCode(t("goals.objectiveCode"), objective.code, objective.title || t("goals.objective"))} />
      <div className="content">
        <Stack gap={20}>
          <Card title={objective.title || t("goals.objective")}>
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
