import type { ReactNode } from "react";
import { useI18n } from "../../i18n";
import { Card, Detail, Stack } from "../../ui";
import type { TestRun, TrailLine } from "../../data/testRun";
import { JsonView } from "./JsonView";

type Props = { run: TestRun };

export function DataTrail({ run }: Props) {
  const { t } = useI18n();
  const nameOf = (stepId: string) =>
    run.steps.find((step) => step.stepId === stepId)?.step ?? stepId;
  const stepIds = [...new Set(run.trail.map((line) => line.stepId))];
  const pairsOf = (line: TrailLine): [string, ReactNode][] => [
    [t("test.colModule"), line.module],
    [t("test.endpoint"), line.endpoint],
    [t("test.colLine"), <JsonView key="line" text={line.text} />],
  ];
  return (
    <Stack gap={16}>
      {stepIds.length === 0 ? (
        <span className="muted">{t("test.noTrail")}</span>
      ) : (
        stepIds.map((stepId) => (
          <Card key={stepId} title={nameOf(stepId)}>
            <Stack gap={16}>
              {run.trail
                .filter((line) => line.stepId === stepId)
                .map((line, index) => (
                  <Detail key={index} pairs={pairsOf(line)} />
                ))}
            </Stack>
          </Card>
        ))
      )}
      {run.stored.map((held) => (
        <Card key={held.record} title={`${t("test.holds")} · ${held.record}`}>
          <Stack gap={4}>
            <span className="muted">{held.holds}</span>
            <span className="count">{held.rows}</span>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
