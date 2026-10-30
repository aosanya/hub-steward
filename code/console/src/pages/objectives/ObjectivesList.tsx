import { useState, type ReactNode } from "react";
import { measuresOn } from "../../data/features";
import { byName, matching } from "../../data/listView";
import { MeasureLines } from "./MeasureLines";
import { useI18n } from "../../i18n";
import {
  Card,
  Detail,
  Empty,
  FilterBar,
  Stack,
  StatusLine,
  TextLink,
  TitleRow,
} from "../../ui";
import { goalsHref, useArrivedNote } from "../spec/goalsLinks";
import { useLoaded } from "../../shell/useLoaded";
import { loadObjectiveCards, type ObjectiveCard } from "./objectivesData";
import { objectivesHref, workflowHref } from "./objectivesLinks";

const heading = (card: ObjectiveCard) =>
  [card.code, card.title].filter(Boolean).join(" · ");

function ObjectiveCardView({
  hubId,
  card,
}: {
  hubId: string;
  card: ObjectiveCard;
}) {
  const { t } = useI18n();
  const goal = card.goal;
  const [open, setOpen] = useState(false);
  return (
    <Card
      title={heading(card)}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={
        <TextLink to={objectivesHref(hubId, { objective: card.id })} size="sm">
          {t("edit")}
        </TextLink>
      }
    >
      <Detail
        pairs={[
          [
            t("goals.goal"),
            goal ? (
              <TextLink key="goal" to={goalsHref(hubId, { goal: goal.id })}>
                {[goal.code, goal.title].filter(Boolean).join(" · ")}
              </TextLink>
            ) : (
              "—"
            ),
          ],
          [
            t("menu.workflows"),
            card.workflows.length === 0 ? (
              t("objectives.noWorkflow")
            ) : (
              <Stack key="workflows" gap={6}>
                {card.workflows.map((workflow) => (
                  <span key={workflow.id}>
                    <TextLink to={workflowHref(hubId, workflow.id)}>
                      {[workflow.code, workflow.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </TextLink>{" "}
                    {t("workflows.steps")}: {workflow.steps}
                  </span>
                ))}
              </Stack>
            ),
          ],
          ...(measuresOn
            ? [
                [
                  t("objectives.measure"),
                  <MeasureLines key="measure" measures={card.measures} />,
                ] as [string, ReactNode],
              ]
            : []),
        ]}
      />
    </Card>
  );
}

export function ObjectivesList({ hubId }: { hubId: string }) {
  const { t } = useI18n();
  const note = useArrivedNote();
  const { state } = useLoaded(() => loadObjectiveCards(hubId), [hubId]);
  const [search, setSearch] = useState("");

  const body = () => {
    if (state.kind === "loading") return null;
    if (state.kind === "failed")
      return <Empty text={t("loadFailed")} failed />;
    if (state.value.length === 0) return <Empty text={t("noRows")} />;
    const shown = byName(
      matching(state.value, (card) => [card.title, card.code], search),
      (card) => card.title,
    );
    return (
      <Stack gap={20}>
        <FilterBar
          placeholder={t("objectives.search")}
          chips={[]}
          search={search}
          onSearch={setSearch}
        />
        {shown.map((card) => (
          <ObjectiveCardView key={card.id} hubId={hubId} card={card} />
        ))}
      </Stack>
    );
  };

  return (
    <>
      <TitleRow
        title={t("menu.objectives")}
        primary={t("addObjective")}
        primaryTo={objectivesHref(hubId, { add: "objective" })}
      />
      <div className="content">
        {note.text ? (
          <StatusLine text={note.text} failed={note.failed} />
        ) : null}
        {body()}
      </div>
    </>
  );
}
