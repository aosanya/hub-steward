import type { ReactNode } from "react";
import { hubPath } from "../../api";
import { useI18n } from "../../i18n";
import { Button, Chip, Detail, Row, Stack, TextLink } from "../../ui";
import type { RunStepLine } from "../../data/testRun";
import { JsonView } from "./JsonView";
import { RuleChip } from "./RuleChip";

type Props = {
  hubId: string;
  steps: RunStepLine[];
  busy: boolean;
  onRunAgain: () => void;
  onWhy: (index: number) => void;
};

export function RunSteps({ hubId, steps, busy, onRunAgain, onWhy }: Props) {
  const { t, lang } = useI18n();
  const pairsOf = (step: RunStepLine): [string, ReactNode][] => {
    const happened: [string, ReactNode][] =
      step.failed && (step.expected || step.found)
        ? [
            [t("test.expected"), step.expected],
            [t("test.found"), step.found],
          ]
        : [[t("test.colRecorded"), step.recorded]];
    return [
      [
        t("test.colActor"),
        step.playedBy ? `${step.actor} · ${step.playedBy}` : step.actor,
      ],
      [t("test.colDid"), step.did],
      ...happened,
      ...(step.endpoint
        ? ([[t("test.endpoint"), step.endpoint]] as [string, ReactNode][])
        : []),
      ...(step.sent
        ? ([[t("test.sent"), <JsonView key="sent" text={step.sent} />]] as [
            string,
            ReactNode,
          ][])
        : []),
      ...(step.answer
        ? ([
            [t("test.answered"), <JsonView key="answer" text={step.answer} />],
          ] as [string, ReactNode][])
        : []),
      ...step.trail.map((line, at): [string, ReactNode] => [
        line.endpoint || "·",
        <JsonView key={"trail" + at} text={line.text} />,
      ]),
      ...(step.rules.length > 0
        ? ([
            [
              "",
              <Row key="rules" gap={8}>
                {step.rules.map((rule) => (
                  <RuleChip key={rule.code} {...rule} />
                ))}
              </Row>,
            ],
          ] as [string, ReactNode][])
        : []),
      [t("test.colTokens"), step.tokens.toLocaleString(lang)],
    ];
  };
  if (steps.length === 0) return <span className="muted">{t("noRows")}</span>;
  return (
    <Stack gap={16}>
      {steps.map((step, index) => (
        <Detail
          key={step.stepId + ":" + index}
          title={
            <>
              {step.step}
              {step.failed ? (
                <>
                  {" "}
                  <Chip kind="bad">{t("test.result.failed")}</Chip>
                </>
              ) : null}
            </>
          }
          actions={
            step.failed ? (
              <Row gap={8}>
                <TextLink to={hubPath(hubId, "roles")} arrow size="sm">
                  {t("test.openRule")}
                </TextLink>
                <Button
                  kind="quiet"
                  size="sm"
                  disabled={busy}
                  onClick={onRunAgain}
                >
                  {t("test.runAgain")}
                </Button>
                <Button kind="quiet" size="sm" onClick={() => onWhy(index)}>
                  {t("test.why")}
                </Button>
              </Row>
            ) : undefined
          }
          pairs={pairsOf(step)}
        />
      ))}
    </Stack>
  );
}
