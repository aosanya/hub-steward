import { useState } from "react";
import { useI18n } from "../../i18n";
import type { FieldSpec } from "../../types";
import { Button, Card, Chip, DataTable, Field, Notice, Stack, Tile } from "../../ui";
import { runSample, type SampleClient, type SampleOutcome } from "./sampleRun";

export type TryItCardProps = {
  inputs: string[];
  initial?: Record<string, string>;
  client: SampleClient;
};

const specOf = (name: string): FieldSpec => ({ name, component: "text" });

export function TryItCard({ inputs, initial = {}, client }: TryItCardProps) {
  const { t } = useI18n();
  const [typed, setTyped] = useState<Record<string, string>>(initial);
  const [outcome, setOutcome] = useState<SampleOutcome | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setOutcome(await runSample(client, inputs, typed));
    setRunning(false);
  };

  const countText = (count: number) => (count === 1 ? t("calcstep.tryit.problemOne") : t("calcstep.tryit.problemMany").replace("{n}", String(count)));

  const tag =
    outcome?.kind === "worked" ? (
      <Chip kind="ok">{t("calcstep.tryit.worked")}</Chip>
    ) : outcome?.kind === "problems" ? (
      <Chip kind="bad">{countText(outcome.rows.length)}</Chip>
    ) : undefined;

  return (
    <Card title={t("calcstep.tryit.title")} actions={tag}>
      <Stack gap={12}>
        {inputs.map((name) => (
          <Field key={name} spec={specOf(name)} value={typed[name] ?? ""} onChange={(value) => setTyped({ ...typed, [name]: String(value) })} />
        ))}
      </Stack>
      <div className="form-foot">
        <Button kind="quiet" size="sm" disabled={running} onClick={run}>
          {t("calcstep.tryit.run")}
        </Button>
      </div>
      {outcome?.kind === "worked" ? (
        <>
          <Tile label={outcome.label} value={outcome.value} />
          <span className="hint">{t("calcstep.tryit.how").replace("{function}", outcome.function).replace("{rounding}", outcome.rounding)}</span>
        </>
      ) : null}
      {outcome?.kind === "problems" ? (
        <>
          <Tile label={t("calcstep.tryit.nothing")} value={countText(outcome.rows.length)} state="bad" />
          <span className="hint">{t("calcstep.tryit.allAtOnce")}</span>
          <DataTable
            className="mini"
            empty=""
            columns={[t("calcstep.tryit.input"), t("calcstep.tryit.received"), t("calcstep.tryit.problem")]}
            rows={outcome.rows.map((row, i) => ({
              key: `${i}-${row.input}`,
              cells: [
                <span className="cell-name">{row.input}</span>,
                <span className="count">{row.received ?? t("calcstep.tryit.nothingReceived")}</span>,
                row.sentence,
              ],
            }))}
          />
        </>
      ) : null}
      {outcome?.kind === "failed" ? <Notice kind="bad" text={t("calcstep.tryit.failed")} onDismiss={() => setOutcome(null)} /> : null}
    </Card>
  );
}
