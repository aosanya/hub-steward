import { goalDetail, goalsPage } from "../../data/pages/goals";
import { useI18n } from "../../i18n";
import { Card, Cell, DataTable, Detail, Empty, Note, SectionTitle, Stack, StatusLine, TextLink, TitleRow } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { goalsHref, useArrivedNote, withCode } from "./goalsLinks";

const textOf = (value: unknown) => (value === undefined || value === null ? "" : String(value));

export function GoalPage({ hubId, goalId }: { hubId: string; goalId: string }) {
  const { t } = useI18n();
  const note = useArrivedNote();
  const { state } = useLoaded(async () => {
    const goal = await goalDetail(hubId, goalId);
    const objectives = await goalsPage.rows(hubId, { goal: goalId });
    return { goal, objectives };
  }, [hubId, goalId]);

  if (state.kind !== "ready") {
    return (
      <>
        <TitleRow title={t("menu.goals")} />
        <div className="content">{state.kind === "failed" ? <Empty text={t("loadFailed")} failed /> : null}</div>
      </>
    );
  }

  const { goal, objectives } = state.value;
  return (
    <>
      <TitleRow
        title={goal.title || t("goals.goal")}
        primary={t("addObjective")}
        primaryTo={goalsHref(hubId, { add: "objective", goal: goalId })}
      />
      <div className="content">
        <Stack gap={20}>
          {note.text ? <StatusLine text={note.text} failed={note.failed} /> : null}
          <Card title={withCode(t("goals.goalCode"), goal.code, t("goals.goal"))}>
            {goal.description ? <Note>{goal.description}</Note> : null}
            <Detail pairs={[[t("goals.objectives"), objectives.length]]} />
          </Card>
          <SectionTitle title={t("goals.objectives")} />
          <DataTable
            columns={[t("goals.objective")]}
            empty={t("noRows")}
            rows={objectives.map((objective, index) => {
              const to = goalsHref(hubId, { goal: goalId, objective: textOf(objective.id) });
              return {
                key: textOf(objective.id) || String(index),
                cells: [
                  <Cell key="objective" text={textOf(objective.title)} sub={textOf(objective.code)} to={to} />,
                ],
                actions: (
                  <TextLink to={to} size="sm">
                    {t("goals.open")}
                  </TextLink>
                ),
              };
            })}
          />
        </Stack>
      </div>
    </>
  );
}
