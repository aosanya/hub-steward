import type { ReactNode } from "react";
import { suggestedEndpoint } from "../../data/blockEndpoint";
import type { Block } from "../../data/scenario";
import type { RuleHeld, RunStepLine, StoredRows } from "../../data/testRun";
import { useI18n } from "../../i18n";
import { Cell, Chip, DataTable, SectionTitle, Stack } from "../../ui";
import { RuleChip } from "./RuleChip";

type Say = (key: string) => string;

const kindWord = (t: Say, kind: string): string => {
  const key = "workflows.kind." + kind;
  const word = t(key);
  return word === key ? kind : word;
};

export function ReportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Stack gap={10}>
      <SectionTitle title={title} />
      {children}
    </Stack>
  );
}

export function ReportBlocks({ blocks }: { blocks: Block[] }) {
  const { t } = useI18n();
  return (
    <DataTable
      columns={[
        "#",
        t("test.colActor"),
        t("test.colKind"),
        t("test.action"),
        t("test.colThen"),
        t("test.endpoint"),
      ]}
      rows={blocks.map((block, index) => ({
        key: block.stepId + ":" + index,
        cells: [
          String(index + 1),
          block.actor,
          block.kind ? (
            <Chip key="kind" kind="mute">
              {kindWord(t, block.kind)}
            </Chip>
          ) : (
            ""
          ),
          block.action,
          block.then,
          <span key="endpoint" className="muted">
            {block.endpoint || suggestedEndpoint(block)}
          </span>,
        ],
      }))}
      empty={t("noRows")}
    />
  );
}

export function ReportSteps({
  steps,
  blocks,
}: {
  steps: RunStepLine[];
  blocks: Block[];
}) {
  const { t, lang } = useI18n();
  const playedAs = (step: RunStepLine): string => {
    const kind = blocks.find((block) => block.stepId === step.stepId)?.kind;
    return [step.playedBy, kind ? kindWord(t, kind) : ""]
      .filter(Boolean)
      .join(" · ");
  };
  const recordedOf = (step: RunStepLine): ReactNode =>
    step.failed && (step.expected || step.found) ? (
      <>
        <div>{`${t("test.expected")}: ${step.expected}`}</div>
        <div>{`${t("test.found")}: ${step.found}`}</div>
      </>
    ) : (
      <div>{step.recorded}</div>
    );
  return (
    <DataTable
      columns={[
        t("test.colActor"),
        t("test.colDid"),
        t("test.colRecorded"),
        t("test.colStep"),
        t("test.colTokens"),
      ]}
      rows={steps.map((step, index) => ({
        key: step.stepId + ":" + index,
        cells: [
          <Cell key="actor" text={step.actor} sub={playedAs(step)} />,
          step.did,
          <Stack key="recorded" gap={4}>
            {recordedOf(step)}
            {step.rules.length > 0 ? (
              <div>
                {step.rules.map((rule) => (
                  <RuleChip key={rule.code} {...rule} />
                ))}
              </div>
            ) : null}
            {step.endpoint ? (
              <span className="muted">{`${t("test.endpoint")}: ${step.endpoint}`}</span>
            ) : null}
          </Stack>,
          <div key="step">
            <Cell text={step.step} />
            {step.failed ? (
              <Chip kind="bad">{t("test.result.failed")}</Chip>
            ) : null}
            {step.waited ? <Chip kind="mute">{t("test.waitActed")}</Chip> : null}
          </div>,
          step.tokens.toLocaleString(lang),
        ],
      }))}
      empty={t("noRows")}
    />
  );
}

export function ReportStored({ stored }: { stored: StoredRows[] }) {
  const { t, lang } = useI18n();
  return (
    <DataTable
      columns={[t("test.colRecord"), t("test.colHolds"), t("test.colRows")]}
      rows={stored.map((held) => ({
        key: held.record,
        cells: [
          <span key="record" className="count">
            {held.record}
          </span>,
          held.holds,
          held.rows.toLocaleString(lang),
        ],
      }))}
      empty={t("noRows")}
    />
  );
}

export function ReportRules({ rules }: { rules: RuleHeld[] }) {
  const { t } = useI18n();
  return (
    <DataTable
      columns={[t("test.colCode"), t("test.colRule"), t("test.colResult")]}
      rows={rules.map((rule) => ({
        key: rule.code,
        cells: [
          <span key="code" className="count">
            {rule.code}
          </span>,
          rule.text,
          <RuleChip key="result" code={rule.code} held={rule.held} />,
        ],
      }))}
      empty={t("noRows")}
    />
  );
}
